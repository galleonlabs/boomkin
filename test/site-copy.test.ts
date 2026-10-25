import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import type {Workflow} from '../src/workflows.ts';
import type {Pack} from '../src/core.ts';

interface CatalogHelpers {
  filterWorkflows(workflows: Pick<Workflow, 'id'|'protocol'|'title'|'skill'|'output'>[], query: string): Workflow[];
  initialWorkflowId(workflows: Pick<Workflow, 'id'>[], search: string): string | undefined;
  skillSource(workflow: Pick<Workflow, 'id'|'pack'|'skill'>, packs: Pick<Pack, 'id'|'source'|'revision'|'path'|'skills'>[]): string;
}

const source = readFileSync(new URL('../site/assets/app.js', import.meta.url), 'utf8')
  .replace('import.meta.url', '"https://example.test/boomkin/assets/app.js"')
  .replaceAll('export function ', 'function ');

function fixture(clipboard?: {writeText: (text: string) => Promise<void>}) {
  const label = {textContent:'Copy'};
  class Button {
    disabled = false;
    dataset = {copyTarget:'doc-code-1'};
    closest() { return this; }
    hasAttribute() { return true; }
    querySelector() { return label; }
  }
  const button = new Button();
  const code = {textContent:'  echo "&amp; <tag>"\n\n'};
  const toast = {textContent:'', classList:{add() {},remove() {}}};
  let click!: (event: {target: Button}) => Promise<void>;
  const helpers = runInNewContext(source + '\n;({filterWorkflows,initialWorkflowId,skillSource})', {
    URL, URLSearchParams, Element:Button, navigator:{clipboard}, setTimeout() {}, clearTimeout() {},
    document:{
      getElementById(id: string) { return id === 'doc-code-1' ? code : id === 'toast' ? toast : null; },
      querySelectorAll() { return []; },
      addEventListener(_type: string, handler: typeof click) { click = handler; },
    },
  }) as CatalogHelpers;
  return {button, code, label, toast, helpers, click:() => click({target:button})};
}

test('docs clipboard writes exact code, waits for success and blocks repeat clicks', async () => {
  let resolve!: () => void;
  const writes: string[] = [];
  const page = fixture({writeText(text) { writes.push(text); return new Promise(done => {resolve = done;}); }});
  const pending = page.click();
  expect(writes).toEqual([page.code.textContent]);
  expect(page.button.disabled).toBe(true);
  expect(page.label.textContent).toBe('Copying');
  expect(page.toast.textContent).toBe('');
  await page.click();
  expect(writes.length).toBe(1);
  resolve();
  await pending;
  expect(page.toast.textContent).toBe('Copied to clipboard');
  expect(page.button.disabled).toBe(false);
  expect(page.label.textContent).toBe('Copy');
});

for (const [reason, clipboard] of [
  ['denied', {writeText:async () => {throw new Error('denied');}}],
  ['unavailable', undefined],
] as const) {
  test(`clipboard ${reason} keeps code visible and gives a manual copy fallback`, async () => {
    const page = fixture(clipboard);
    await page.click();
    expect(page.toast.textContent).toBe('Could not copy. Select the code and copy it from the page.');
    expect(page.button.disabled).toBe(false);
    expect(page.label.textContent).toBe('Copy');
    expect(page.code.textContent).toBe('  echo "&amp; <tag>"\n\n');
  });
}


test('workflow discovery supports protocol plus task terms and exact skill names', () => {
  const {helpers} = fixture();
  const workflows = [
    {id:'aave-health',protocol:'Aave',title:'Stress-test a position',skill:'galleon-aave-position',output:'Health factor and evidence'},
    {id:'lido-exit',protocol:'Lido',title:'Track a withdrawal',skill:'galleon-lido-withdrawals',output:'Claimability evidence'},
  ];
  expect(helpers.filterWorkflows(workflows, ' AAVE   position ').map((item: {id:string}) => item.id)).toEqual(['aave-health']);
  expect(helpers.filterWorkflows(workflows, 'galleon-lido-withdrawals').map((item: {id:string}) => item.id)).toEqual(['lido-exit']);
  expect(helpers.filterWorkflows(workflows, 'aave withdrawal')).toEqual([]);
  expect(helpers.initialWorkflowId(workflows, '?workflow=lido-exit')).toBe('lido-exit');
  expect(helpers.initialWorkflowId(workflows, '?workflow=unknown')).toBe('aave-health');
});

test('skill links retain the reviewed source revision and reject unavailable workflows', () => {
  const {helpers} = fixture();
  const workflow = {id:'aave-health',pack:'defi-lending-skills',skill:'galleon-aave-position'};
  const packs = [{id:'defi-lending-skills',source:'galleonlabs/crypto-defi-skills',revision:'a'.repeat(40),path:'packages/lending',skills:['galleon-aave-position']}];
  expect(helpers.skillSource(workflow,packs)).toBe(`https://github.com/galleonlabs/crypto-defi-skills/blob/${'a'.repeat(40)}/packages/lending/skills/galleon-aave-position/SKILL.md`);
  expect(() => helpers.skillSource({...workflow,skill:'invented'},packs)).toThrow('no reviewed skill');
});
