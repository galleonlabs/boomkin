import {expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const source = readFileSync(new URL('../site/assets/app.js', import.meta.url), 'utf8')
  .replace('import.meta.url', '"https://example.test/boomkin/assets/app.js"')
  .replace('export function toast', 'function toast');

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
  runInNewContext(source, {
    URL, Element:Button, navigator:{clipboard}, setTimeout() {}, clearTimeout() {},
    document:{
      getElementById(id: string) { return id === 'doc-code-1' ? code : id === 'toast' ? toast : null; },
      querySelectorAll() { return []; },
      addEventListener(_type: string, handler: typeof click) { click = handler; },
    },
  });
  return {button, code, label, toast, click:() => click({target:button})};
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
