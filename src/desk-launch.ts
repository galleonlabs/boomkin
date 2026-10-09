import { lstat, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig, type Catalog } from "./core.ts";

export const publicDeskPacks = ["defi-data-skills", "hyperliquid-skills", "defi-strategy-skills"];

export async function deskSetupPacks(directory: string, catalog: Catalog): Promise<string[]> {
  const root = resolve(directory);
  const file = join(root, ".boomkin/config.json");
  let previous: string[] = [];
  try {
    for (const path of [root, join(root, ".boomkin"), file]) if ((await lstat(path)).isSymbolicLink()) throw new Error("Refusing a symlink in the selected profile");
    const config = parseConfig(JSON.parse(await readFile(file, "utf8")), root);
    if (config.harness !== "hermes") throw new Error("The local desk requires a Hermes profile; choose another directory");
    previous = config.packs ?? catalog.packs.map(pack => pack.id);
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return [...new Set([...previous, ...publicDeskPacks])];
}

export function deskAssetsDirectory(moduleUrl: string): string {
  const file = fileURLToPath(moduleUrl);
  return file.endsWith("/dist/cli.js") ? join(file, "../desk") : join(file, "../../dist/desk");
}

export function deskPort(value?: string): number {
  if (value === undefined) return 0;
  if (!/^(?:0|[1-9]\d{0,4})$/.test(value) || Number(value) > 65535) throw new Error("--port must be an integer from 0 to 65535");
  return Number(value);
}
