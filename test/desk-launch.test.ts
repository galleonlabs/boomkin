import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, symlink, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deskAssetsDirectory, deskPort, deskSetupPacks, publicDeskPacks } from "../src/desk-launch.ts";
import { parseCatalog } from "../src/core.ts";
import catalogFile from "../catalog/skills.json";

test("desk preparation retains existing selected packs and refuses another harness", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "boomkin-desk-selection-")));
  const catalog = parseCatalog(catalogFile);
  try {
    expect(await deskSetupPacks(root, catalog)).toEqual(publicDeskPacks);
    await mkdir(join(root, ".boomkin"));
    const file = join(root, ".boomkin/config.json");
    await writeFile(file, JSON.stringify({ schemaVersion: 1, harness: "hermes", directory: root, packs: ["lp-skills", "defi-data-skills"] }));
    expect(await deskSetupPacks(root, catalog)).toEqual(["lp-skills", ...publicDeskPacks]);
    await writeFile(file, JSON.stringify({ schemaVersion: 1, harness: "hermes", directory: root }));
    expect(await deskSetupPacks(root, catalog)).toEqual(["lp-skills", "hyperliquid-skills", "defi-data-skills", "defi-strategy-skills"]);
    await writeFile(file, JSON.stringify({ schemaVersion: 1, harness: "codex", directory: root }));
    await expect(deskSetupPacks(root, catalog)).rejects.toThrow("Hermes profile");
    await rm(file);
    await symlink(join(root, "elsewhere"), file);
    await expect(deskSetupPacks(root, catalog)).rejects.toThrow("symlink");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("desk asset resolution works for source and bundled consumer installs", () => {
  expect(deskAssetsDirectory("file:///repo/src/cli.ts")).toBe("/repo/dist/desk");
  expect(deskAssetsDirectory("file:///app/node_modules/boomkin/dist/cli.js")).toBe("/app/node_modules/boomkin/dist/desk");
  for (const value of [undefined, "0", "4178", "65535"]) expect(deskPort(value)).toBe(Number(value ?? 0));
  for (const value of ["-1", "1.5", "65536", "01", "junk", ""]) expect(() => deskPort(value)).toThrow();
});
