import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseCatalog, parseConfig, parseHarness, installArgs, harnesses, fetchCatalog, catalogChanges, installedVersion, selectPacks, compatibilitySetupMessage } from "../src/core";
import catalog from "../catalog/skills.json";

describe("trust and installation boundaries", () => {
  test("catalog rejects external sources, options, duplicates, and schema drift", () => {
    expect(parseCatalog(catalog).packs).toHaveLength(catalog.packs.length);
    for (const source of ["evil/lp-skills", "--global", "galleonlabs/crypto-defi-skills@evil"]) {
      expect(() => parseCatalog({ ...catalog, packs: [{ ...catalog.packs[0], source }] })).toThrow();
    }
    expect(() => parseCatalog({ ...catalog, packs: [catalog.packs[0], catalog.packs[0]] })).toThrow();
    expect(() => parseCatalog({ ...catalog, schemaVersion: 2 })).toThrow();
  });
  test("unrecognized harnesses and moved state fail closed", () => {
    for (const name of ["toString", "constructor", "unknown"]) expect(() => parseHarness(name)).toThrow();
    expect(() => parseConfig({ schemaVersion: 1, harness: "eve", directory: "/old" }, "/new")).toThrow();
  });
  test("Hermes targets its profile, other adapters stay project scoped", () => {
    for (const harness of Object.keys(harnesses) as (keyof typeof harnesses)[]) {
      const args = installArgs("/tmp/verified-skills", harness, ["lp-setup"]);
      expect(args.includes("--global")).toBe(harness === "hermes");
      expect(args).toContain("--copy");
      expect(args).toContain(harnesses[harness].agent);
    }
  });
  test("dry run does not create a workspace, config, or install files", async () => {
    const root = await mkdtemp(join(tmpdir(), "boomkin-test-"));
    const directory = join(root, "not-created");
    try {
      const p = Bun.spawn([process.execPath, "src/cli.ts", "setup", "--harness", "eve", "--directory", directory, "--dry-run"], { stdout: "pipe", stderr: "pipe" });
      expect(await p.exited).toBe(0);
      expect(await new Response(p.stdout).text()).toContain("galleonlabs/crypto-defi-skills/packages/hyperliquid");
      expect(await Bun.file(join(directory, ".boomkin/config.json")).exists()).toBe(false);
      await expect(readFile(directory)).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  test("native Hermes setup omits the skill-only runtime instruction that other adapters still print", async () => {
    expect(compatibilitySetupMessage("hermes")).toBeUndefined();
    for (const harness of Object.keys(harnesses) as (keyof typeof harnesses)[]) {
      if (harness === "hermes") continue;
      expect(compatibilitySetupMessage(harness)).toBe(harnesses[harness].setup);
    }
    const root = await mkdtemp(join(tmpdir(), "boomkin-setup-hint-"));
    try {
      for (const harness of ["hermes", "codex"] as const) {
        const p = Bun.spawn([process.execPath, "src/cli.ts", "setup", "--harness", harness, "--directory", join(root, harness), "--dry-run"], { stdout: "pipe", stderr: "pipe" });
        const output = await new Response(p.stdout).text();
        expect(await p.exited).toBe(0);
        expect(output.includes(harnesses.hermes.setup)).toBe(false);
        expect(output.includes(harnesses.codex.setup)).toBe(harness === "codex");
      }
      const listed = Bun.spawn([process.execPath, "src/cli.ts", "harnesses"], { stdout: "pipe", stderr: "pipe" });
      expect(await new Response(listed.stdout).text()).toContain(harnesses.hermes.setup);
      expect(await listed.exited).toBe(0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  test("unknown flags and missing directories do not start installation", async () => {
    for (const args of [["setup", "--harness", "eve"], ["setup", "--force"], ["oops"]]) {
      const p = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
      expect(await p.exited).toBe(1);
    }
  });
  test("commands reject profile and catalog flags they do not use", async () => {
    const help = Bun.spawn([process.execPath, "src/cli.ts", "--help"], { stdout: "pipe", stderr: "pipe" });
    const text = await new Response(help.stdout).text();
    expect(await help.exited).toBe(0);
    expect(text).toContain("boomkin project show --name my-research");
    expect(text).toContain("boomkin status --directory ~/.boomkin/hermes");
    expect(text).toContain("boomkin workflows --protocol Aave");
    expect(text).toContain("boomkin chatgpt --action refresh");
    expect(text).toContain("workflows, templates, providers, catalog and harnesses do not use a profile");
    expect(text).not.toContain("for the commands above");
    for (const args of [
      ["workflows", "--offline-catalog"],
      ["workflows", "--directory", "/tmp/unused-profile"],
      ["catalog", "--pack", "lp-skills"],
      ["harnesses", "--harness", "codex"],
      ["status", "--offline-catalog"],
      ["doctor", "--offline-catalog"],
      ["update", "--harness", "codex"],
      ["check", "--harness", "hermes"],
    ]) {
      const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
      expect(await child.exited, args.join(" ")).toBe(1);
      expect(await new Response(child.stdout).text(), args.join(" ")).toBe("");
    }
  });
});


test("pins release versions and rejects branch names or missing version metadata", () => {
  const pack = parseCatalog(catalog).packs[0]!;
  expect(installArgs("/tmp/verified-skills", "eve", ["lp-setup"])[1]).toBe("/tmp/verified-skills");
  for (const revision of ["main", "v0.4.0", "../../evil", "shortsha"]) expect(() => parseCatalog({ schemaVersion: 3, packs: [{ ...pack, revision }] })).toThrow();
  expect(() => parseCatalog({ schemaVersion: 3, packs: [{ ...pack, version: undefined }] })).toThrow();
});
test("checks report new revisions, new packs, and retirement without installing", () => {
  const current = parseCatalog(catalog);
  expect(catalogChanges(current, current)).toEqual([]);
  expect(catalogChanges(current)).toHaveLength(catalog.packs.length);
  expect(catalogChanges({ ...current, packs: [current.packs[0]!] }, current)[0]).toContain("retired");
});
test("catalog fetch fails closed on HTTP failure and invalid data", async () => {
  await expect(fetchCatalog((async () => new Response("down", { status: 503 })))).rejects.toThrow("503");
  await expect(fetchCatalog((async () => Response.json({ schemaVersion: 3, packs: [] })))).rejects.toThrow();
});
test("catalog fetch rejects transport failures, redirects, oversize bodies and non-catalog JSON", async () => {
  let seen: { url?: string; redirect?: RequestRedirect } = {};
  const loaded = await fetchCatalog(async (url, init) => {
    seen = { url, redirect: init?.redirect };
    return Response.json(catalog);
  });
  expect(loaded.packs).toHaveLength(catalog.packs.length);
  expect(seen).toEqual({ url: "https://raw.githubusercontent.com/galleonlabs/boomkin/main/catalog/skills.json", redirect: "error" });
  const unchanged = "installed skills were not changed.";
  await expect(fetchCatalog(async () => { throw new Error("network down"); })).rejects.toThrow(unchanged);
  await expect(fetchCatalog(async () => { throw new DOMException("The operation was aborted.", "AbortError"); })).rejects.toThrow(unchanged);
  await expect(fetchCatalog(async () => new Response("not-json"))).rejects.toThrow("invalid data");
  await expect(fetchCatalog(async () => new Response(""))).rejects.toThrow("invalid data");
  await expect(fetchCatalog(async () => Response.json(null))).rejects.toThrow("unrecognized catalog");
  await expect(fetchCatalog(async () => Response.json([]))).rejects.toThrow("unrecognized catalog");
  await expect(fetchCatalog(async () => new Response("{}", { headers: { "content-length": "2000000" } }))).rejects.toThrow("size limit");
  await expect(fetchCatalog(async () => Response.json({ schemaVersion: 2, packs: catalog.packs }))).rejects.toThrow("current Boomkin CLI");
});
test("harness detection accepts only an exact harness name", async () => {
  for (const value of [["hermes"], { toString: () => "hermes" }, "Hermes", " hermes"]) {
    expect(() => parseHarness(value)).toThrow("Choose a harness");
    expect(() => parseConfig({ schemaVersion: 1, harness: value, directory: "/tmp/profile" }, "/tmp/profile")).toThrow("Choose a harness");
  }
  expect(parseConfig({ schemaVersion: 1, harness: "hermes", directory: "/tmp/profile" }, "/tmp/profile").harness).toBe("hermes");
  expect(parseConfig({ schemaVersion: 1, harness: "eve", directory: "/tmp/profile" }, "/tmp/profile").harness).toBe("eve");
  const root = await mkdtemp(join(tmpdir(), "boomkin-harness-"));
  try {
    const directory = await realpath(root);
    await mkdir(join(directory, ".boomkin"));
    await writeFile(join(directory, ".boomkin", "config.json"), JSON.stringify({ schemaVersion: 1, harness: ["hermes"], directory }));
    const child = Bun.spawn([process.execPath, "src/cli.ts", "check", "--directory", directory, "--offline-catalog"], { stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(code).toBe(1);
    expect(stderr).toContain("Choose a harness");
    expect(stdout).toBe("");
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("reads both original and Eve-normalized skill version metadata", () => {
  expect(installedVersion('---\nname: lp-setup\nmetadata:\n  version: "0.4.0"\n---\nbody')).toBe("0.4.0");
  expect(installedVersion('---\ndescription: "Setup"\nmetadata: {"version":"0.4.0"}\n---\nbody')).toBe("0.4.0");
  expect(installedVersion("No metadata")).toBeUndefined();
});
test("checks detect corrected release metadata even with the same revision", () => {
  const current = parseCatalog(catalog);
  const previous = structuredClone(current);
  previous.packs[0]!.version = "0.0.1";
  expect(catalogChanges(current, previous)).toHaveLength(1);
  previous.packs[0]!.version = current.packs[0]!.version;
  previous.packs[0]!.skills.pop();
  expect(catalogChanges(current, previous)).toHaveLength(1);
});

test("monorepo package paths and identities are explicit and cannot escape", () => {
  for (const path of ["../lp", "packages/../../evil", "packages/lp/../hyperliquid", "/tmp/lp", "packages/hyperliquid"]) {
    expect(() => parseCatalog({ ...catalog, packs: [{ ...catalog.packs[0], path }] })).toThrow();
  }
  expect(() => parseCatalog({ ...catalog, packs: [{ ...catalog.packs[0], package: "evil" }] })).toThrow();
});
test("pack selection installs only requested packages and rejects unknown names", () => {
  const current = parseCatalog(catalog);
  expect(selectPacks(current, ["lp-skills"]).packs.map(p => p.id)).toEqual(["lp-skills"]);
  expect(() => selectPacks(current, ["missing"])).toThrow();
  expect(() => selectPacks(current, ["lp-skills", "lp-skills"])).toThrow();
  const args = installArgs("/tmp/packages/lp", "eve", ["lp-setup", "lp-plan"]);
  expect(args).toContain("lp-setup");
  expect(args).not.toContain("*");
  expect(args).not.toContain("hyperliquid-setup");
});
test("saved selections validate and source path changes require an update", () => {
  expect(() => parseConfig({ schemaVersion: 1, harness: "eve", directory: "/tmp", packs: [] }, "/tmp")).toThrow();
  const current = parseCatalog(catalog);
  const previous = structuredClone(current);
  previous.packs[0]!.path = "packages/old";
  expect(catalogChanges(current, previous)).toHaveLength(1);
});

test("configuration rejects malformed selections and preserves the legacy pack default", () => {
  const directory = "/tmp/boomkin-config";
  const base = { schemaVersion: 1, harness: "hermes", directory };
  expect(parseConfig(base, directory).packs).toEqual(["lp-skills", "hyperliquid-skills"]);
  expect(parseConfig({ ...base, packs: ["defi-data-skills"] }, directory).packs).toEqual(["defi-data-skills"]);
  for (const packs of [[], ["lp-skills", "lp-skills"], ["LP-skills"], "lp-skills", [1], ["../lp"], [""]]) {
    expect(() => parseConfig({ ...base, packs }, directory)).toThrow("Invalid configured pack selection");
  }
  expect(() => parseConfig(null, directory)).toThrow("Invalid or moved");
  expect(() => parseConfig({ ...base, schemaVersion: 2 }, directory)).toThrow("Invalid or moved");
  expect(() => parseConfig({ ...base, directory: "/tmp/other" }, directory)).toThrow("Invalid or moved");
  expect(() => parseConfig({ ...base, harness: "constructor" }, directory)).toThrow("Choose a harness");
  expect(() => parseConfig({ ...base, harness: "Hermes" }, directory)).toThrow("Choose a harness");
});

test("check uses the saved configuration and does not install from a malformed profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-config-"));
  const directory = await realpath(root);
  const config = join(directory, ".boomkin", "config.json");
  await mkdir(join(directory, ".boomkin"));
  try {
    await writeFile(config, JSON.stringify({ schemaVersion: 1, harness: "hermes", directory, packs: ["lp-skills", "lp-skills"] }));
    const duplicate = Bun.spawn([process.execPath, "src/cli.ts", "check", "--directory", directory, "--offline-catalog"], { stdout: "pipe", stderr: "pipe" });
    expect(await duplicate.exited).toBe(1);
    expect(await new Response(duplicate.stderr).text()).toContain("Invalid configured pack selection");
    expect(await new Response(duplicate.stdout).text()).toBe("");
    await writeFile(config, JSON.stringify({ schemaVersion: 1, harness: "hermes", directory }));
    const legacy = Bun.spawn([process.execPath, "src/cli.ts", "check", "--directory", directory, "--offline-catalog"], { stdout: "pipe", stderr: "pipe" });
    const output = await new Response(legacy.stdout).text();
    expect(await legacy.exited).toBe(0);
    expect(output).toContain("lp-skills:");
    expect(output).toContain("hyperliquid-skills:");
    expect(output).not.toContain("defi-data-skills:");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("project run rejects max-turns outside 1 to 100 before any model call", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-turns-"));
  const directory = await realpath(root);
  const inputs = join(directory, "inputs.json");
  await writeFile(inputs, JSON.stringify({ chain: "Ethereum", asset: "USDC" }));
  try {
    const created = Bun.spawn([process.execPath, "src/cli.ts", "project", "create", "--name", "yields", "--workflow", "yield-screen", "--input-file", inputs, "--directory", directory], { stdout: "pipe", stderr: "pipe" });
    expect(await created.exited).toBe(0);
    for (const turns of ["0", "101", "nope", "1.5"]) {
      const child = Bun.spawn([process.execPath, "src/cli.ts", "project", "run", "--name", "yields", "--dry-run", "--max-turns", turns, "--directory", directory], { stdout: "pipe", stderr: "pipe" });
      expect(await child.exited, turns).toBe(1);
      expect(await new Response(child.stderr).text(), turns).toContain("--max-turns must be an integer from 1 to 100");
    }
    const preview = Bun.spawn([process.execPath, "src/cli.ts", "project", "run", "--name", "yields", "--dry-run", "--max-turns", "1", "--directory", directory], { stdout: "pipe", stderr: "pipe" });
    expect(await preview.exited).toBe(0);
    expect(await new Response(preview.stderr).text()).toBe("");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("legacy configurations never opt into future catalog packs", () => {
  const config = parseConfig({ schemaVersion: 1, harness: "codex", directory: "/tmp/legacy" }, "/tmp/legacy");
  const current = parseCatalog(catalog);
  const future = parseCatalog({ ...catalog, packs: [...current.packs, {
    ...current.packs[0], id: "aave-skills", path: "packages/aave", package: "galleon-aave-skills", skills: ["aave-setup"],
  }] });
  expect(selectPacks(future, config.packs).packs.map(pack => pack.id)).toEqual(["lp-skills", "hyperliquid-skills"]);
  expect(selectPacks(future).packs).toHaveLength(current.packs.length + 1);
});

test("core CI covers catalog installation while native compatibility follows integration changes", async () => {
  const text = await readFile(new URL("../.github/workflows/compatibility.yml", import.meta.url), "utf8");
  const workflow = parseYaml(text) as { on: { pull_request_target?: { paths?: string[] }; push?: { paths?: string[] } } };
  expect(workflow.on.pull_request_target?.paths).toEqual(workflow.on.push?.paths);
  expect(workflow.on.pull_request_target?.paths).toContain("src/**");
  expect(workflow.on.pull_request_target?.paths).toContain("scripts/hermes-native-smoke.py");
  const ci = parseYaml(await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"));
  expect(ci.on.pull_request_target).toBeNull();
  const runs = ci.jobs.check.steps.map((step: { run?: string }) => step.run);
  for (const journey of ["bun run check", "bun run build", "bun run smoke", "bun run build:site", "bun run check:site"]) expect(runs).toContain(journey);
  const packageFile = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const scripts = packageFile.scripts;
  const version = `boomkin@${packageFile.version}`;
  for (const path of ["README.md", "docs/GETTING-STARTED.md", "docs/DESK.md", "docs/UPDATES.md", "site/docs/start.md", "site/index.html"]) {
    expect(await readFile(new URL(`../${path}`, import.meta.url), "utf8")).toContain(version);
  }
  expect(await readFile(new URL("../docs/AGENT-INDEX.md", import.meta.url), "utf8")).toContain("59 discovery entries");
  expect(await readFile(new URL("../site/docs/start.md", import.meta.url), "utf8")).toContain("59 source-reviewed entries");
  expect(scripts.check).toBe("bun run typecheck && bun run test:gate");
  for (const path of scripts["test:gate"].split(" ").filter((part: string) => part.endsWith(".test.ts"))) {
    expect(await Bun.file(new URL(`../${path}`, import.meta.url)).exists()).toBe(true);
  }
});
