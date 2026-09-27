import { expect, test } from "bun:test";
import { mkdtemp, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import catalog from "../catalog/skills.json";
import { parseCatalog } from "../src/core.ts";
import { workflows, selectWorkflow, workflowPacks } from "../src/workflows.ts";

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
