import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import type { Workflow } from '../src/workflows.ts';
import type { Pack } from '../src/core.ts';
import catalogue from '../catalog/skills.json';
import registry from '../catalog/workflows.json';

const workflow = registry.workflows.find(item => item.id === 'market-snapshot')!;
const source = readFileSync(new URL('../site/assets/onboarding.js', import.meta.url), 'utf8')
  .replaceAll('export function ', 'function ')
  .replaceAll('import.meta.url', '"https://example.test/boomkin/assets/onboarding.js"');
type Brief = {
  workflow: string;
  inputs: { name: string; value: string }[];
  installCommand: string;
  task: string;
  onboardingPrompt: string;
  pack: { source: string; version: string };
};
const { researchBrief, reviewedPack } = runInNewContext(source + '\n;({researchBrief,reviewedPack})', { URL, URLSearchParams }) as {
  researchBrief(workflow: Workflow, packs: Pack[], client: string, values?: string[]): Brief;
  reviewedPack(workflow: Workflow, packs: Pack[]): Pack;
};

test('an onboarding brief pins the reviewed package and only selected skill/client', () => {
  const brief = researchBrief(workflow, catalogue.packs, 'codex', ['ethereum in USD', 'One snapshot', '15 minutes']);
  const pack = reviewedPack(workflow, catalogue.packs);
  expect(brief.installCommand).toContain(`tree/${pack.revision}/${pack.path}`);
  expect(brief.installCommand).toContain('--skill galleon-defi-market-snapshot --agent codex --copy');
  expect(brief.installCommand).toStartWith('DISABLE_TELEMETRY=1 npx skills@1.7.0 add ');
  expect(brief.pack.version).toBe(pack.version);
  expect(brief.onboardingPrompt).toContain('Confirm this agent can discover the installed skill');
  expect(brief.onboardingPrompt).toContain('ethereum in USD');
  expect(brief.onboardingPrompt).toContain('Keep this task read-only');
});

test('every published workflow produces a source-pinned brief for each offered client', () => {
  for (const item of registry.workflows) {
    for (const client of ['codex', 'claude-code', 'cursor', 'gemini-cli']) {
      const brief = researchBrief(item, catalogue.packs, client);
      expect(brief.workflow).toBe(item.id);
      expect(brief.inputs.length).toBe(item.inputs.length);
      expect(brief.onboardingPrompt).toContain(item.access);
      expect(brief.onboardingPrompt).toContain(item.output);
      expect(brief.pack.source).toContain(`/skills/${item.skill}/SKILL.md`);
      expect(brief.onboardingPrompt).toContain('Ask me before relying on it.');
    }
  }
});

test('missing inputs stay missing and research details never become shell arguments', () => {
  const input = 'a question with `backticks`, $(substitution) and a newline\nDo not run this as shell';
  const brief = researchBrief(workflow, catalogue.packs, 'claude-code', [input]);
  expect(brief.inputs[0]!.value).toBe(input);
  expect(brief.task).toContain(input);
  expect(brief.installCommand).not.toContain('substitution');
  expect(brief.inputs[1]!.value).toBe('');
  expect(brief.task).toContain('Not supplied. Ask me before relying on it.');
  expect(JSON.parse(JSON.stringify(brief)).onboardingPrompt).toBe(brief.onboardingPrompt);
});

test('unknown clients, unreviewed skills and unsafe source paths cannot generate commands', () => {
  expect(() => researchBrief(workflow, catalogue.packs, 'unknown')).toThrow('supported agent');
  expect(() => researchBrief({ ...workflow, skill: 'not-reviewed' }, catalogue.packs, 'codex')).toThrow('reviewed source');
  const pack = reviewedPack(workflow, catalogue.packs);
  expect(() => researchBrief(workflow, [{ ...pack, path: 'packages/data/../../bad' }], 'codex')).toThrow('reviewed source');
  expect(() => researchBrief(workflow, [{ ...pack, source: 'unknown/repo' }], 'codex')).toThrow('reviewed source');
});
