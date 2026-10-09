import { expect, test } from "bun:test";
import { mkdtemp, writeFile, readFile, chmod, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { dashboardEnvironment, createNativeDashboard } from "../src/desk-model.ts";

test("native dashboard gets the exact selected profile and no inherited desktop ownership", () => {
  const env = dashboardEnvironment("/tmp/desk-profile", { PATH: "/fixture/bin", HERMES_HOME: "/wrong", HERMES_DESKTOP: "1", HERMES_SERVE_HEADLESS: "1", HERMES_WEB_DIST: "/wrong", HERMES_DASHBOARD_SESSION_TOKEN: "fixture", HERMES_SESSION_KEY: "fixture" });
  expect(env.HERMES_HOME).toBe("/tmp/desk-profile");
  expect(env.HERMES_CONFIG).toBe("/tmp/desk-profile/config.yaml");
  expect(env.PATH).toBe("/fixture/bin");
  for (const key of ["HERMES_DESKTOP", "HERMES_SERVE_HEADLESS", "HERMES_WEB_DIST", "HERMES_DASHBOARD_SESSION_TOKEN", "HERMES_SESSION_KEY"]) expect(env[key]).toBeUndefined();
});

test("native setup confirms its own process health and shuts down only its child", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-native-dashboard-"));
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.json({ ok: true, version: "0.21.5" }) });
  try {
    const executable = join(root, "hermes");
    await writeFile(executable, `#!/bin/sh\ncase "$*" in *--help*) echo '--no-open --isolated --host --port'; exit 0;; esac\nprintf 'HERMES_DASHBOARD_READY port=${server.port}\\n'\nexec sleep 60\n`);
    await chmod(executable, 0o700);
    const native = createNativeDashboard(root, { executable, startupTimeoutMs: 2000 });
    const result = await native.open();
    expect(result.url).toBe(`http://127.0.0.1:${server.port}/env`);
    expect(await native.open()).toEqual(result);
    await native.stop();
    expect((await fetch(`http://127.0.0.1:${server.port}/api/health`)).ok).toBe(true);
    await expect(native.open()).rejects.toThrow("stopped");
  } finally { server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("native readiness waits for a complete sentinel across stream chunks", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-native-chunks-"));
  const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => Response.json({ ok: true, version: "0.21.5" }) });
  const native = createNativeDashboard(root, { executable: join(root, "hermes"), startupTimeoutMs: 3000 });
  try {
    const port = String(server.port);
    await writeFile(join(root, "hermes"), `#!/bin/sh\ncase "$*" in *--help*) echo '--no-open --isolated --host --port'; exit 0;; esac\nprintf 'HERMES_DASHBOARD_READY port=${port.slice(0, 2)}'\nsleep 0.1\nprintf '${port.slice(2)}\\n'\nexec sleep 60\n`);
    await chmod(join(root, "hermes"), 0o700);
    expect((await native.open()).url).toBe(`http://127.0.0.1:${server.port}/env`);
  } finally { await native.stop(); server.stop(true); await rm(root, { recursive: true, force: true }); }
});

test("failed native startup reaps resistant owned children before retry", async () => {
  if (process.platform === "win32") return;
  const root = await mkdtemp(join(tmpdir(), "boomkin-native-reap-"));
  const native = createNativeDashboard(root, { executable: join(root, "hermes"), startupTimeoutMs: 300 });
  try {
    await writeFile(join(root, "hermes"), `#!/bin/sh\ncase "$*" in *--help*) echo '--no-open --isolated --host --port'; exit 0;; esac\necho $$ >> '${join(root, "pids")}'\ntrap '' TERM\nwhile :; do sleep 1; done\n`);
    await chmod(join(root, "hermes"), 0o700);
    for (let attempt = 0; attempt < 2; attempt++) {
      await expect(native.open()).rejects.toThrow("timed out");
      const pids = (await readFile(join(root, "pids"), "utf8")).trim().split("\n").map(Number);
      expect(pids).toHaveLength(attempt + 1);
      for (const pid of pids) expect(() => process.kill(pid, 0)).toThrow();
    }
  } finally { await native.stop(); await rm(root, { recursive: true, force: true }); }
}, 10_000);

test("native setup failure reveals no captured logs or credentials", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-native-failure-"));
  try {
    const executable = join(root, "hermes");
    await writeFile(executable, "#!/bin/sh\ncase \"$*\" in *--help*) echo '--no-open --isolated --host --port'; exit 0;; esac\necho 'PRIVATE_FIXTURE_LOG' >&2\nexit 2\n");
    await chmod(executable, 0o700);
    const native = createNativeDashboard(root, { executable, startupTimeoutMs: 1000 });
    await expect(native.open()).rejects.toThrow("prerequisites");
    await native.stop();
  } finally { await rm(root, { recursive: true, force: true }); }
});
