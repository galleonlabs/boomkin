import { expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import catalogFile from "../catalog/skills.json";
import { parseCatalog } from "../src/core.ts";
import { skillFiles } from "../src/integrity.ts";
import { createProject, readProject, listProjects, parseInputs, projectRuns, projectHermesArgs, runProject, checkProjectRun } from "../src/projects.ts";

const catalog = parseCatalog(catalogFile);
async function temporary(action: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "boomkin-project-"));
  try { await action(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function create(directory: string, name = "aave-review") {
  return createProject(directory, { name, workflow: "aave-health", inputs: { chainId: 1, market: "explicit-market", wallet: "public-address", stress: "20% collateral-price decrease" } }, catalog);
}
async function installed(directory: string) {
  const pack = catalog.packs.find(item => item.id === "defi-lending-skills")!;
  const integrity: Record<string, Record<string, string>> = {};
  for (const skill of pack.skills) {
    const path = join(directory, "skills", skill);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "SKILL.md"), `---\nname: ${skill}\nmetadata:\n  version: "${pack.version}"\n---\nFixture only. No data or financial tools.\n`);
    integrity[skill] = await skillFiles(path);
  }
  await writeFile(join(directory, ".boomkin", "last-sync.json"), JSON.stringify({ catalog: { schemaVersion: 3, packs: [pack] }, integrity }));
}
async function runtime(directory: string, behavior: "success" | "fail" | "missing" | "unsupported" = "success") {
  const executable = join(directory, `hermes-${behavior}`);
  const code = `#!/usr/bin/env bun
import { readFileSync, writeFileSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createHash } from "node:crypto";
const args = process.argv.slice(2);
if (args.includes("--help")) { console.log(${JSON.stringify(behavior === "unsupported" ? "old chat" : "--query-file --skills --max-turns --oneshot --cli")}); process.exit(0); }
if (${JSON.stringify(behavior)} === "fail") process.exit(7);
if (args[0] !== "--profile" || args[1] !== "default" || realpathSync(process.env.HERMES_HOME) !== process.cwd() || process.env.HERMES_CONFIG !== join(process.env.HERMES_HOME, "config.yaml")) process.exit(8);
const promptPath = args[args.indexOf("--query-file") + 1];
const output = dirname(promptPath);
const prompt = readFileSync(promptPath, "utf8");
if (!prompt.includes("Do not sign, approve, fund, submit")) process.exit(9);
if (${JSON.stringify(behavior)} === "missing") process.exit(0);
const raw = JSON.stringify({ fixture: true, healthFactor: "1.8", blockNumber: "21000000" });
writeFileSync(join(output, "sources", "state.json"), raw);
writeFileSync(join(output, "evidence.json"), JSON.stringify({schemaVersion:1,observations:[{id:"aave-state",source:"https://example.com/public-fixture",observedAt:new Date().toISOString(),summary:"Fixture observation",artifact:"sources/state.json",sha256:createHash("sha256").update(raw).digest("hex"),limitations:["Synthetic fixture, not a live chain read"]}]}));
writeFileSync(join(output, "report.md"), "Fixture only. Current health factor 1.8 [aave-state]. No live financial claim.");
writeFileSync(join(output, "plan.json"), JSON.stringify({schemaVersion:1,status:"no-action",authorization:"not-granted",summary:"No financial action from a fixture",steps:[]}));
console.log("Fixture native contract exercised; no model call.");
`;
  await writeFile(executable, code);
  await chmod(executable, 0o700);
  return executable;
}

test("projects preserve saved input context, reject overwrites and support an empty profile", async () => temporary(async directory => {
  expect(await listProjects(directory)).toEqual([]);
  const project = await create(directory);
  expect(await readProject(directory, project.name)).toEqual(project);
  expect((await listProjects(directory)).map(item => item.name)).toEqual([project.name]);
  await expect(create(directory)).rejects.toThrow("already exists");
  expect(await projectRuns(directory, project.name)).toEqual([]);
  expect((await readProject(directory, project.name)).inputs.chainId).toBe(1);
}));

test("project validation refuses path escape, invalid input trees and malformed records", async () => temporary(async directory => {
  for (const name of ["../elsewhere", "Aave", "", "a/b", "-bad"]) await expect(create(directory, name)).rejects.toThrow("Project name");
  for (const value of [null, [], {}, { price: Infinity }, { value: "x".repeat(65_537) }]) expect(() => parseInputs(value)).toThrow("Project inputs");
  await create(directory);
  const path = join(directory, ".boomkin/projects/aave-review/project.json");
  const project = JSON.parse(await readFile(path, "utf8"));
  project.workflow.output = "Unreviewed instruction in a local record";
  project.workflow.inputs = null;
  await writeFile(path, JSON.stringify(project));
  expect((await readProject(directory, "aave-review")).workflow.output).not.toContain("Unreviewed");
  expect((await readProject(directory, "aave-review")).workflow.inputs.length).toBeGreaterThan(0);
  project.workflow.skill = "unreviewed-skill";
  await writeFile(path, JSON.stringify(project));
  await expect(readProject(directory, "aave-review")).rejects.toThrow("reviewed registry");
}));

