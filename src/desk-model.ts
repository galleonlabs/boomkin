import { join, resolve } from "node:path";
import { findRuntime } from "./hermes.ts";
import { terminateOwnedProcess } from "./processes.ts";

export function dashboardEnvironment(directory: string, inherited = process.env): NodeJS.ProcessEnv {
  const root = resolve(directory);
  const env: NodeJS.ProcessEnv = { ...inherited, HERMES_HOME: root, HERMES_CONFIG: join(root, "config.yaml"), HERMES_ENV: join(root, ".env") };
  for (const key of ["HERMES_DESKTOP", "HERMES_SERVE_HEADLESS", "HERMES_WEB_DIST", "HERMES_DASHBOARD_SESSION_TOKEN", "HERMES_SESSION_KEY"]) delete env[key];
  return env;
}

export function createNativeDashboard(directory: string, options: { executable?: string; startupTimeoutMs?: number; environment?: NodeJS.ProcessEnv } = {}) {
  let child: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
  let probe: Bun.Subprocess<"ignore", "pipe", "pipe"> | undefined;
  let opening: Promise<{ url: string }> | undefined;
  let readyUrl: string | undefined;
  let stopped = false;
  const terminate = async (target: Bun.Subprocess | undefined) => {
    if (!target) return;
    await terminateOwnedProcess(target, process.platform !== "win32");
    if (child === target) { child = undefined; readyUrl = undefined; }
    if (probe === target) probe = undefined;
  };
  const stop = async () => {
    stopped = true;
    await Promise.all([terminate(child), terminate(probe)]);
    readyUrl = undefined;
  };
  const open = async (): Promise<{ url: string }> => {
    if (stopped) throw new Error("The desk has stopped");
    if (readyUrl && child?.exitCode === null) return { url: readyUrl };
    if (opening) return opening;
    opening = (async () => {
      const executable = options.executable ?? await findRuntime(directory);
      if (!executable) throw new Error("Prepare native Hermes before connecting a model");
      const env = dashboardEnvironment(directory, options.environment);
      const helpProbe = probe = Bun.spawn([executable, "--profile", "default", "dashboard", "--help"], { cwd: resolve(directory), env, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: process.platform !== "win32" });
      void new Response(helpProbe.stderr).arrayBuffer();
      const probeTimeout = setTimeout(() => { void terminate(helpProbe); }, 15_000);
      let help: string, probeCode: number;
      try { help = await new Response(helpProbe.stdout).text(); probeCode = await helpProbe.exited; }
      finally { clearTimeout(probeTimeout); }
      if (probe === helpProbe) probe = undefined;
      if (probeCode !== 0 || ["--no-open", "--isolated", "--host", "--port"].some(flag => !help.includes(flag))) throw new Error("This Hermes installation lacks the reviewed browser setup contract. Use its native update or boomkin model in your terminal.");
      if (stopped) throw new Error("The desk has stopped");
      const started = child = Bun.spawn([executable, "--profile", "default", "dashboard", "--no-open", "--isolated", "--host", "127.0.0.1", "--port", "0"], { cwd: resolve(directory), env, stdin: "ignore", stdout: "pipe", stderr: "pipe", detached: process.platform !== "win32" });
      let resolvePort!: (port: number) => void;
      const portReady = new Promise<number>(done => { resolvePort = done; });
      const consume = async (stream: ReadableStream<Uint8Array>) => {
        const decoder = new TextDecoder();
        let tail = "";
        for await (const bytes of stream) {
          const lines = (tail + decoder.decode(bytes, { stream: true })).split("\n");
          tail = lines.pop()!.slice(-4096);
          for (const line of lines) {
            const match = line.match(/^HERMES_DASHBOARD_READY port=(\d{1,5})\r?$/);
            if (match && Number(match[1]) >= 1 && Number(match[1]) <= 65535) resolvePort(Number(match[1]));
          }
        }
      };
      // Native logs can include auth details. Drain them without returning them to the desk.
      void consume(started.stdout).catch(() => {});
      void consume(started.stderr).catch(() => {});
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const port = await Promise.race([
          portReady,
          started.exited.then(() => { throw new Error("Native browser setup exited before it was ready. Check Hermes's dashboard prerequisites, including its supported Node.js version, or use boomkin model in your terminal."); }),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Native browser setup timed out while preparing its dashboard. Check Hermes's prerequisites or use boomkin model in your terminal.")), options.startupTimeoutMs ?? 900_000); }),
        ]);
        if (stopped || started.exitCode !== null) throw new Error("Native browser setup has stopped");
        const origin = `http://127.0.0.1:${port}`;
        const response = await fetch(`${origin}/api/health`, { redirect: "error", signal: AbortSignal.timeout(5000) });
        const health = await response.json() as { ok?: unknown; version?: unknown };
        if (!response.ok || health.ok !== true || typeof health.version !== "string" || started.exitCode !== null) throw new Error("Native browser setup did not confirm its health");
        readyUrl = `${origin}/env`;
        return { url: readyUrl };
      } catch (error) { await terminate(started); throw error; }
      finally { if (timeout) clearTimeout(timeout); }
    })();
    try { return await opening; } finally { opening = undefined; }
  };
  return { open, stop };
}
