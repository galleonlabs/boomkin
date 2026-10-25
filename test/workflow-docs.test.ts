import {expect, test} from 'bun:test';
import {readFile} from 'node:fs/promises';
import catalog from '../catalog/skills.json';
import {workflows} from '../src/workflows.ts';
import {renderWorkflowDocs} from '../scripts/workflow-docs.ts';

test('published workflow guide matches current tasks and immutable skill sources', async () => {
  const expected = renderWorkflowDocs(workflows, catalog.packs);
  expect(await readFile(new URL('../docs/WORKFLOWS.md', import.meta.url), 'utf8')).toBe(expected);
  expect(expected).toContain('## Agent tools and unsigned transactions');
  expect(expected).toContain('id="public-wallet-diagnostics"');
  expect(expected).toContain('id="hyperliquid-research-and-trade-review"');
  expect(expected).toContain('id="frozen-strategy-validation"');
});