test("creation and run previews have no writes or runtime dependency and preserve literal input", async () => temporary(async directory => {
  await createProject(directory, { name: "preview", workflow: "aave-health", inputs: { notes: "$(touch /tmp/boomkin-should-not-exist) `echo command`" }, dryRun: true }, catalog);
  expect(await readdir(directory)).toEqual([]);
  await create(directory);
  const before = await readdir(join(directory, ".boomkin/projects/aave-review/runs"));
  const preview = await runProject(directory, "aave-review", { dryRun: true });
  expect(preview.prompt).toContain("not-granted");
  expect(preview.prompt).toContain("20% collateral-price decrease");
  expect(await readdir(join(directory, ".boomkin/projects/aave-review/runs"))).toEqual(before);
  for (const turns of [0, 1.5, NaN, 101]) expect(() => projectHermesArgs("/tmp/literal `path`.md", "skill", turns)).toThrow("integer");
  expect(projectHermesArgs("/tmp/literal `path`.md", "skill", 4)).toContain("/tmp/literal `path`.md");
}));

test("large valid briefs roundtrip and Unicode byte limits are enforced before creating a project", async () => temporary(async directory => {
  const objective = "o".repeat(16_384);
  const inputs = Object.fromEntries(["one", "two", "three", "four"].map(key => [key, "x".repeat(16_000)]));
  const project = await createProject(directory, { name: "large", workflow: "aave-health", inputs, objective }, catalog);
  expect(await readProject(directory, "large")).toEqual(project);
  expect((await listProjects(directory)).map(item => item.name)).toEqual(["large"]);
  expect((await runProject(directory, "large", { dryRun: true })).prompt).toContain(objective);
  await expect(createProject(directory, { name: "too-many-bytes", workflow: "aave-health", inputs: { one: "界".repeat(16_000), two: "界".repeat(16_000) } }, catalog)).rejects.toThrow("64 KiB");
  expect((await listProjects(directory)).map(item => item.name)).toEqual(["large"]);
  await installed(directory);
  const run = await runProject(directory, "large", { executable: await runtime(directory) });
  expect(run.run!.state).toBe("ready-for-review");
  expect((await checkProjectRun(directory, "large")).issues).toEqual([]);
}));

test("a thesis project requires explicit invalidation and review preferences without creating a schedule", async () => temporary(async directory => {
  await expect(createProject(directory, { name: "thesis", workflow: "thesis-review", inputs: { asset: "ethereum" } }, catalog)).rejects.toThrow("invalidationConditions");
  await createProject(directory, { name: "thesis", workflow: "thesis-review", inputs: {
    asset: "Ethereum native ETH; CoinGecko ID ethereum", thesis: "Synthetic research question",
    invalidationConditions: ["A specific cited condition"], evidenceStandard: "Primary network metrics",
    reviewFrequency: "Weekly", notifyWhen: "A material condition changes verdict",
  } }, catalog);
  const preview = await runProject(directory, "thesis", { dryRun: true });
  expect(preview.prompt).toContain("holds, weakened, invalidated or unknown");
  expect(preview.prompt).toContain("does not create a schedule or send notifications");
  expect(await projectRuns(directory, "thesis")).toEqual([]);
}));

test("native launch preserves per-run evidence and checks hashes, citations and unsigned plans", async () => temporary(async directory => {
  await create(directory);
  await installed(directory);
  const executable = await runtime(directory);
  const result = await runProject(directory, "aave-review", { executable, maxTurns: 4 });
  expect(result.run?.state).toBe("ready-for-review");
  expect(result.run?.maxTurns).toBe(4);
  const checked = await checkProjectRun(directory, "aave-review");
  expect(checked.observations).toBe(1);
  expect(checked.issues).toEqual([]);
  const second = await runProject(directory, "aave-review", { executable });
  expect(second.run?.id).not.toBe(result.run?.id);
  expect(second.prompt).toContain(result.run!.id);
  expect(second.prompt).toContain("never reuse old reads as current");
  expect(await projectRuns(directory, "aave-review")).toHaveLength(2);
  expect((await checkProjectRun(directory, "aave-review", result.run!.id)).issues).toEqual([]);
  await writeFile(join(result.path, "sources/state.json"), "changed");
  expect((await checkProjectRun(directory, "aave-review", result.run!.id)).issues.join(" ")).toContain("hash differs");
}));

