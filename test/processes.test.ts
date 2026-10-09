import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { terminateOwnedProcess } from "../src/processes.ts";

test("owned process groups reap resistant descendants after their parent exits", async () => {
  if (process.platform === "win32") return;
  const root = await mkdtemp(join(tmpdir(), "boomkin-process-group-"));
  const parent = Bun.spawn(["sh", "-c", "trap 'exit 0' TERM; sh -c 'trap \"\" TERM; echo $$ > child.pid; exec sleep 60' & wait"], { cwd: root, detached: true, stdin: "ignore", stdout: "ignore", stderr: "ignore" });
  try {
    let pid = 0;
    for (let attempt = 0; attempt < 200; attempt++) {
      try { pid = Number(await readFile(join(root, "child.pid"), "utf8")); if (pid) break; } catch {}
      await Bun.sleep(10);
    }
    expect(pid).toBeGreaterThan(0);
    process.kill(pid, 0);
    await terminateOwnedProcess(parent, true, 150);
    expect(parent.exitCode).not.toBeNull();
    const check = Bun.spawn(["ps", "-o", "stat=", "-p", String(pid)], { stdout: "pipe", stderr: "ignore" });
    const state = (await new Response(check.stdout).text()).trim();
    await check.exited;
    expect(state === "" || state.startsWith("Z")).toBe(true);
  } finally { await terminateOwnedProcess(parent, true, 150); await rm(root, { recursive: true, force: true }); }
});
