import { cp, mkdir, readFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dir, "..");
const out = join(root, "dist");
const provenance = JSON.parse(await readFile(join(root, "site/vendor/provenance.json"), "utf8")) as { files: Record<string, string> };
for (const [path, expected] of Object.entries(provenance.files)) {
  if (!["vendor/strategy-engine.mjs", "data/synthetic-daily.json", "data/bitcoin-180d.json", "data/bitcoin-capture.json"].includes(path)) throw new Error(`Unexpected reviewed desk resource ${path}`);
  const actual = createHash("sha256").update(await readFile(join(root, "site", path))).digest("hex");
  if (actual !== expected) throw new Error(`Reviewed desk resource changed: ${path}`);
}
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const result = await Bun.build({ entrypoints: [join(root, "src/cli.ts")], target: "bun", outdir: out });
if (!result.success) throw new AggregateError(result.logs, "Boomkin CLI build failed");
await cp(join(root, "desk"), join(out, "desk"), { recursive: true });
for (const path of Object.keys(provenance.files)) {
  await mkdir(join(out, "desk", path.split("/")[0]), { recursive: true });
  await cp(join(root, "site", path), join(out, "desk", path));
}
await cp(join(root, "site/vendor/LICENSE"), join(out, "desk/vendor/LICENSE"));
await cp(join(root, "site/vendor/provenance.json"), join(out, "desk/vendor/provenance.json"));
console.log("Built CLI and local desk with verified strategy resources");
