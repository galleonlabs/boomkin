#!/usr/bin/env bun
import { mkdir, readFile, writeFile, rename, rm, realpath, mkdtemp } from "node:fs/promises";
import { resolve, join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import catalogFile from "../catalog/skills.json";
import packageFile from "../package.json";
import { harnesses, parseCatalog, parseHarness, parseConfig, installArgs, identity, fetchCatalog, catalogChanges, installedVersion, selectPacks, compatibilitySetupMessage, type Catalog, type Config } from "./core.ts";

import { tmpdir } from "node:os";
import { checkoutPack, packageDirectory } from "./source.ts";
import { defaultProfile, prepareHermes, connectProvider, doctor } from "./onboarding.ts";
import { providerCatalog, selectProvider, filterProviders, renderProvider } from "./provider-catalog.ts";
import { runHermes, runChatGpt, type ChatGptAction } from "./hermes.ts";
import { verifyCopiedSkill, verifyIntegrity, readIntegrity, type SkillIntegrity } from "./integrity.ts";
import { workflows, selectWorkflow, workflowPacks, renderWorkflow } from "./workflows.ts";
import { createProject, listProjects, readProject, projectRuns, runProject, checkProjectRun } from "./projects.ts";
import { templates, selectTemplate, templateInputs, renderTemplate } from "./templates.ts";

const help = `Boomkin — your Hermes DeFi agent.

boomkin onboard
boomkin doctor --live
boomkin start
boomkin providers
boomkin providers --search simulation --json
boomkin providers --access keyless
boomkin providers --provider blockscout
boomkin workflows
boomkin workflows --workflow aave-health
boomkin templates
boomkin templates --template wallet-audit --json
boomkin project create --name wallet-review --template wallet-audit --input-file ./inputs.json
boomkin project create --name my-research --workflow yield-screen --input-file ./inputs.json
boomkin project run --name my-research --dry-run
boomkin project run --name my-research
boomkin project check --name my-research
boomkin project list
boomkin onboard --workflow yield-screen
boomkin connect --provider alchemy
boomkin connect --provider tenderly
boomkin connect --provider blockscout
boomkin model
boomkin chatgpt --action login
boomkin chatgpt --action status
boomkin check --directory ~/.boomkin/hermes
boomkin update --directory ~/.boomkin/hermes

onboard installs the official Hermes runtime if needed, prepares an isolated profile,
installs the selected Galleon skill packs and public CoinGecko MCP, then runs native model setup.
--directory chooses the Hermes home (default ~/.boomkin/hermes for the commands above).
--skip-model-setup prepares files without an interactive model login.
--no-install uses an existing Hermes executable. --dry-run previews without writes.
--all-packs opts an existing onboarding profile into every pack in the current catalog.
--workflow chooses one task's pack for onboarding; updates keep that selection.
workflows lists inputs, concrete results and access requirements; --json emits structured data.
templates lists reviewed starting points; --template inspects the required inputs and example.
project create accepts either --template or --workflow with your --input-file.
providers discovers sourced provider tools locally; --search, --capability and --access narrow results.
--provider inspects one entry. Discovery does not install third-party skills or connect a service.
project saves workflow inputs and keeps separate native Hermes runs, evidence and unsigned plans.
create and run --dry-run make no model or data call; run uses your configured model.
--max-turns bounds a project run (default 30, maximum 100); see docs/PROJECTS.md.
doctor distinguishes configuration from verified reads; --live probes public MCP only.
connect uses native Hermes OAuth, AIXBT environment-backed authentication, or the official local Coinbase MCP.
Wallet/account setup stays in its official CLI; see docs/CONNECTIONS.md.

Advanced skill-only compatibility:
boomkin setup --harness codex --directory ./agent --pack lp-skills
boomkin harnesses
boomkin catalog
--pack selects a pack (repeat for several); updates preserve your saved selection.
--offline-catalog uses this checkout's catalog. Runtime updates use native Hermes.
No model call, wallet funding, trading, paid data request or service starts in onboarding.`;

async function canonicalPath(path: string): Promise<string> {
  try { return await realpath(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return join(await canonicalPath(dirname(path)), basename(path));
  }
}

async function main() {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, strict: true, options: {
    name: { type: "string" }, "input-file": { type: "string" }, objective: { type: "string" }, "max-turns": { type: "string" }, "run-id": { type: "string" }, template: { type: "string" },
    version: { type: "boolean", short: "v" }, action: { type: "string" }, workflow: { type: "string" }, protocol: { type: "string" }, json: { type: "boolean" },
    search: { type: "string" }, capability: { type: "string" }, access: { type: "string" },
    "key-file": { type: "string" }, provider: { type: "string" }, live: { type: "boolean" }, "all-packs": { type: "boolean" }, "skip-model-setup": { type: "boolean" }, "no-install": { type: "boolean" }, pack: { type: "string", multiple: true }, harness: { type: "string" }, directory: { type: "string" }, "dry-run": { type: "boolean" }, "offline-catalog": { type: "boolean" }, help: { type: "boolean", short: "h" },
  } });
  const command = positionals[0] ?? "help";
  if (values.version || command === "version") return console.log(`Boomkin ${packageFile.version}`);
  if (values.help || command === "help") return console.log(help);
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
  if (values["dry-run"] && !["onboard", "setup", "update", "connect", "start", "model", "chatgpt", "project"].includes(command)) throw new Error("--dry-run is unavailable for this read-only command");

  if (command === "project") {
    const action = positionals[1];
    if (!action || !["create", "list", "show", "run", "check"].includes(action)) throw new Error("Choose project create, list, show, run or check");
    if (values.pack || values.harness || values["offline-catalog"]) throw new Error("Project commands use the selected Hermes profile; pack options belong to onboard");
    if (action !== "create" && [values.workflow, values.template, values["input-file"], values.objective].some(value => value !== undefined)) throw new Error("--workflow, --template, --input-file and --objective are only available for project create");
    if (action !== "run" && values["max-turns"] !== undefined) throw new Error("--max-turns is only available for project run");
    if (action !== "check" && values["run-id"] !== undefined) throw new Error("--run-id is only available for project check");
    if (values["dry-run"] && !["create", "run"].includes(action)) throw new Error("--dry-run is available for project create and run");
    if (action === "run" && values.json && !values["dry-run"]) throw new Error("Live project run streams native Hermes output. Use --dry-run --json to preview, or project show/project check for saved JSON results");
    const directory = await canonicalPath(resolve(values.directory ?? defaultProfile()));
    if (action === "list") {
      if (values.name !== undefined) throw new Error("project list does not accept --name");
      const projects = await listProjects(directory);
      return console.log(values.json ? JSON.stringify({ schemaVersion: 1, projects }, null, 2) : projects.length ? projects.map(project => `${project.name}: ${project.workflow.title}`).join("\n") : "No saved projects. Use project create with a workflow and input file.");
    }
    if (!values.name) throw new Error("Pass --name with the saved project name");
    if (action === "create") {
      if (!(values.workflow || values.template) || !values["input-file"]) throw new Error("project create requires --workflow or --template, and --input-file (a JSON object)");
      const file = Bun.file(resolve(values["input-file"]));
      if (file.size > 65_536) throw new Error("Project input file exceeds 64 KiB");
      const supplied = await file.json();
      const project = await createProject(directory, { name: values.name, workflow: values.template ? selectTemplate(values.template).workflow : values.workflow!, inputs: values.template ? templateInputs(values.template, supplied) : supplied, objective: values.objective, dryRun: values["dry-run"] }, parseCatalog(catalogFile));
      return console.log(values.json ? JSON.stringify(project, null, 2) : `${values["dry-run"] ? "Would create" : "Saved"} ${project.name} in ${directory}. Preview with project run --name ${project.name} --dry-run.`);
    }
    if (action === "show") return console.log(JSON.stringify({ project: await readProject(directory, values.name), runs: await projectRuns(directory, values.name) }, null, 2));
    if (action === "run") {
      const result = await runProject(directory, values.name, { dryRun: values["dry-run"], maxTurns: values["max-turns"] === undefined ? undefined : Number(values["max-turns"]) });
      return console.log(values.json ? JSON.stringify(result, null, 2) : values["dry-run"] ? result.prompt : `${result.run!.state}: ${result.path}${result.run!.issues?.length ? `\n${result.run!.issues.join("\n")}` : "\nCaptured files passed structural and hash checks. Review the findings and unsigned plan."}`);
    }
    const result = await checkProjectRun(directory, values.name, values["run-id"]);
    console.log(JSON.stringify(result, null, 2));
    if (result.issues.length) process.exitCode = 1;
    return;
  }

  if (command === "templates") {
    if (values.pack || values.harness || values.directory || values["offline-catalog"] || values.workflow) throw new Error("templates accepts --template and --json");
    const selected = values.template !== undefined ? [selectTemplate(values.template)] : templates;
    return console.log(values.json ? JSON.stringify({ schemaVersion: 1, templates: selected }, null, 2) : selected.map(renderTemplate).join("\n\n"));
  }

  if (command === "workflows") {
    if (values.pack || values.harness || values.directory) throw new Error("workflows accepts --workflow, --protocol and --json");
    const selected = values.workflow !== undefined ? [selectWorkflow(values.workflow)] : workflows.filter(item => values.protocol === undefined || item.protocol.toLowerCase() === values.protocol.toLowerCase());
    if (!selected.length) throw new Error("No matching protocol. Run workflows to list supported protocols.");
    return console.log(values.json ? JSON.stringify({ schemaVersion: 1, workflows: selected }, null, 2) : selected.map(renderWorkflow).join("\n\n"));
  }
  if (command === "providers") {
    if (values.pack || values.harness || values.directory || values["offline-catalog"]) throw new Error("providers accepts --provider, --search, --capability, --access and --json");
    if (values.provider !== undefined && [values.search, values.capability, values.access].some(value => value !== undefined)) throw new Error("Choose one --provider or discovery filters separately");
    const selected = values.provider !== undefined ? [selectProvider(values.provider)] : filterProviders({ search: values.search, capability: values.capability, access: values.access });
    return console.log(values.json ? JSON.stringify({ schemaVersion: providerCatalog.schemaVersion, directory: providerCatalog.directory, checkedOn: providerCatalog.checkedOn, providers: selected }, null, 2) : selected.length ? selected.map(provider => renderProvider(provider, values.provider !== undefined)).join("\n") : "No matching providers. Broaden the filters or run providers without filters.");
  }
  if (["onboard", "doctor", "start", "connect", "model", "chatgpt"].includes(command)) {
    if (values.harness && values.harness !== "hermes") throw new Error("Boomkin onboarding uses Hermes. Use setup for skill-only compatibility with another harness.");
    const directory = await canonicalPath(resolve(values.directory ?? defaultProfile()));
    if (command === "onboard") {
      if (values.pack && values["all-packs"]) throw new Error("Choose --pack or --all-packs, not both");
      const selected = values.workflow !== undefined ? workflowPacks(values.workflow, parseCatalog(catalogFile)) : values["all-packs"] ? parseCatalog(catalogFile).packs.map(pack => pack.id) : values.pack;
      const args = [process.execPath, fileURLToPath(import.meta.url), "setup", "--harness", "hermes", "--directory", directory,
        ...(selected?.flatMap(id => ["--pack", id]) ?? []), ...(values["dry-run"] ? ["--dry-run"] : [])];
      const child = Bun.spawn(args, { stdin: "inherit", stdout: "inherit", stderr: "inherit" });
      if (await child.exited !== 0) throw new Error("Skill setup did not finish. Resolve its reported issue and rerun onboard.");
      console.log(`Hermes home: ${directory}. Native model setup and keyless CoinGecko data; other providers are opt-in.`);
      await prepareHermes(directory, { install: !values["no-install"], dryRun: values["dry-run"], skipModelSetup: values["skip-model-setup"] });
      if (values["dry-run"]) return;
      console.log(JSON.stringify(await doctor(directory, parseCatalog(catalogFile)), null, 2));
      console.log("Onboarding saved. Use doctor --live to check public data, then start to launch Hermes. Complete any listed setup gaps first.");
      return;
    }
    if (values.pack || values["all-packs"] || values["skip-model-setup"] || values["no-install"]) throw new Error("Pack and installer options are only available for onboard here");
    if (command === "chatgpt") return runChatGpt(directory, (values.action ?? "status") as ChatGptAction, values["dry-run"]);
    if (command === "doctor") return console.log(JSON.stringify(await doctor(directory, parseCatalog(catalogFile), values.live), null, 2));
    if (command === "connect") return connectProvider(directory, values.provider ?? "", values["dry-run"], values["key-file"] ? resolve(values["key-file"]) : undefined);
    if (values["dry-run"]) return console.log(`Hermes ${command === "model" ? "setup model" : "chat"} in ${directory}`);
    return runHermes(directory, command === "model" ? ["setup", "model"] : ["chat"]);
  }

  if (command === "harnesses") {
    for (const [name, h] of Object.entries(harnesses)) console.log(`${name}\n  ${h.setup}\n  ${h.docs}\n`);
    return;
  }
  if (command === "catalog") return console.log(JSON.stringify(parseCatalog(catalogFile), null, 2));
  if (!["setup", "update", "check", "status"].includes(command)) throw new Error(`Unknown command: ${command}`);
  if (!values.directory) throw new Error("Pass --directory with your harness workspace (Hermes: its HERMES_HOME).");
  const directory = await canonicalPath(resolve(values.directory));
  const stateDir = join(directory, ".boomkin");
  const configPath = join(stateDir, "config.json");
  let config: Config;
  if (command === "setup") {
    config = { schemaVersion: 1, harness: parseHarness(values.harness), directory };
    try {
      const existing = parseConfig(JSON.parse(await readFile(configPath, "utf8")), directory);
      if (existing.harness !== config.harness) throw new Error("This directory belongs to another harness. Use a separate workspace.");
      config = existing;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  else config = parseConfig(JSON.parse(await readFile(configPath, "utf8")), directory);
  if (values.pack && !["setup", "update"].includes(command)) throw new Error("--pack is available for setup and update");
  if (values.pack) config.packs = values.pack;
  const adapter = harnesses[config.harness];
  const env = { ...process.env, DISABLE_TELEMETRY: "1", XDG_STATE_HOME: join(stateDir, "state"), ...(config.harness === "hermes" ? { HERMES_HOME: directory } : {}) };
  const skillsBin = fileURLToPath(import.meta.resolve("skills/bin/cli.mjs"));
  async function run(args: string[]) {
    const child = Bun.spawn([process.execPath, skillsBin, ...args], { cwd: directory, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
    if (await child.exited !== 0) throw new Error("Upstream skills command failed. Completed packs remain installed; rerun after resolving the error.");
  }
  async function verifyInstalled(catalog: Catalog) {
    for (const pack of catalog.packs) {
      for (const skill of pack.skills) {
        const text = await readFile(join(directory, adapter.skillsPath, skill, "SKILL.md"), "utf8");
        const version = installedVersion(text);
        if (version !== pack.version) throw new Error(`Installed ${skill} has version ${version ?? "unknown"}; expected ${pack.version}. Sync not marked complete.`);
      }
    }
  }
  if (command === "status") {
    console.log(JSON.stringify(config, null, 2));
    console.log(`Skills: ${join(directory, adapter.skillsPath)}\n${adapter.setup}`);
    return run(["list", "--agent", adapter.agent, ...(adapter.global ? ["--global"] : [])]);
  }
  let previous: Catalog | undefined;
  try {
    const record = JSON.parse(await readFile(join(stateDir, "last-sync.json"), "utf8"));
    if (record.catalog?.schemaVersion === 3) previous = parseCatalog(record.catalog);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT" && command === "check") throw new Error("Sync record is incomplete; run update to rebuild it.");
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.log("Rebuilding an incomplete sync record.");
  }
  if (command === "check") {
    const current = selectPacks(values["offline-catalog"] ? parseCatalog(catalogFile) : await fetchCatalog(), config.packs);
    const changes = catalogChanges(current, previous);
    // Recorded digests describe the installed release, so a pending catalog change must not hide changed files.
    const issues = previous ? await verifyIntegrity(join(directory, adapter.skillsPath), previous, await readIntegrity(directory)) : [];
    // Installed versions are only comparable to the published catalog while no update is pending.
    if (!changes.length && previous) await verifyInstalled(current);
    if (changes.length) console.log(changes.join("\n"));
    if (issues.length) throw new Error(issues.join("; "));
    if (!changes.length) console.log("Recorded releases and installed skill files match the published Boomkin catalog.");
    return;
  }
  let catalog = parseCatalog(catalogFile);
  if (command === "update" && !values["offline-catalog"]) {
    catalog = await fetchCatalog();
  }
  catalog = selectPacks(catalog, config.packs);
  config.packs = catalog.packs.map(pack => pack.id);
  const setupHint = compatibilitySetupMessage(config.harness);
  if (setupHint) console.log(setupHint);
  for (const pack of catalog.packs) console.log(`Install ${pack.source}/${pack.path}@${pack.version} from verified commit ${pack.revision}`);
  if (values["dry-run"]) return;
  await mkdir(directory, { recursive: true });
  await mkdir(stateDir, { recursive: true });
  const lock = join(stateDir, "operation.lock");
  try { await mkdir(lock); } catch { throw new Error(`Another operation is active. If it crashed, remove ${lock} after checking no installer is running.`); }
  try {
    try {
      const existing = parseConfig(JSON.parse(await readFile(configPath, "utf8")), directory);
      if (existing.harness !== config.harness) throw new Error("This directory belongs to another harness. Use a separate workspace.");
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    // Keep enough state to retry safely if one of the independent upstream installs fails.
    await writeFile(`${configPath}.tmp`, JSON.stringify(config, null, 2) + "\n");
    await rename(`${configPath}.tmp`, configPath);
    const staging = await mkdtemp(join(tmpdir(), "boomkin-sources-"));
    const integrity: SkillIntegrity = {};
    try {
      // Resolve every source before installing; the installer receives only verified local checkouts.
      const sources = new Map<string, string>();
      const packages = new Map<string, string>();
      for (const pack of catalog.packs) {
        const key = `${pack.source}@${pack.revision}`;
        let checkout = sources.get(key);
        if (!checkout) {
          checkout = join(staging, `source-${sources.size}`);
          await checkoutPack(pack, checkout);
          sources.set(key, checkout);
        }
        packages.set(pack.id, await packageDirectory(pack, checkout));
      }
      for (const pack of catalog.packs) {
        await run(installArgs(packages.get(pack.id)!, config.harness, pack.skills));
        for (const skill of pack.skills) integrity[skill] = await verifyCopiedSkill(join(packages.get(pack.id)!, "skills", skill), join(directory, adapter.skillsPath, skill));
      }
    } finally { await rm(staging, { recursive: true, force: true }); }
    await verifyInstalled(catalog);
    for (const retired of ["lp-research", "lp-operate", "hyperliquid-research", "hyperliquid-operate"]) {
      if (await Bun.file(join(directory, adapter.skillsPath, retired, "SKILL.md")).exists()) console.log(`Legacy skill ${retired} remains. Review local edits and follow docs/UPDATES.md before removing it.`);
    }
    const identityPath = join(directory, config.harness === "eve" ? "agent/instructions.md" : "AGENTS.md");
    await mkdir(dirname(identityPath), { recursive: true });
    try { await writeFile(identityPath, identity, { flag: "wx" }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; console.log(`Preserved ${identityPath}. Add the Boomkin identity from docs/IDENTITY.md if wanted.`); }
    await writeFile(join(stateDir, "last-sync.json.tmp"), JSON.stringify({ syncedAt: new Date().toISOString(), catalog, integrity }, null, 2) + "\n");
    await rename(join(stateDir, "last-sync.json.tmp"), join(stateDir, "last-sync.json"));
    console.log(`Skills ready in ${join(directory, adapter.skillsPath)}. Use the installed skill matching your task; infrastructure and data skills establish tool readiness and evidence first. Restart the harness to reload.${setupHint ? `\n${setupHint}` : ""}`);
  } finally { await rm(lock, { recursive: true }); }
}
main().catch(error => { console.error(`Boomkin: ${error.message}`); process.exitCode = 1; });
