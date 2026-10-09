/** Reap a launched child and, when detached, its owned process group. */
export async function terminateOwnedProcess(child: Bun.Subprocess, group: boolean, graceMs = 2000): Promise<void> {
  const signal = (value: "SIGTERM" | "SIGKILL") => {
    try {
      if (group) process.kill(-child.pid, value);
      else if (child.exitCode === null) child.kill(value);
    } catch { /* The owned process or group has already exited. */ }
  };
  const groupExists = () => {
    try { process.kill(-child.pid, 0); return true; }
    catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
  };
  signal("SIGTERM");
  let timer!: ReturnType<typeof setTimeout>;
  const escalation = new Promise<void>(done => {
    timer = setTimeout(() => { signal("SIGKILL"); done(); }, graceMs);
  });
  try {
    await child.exited;
    // A terminal parent is not proof that a descendant npm/tool process died.
    if (group && groupExists()) await escalation;
  } finally { clearTimeout(timer); }
}
