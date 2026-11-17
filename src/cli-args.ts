import { parseArgs } from "node:util";

// The argument contract lives apart from dispatch so documentation examples can be checked against it.
export const cliOptions = {
  name: { type: "string" }, "input-file": { type: "string" }, objective: { type: "string" }, "max-turns": { type: "string" }, "run-id": { type: "string" }, template: { type: "string" },
  version: { type: "boolean", short: "v" }, action: { type: "string" }, workflow: { type: "string" }, protocol: { type: "string" }, json: { type: "boolean" }, port: { type: "string" }, "no-open": { type: "boolean" },
  search: { type: "string" }, capability: { type: "string" }, access: { type: "string" },
  "key-file": { type: "string" }, provider: { type: "string" }, live: { type: "boolean" }, "all-packs": { type: "boolean" }, "skip-model-setup": { type: "boolean" }, "no-install": { type: "boolean" }, pack: { type: "string", multiple: true }, harness: { type: "string" }, directory: { type: "string" }, "dry-run": { type: "boolean" }, "offline-catalog": { type: "boolean" }, help: { type: "boolean", short: "h" },
} as const;
export const commands = ["desk", "project", "templates", "workflows", "providers", "onboard", "doctor", "start", "connect", "model", "chatgpt", "harnesses", "catalog", "setup", "update", "check", "status"] as const;

export function parseCli(args: string[]) {
  const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: cliOptions });
  return { values, positionals, command: positionals[0] ?? "help" };
}
export type CliValues = ReturnType<typeof parseCli>["values"];

/** Reject option and command combinations before any command reads a profile or the network. */
export function checkUsage(values: CliValues, positionals: string[]): void {
  const command = positionals[0] ?? "help";
  if ((values.port !== undefined || values["no-open"]) && command !== "desk") throw new Error("--port and --no-open are only available for desk");
  if (values.action && command !== "chatgpt") throw new Error("--action is only available for chatgpt");
  if (positionals.length > (command === "project" ? 2 : 1)) throw new Error("Unexpected positional arguments");
  if (values.workflow !== undefined && !["workflows", "onboard", "project"].includes(command)) throw new Error("--workflow is available for workflows, onboard and project create");
  if (values.protocol !== undefined && command !== "workflows" || values.json && !["workflows", "project", "providers", "templates"].includes(command)) throw new Error("--protocol is available for workflows; --json for workflows, providers, templates and project");
  if (values.template !== undefined && !["templates", "project"].includes(command)) throw new Error("--template is available for templates and project create");
  if (values.template !== undefined && values.workflow !== undefined) throw new Error("Choose --template or --workflow separately");
  if ([values.search, values.capability, values.access].some(value => value !== undefined) && command !== "providers") throw new Error("--search, --capability and --access are only available for providers");
  if ([values.name, values["input-file"], values.objective, values["max-turns"], values["run-id"]].some(value => value !== undefined) && command !== "project") throw new Error("Project options are only available for project");
  if (values.workflow !== undefined && (values.pack || values["all-packs"] || values.protocol !== undefined)) throw new Error("Choose --workflow, --protocol, --pack or --all-packs separately");
  if (values["key-file"] && (command !== "connect" || values.provider !== "coinbase")) throw new Error("--key-file is only available for connect --provider coinbase");
  if (values.provider !== undefined && !["connect", "providers"].includes(command)) throw new Error("--provider is only available for connect and providers");
  if (values.live && command !== "doctor") throw new Error("--live is only available for doctor");
  if ((values["all-packs"] || values["skip-model-setup"] || values["no-install"]) && command !== "onboard") throw new Error("Onboarding options are only available for onboard");
  if (values["dry-run"] && !["desk", "onboard", "setup", "update", "connect", "start", "model", "chatgpt", "project"].includes(command)) throw new Error("--dry-run is unavailable for this read-only command");
  if (values["offline-catalog"] && !["check", "update", "setup", "onboard"].includes(command)) throw new Error("--offline-catalog is available for setup, onboard, check and update");
  if ((command === "harnesses" || command === "catalog") && (values.pack || values.harness || values.directory)) throw new Error(`${command} does not accept profile, harness or pack options`);
  if (command === "project") {
    const action = positionals[1];
    if (!action || !["create", "list", "show", "run", "check"].includes(action)) throw new Error("Choose project create, list, show, run or check");
    if (values.pack || values.harness) throw new Error("Project commands use the selected Hermes profile; pack options belong to onboard");
    if (action !== "create" && [values.workflow, values.template, values["input-file"], values.objective].some(value => value !== undefined)) throw new Error("--workflow, --template, --input-file and --objective are only available for project create");
    if (action !== "run" && values["max-turns"] !== undefined) throw new Error("--max-turns is only available for project run");
    if (action !== "check" && values["run-id"] !== undefined) throw new Error("--run-id is only available for project check");
    if (values["dry-run"] && !["create", "run"].includes(action)) throw new Error("--dry-run is available for project create and run");
    if (action === "run" && values.json && !values["dry-run"]) throw new Error("Live project run streams native Hermes output. Use --dry-run --json to preview, or project show/project check for saved JSON results");
  }
  if (!(commands as readonly string[]).includes(command)) throw new Error(`Unknown command: ${command}`);
}
