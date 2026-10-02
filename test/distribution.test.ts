import { expect, test } from "bun:test";
import { mkdtemp, mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

test("compiled CLI finds an npm-hoisted skills dependency outside its package directory", async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "boomkin-distribution-")));
  try {
    const pack = join(root, "node_modules", "boomkin");
    const output = join(pack, "dist");
    await mkdir(output, { recursive: true });
    const build = await Bun.build({ entrypoints: [resolve("src/cli.ts")], target: "bun", outdir: output });
    expect(build.success).toBe(true);
    const dependency = join(root, "node_modules", "skills");
    await mkdir(join(dependency, "bin"), { recursive: true });
    await writeFile(join(dependency, "package.json"), JSON.stringify({ name: "skills", type: "module", version: "1.7.0" }));
    await writeFile(join(dependency, "bin", "cli.mjs"), "console.log('Hoisted fixture skills command: ' + process.argv.slice(2).join(' '));\n");
    const workspace = join(root, "workspace");
    await mkdir(join(workspace, ".boomkin"), { recursive: true });
    await writeFile(join(workspace, ".boomkin", "config.json"), JSON.stringify({ schemaVersion: 1, harness: "codex", directory: workspace }));
    const child = Bun.spawn([process.execPath, join(output, "cli.js"), "status", "--directory", workspace], { cwd: workspace, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout).toContain("Hoisted fixture skills command: list --agent codex");
  } finally { await rm(root, { recursive: true, force: true }); }
});
