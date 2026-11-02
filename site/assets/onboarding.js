const clients = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
  cursor: 'Cursor',
  'gemini-cli': 'Gemini CLI',
};

export function reviewedPack(workflow, packs) {
  const pack = packs.find(item => item.id === workflow.pack && item.skills.includes(workflow.skill));
  if (!pack || pack.source !== 'galleonlabs/crypto-defi-skills' || !/^[a-f0-9]{40}$/.test(pack.revision)
    || !/^packages\/[a-z0-9-]+$/.test(pack.path) || !/^[a-z0-9-]+$/.test(workflow.skill)) {
    throw new Error('No reviewed source for this workflow.');
  }
  return pack;
}

export function researchBrief(workflow, packs, client, values = []) {
  if (!Object.hasOwn(clients, client)) throw new Error('Choose a supported agent.');
  const pack = reviewedPack(workflow, packs);
  const packageUrl = `https://github.com/${pack.source}/tree/${pack.revision}/${pack.path}`;
  const source = `https://github.com/${pack.source}/blob/${pack.revision}/${pack.path}/skills/${workflow.skill}/SKILL.md`;
  const command = `DISABLE_TELEMETRY=1 npx skills@1.7.0 add ${packageUrl} --skill ${workflow.skill} --agent ${client} --copy`;
  const inputs = workflow.inputs.map((name, index) => ({ name, value: String(values[index] ?? '').trim() }));
  const task = [
    `Use ${workflow.skill} for this research task: ${workflow.title}.`,
    ...inputs.map(input => `${input.name}: ${input.value || 'Not supplied. Ask me before relying on it.'}`),
    `Return: ${workflow.output}`,
    `Access requirements: ${workflow.access}`,
    'Keep this task read-only and any proposed financial action unsigned. Do not connect a wallet, submit a transaction, grant spending access or start a paid service.',
    'Show source URLs, observation and retrieval times, units and missing or stale coverage. If access or inputs are missing, explain what is needed instead of inventing a result.',
  ].join('\n\n');
  const prompt = [
    `Prepare this Boomkin research workflow in the current project for ${clients[client]}.`,
    `Reviewed source: ${source}`,
    `Skill pack: ${pack.package}@${pack.version}, commit ${pack.revision}.`,
    `If this exact skill is not installed, inspect the source and use:\n${command}`,
    'Preserve my existing instructions and unrelated skills. Confirm this agent can discover the installed skill before starting. Installation alone is not a completed research result.',
    task,
  ].join('\n\n');
  return {
    schemaVersion: 1,
    kind: 'boomkin-agent-research-brief',
    workflow: workflow.id,
    client,
    skill: workflow.skill,
    pack: { name: pack.package, version: pack.version, revision: pack.revision, source },
    inputs,
    installCommand: command,
    task,
    onboardingPrompt: prompt,
  };
}

async function initOnboarding() {
  const container = document.getElementById('agent-builder-content');
  if (!container) return;
  const node = id => document.getElementById(id);
  const status = node('agent-builder-status');
  try {
    const response = await fetch(new URL('catalog.json', import.meta.url));
    if (!response.ok) throw new Error('catalog_unavailable');
    const data = await response.json();
    // Validate every choice before presenting a command from the catalogue.
    for (const workflow of data.workflows) reviewedPack(workflow, data.packs);
    if (!data.workflows.length) throw new Error('empty_catalog');
    const taskSelect = node('agent-workflow');
    const groups = new Map();
    for (const workflow of data.workflows) {
      if (!groups.has(workflow.protocol)) {
        const group = document.createElement('optgroup');
        group.label = workflow.protocol;
        groups.set(workflow.protocol, group);
        taskSelect.append(group);
      }
      const option = document.createElement('option');
      option.value = workflow.id;
      option.textContent = workflow.title;
      groups.get(workflow.protocol).append(option);
    }
    const requested = new URLSearchParams(location.search).get('workflow');
    taskSelect.value = data.workflows.find(item => item.id === requested)?.id
      ?? data.workflows.find(item => item.id === 'market-snapshot')?.id ?? data.workflows[0].id;
    const valuesByWorkflow = new Map([['market-snapshot', [
      'ethereum; quote currency USD',
      'One current snapshot, with at most 10 observations',
      'Maximum age 15 minutes; report stale or unavailable fields',
    ]]]);
    let brief;
    const selected = () => data.workflows.find(item => item.id === taskSelect.value);
    function updateOutput() {
      const workflow = selected();
      brief = researchBrief(workflow, data.packs, node('agent-client').value, valuesByWorkflow.get(workflow.id));
      node('agent-task-title').textContent = workflow.title;
      node('agent-outcome').textContent = workflow.output;
      node('agent-access').textContent = workflow.access;
      node('agent-command').textContent = brief.installCommand;
      node('agent-prompt').textContent = brief.onboardingPrompt;
      node('agent-source').href = brief.pack.source;
      node('agent-pack').textContent = `${brief.pack.name} v${brief.pack.version}`;
    }
    function chooseTask() {
      const workflow = selected();
      const values = valuesByWorkflow.get(workflow.id) ?? [];
      const fields = node('agent-inputs');
      fields.replaceChildren();
      workflow.inputs.forEach((input, index) => {
        const label = document.createElement('label');
        label.textContent = input;
        const field = document.createElement('textarea');
        field.rows = 2;
        field.maxLength = 1500;
        field.value = values[index] ?? '';
        field.placeholder = 'Add what you know; your agent can ask for the rest';
        field.addEventListener('input', () => {
          const updated = [...(valuesByWorkflow.get(workflow.id) ?? [])];
          updated[index] = field.value;
          valuesByWorkflow.set(workflow.id, updated);
          updateOutput();
        });
        label.append(field);
        fields.append(label);
      });
      updateOutput();
    }
    taskSelect.addEventListener('change', chooseTask);
    node('agent-client').addEventListener('change', updateOutput);
    document.addEventListener('click', event => {
      const link = event.target instanceof Element ? event.target.closest('[data-agent-workflow]') : null;
      if (!link || !data.workflows.some(item => item.id === link.dataset.agentWorkflow)) return;
      taskSelect.value = link.dataset.agentWorkflow;
      chooseTask();
    });
    node('agent-download').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(brief, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `boomkin-${brief.workflow}-brief.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    chooseTask();
    status.hidden = true;
    container.hidden = false;
  } catch {
    status.textContent = 'The reviewed catalogue could not load. Use the workflow guide below, or reload to try again.';
    const fallback = document.createElement('a');
    fallback.href = new URL('../docs/workflows/', import.meta.url).href;
    fallback.textContent = 'Read the workflow guide';
    fallback.className = 'text-link';
    status.after(fallback);
  }
}

if (typeof document !== 'undefined') initOnboarding();
