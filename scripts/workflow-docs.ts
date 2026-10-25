import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import catalog from '../catalog/skills.json';
import {workflows, type Workflow} from '../src/workflows.ts';
import type {Pack} from '../src/core.ts';

const destination = resolve(import.meta.dir, '../docs/WORKFLOWS.md');
const cell = (text: string) => text.replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');
const legacyAnchors: Record<string, string> = {
  'hyperliquid-wallet-audit': 'public-wallet-diagnostics',
  'strategy-validation': 'frozen-strategy-validation',
  'hyperliquid-market': 'hyperliquid-research-and-trade-review',
};

export function renderWorkflowDocs(entries: readonly Workflow[], packs: readonly Pack[]): string {
  const rows = entries.map(workflow => {
    const pack = packs.find(pack => pack.id === workflow.pack);
    if (!pack) throw new Error(`Workflow has no pack: ${workflow.id}`);
    const source = `https://github.com/${pack.source}/blob/${pack.revision}/${pack.path}/skills/${workflow.skill}/SKILL.md`;
    const anchors = [slug(workflow.title), legacyAnchors[workflow.id]].filter(Boolean).map(id => `<a id="${id}"></a>`).join('');
    const explorer = `https://galleonlabs.github.io/boomkin/?workflow=${workflow.id}#workflows`;
    return `| ${cell(workflow.protocol)} | ${anchors}${cell(workflow.title)}<br>[\`${workflow.id}\`](${explorer}) | [\`${workflow.skill}\`](${source}) |`;
  });
  return `# Protocol workflows

**${entries.length} jobs with actual installable skills.** Choose a protocol or task below. Each linked \`SKILL.md\` contains the procedure reviewed by Boomkin: required reads, decisions, calculations, failure handling and completion evidence.

## Inspect before installing

\`\`\`bash
boomkin workflows --protocol Aave
boomkin workflows --workflow aave-health
boomkin onboard --workflow aave-health --dry-run
\`\`\`

Discovery and preview run locally. The single-workflow command shows its full inputs, expected output, access requirements, skill ID and starting prompt. Onboarding installs the selected skill's complete pack; use a separate \`--directory\` for an isolated profile. From source, use \`bun run boomkin\` in place of \`boomkin\`.

The [interactive explorer](https://galleonlabs.github.io/boomkin/#workflows) searches protocol, task and exact skill names. It offers an individual skill install command for agents you already use, plus a link to share the selected workflow. Direct skill installs follow the library's current \`main\`; links in this table identify the immutable release reviewed by Boomkin.

## Find the procedure

| Protocol | Workflow and task ID | Installable skill |
| --- | --- | --- |
${rows.join('\n')}

## Agent tools and unsigned transactions

Use \`boomkin workflows --workflow unsigned-plan\` for deterministic unsigned payload construction and \`boomkin workflows --workflow transaction-simulation\` for exact-payload simulation evidence. Neither grants signing, submission or spending authority. Provider access and the actual deployment must match the task.

## Cross-protocol tasks

Broad primitive skills remain useful for comparison, portfolio reconciliation, security and work spanning venues. For a named protocol, start with its specific skill. The [skill library](https://github.com/galleonlabs/crypto-defi-skills) lists all packs and procedures; Boomkin's catalog installs only reviewed releases.

Use [saved projects](PROJECTS.md) to retain inputs, source evidence and successive reports. Creating a project or preview makes no model call. A live project run explicitly uses native Hermes and the selected model/tools; provider usage may incur costs. Installation, data access, simulation and verified settlement remain distinct outcomes.

This guide is generated from [catalog/workflows.json](../catalog/workflows.json) and [catalog/skills.json](../catalog/skills.json). After editing a catalog, run \`bun scripts/workflow-docs.ts --write\`; the website build rejects stale documentation.
`;
}

export async function checkWorkflowDocs(): Promise<void> {
  if (await readFile(destination, 'utf8') !== renderWorkflowDocs(workflows, catalog.packs)) {
    throw new Error('Workflow documentation is stale. Run bun scripts/workflow-docs.ts --write');
  }
}

if (import.meta.main) {
  if (process.argv.includes('--write')) {
    await writeFile(destination, renderWorkflowDocs(workflows, catalog.packs));
    console.log(`Wrote ${workflows.length} workflows to docs/WORKFLOWS.md`);
  } else {
    await checkWorkflowDocs();
    console.log('Workflow documentation matches the catalogs');
  }
}
