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

const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const plain = (value: unknown): value is string => typeof value === "string" && !!value.trim() && !/[\u0000-\u001f]/.test(value);

export function parseWorkflowRegistry(value: unknown): { schemaVersion: 1; workflows: Workflow[] } {
  const registry = value as { schemaVersion?: unknown; workflows?: unknown };
  if (!registry || typeof registry !== "object" || Array.isArray(registry) || registry.schemaVersion !== 1 || !Array.isArray(registry.workflows) || !registry.workflows.length) throw new Error("Malformed workflow registry");
  const ids = new Set<string>();
  const workflows: Workflow[] = [];
  for (const item of registry.workflows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error("Invalid or duplicate workflow");
    const workflow = item as Partial<Workflow>;
    if (typeof workflow.id !== "string" || !slug.test(workflow.id) || ids.has(workflow.id) || !plain(workflow.protocol) || !plain(workflow.title) || typeof workflow.skill !== "string" || !slug.test(workflow.skill) || typeof workflow.pack !== "string" || !slug.test(workflow.pack) || !Array.isArray(workflow.inputs) || !workflow.inputs.length || workflow.inputs.some(input => !plain(input)) || !plain(workflow.output) || !plain(workflow.access)) throw new Error("Invalid or duplicate workflow");
    ids.add(workflow.id);
    workflows.push({ id: workflow.id, protocol: workflow.protocol, title: workflow.title, skill: workflow.skill, pack: workflow.pack, inputs: [...workflow.inputs], output: workflow.output, access: workflow.access });
  }
  return { schemaVersion: 1, workflows };
}

export const workflows: readonly Workflow[] = parseWorkflowRegistry(registry).workflows;

export function workflowMatchesProtocol(workflow: Workflow, protocol: string): boolean {
  const wanted = protocol.trim().toLowerCase();
  if (!wanted) return false;
  return [workflow.protocol, ...workflow.protocol.split(" / ")].some(name => name.trim().toLowerCase() === wanted);
}

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
  Install: boomkin onboard --workflow ${workflow.id}
  Start with: Use ${workflow.skill}. ${workflow.title}. Ask for missing inputs and return the supported evidence before proposing any wallet action.`;
}
