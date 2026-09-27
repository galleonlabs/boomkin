import registry from "../catalog/workflows.json";
import type { Catalog } from "./core.ts";

export interface Workflow {
  id: string;
  protocol: string;
  title: string;
  skill: string;
  pack: string;
  inputs: string[];
  output: string;
  access: string;
}

export const workflows: readonly Workflow[] = registry.workflows;

export function selectWorkflow(id: string): Workflow {
  const workflow = workflows.find(item => item.id === id);
  if (!workflow) throw new Error(`Unknown workflow: ${id}. Run workflows to list available tasks.`);
  return workflow;
}

export function workflowPacks(id: string, catalog: Catalog): string[] {
  const workflow = selectWorkflow(id);
  if (!catalog.packs.some(pack => pack.id === workflow.pack && pack.skills.includes(workflow.skill))) {
    throw new Error(`Workflow ${id} is unavailable in this catalog. Update Boomkin before installing it.`);
  }
  return [workflow.pack];
}

export function renderWorkflow(workflow: Workflow): string {
  return `${workflow.id}: ${workflow.title}
  Skill: ${workflow.skill}
  Inputs: ${workflow.inputs.join("; ")}
  Result: ${workflow.output}
  Access: ${workflow.access}
  Install: bun run boomkin onboard --workflow ${workflow.id}
  Start with: Use ${workflow.skill}. ${workflow.title}. Ask for missing inputs and return the supported evidence before proposing any wallet action.`;
}
