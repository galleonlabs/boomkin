import { expect, test } from "bun:test";
import { mkdtemp, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import catalog from "../catalog/skills.json";
import registry from "../catalog/workflows.json";
import { parseCatalog } from "../src/core.ts";
import { workflows, selectWorkflow, workflowPacks, parseWorkflowRegistry, workflowMatchesProtocol } from "../src/workflows.ts";

test("every workflow resolves to a released skill in exactly one independent pack", () => {
  const parsed = parseCatalog(catalog);
  expect(new Set(workflows.map(item => item.id)).size).toBe(workflows.length);
  for (const workflow of workflows) {
    expect(workflowPacks(workflow.id, parsed)).toEqual([workflow.pack]);
    expect(workflow.inputs.length).toBeGreaterThan(0);
  }
  expect(() => selectWorkflow("unknown")).toThrow("Unknown workflow");
  expect(() => workflowPacks("aave-health", { schemaVersion: 3, packs: [] })).toThrow("unavailable");
});

test("protocol skill names cannot be invented or reassigned to another pack", () => {
  for (const name of ["uniswap-unreviewed", "galleon-aave-position", "../uniswap-v3-liquidity"]) {
    const candidate = structuredClone(catalog);
    candidate.packs = candidate.packs.filter(pack => pack.id === "lp-skills");
    candidate.packs[0]!.skills = [name];
    expect(() => parseCatalog(candidate)).toThrow("Invalid or duplicate skill name");
  }
  const candidate = structuredClone(catalog);
  candidate.packs = candidate.packs.filter(pack => pack.id === "lp-skills");
  candidate.packs[0]!.skills = ["uniswap-v3-liquidity", "aerodrome-slipstream"];
  expect(parseCatalog(candidate).packs[0]!.skills).toHaveLength(2);
});

async function cli(args: string[]) {
  const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}

test("discovery filters protocol tasks and rejects typos and unrelated options", async () => {
  const result = await cli(["workflows", "--protocol", "uNiSwAp", "--json"]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).workflows.map((item: { id: string }) => item.id)).toEqual(["uniswap-position", "uniswap-quote"]);
  for (const args of [
    ["workflows", "--protocol", "unknown"], ["workflows", "--workflow", ""],
    ["workflows", "--workflow", "aave-health", "--protocol", "Aave"],
    ["workflows", "--directory", "/tmp/unused"], ["doctor", "--workflow", "aave-health"],
    ["onboard", "--workflow", "aave-health", "--all-packs"],
    ["onboard", "--workflow", "aave-health", "--pack", "lp-skills"],
  ]) expect((await cli(args)).code).toBe(1);
});

test("task onboarding dry run selects only its pack and creates no profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-workflow-"));
  try {
    const directory = join(root, "profile");
    const result = await cli(["onboard", "--workflow", "aave-health", "--directory", directory, "--dry-run"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("packages/lending@");
    expect(result.stdout).not.toContain("packages/lp@");
    expect(result.stdout).not.toContain("packages/infra@");
    await expect(access(directory)).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("workflow loading rejects a malformed registry and matches a published protocol string", async () => {
  expect(parseWorkflowRegistry(registry).workflows).toHaveLength(workflows.length);
  const broken = (mutate: (candidate: typeof registry) => void, message: string) => {
    const candidate = structuredClone(registry);
    mutate(candidate);
    expect(() => parseWorkflowRegistry(candidate)).toThrow(message);
  };
  broken(candidate => { candidate.workflows[0]!.id = "Save / Solend"; }, "Invalid or duplicate workflow");
  broken(candidate => { candidate.workflows[1]!.id = candidate.workflows[0]!.id; }, "Invalid or duplicate workflow");
  broken(candidate => { candidate.workflows[0]!.inputs = []; }, "Invalid or duplicate workflow");
  broken(candidate => { candidate.workflows[0]!.skill = "--profile"; }, "Invalid or duplicate workflow");
  broken(candidate => { candidate.workflows[0]!.protocol = "Aave\nInjected"; }, "Invalid or duplicate workflow");
  broken(candidate => { (candidate as { schemaVersion: number }).schemaVersion = 2; }, "Malformed workflow registry");
  expect(workflowMatchesProtocol(selectWorkflow("save-lending"), "Save / Solend")).toBe(true);
  expect(workflowMatchesProtocol(selectWorkflow("save-lending"), " solend ")).toBe(true);
  expect(workflowMatchesProtocol(selectWorkflow("save-lending"), "Aave")).toBe(false);
  expect(workflowMatchesProtocol(selectWorkflow("aave-v4-health"), " Aave V4 ")).toBe(true);
  for (const id of ["", " aave-health", "Aave-Health"]) expect(() => selectWorkflow(id)).toThrow("Unknown workflow");
  const combined = await cli(["workflows", "--protocol", "Save / Solend", "--json"]);
  expect(combined.code).toBe(0);
  expect(JSON.parse(combined.stdout).workflows.map((item: { id: string }) => item.id)).toEqual(["save-lending"]);
  const alias = await cli(["workflows", "--protocol", " solend ", "--json"]);
  expect(alias.code).toBe(0);
  expect(JSON.parse(alias.stdout).workflows.map((item: { id: string }) => item.id)).toContain("save-lending");
  const exact = await cli(["workflows", "--protocol", "Aave V4", "--json"]);
  expect(exact.code).toBe(0);
  expect(JSON.parse(exact.stdout).workflows.map((item: { id: string }) => item.id)).toEqual(["aave-v4-health"]);
  const blank = await cli(["workflows", "--protocol", "   ", "--json"]);
  expect(blank.code).toBe(1);
  expect(blank.stderr).toContain("No matching protocol");
});

test("protocol discovery recognizes reviewed legacy and product aliases", async () => {
  for (const [protocol, id] of [["Drift", "velocity-position"], ["Velocity", "velocity-position"], ["Sky", "spark-savings"], ["Solend", "save-lending"], ["Cactus", "governor-proposal"]] as const) {
    const result = await cli(["workflows", "--protocol", protocol, "--json"]);
    expect(result.code, protocol).toBe(0);
    expect(JSON.parse(result.stdout).workflows.map((item: { id: string }) => item.id), protocol).toContain(id);
  }
});