test("expired/future evidence, uncited reports, forged authority and edited briefs fail review", async () => temporary(async directory => {
  await create(directory);
  await installed(directory);
  const result = await runProject(directory, "aave-review", { executable: await runtime(directory) });
  const evidencePath = join(result.path, "evidence.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  const original = JSON.stringify(evidence);
  evidence.observations[0].expiresAt = new Date(Date.now() - 60_000).toISOString();
  await writeFile(evidencePath, JSON.stringify(evidence));
  expect((await checkProjectRun(directory, "aave-review")).issues.join(" ")).toContain("expired");
  evidence.observations[0].expiresAt = undefined;
  evidence.observations[0].observedAt = new Date(Date.now() + 600_000).toISOString();
  await writeFile(evidencePath, JSON.stringify(evidence));
  expect((await checkProjectRun(directory, "aave-review")).issues.join(" ")).toContain("invalid fields");
  await writeFile(evidencePath, original);
  await writeFile(join(result.path, "report.md"), "An uncited assertion");
  await writeFile(join(result.path, "plan.json"), JSON.stringify({schemaVersion:1,status:"signed",authorization:"granted",summary:"bad",steps:[]}));
  await writeFile(join(result.path, "brief.json"), "changed");
  const issues = (await checkProjectRun(directory, "aave-review")).issues.join(" ");
  expect(issues).toContain("brief.json changed");
  expect(issues).toContain("Report must cite");
  expect(issues).toContain("unsigned or no-action");
}));

test("failed launches, missing artifacts and interrupted locks remain visible and preserve earlier runs", async () => temporary(async directory => {
  await create(directory);
  await installed(directory);
  await expect(runProject(directory, "aave-review", { executable: await runtime(directory, "fail") })).rejects.toThrow("Hermes command failed");
  expect((await projectRuns(directory, "aave-review"))[0]!.state).toBe("failed");
  const missing = await runProject(directory, "aave-review", { executable: await runtime(directory, "missing") });
  expect(missing.run!.state).toBe("needs-review");
  expect(missing.run!.issues?.length).toBeGreaterThan(0);
  await expect(runProject(directory, "aave-review", { executable: await runtime(directory, "unsupported") })).rejects.toThrow("launch contract");
  await mkdir(join(directory, ".boomkin/projects/aave-review/run.lock"));
  await expect(runProject(directory, "aave-review", { executable: await runtime(directory) })).rejects.toThrow("run lock exists");
  expect(await projectRuns(directory, "aave-review")).toHaveLength(2);
}));

test("local skill changes and symlinked projects/artifacts cannot silently pass", async () => temporary(async directory => {
  await create(directory);
  await installed(directory);
  const executable = await runtime(directory);
  const result = await runProject(directory, "aave-review", { executable });
  const source = join(result.path, "sources/state.json");
  const raw = await readFile(source, "utf8");
  const outside = join(directory, "outside.json");
  await writeFile(outside, raw);
  await rm(source);
  await symlink(outside, source);
  expect((await checkProjectRun(directory, "aave-review")).issues.join(" ")).toContain("symlink");
  await writeFile(join(directory, "skills/galleon-aave-position/SKILL.md"), "changed");
  await expect(runProject(directory, "aave-review", { executable })).rejects.toThrow("version differs");
  await symlink(directory, join(directory, ".boomkin/projects/linked"));
  await expect(listProjects(directory)).rejects.toThrow("symlink");
}));

async function cli(args: string[]) {
  const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
  return { code: await child.exited, stdout: await new Response(child.stdout).text(), stderr: await new Response(child.stderr).text() };
}
test("project CLI supports input-file creation and previews and rejects misplaced options", async () => temporary(async directory => {
  const input = join(directory, "inputs.json");
  await writeFile(input, JSON.stringify({ chainId: 1, question: "fresh health factor" }));
  const created = await cli(["project", "create", "--name", "cli-review", "--workflow", "aave-health", "--input-file", input, "--directory", directory, "--json"]);
  expect(created.code).toBe(0);
  expect(JSON.parse(created.stdout).name).toBe("cli-review");
  const preview = await cli(["project", "run", "--name", "cli-review", "--directory", directory, "--dry-run", "--json"]);
  expect(preview.code).toBe(0);
  expect(JSON.parse(preview.stdout).prompt).toContain("fresh health factor");
  const liveJson = await cli(["project", "run", "--name", "cli-review", "--directory", directory, "--json"]);
  expect(liveJson.code).toBe(1);
  expect(liveJson.stderr).toContain("streams native Hermes output");
  expect(liveJson.stdout).toBe("");
  const list = await cli(["project", "list", "--directory", directory, "--json"]);
  expect(JSON.parse(list.stdout).projects).toHaveLength(1);
  for (const args of [["doctor", "--name", "bad"], ["project", "show", "--name", "cli-review", "--max-turns", "5"], ["project", "list", "--workflow", "aave-health"], ["project", "run", "--name", "cli-review", "--max-turns", "0", "--dry-run"], ["project", "create", "--name", "missing-input"], ["project", "check", "--name", "cli-review"]]) {
    expect((await cli([...args, "--directory", directory])).code).toBe(1);
  }
}));
