import { mkdtemp, mkdir, readdir, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { harnesses, parseCatalog } from "../src/core";

import catalogFile from "../catalog/skills.json";
import workflowRegistry from "../catalog/workflows.json";

const root = await mkdtemp(join(tmpdir(), "boomkin-smoke-"));
const cli = resolve(import.meta.dir, "../src/cli.ts");
const home = join(root, "home");

async function boomkin(args: string[], label: string) {
  const p = Bun.spawn([process.execPath, cli, ...args], {
    env: { ...process.env, HOME: home, XDG_CONFIG_HOME: join(home, ".config"), CODEX_HOME: join(home, ".codex") }, stdout: "pipe", stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
  if (code !== 0) throw new Error(`${label}: ${stdout}\n${stderr}`);
}

async function harnessInstall(name: string, adapter: (typeof harnesses)[keyof typeof harnesses]) {
  const log: string[] = [];
  const directory = join(root, name);
  await mkdir(directory);
  const instruction = join(directory, name === "eve" ? "agent/instructions.md" : "AGENTS.md");
  await mkdir(resolve(instruction, ".."), { recursive: true });
  await writeFile(instruction, "Keep my existing instructions.\n");
  for (const command of ["setup", "update"] as const) {
    if (command === "update" && name === "hermes") await writeFile(join(directory, ".boomkin/last-sync.json"), "{broken");
    await boomkin([command, "--directory", directory, ...(command === "setup" ? ["--harness", name] : ["--offline-catalog"])], `${name} ${command}`);
    const entries = await readdir(join(directory, adapter.skillsPath));
    const expected = parseCatalog(catalogFile).packs.flatMap(p => p.skills);
    if (JSON.stringify([...entries].sort()) !== JSON.stringify([...expected].sort())) {
      throw new Error(`${name}: installed skills [${[...entries].sort().join(", ")}] do not match catalog [${[...expected].sort().join(", ")}]`);
    }
    for (const skill of expected) {
      if (!(await readFile(join(directory, adapter.skillsPath, skill, "SKILL.md"), "utf8")).includes("description:")) throw new Error("Missing skill metadata");
    }
    if (await readFile(instruction, "utf8") !== "Keep my existing instructions.\n") throw new Error("User instructions overwritten");
    log.push(`${name} ${command}: ${entries.length} skills; existing instructions preserved`);
  }
  if (name === "hermes") log.push(await helperContracts(join(directory, adapter.skillsPath)));
  return log;
}

// Boomkin's project briefs and connection guide tell an agent which pinned helper to run and with
// which flags. Read those names from the shipped text and confirm the installed release offers them.
async function helperContracts(skills: string) {
  const text = [await readFile(resolve(import.meta.dir, "../src/projects.ts"), "utf8"), await readFile(resolve(import.meta.dir, "../docs/CONNECTIONS.md"), "utf8")].join("\n").split("\n");
  const skillFor = (id: string) => workflowRegistry.workflows.find(workflow => workflow.id === id)!.skill;
  const helpers = [
    { script: join(skillFor("hyperliquid-wallet-audit"), "scripts/wallet-audit.mjs"), named: "scripts/wallet-audit.mjs" },
    { script: join(skillFor("strategy-validation"), "scripts/validate-strategy.mjs"), named: "scripts/validate-strategy.mjs" },
    { script: "galleon-defi-data/scripts/price-check.mjs", named: "price-check.mjs|The helper accepts" },
  ];
  let checked = 0;
  for (const { script, named } of helpers) {
    const flags = new Set(text.filter(line => new RegExp(named).test(line)).flatMap(line => line.match(/(?<![\w-])--[a-z][a-z-]*/g) ?? []));
    if (!flags.size) throw new Error(`Shipped text no longer names flags for ${script}; update the helper contract check`);
    const child = Bun.spawn([Bun.which("node") ?? process.execPath, join(skills, script), "--help"], { stdout: "pipe", stderr: "pipe" });
    const [help, code] = await Promise.all([new Response(child.stdout).text(), child.exited]);
    if (code !== 0) throw new Error(`Installed helper ${script} did not print help`);
    for (const flag of flags) {
      if (!new RegExp(`${flag}(?![a-z-])`).test(help)) throw new Error(`Shipped text names ${flag} for ${script}, which the pinned release does not offer`);
      checked++;
    }
  }
  if (!(await Bun.file(join(skills, "galleon-defi-data/references/diagnostic.md")).exists())) throw new Error("docs/CONNECTIONS.md names references/diagnostic.md, which the pinned data pack does not ship");
  return `helper contracts: ${checked} documented flags offered by the pinned releases`;
}

async function selectedInstall(selected: ReturnType<typeof parseCatalog>["packs"][number]) {
  const log: string[] = [];
  const directory = join(root, `pack-${selected.id}`);
  for (const command of ["setup", "update"] as const) {
    await boomkin([command, "--directory", directory, ...(command === "setup" ? ["--harness", "codex", "--pack", selected.id] : ["--offline-catalog"])], `selected ${command}`);
    const entries = await readdir(join(directory, ".agents/skills"));
    const expected = selected.skills;
    if (JSON.stringify(entries.sort()) !== JSON.stringify([...expected].sort())) throw new Error(`Selected install leaked another package: ${entries.join(", ")}`);
    const config = JSON.parse(await readFile(join(directory, ".boomkin/config.json"), "utf8"));
    if (JSON.stringify(config.packs) !== JSON.stringify([selected.id])) throw new Error("Saved pack selection changed");
    log.push(`${selected.id} ${command}: exactly ${entries.length} skills; selection preserved`);
  }
  return log;
}

// Each case owns its directory and runs setup then update in order. Cases are
// independent and dominated by git fetches, so run a bounded pool of them.
const cases = [
  ...Object.entries(harnesses).map(([name, adapter]) => () => harnessInstall(name, adapter)),
  ...parseCatalog(catalogFile).packs.map(selected => () => selectedInstall(selected)),
];
const concurrency = Math.min(8, Math.max(1, Number(process.env.BOOMKIN_SMOKE_CONCURRENCY ?? 6) || 1));
try {
  await mkdir(home);
  const logs: string[][] = new Array(cases.length);
  const failures: unknown[] = [];
  let next = 0;
  const worker = async () => {
    while (failures.length === 0 && next < cases.length) {
      const index = next++;
      try {
        logs[index] = await cases[index]!();
      } catch (error) {
        failures.push(error);
      }
    }
  };
  // Let in-flight cases finish before the temporary root is removed.
  await Promise.all(Array.from({ length: Math.min(concurrency, cases.length) }, worker));
  if (failures.length) throw failures[0];
  for (const lines of logs) for (const line of lines) console.log(line);
} finally { await rm(root, { recursive: true, force: true }); }
