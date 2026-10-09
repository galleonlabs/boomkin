import { expect, test } from "bun:test";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { templates, selectTemplate, templateInputs } from "../src/templates.ts";
import { selectWorkflow, workflowPacks } from "../src/workflows.ts";
import { parseCatalog } from "../src/core.ts";
import catalog from "../catalog/skills.json";

async function cli(args: string[]) {
  const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}

test("templates resolve to reviewed workflows and never create financial authority", async () => {
  for (const template of templates) {
    const workflow = selectWorkflow(template.workflow);
    expect(workflowPacks(workflow.id, parseCatalog(catalog))).toEqual([workflow.pack]);
    expect(new Set(template.requiredInputs).size).toBe(template.requiredInputs.length);
    expect(template.requiredInputs.every(key => Object.hasOwn(template.exampleInputs, key))).toBe(true);
  }
  const result = await cli(["templates", "--template", "wallet-audit", "--json"]);
  expect(result.code).toBe(0);
  expect(JSON.parse(result.stdout).templates[0].requiredInputs).toEqual(["account", "startTime", "endTime"]);
  for (const args of [["templates", "--template", "unknown"], ["templates", "--directory", "/tmp/unused"], ["project", "run", "--template", "wallet-audit", "--name", "unused"], ["onboard", "--template", "wallet-audit"]]) expect((await cli(args)).code).toBe(1);
});

test("required user inputs reject placeholders and wrong types while preserving explicit defaults", () => {
  for (const inputs of [{ chain: "Ethereum" }, { chain: 1, asset: "USDC" }, { chain: "", asset: "USDC" }, { chain: "YOUR_CHAIN", asset: "USDC" }]) expect(() => templateInputs("stablecoin-yields", inputs)).toThrow("requires your");
  expect(templateInputs("stablecoin-yields", { chain: "Base", asset: "USDC", limit: 3 })).toMatchObject({ chain: "Base", asset: "USDC", limit: 3, minimumTvlUsd: "10000000" });
  expect(() => templateInputs("strategy-validation", selectTemplate("strategy-validation").exampleInputs)).toThrow("placeholders");
  expect(() => templateInputs("thesis-review", { asset: "ETH", thesis: "A thesis", evidenceStandard: "Primary sources", invalidationConditions: ["YOUR_CONDITION"] })).toThrow("invalidationConditions");
});

test("template create freezes inputs, previews without writes and preserves existing projects", async () => {
  const directory = await mkdtemp(join(tmpdir(), "boomkin-template-"));
  try {
    const input = join(directory, "inputs.json");
    await writeFile(input, JSON.stringify({ chain: "Ethereum", asset: "USDC" }));
    const args = ["project", "create", "--name", "income", "--template", "stablecoin-yields", "--input-file", input, "--directory", directory];
    const before = await readdir(directory);
    expect((await cli([...args, "--dry-run", "--json"])).code).toBe(0);
    expect(await readdir(directory)).toEqual(before);
    expect((await cli(args)).code).toBe(0);
    const path = join(directory, ".boomkin/projects/income/project.json");
    const saved = await readFile(path, "utf8");
    expect(JSON.parse(saved).inputs.limit).toBe(5);
    await writeFile(input, JSON.stringify({ chain: "Base", asset: "USDC" }));
    expect((await cli(args)).code).toBe(1);
    expect(await readFile(path, "utf8")).toBe(saved);
    const preview = await cli(["project", "run", "--name", "income", "--directory", directory, "--dry-run"]);
    expect(preview.code).toBe(0);
    expect(preview.stdout).toContain("not-granted");
    expect(preview.stdout).toContain("Ethereum");
    expect(preview.stdout).not.toContain('"Base"');
    expect((await cli([...args, "--workflow", "yield-screen"])).code).toBe(1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("wallet and validation projects reject ambiguous identities/windows before writing", async () => {
  const directory = await mkdtemp(join(tmpdir(), "boomkin-audit-inputs-"));
  try {
    const input = join(directory, "input.json");
    const valid = { account: "0x" + "1".repeat(40), startTime: "2026-10-01T00:00:00.000Z", endTime: "2026-10-08T00:00:00.000Z" };
    for (const patch of [{ account: "YOUR_PUBLIC_ACCOUNT_ADDRESS" }, { account: "0x" + "0".repeat(40) }, { endTime: valid.startTime }, { network: "unknown" }, { network: ["mainnet"] }, { maxPages: 0 }, { maxPages: 51 }]) {
      await writeFile(input, JSON.stringify({ ...valid, ...patch }));
      expect((await cli(["project", "create", "--name", "audit", "--template", "wallet-audit", "--input-file", input, "--directory", directory])).code).toBe(1);
      expect(await readdir(directory)).toEqual(["input.json"]);
    }
    await writeFile(input, JSON.stringify(valid));
    expect((await cli(["project", "create", "--name", "audit", "--template", "wallet-audit", "--input-file", input, "--directory", directory])).code).toBe(0);
    const preview = await cli(["project", "run", "--name", "audit", "--directory", directory, "--dry-run"]);
    expect(preview.stdout).toContain("wallet-audit.mjs capture");
    expect(preview.stdout).toContain("incomplete orders");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
