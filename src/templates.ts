import registry from "../catalog/templates.json";
import { parseInputs, type Project } from "./projects.ts";
import { selectWorkflow } from "./workflows.ts";

export interface ProjectTemplate {
  id: string;
  title: string;
  workflow: string;
  description: string;
  defaults: Project["inputs"];
  requiredInputs: string[];
  exampleInputs: Project["inputs"];
}

export const templates = registry.templates as unknown as readonly ProjectTemplate[];

export function selectTemplate(id: string): ProjectTemplate {
  const template = templates.find(item => item.id === id);
  if (!template) throw new Error(`Unknown template: ${id}. Run templates to list available starting points.`);
  selectWorkflow(template.workflow);
  return template;
}

export function templateInputs(id: string, supplied: unknown): Project["inputs"] {
  const template = selectTemplate(id);
  const inputs = parseInputs({ ...template.defaults, ...parseInputs(supplied) });
  for (const key of template.requiredInputs) {
    const value = inputs[key];
    if (value === undefined || value === null || typeof template.exampleInputs[key] === "string" && typeof value !== "string" || Array.isArray(template.exampleInputs[key]) && !Array.isArray(value) || typeof value === "string" && (!value.trim() || /YOUR_|\/absolute\/path\/to\//.test(value)) || Array.isArray(value) && (!value.length || value.some(item => typeof item !== "string" || !item.trim() || /YOUR_/.test(item)))) {
      throw new Error(`Template ${id} requires your ${key}; replace the example placeholders in the input file.`);
    }
  }
  return inputs;
}

export function renderTemplate(template: ProjectTemplate): string {
  return `${template.id}: ${template.title}
  ${template.description}
  Workflow: ${template.workflow}
  Supply: ${template.requiredInputs.join(", ")}
  Example input (replace placeholders): ${JSON.stringify({ ...template.defaults, ...template.exampleInputs })}
  Create: boomkin project create --name my-research --template ${template.id} --input-file ./inputs.json
  Preview: boomkin project run --name my-research --dry-run
  Install: boomkin onboard --workflow ${template.workflow}
  Creation and preview make no model or data call. Live runs use your configured model and tools.`;
}
