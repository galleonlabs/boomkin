import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import catalogFile from "../catalog/skills.json";
import packageFile from "../package.json";
import { installedVersion, parseCatalog, type Catalog, type Pack } from "./core.ts";
import { hermesModelConfigured, localProfileStatus, readHermesConfig } from "./hermes.ts";
import { verifyIntegrity } from "./integrity.ts";
import { compareDeskRuns, type ComparisonSnapshot } from "./desk-comparison.ts";
import { checkProjectRun, createProject, listProjects, projectRuns, readProject, renderProjectPrompt, runProject, type Evidence, type Project, type ProjectRun } from "./projects.ts";

export type DeskKind = "wallet" | "market" | "strategy";
export type DeskRunState = "queued" | "running" | "complete" | "partial" | "failed" | "cancelled" | "interrupted";
export interface DeskRun {
  schemaVersion: 1; id: string; project: string; kind: DeskKind; state: DeskRunState;
  createdAt: string; finishedAt?: string; progress: string; error?: string; execution?: "native-hermes"; resultSha256?: string;
}
interface DeskProject { schemaVersion: 1; kind: DeskKind; title: string; execution?: "native-hermes"; maxTurns?: number; parent?: { project: string; runId: string }; }
export interface DeskOptions {
  directory: string; catalog?: Catalog; assetsDirectory?: string; port?: number;
  onSetup?: (signal: AbortSignal) => Promise<unknown>; onModelSetup?: (signal: AbortSignal) => Promise<unknown>;
  /** For adapter tests; production requests always use the fixed public helper URLs. */
  fetcher?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Reviewed native executable override for launcher contract tests only; never a request input. */
  nativeExecutable?: string;
}
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
const object = (value: unknown): value is Record<string, any> => !!value && typeof value === "object" && !Array.isArray(value);
const slug = /^[a-z0-9][a-z0-9-]{0,62}$/;
const runPattern = /^\d{4}-\d{2}-\d{2}T[0-9-]+Z-[0-9a-f]{8}$/;
const kinds: Record<DeskKind, { workflow: string; pack: string; skill: string; module: string }> = {
  wallet: { workflow: "hyperliquid-wallet-audit", pack: "hyperliquid-skills", skill: "hyperliquid-wallet-audit", module: "audit-engine.mjs" },
  market: { workflow: "market-snapshot", pack: "defi-data-skills", skill: "galleon-defi-market-snapshot", module: "market-data.mjs" },
  strategy: { workflow: "strategy-backtest", pack: "defi-strategy-skills", skill: "galleon-defi-strategy-backtest", module: "engine.mjs" },
};
class DeskError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
function validName(value: string) { if (!slug.test(value)) throw new DeskError("Invalid project name"); return value; }
function validRun(value: string) { if (!runPattern.test(value)) throw new DeskError("Invalid run ID"); return value; }
async function safe(root: string, parts: string[] = []) {
  let path = resolve(root);
  for (const part of ["", ...parts]) {
    if (part) {
      if (!/^[a-zA-Z0-9.][a-zA-Z0-9._-]*$/.test(part) || part === "." || part === "..") throw new DeskError("Invalid managed path");
      path = join(path, part);
    }
    try { if ((await lstat(path)).isSymbolicLink()) throw new DeskError("Refusing a symbolic link in a managed desk path", 409); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  return path;
}
async function limitedBytes(path: string, maxBytes = 1_048_576) {
  const info = await lstat(path);
  if (!info.isFile() || info.size > maxBytes) throw new DeskError("Expected a bounded regular file", 409);
  return readFile(path);
}
async function limited(path: string, maxBytes = 1_048_576) {
  return (await limitedBytes(path, maxBytes)).toString("utf8");
}
async function atomic(root: string, parts: string[], value: string) {
  const path = await safe(root, parts), temporary = path + "." + randomUUID() + ".tmp";
  try {
    await writeFile(temporary, value, { flag: "wx", mode: 0o600 });
    await safe(root, parts);
    await rename(temporary, path);
  } finally { await rm(temporary, { force: true }); }
}
const projectParts = (name: string) => [".boomkin", "projects", validName(name)];
const runParts = (name: string, id: string) => [...projectParts(name), "runs", validRun(id)];
function parseRun(value: unknown, name: string, id: string): DeskRun {
  if (!object(value) || value.schemaVersion !== 1 || value.project !== name || value.id !== id || !Object.hasOwn(kinds, value.kind) || !["queued", "running", "complete", "partial", "failed", "cancelled", "interrupted"].includes(value.state) || typeof value.createdAt !== "string" || !Number.isFinite(Date.parse(value.createdAt)) || typeof value.progress !== "string") throw new DeskError("Saved desk run is malformed; files were preserved", 409);
  return value as DeskRun;
}
function parseMetadata(value: unknown): DeskProject {
  if (!object(value) || value.schemaVersion !== 1 || !Object.hasOwn(kinds, value.kind) || typeof value.title !== "string" || !value.title.trim() || value.title.length > 160) throw new DeskError("Saved desk project is malformed; files were preserved", 409);
  if (value.parent !== undefined && (!object(value.parent) || typeof value.parent.project !== "string" || !slug.test(value.parent.project) || typeof value.parent.runId !== "string" || !runPattern.test(value.parent.runId))) throw new DeskError("Saved parent capture is malformed; files were preserved", 409);
  return value as DeskProject;
}
function normalizeInput(kind: DeskKind, input: unknown) {
  if (!object(input)) throw new DeskError("Inputs must be an object");
  const allowed = kind === "wallet" ? ["account", "startTime", "endTime", "network", "maxPages"] : kind === "market" ? ["asset"] : ["asset", "days", "template", "initialCashUsd", "feeBps", "slippageBps", "amountUsd", "datasetSource", "dataset"];
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new DeskError("Unknown task input");
  if (kind === "wallet") {
    const network = input.network ?? "mainnet", maxPages = input.maxPages ?? 10;
    if (typeof input.account !== "string" || !/^0x[\da-f]{40}$/i.test(input.account) || /^0x0{40}$/i.test(input.account)) throw new DeskError("Enter a nonzero public Hyperliquid address");
    for (const key of ["startTime", "endTime"]) if (typeof input[key] !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(input[key]) || !Number.isFinite(Date.parse(input[key]))) throw new DeskError("Choose UTC start and end times");
    if (Date.parse(input.startTime) >= Date.parse(input.endTime) || Date.parse(input.endTime) > Date.now() + 300_000) throw new DeskError("Choose an ordered window ending no later than now");
    if (!["mainnet", "testnet"].includes(network) || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 50) throw new DeskError("Choose mainnet/testnet and 1–50 history pages");
    return { account: input.account.toLowerCase(), startTime: new Date(input.startTime).toISOString(), endTime: new Date(input.endTime).toISOString(), network, maxPages };
  }
  const asset = input.asset ?? "bitcoin";
  if (typeof asset !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(asset)) throw new DeskError("Use the exact CoinGecko asset ID, for example ethereum");
  if (kind === "market") return { asset };
  const result = { asset, days: input.days ?? 180, template: input.template ?? "sma-10", initialCashUsd: input.initialCashUsd ?? 10000, feeBps: input.feeBps ?? 10, slippageBps: input.slippageBps ?? 5, ...(input.amountUsd !== undefined ? { amountUsd: input.amountUsd } : {}), datasetSource: input.datasetSource ?? "live", ...(input.dataset !== undefined ? { dataset: input.dataset } : {}) };
  if (!Number.isInteger(result.days) || result.days < 91 || result.days > 365 || !["buy-and-hold", "weekly-dca", "sma-10", "sma-30"].includes(result.template)) throw new DeskError("Choose a documented rule and 91–365 days");
  for (const key of ["initialCashUsd", "feeBps", "slippageBps", "amountUsd"] as const) if (result[key] !== undefined && (typeof result[key] !== "number" || !Number.isFinite(result[key]) || result[key] < (key === "initialCashUsd" || key === "amountUsd" ? 0.01 : 0) || result[key] > (key === "feeBps" || key === "slippageBps" ? 1000 : 1e9))) throw new DeskError("Invalid cash or cost assumptions");
  if (result.template === "weekly-dca" && result.amountUsd === undefined) throw new DeskError("Weekly DCA requires an explicit purchase budget");
  if (!["live", "bundled", "upload"].includes(result.datasetSource) || result.datasetSource === "upload" && !object(result.dataset) || result.datasetSource !== "upload" && result.dataset !== undefined) throw new DeskError("Choose live, bundled or an uploaded daily dataset");
  if (result.dataset !== undefined && Buffer.byteLength(json(result.dataset)) > 262144) throw new DeskError("Uploaded dataset exceeds 256 KiB", 413);
  if (result.datasetSource === "bundled" && result.asset !== "bitcoin") throw new DeskError("The bundled historical dataset is Bitcoin; choose its exact asset ID");
  return result;
}

/** Loopback-only, model-free research desk over verified installed Galleon helpers. */
export async function startDesk(options: DeskOptions) {
  const root = resolve(options.directory), assets = resolve(options.assetsDirectory ?? join(import.meta.dir, "../desk"));
  const catalog = parseCatalog(options.catalog ?? catalogFile), token = randomBytes(32).toString("hex");
  const active = new Map<string, { controller: AbortController; done: Promise<void> }>();
  const preparing = new Map<string, { controller: AbortController; done: Promise<void> }>();
  let stopped = false;
  let stopping: Promise<void> | undefined;
  let profileCache = { runtimeAvailable: false, modelConfigured: false, credentialConfigured: false, authenticated: "unverified" as const };
  let profileCheckedAt = 0, profileGeneration = 0, profilePromise: Promise<void> | undefined, profileController: AbortController | undefined;
  let setup: { state: "running" | "complete" | "failed"; action: "public-tools" | "model"; message: string; result?: { url: string } } | undefined;
  let setupPromise: Promise<void> | undefined;
  let setupController: AbortController | undefined;
  await safe(root);
  await mkdir(root, { recursive: true, mode: 0o700 });
  await mkdir(await safe(root, [".boomkin"]), { recursive: true, mode: 0o700 });
  const lock = await safe(root, [".boomkin", "desk.lock"]);
  try { await mkdir(lock, { mode: 0o700 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const recovery = await safe(root, [".boomkin", "desk-recovery.lock"]);
    try { await mkdir(recovery, { mode: 0o700 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new DeskError("Desk lock recovery is already in progress. Retry after it finishes; inspect a retained recovery lock before removing it", 409); throw error; }
    try {
    await writeFile(join(recovery, "owner.json"), json({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });
    let owner;
    try { owner = JSON.parse(await limited(await safe(root, [".boomkin", "desk.lock", "owner.json"]))); }
    catch { throw new DeskError("Desk lock has no verifiable owner; preserve it and inspect the profile", 409); }
    if (!object(owner) || !Number.isSafeInteger(owner.pid) || owner.pid <= 0) throw new DeskError("Desk lock owner is malformed", 409);
    let alive = true;
    try { process.kill(owner.pid, 0); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ESRCH") alive = false; }
    if (alive) throw new DeskError("A desk already owns this profile. Use its existing window", 409);
    await rm(lock, { recursive: true });
    await mkdir(lock, { mode: 0o700 });
    } finally { await rm(recovery, { recursive: true, force: true }); }
  }
  await writeFile(join(lock, "owner.json"), json({ pid: process.pid, startedAt: new Date().toISOString() }), { flag: "wx", mode: 0o600 });

  async function readMetadata(name: string) { return parseMetadata(JSON.parse(await limited(await safe(root, [...projectParts(name), "desk.json"])))) ; }
  async function readDeskRun(name: string, id: string) { return parseRun(JSON.parse(await limited(await safe(root, [...runParts(name, id), "desk.json"]))), name, id); }
  async function saveRun(run: DeskRun) { await atomic(root, [...runParts(run.project, run.id), "desk.json"], json(run)); }
  async function projectDto(project: Project) {
    const meta = await readMetadata(project.name), runs: DeskRun[] = [];
    for (const run of await projectRuns(root, project.name)) {
      try { runs.push(await readDeskRun(project.name, run.id)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return { name: project.name, title: meta.title, kind: meta.kind, ...(meta.execution ? { execution: meta.execution } : {}), ...(meta.parent ? { parent: meta.parent } : {}), createdAt: project.createdAt, inputs: project.inputs, runs: runs.reverse() };
  }
  async function projects() {
    const result = [];
    for (const project of await listProjects(root)) {
      try { result.push(await projectDto(project)); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    }
    return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  // Owning the profile-wide lock proves that any previous desk process is gone.
  // Record interruption instead of silently presenting an unfinished capture.
  try {
    for (const project of await projects()) for (const run of project.runs) if (["queued", "running"].includes(run.state)) {
      run.state = "interrupted"; run.finishedAt = new Date().toISOString(); run.progress = "The previous desk stopped before this run finished. Refresh to capture new evidence.";
      await saveRun(run);
      const previous = (await projectRuns(root, project.name)).find(item => item.id === run.id)!;
      await atomic(root, [...runParts(project.name, run.id), "run.json"], json({ ...previous, state: "failed", finishedAt: run.finishedAt, issues: [run.progress] }));
      // A crashed desk can leave a native child alive. Its native lock needs
      // process inspection; a finished HTTP server is insufficient proof.
      if (run.execution !== "native-hermes") await rm(await safe(root, [...projectParts(project.name), "run.lock"]), { recursive: true, force: true });
    }
  } catch (error) { await rm(lock, { recursive: true, force: true }); throw error; }

  async function installed(kind: DeskKind): Promise<{ pack: Pack; path: string }> {
    const contract = kinds[kind], recorded = JSON.parse(await limited(await safe(root, [".boomkin", "last-sync.json"])));
    const selected = parseCatalog(recorded.catalog), pack = selected.packs.find(item => item.id === contract.pack && item.skills.includes(contract.skill));
    const reviewed = catalog.packs.find(item => item.id === contract.pack);
    if (!pack || !reviewed) throw new DeskError(`Install ${contract.pack} in this profile`, 409);
    if (pack.version !== reviewed.version || pack.revision !== reviewed.revision || json(pack) !== json(reviewed)) throw new DeskError("Installed release differs from the reviewed catalog; review update before running", 409);
    const skills = await safe(root, ["skills"]), skillPath = await safe(root, ["skills", contract.skill]);
    if (installedVersion(await limited(await safe(root, ["skills", contract.skill, "SKILL.md"]))) !== pack.version) throw new DeskError("Installed skill version differs from its recorded release", 409);
    const issues = await verifyIntegrity(skills, { schemaVersion: 3, packs: [pack] }, recorded.integrity);
    if (issues.length) throw new DeskError(issues.join("; "), 409);
    const path = await safe(root, ["skills", contract.skill, "scripts", contract.module]);
    await limited(path);
    return { pack, path };
  }
  async function reserve<T>(key: string, operation: (controller: AbortController) => Promise<T>): Promise<T> {
    if (stopped) throw new DeskError("This desk is shutting down", 503);
    if (setup?.state === "running") throw new DeskError("Finish setup before starting research", 409);
    if (preparing.has(key) || active.has(key)) throw new DeskError("This project already has an active run", 409);
    const controller = new AbortController();
    let release!: () => void;
    const done = new Promise<void>(resolve => { release = resolve; });
    // Reserve before any filesystem await. Setup and shutdown see preparations
    // as owned work, including the gap before an adapter/native child starts.
    preparing.set(key, { controller, done });
    try { return await operation(controller); }
    finally { preparing.delete(key); release(); }
  }
  function checkProfile() {
    if (profilePromise || Date.now() - profileCheckedAt < 60_000 || stopped) return;
    const generation = profileGeneration;
    profileController = new AbortController();
    profilePromise = localProfileStatus(root, { signal: profileController.signal }).then(value => {
      if (generation === profileGeneration) profileCache = { runtimeAvailable: value.runtime.available, modelConfigured: value.modelConfigured, credentialConfigured: value.credentialConfigured, authenticated: value.authenticated };
    }, () => { if (generation === profileGeneration) profileCache.runtimeAvailable = false; }).finally(() => { profileCheckedAt = generation === profileGeneration ? Date.now() : 0; profilePromise = undefined; profileController = undefined; });
  }
  async function status() {
    checkProfile();
    let modelConfigured = false;
    try { modelConfigured = hermesModelConfigured(await readHermesConfig(root)); } catch {}
    const profile = { ...profileCache, modelConfigured, runtimeChecking: !!profilePromise };
    const capabilities = await Promise.all((Object.keys(kinds) as DeskKind[]).map(async kind => {
      try { await installed(kind); return { kind, ready: true, issues: [] as string[] }; }
      catch (error) { return { kind, ready: false, issues: [(error as NodeJS.ErrnoException).code === "ENOENT" ? `Install ${kinds[kind].pack} in this profile` : (error as Error).message] }; }
    }));
    return { schemaVersion: 1, version: packageFile.version, ready: capabilities.every(item => item.ready), profile, capabilities, activeRuns: active.size + preparing.size, ...(setup ? { setup } : {}), setupAvailable: !!options.onSetup, modelSetupAvailable: !!options.onModelSetup };
  }
  async function create(body: unknown) { return reserve(`create-${randomUUID()}`, async controller => {
    if (!object(body) || !Object.hasOwn(kinds, body.kind) || Object.keys(body).some(key => !["kind", "title", "inputs"].includes(key))) throw new DeskError("Choose wallet, market or strategy");
    const kind = body.kind as DeskKind, input = normalizeInput(kind, body.inputs) as Record<string, any>;
    const title = body.title ?? (kind === "wallet" ? "Hyperliquid wallet review" : kind === "market" ? `${input.asset} market research` : `${input.asset} strategy test`);
    if (typeof title !== "string" || !title.trim() || title.length > 160) throw new DeskError("Title must contain 1–160 characters");
    const name = `${kind}-${randomUUID().slice(0, 8)}`;
    controller.signal.throwIfAborted();
    const { dataset, ...savedInput } = input;
    if (dataset) savedInput.uploadedDatasetSha256 = sha(json(dataset));
    const project = await createProject(root, { name, workflow: kinds[kind].workflow, inputs: savedInput, objective: title }, catalog);
    if (dataset) await writeFile(await safe(root, [...projectParts(name), "input.json"]), json(dataset), { flag: "wx", mode: 0o600 });
    await writeFile(await safe(root, [...projectParts(name), "desk.json"]), json({ schemaVersion: 1, kind, title }), { flag: "wx", mode: 0o600 });
    return projectDto(project);
  }); }
  async function runDetails(name: string, id: string) {
    const run = await readDeskRun(name, id), parts = runParts(name, id);
    const integrity = { issues: [] as string[], resultVerified: false };
    function parseSaved(value: string, file: string) { try { return JSON.parse(value); } catch { integrity.issues.push(`${file} contains invalid JSON`); return null; } }
    async function optional(file: string, parse = false) { try { const value = await limited(await safe(root, [...parts, file]), 20_971_520); return parse ? parseSaved(value, file) : value; } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; } }
    const resultText = await optional("result.json");
    if (["complete", "partial"].includes(run.state)) {
      integrity.issues = (await checkProjectRun(root, name, id)).issues;
      if (run.resultSha256 !== undefined) {
        integrity.resultVerified = typeof run.resultSha256 === "string" && /^[a-f0-9]{64}$/.test(run.resultSha256) && resultText !== null && sha(resultText) === run.resultSha256;
        if (!integrity.resultVerified) integrity.issues.push("Structured result changed or is missing since this capture finished");
      }
    }
    return { run, report: await optional("report.md"), evidence: await optional("evidence.json", true), result: resultText === null ? null : parseSaved(resultText, "result.json"), integrity };
  }
  async function comparisonSnapshot(name: string, id: string): Promise<ComparisonSnapshot> {
    const detail = await runDetails(name, id), record = (await projectRuns(root, name)).find(run => run.id === id)!;
    // Known-invalid evidence/briefs must still return a structured unavailable
    // comparison, even when the changed brief can no longer be parsed.
    const brief = detail.integrity.issues.length ? { inputs: {} } : JSON.parse(await limited(await safe(root, [...runParts(name, id), "brief.json"])));
    return { run: detail.run, inputs: brief.inputs, packRevision: record.pack.revision, result: detail.result, evidence: detail.evidence?.observations ?? [], integrityIssues: detail.integrity.issues, resultVerified: detail.integrity.resultVerified };
  }
  async function startRun(name: string) { return reserve(name, async controller => {
    const project = await readProject(root, name), meta = await readMetadata(name), tools = await installed(meta.kind);
    controller.signal.throwIfAborted();
    if (meta.execution === "native-hermes") return startNative(project, meta, controller);
    const id = new Date().toISOString().replaceAll(":", "-").replace(".", "-") + "-" + randomUUID().slice(0, 8), parts = runParts(name, id);
    const output = await safe(root, parts), createdAt = new Date().toISOString();
    const brief = json(project), prompt = renderProjectPrompt(project, output, (await projectRuns(root, name)).at(-1));
    controller.signal.throwIfAborted();
    // The project lock interoperates with native Hermes project run.
    const projectLock = await safe(root, [...projectParts(name), "run.lock"]);
    try { await mkdir(projectLock, { mode: 0o700 }); } catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new DeskError("This project already has an active run or an unresolved run lock", 409); throw error; }
    const run: DeskRun = { schemaVersion: 1, id, project: name, kind: meta.kind, createdAt, state: "queued", progress: "Preparing verified research tools" };
    const record: ProjectRun = { schemaVersion: 1, id, project: name, createdAt, state: "prepared", briefSha256: sha(brief), promptSha256: sha(prompt), pack: tools.pack, maxTurns: 1 };
    try {
      await writeFile(join(projectLock, "owner.json"), json({ pid: process.pid, runId: id, owner: "desk" }), { flag: "wx", mode: 0o600 });
      await mkdir(output, { mode: 0o700 }); await mkdir(join(output, "sources"), { mode: 0o700 });
      for (const [file, value] of [["brief.json", brief], ["prompt.md", prompt], ["run.json", json(record)], ["desk.json", json(run)]]) await writeFile(join(output, file), value, { flag: "wx", mode: 0o600 });
    } catch (error) { await rm(projectLock, { recursive: true, force: true }); throw error; }
    // Register synchronously before the first adapter await. No duplicate capture.
    const entry = { controller, done: Promise.resolve() };
    active.set(name, entry);
    entry.done = execute(project, tools, run, record, controller.signal).finally(async () => { active.delete(name); await rm(projectLock, { recursive: true, force: true }); });
    return run;
  }); }
  async function followup(name: string, body: unknown) { return reserve(`followup-${name}`, async controller => {
    if (!object(body) || Object.keys(body).some(key => !["question", "maxTurns", "runId"].includes(key)) || typeof body.question !== "string" || !body.question.trim() || body.question.length > 4000) throw new DeskError("Enter a follow-up question under 4000 characters");
    if (body.runId !== undefined && (typeof body.runId !== "string" || !runPattern.test(body.runId))) throw new DeskError("Choose a valid saved run for the follow-up");
    const maxTurns = body.maxTurns ?? 10;
    if (!Number.isInteger(maxTurns) || maxTurns < 1 || maxTurns > 30) throw new DeskError("Follow-up requires 1–30 native model turns");
    const previous = await readProject(root, name), meta = await readMetadata(name);
    await installed(meta.kind);
    const runs = await projectRuns(root, name);
    const priorRun = body.runId ? runs.find(item => item.id === body.runId) : runs.filter(item => item.state === "ready-for-review").at(-1);
    if (!priorRun || priorRun.state !== "ready-for-review") throw new DeskError("Follow up on a completed result with verified evidence", 409);
    const priorDetail = await runDetails(name, priorRun.id);
    if (!["complete", "partial"].includes(priorDetail.run.state) || priorDetail.integrity.issues.length) throw new DeskError("Follow up on a completed result with verified evidence", 409);
    // Reuse the single-flight version probe used by status. Native runProject
    // independently validates the executable/help contract before launch.
    checkProfile(); await profilePromise;
    controller.signal.throwIfAborted();
    const config = await readHermesConfig(root);
    if (!profileCache.runtimeAvailable || !hermesModelConfigured(config)) throw new DeskError("Configure the native Hermes runtime and model first", 409);
    const derivedName = `followup-${randomUUID().slice(0, 8)}`;
    const question = body.question.trim(), title = `Follow-up: ${question}`.slice(0, 160);
    const priorBrief = JSON.parse(await limited(await safe(root, [...runParts(name, priorRun.id), "brief.json"])));
    const project = await createProject(root, { name: derivedName, workflow: previous.workflow.id, objective: `Answer the user's follow-up using fresh public reads and the previous saved research as historical context. Question: ${question}`, inputs: { ...priorBrief.inputs, followupQuestion: question, previousProject: name, previousRunId: priorRun.id, previousReport: await safe(root, [...runParts(name, priorRun.id), "report.md"]), previousEvidence: await safe(root, [...runParts(name, priorRun.id), "evidence.json"]) } }, catalog);
    const derived: DeskProject = { schemaVersion: 1, kind: meta.kind, title, execution: "native-hermes", maxTurns, parent: { project: name, runId: priorRun.id } };
    await writeFile(await safe(root, [...projectParts(derivedName), "desk.json"]), json(derived), { flag: "wx", mode: 0o600 });
    const run = await startNative(project, derived, controller);
    return { project: await projectDto(project), run };
  }); }
  async function startNative(project: Project, meta: DeskProject, controller = new AbortController()): Promise<DeskRun> {
    if (active.has(project.name)) throw new DeskError("This project already has an active run", 409);
    let persisted: DeskRun | undefined, preparedResolve!: (run: DeskRun) => void, preparedReject!: (error: unknown) => void;
    const prepared = new Promise<DeskRun>((resolve, reject) => { preparedResolve = resolve; preparedReject = reject; });
    const entry = { controller, done: Promise.resolve() };
    active.set(project.name, entry);
    entry.done = (async () => {
      try {
        const launched = await runProject(root, project.name, {
          signal: controller.signal, executable: options.nativeExecutable, maxTurns: meta.maxTurns ?? 10,
          onPrepared: async (record: ProjectRun) => {
            persisted = { schemaVersion: 1, project: project.name, id: record.id, kind: meta.kind, execution: "native-hermes", createdAt: record.createdAt, state: "queued", progress: "Starting native Hermes with the configured model; provider usage may incur costs" };
            await saveRun(persisted); preparedResolve(persisted);
          },
          onProgress: async (message: string) => { if (persisted) { persisted.state = "running"; persisted.progress = message; await saveRun(persisted); } },
        });
        if (!persisted || !launched.run) throw new Error("Native research did not produce its saved run record");
        persisted.state = launched.run.state === "ready-for-review" ? "complete" : "partial";
        persisted.finishedAt = launched.run.finishedAt; persisted.progress = launched.run.state === "ready-for-review" ? "Native research saved with validated evidence" : "Native research finished with evidence gaps that need review";
        await saveRun(persisted);
      } catch (error) {
        if (!persisted) { preparedReject(error); return; }
        persisted.state = controller.signal.aborted ? "cancelled" : "failed"; persisted.finishedAt = new Date().toISOString();
        persisted.error = controller.signal.aborted ? "Native research cancelled; recorded evidence was preserved" : "Native research failed. Inspect the saved result and launching terminal before retrying.";
        persisted.progress = persisted.error; await saveRun(persisted);
      } finally { active.delete(project.name); }
    })();
    return prepared;
  }
  async function execute(project: Project, tools: { pack: Pack; path: string }, run: DeskRun, record: ProjectRun, signal: AbortSignal) {
    const parts = runParts(project.name, run.id), evidence: Evidence[] = [];
    async function progress(message: string) { signal.throwIfAborted(); run.progress = message; await saveRun(run); }
    async function artifact(filename: string, value: string | Uint8Array, source: string, summary: string, limitations: string[] = [], observedAt = new Date().toISOString()) {
      signal.throwIfAborted();
      const id = filename.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 63);
      await writeFile(await safe(root, [...parts, "sources", filename]), value, { flag: "wx", mode: 0o600 });
      evidence.push({ id, source, observedAt, summary, artifact: `sources/${filename}`, sha256: sha(value), limitations });
    }
    let readSequence = 0;
    const fetcher = async (resource: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      signal.throwIfAborted();
      const url = String(resource), parsed = new URL(url);
      if (!(["api.hyperliquid.xyz", "api.hyperliquid-testnet.xyz", "api.coingecko.com", "coins.llama.fi"].includes(parsed.hostname)) || parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) throw new DeskError("Helper requested an unreviewed endpoint", 409);
      let label = parsed.hostname.includes("hyperliquid") ? "Fetching account history" : "Fetching public market data";
      if (typeof init?.body === "string") { const type = JSON.parse(init.body).type; label = ({ userRole: "Checking public account identity", userAbstraction: "Checking account balance mode", clearinghouseState: "Fetching current perpetual exposure", spotClearinghouseState: "Fetching spot balances", frontendOpenOrders: "Fetching visible open orders", userFillsByTime: "Fetching fill history", userFunding: "Fetching funding cashflows" } as Record<string, string>)[type] ?? label; }
      await progress(label);
      const sequence = ++readSequence;
      const response = await (options.fetcher ?? fetch)(resource, { ...init, credentials: "omit", redirect: "error", signal: init?.signal ? AbortSignal.any([signal, init.signal]) : signal });
      // Persist each completed response before the next read. Cancelling a
      // later page must not discard already captured public evidence.
      {
        const limit = run.kind === "wallet" ? 8_388_608 : 2_097_152, reader = response.body?.getReader();
        if (!reader || Number(response.headers.get("content-length")) > limit) throw new DeskError("Public response exceeds the capture bound", 502);
        const chunks: Uint8Array[] = []; let length = 0;
        try { for (;;) { const { done, value } = await reader.read(); signal.throwIfAborted(); if (done) break; length += value.length; if (length > limit) throw new DeskError("Public response exceeds the capture bound", 502); chunks.push(value); } }
        finally { await reader.cancel().catch(() => {}); }
        const bytes = Buffer.concat(chunks);
        new TextDecoder("utf-8", { fatal: true }).decode(bytes);
        await artifact(`read-${String(sequence).padStart(3, "0")}.${run.kind === "wallet" ? "txt" : "json"}`, bytes, url, `Raw public response: HTTP ${response.status}; historical timestamps are contained in the response`, [run.kind === "wallet" ? "Sequential exchange snapshot; full-window completeness is unverified." : "Aggregate observations are not executable quotes."]);
        return new Response(bytes, { status: response.status, headers: response.headers });
      }
    };
    try {
      run.state = "running"; record.state = "running"; await saveRun(run); await atomic(root, [...parts, "run.json"], json(record));
      const module = await import(pathToFileURL(tools.path).href + `?release=${tools.pack.revision}`);
      let result: any, report: string, partial = false;
      if (run.kind === "wallet") {
        const capture = await module.captureWallet({ address: project.inputs.account, network: project.inputs.network, startTime: Date.parse(String(project.inputs.startTime)), endTime: Date.parse(String(project.inputs.endTime)) }, { maxPages: project.inputs.maxPages, timeoutMs: 15000, fetchImpl: fetcher });
        signal.throwIfAborted();
        await progress("Calculating signed fees, funding and current exposure");
        const serialized = json(capture), endpoint = project.inputs.network === "testnet" ? "https://api.hyperliquid-testnet.xyz/info" : "https://api.hyperliquid.xyz/info";
        if (Buffer.byteLength(serialized) <= 20_971_520) await artifact("capture.json", serialized, endpoint, "Captured public request/response manifest with hashes", ["Window completeness remains unverified."], capture.finishedAt);
        else {
          await writeFile(await safe(root, [...parts, "sources", "capture.json"]), serialized, { flag: "wx", mode: 0o600 });
          const manifest = { ...capture, evidence: capture.evidence.map(({ responseText, ...entry }: any) => ({ ...entry, responseArtifact: responseText !== null ? `sources/read-${String(entry.sequence).padStart(3, "0")}.txt` : null })) };
          await artifact("capture-manifest.json", json(manifest), endpoint, "Large capture manifest; raw responses are separate bounded evidence artifacts", ["Aggregate capture exceeds the individual evidence download bound; reconstruct from each response and this manifest."], capture.finishedAt);
        }
        result = module.analyzeCapture(capture);
        report = module.renderReport(result); partial = result.coverage.status === "partial";
      } else if (run.kind === "market") {
        result = await module.marketSnapshot({ ids: [project.inputs.asset], provider: "both" }, { fetch: fetcher, timeoutMs: 15000 });
        signal.throwIfAborted();
        if (result.status === "unavailable" || result.error) { await atomic(root, [...parts, "result.json"], json(result)); throw new DeskError("Market data is unavailable. Inspect provider errors and retry later.", 502); }
        const rows = result.reads.flatMap((read: any) => read.observations);
        report = `# ${project.inputs.asset} market snapshot\n\nExact identity: CoinGecko ID ${project.inputs.asset}. Public USD aggregate observations.\n\n` + rows.map((row: any) => row.ok ? `${row.provider}: ${row.priceUsd} USD, observed ${row.observedAt}, retrieved ${row.retrievedAt}.` : `${row.provider}: unavailable (${row.error}).`).join("\n\n") + `\n\n${result.limitations.join("\n\n")}\n\nA price snapshot alone cannot establish valuation, investment quality or a complete asset thesis.\n`;
        partial = result.status !== "complete";
      } else {
        const input = project.inputs as any;
        const source = `https://raw.githubusercontent.com/galleonlabs/crypto-defi-skills/${tools.pack.revision}/packages/strategy/skills/galleon-defi-strategy-backtest/scripts/engine.mjs`;
        let dataset;
        if (input.datasetSource === "upload") {
          const uploaded = await limited(await safe(root, [...projectParts(project.name), "input.json"]), 262144);
          if (sha(uploaded) !== input.uploadedDatasetSha256) throw new DeskError("Saved uploaded dataset changed; create a new project", 409);
          dataset = JSON.parse(uploaded); await progress("Validating uploaded daily observations");
        }
        else if (input.datasetSource === "bundled") { dataset = JSON.parse(await limited(await safe(assets, ["data", "bitcoin-180d.json"]), 262144)); await progress("Validating the explicitly selected historical Bitcoin series"); }
        else {
          const dataTools = await installed("market"), dataModule = await import(pathToFileURL(dataTools.path).href + `?release=${dataTools.pack.revision}`);
          const collected = await dataModule.collectHistory({ id: input.asset, days: input.days }, { fetch: fetcher, timeoutMs: 15000 });
          signal.throwIfAborted();
          if (!collected.ok) throw new DeskError(`Daily history unavailable (${collected.error}); no substitute data was used`, 502);
          dataset = collected.dataset;
        }
        const valid = module.validateDataset(dataset);
        if (valid.identity.namespace !== "coingecko" || valid.identity.id !== input.asset) throw new DeskError("Dataset identity differs from the selected CoinGecko asset", 409);
        const spec = module.createStrategySpec(input.template, { initialCashUsd: input.initialCashUsd, feeBps: input.feeBps, slippageBps: input.slippageBps, ...(input.amountUsd !== undefined ? { amountUsd: input.amountUsd } : {}) });
        await artifact("dataset.json", json(valid), valid.provenance.synthetic ? source : valid.provenance.source, `${valid.identity.id} daily USD observations, retrieved ${valid.provenance.retrievedAt}`, [valid.provenance.synthetic ? "Synthetic dataset: source URL documents the model, not market history. Dataset provenance remains in the captured JSON." : "Historical aggregate series; source timestamps and price type are retained."]);
        await artifact("specification.json", json(spec), source, "Frozen rule and explicit cash, fee and slippage assumptions", ["No parameter optimization or future-return claim."]);
        await progress("Comparing reference and held-out periods with higher trading costs");
        result = module.runStrategyValidation(valid, spec);
        result.inputHashes = { datasetSha256: sha(json(valid)), specificationSha256: sha(json(spec)), engineSha256: sha(await readFile(tools.path)) };
        report = `# ${input.asset} frozen-rule strategy validation\n\nEvidence: ${valid.provenance.synthetic ? "synthetic example" : "historical simulation"}. Source: ${valid.provenance.source}. Dataset retrieved ${valid.provenance.retrievedAt}.\n\nRule: ${input.template}. Each period restarts independently with ${input.initialCashUsd} USD.\n\n` + (["reference", "heldOut"] as const).map(period => {
          const row = result.periods[period];
          return `${period === "heldOut" ? "Held-out" : "Reference"}: ${row.period.firstObservation} to ${row.period.lastObservation}. Baseline ending equity ${row.baseline.metrics.endingEquityUsd} USD; maximum drawdown ${row.baseline.metrics.maxDrawdownPct}%. Higher-cost ending equity ${row.higherCosts.metrics.endingEquityUsd} USD. Same-cost buy-and-hold benchmark ${row.baseline.benchmark.metrics.endingEquityUsd} USD.`;
        }).join("\n\n") + `\n\n${result.limitations.join("\n\n")}\n`;
      }
      signal.throwIfAborted();
      report += "\n\nCaptured evidence:\n" + evidence.map(item => `\n- [${item.id}] ${item.summary}`).join("") + "\n";
      const resultText = json(result);
      await atomic(root, [...parts, "result.json"], resultText);
      run.resultSha256 = sha(resultText);
      await atomic(root, [...parts, "report.md"], report);
      await atomic(root, [...parts, "evidence.json"], json({ schemaVersion: 1, observations: evidence }));
      await atomic(root, [...parts, "plan.json"], json({ schemaVersion: 1, status: "no-action", authorization: "not-granted", summary: "Read-only research; no financial action or authority", steps: [] }));
      record.state = "needs-review"; record.finishedAt = new Date().toISOString();
      await atomic(root, [...parts, "run.json"], json(record));
      const checked = await checkProjectRun(root, project.name, run.id);
      if (checked.issues.length) throw new DeskError("Saved result failed evidence validation: " + checked.issues.join("; "), 409);
      record.state = "ready-for-review";
      await atomic(root, [...parts, "run.json"], json(record));
      run.state = partial ? "partial" : "complete"; run.finishedAt = record.finishedAt;
      run.progress = partial ? "Saved with explicit missing or partial observations" : "Research saved; sources and methodology are available";
      await saveRun(run);
    } catch (error) {
      const message = signal.aborted ? "Capture cancelled. Refresh starts a new run; previous evidence was preserved." : (error as Error).message;
      run.state = signal.aborted ? "cancelled" : "failed"; run.finishedAt = new Date().toISOString(); run.error = message; run.progress = message;
      record.state = "failed"; record.finishedAt = run.finishedAt; record.issues = [message];
      await atomic(root, [...parts, "evidence.json"], json({ schemaVersion: 1, observations: evidence }));
      await atomic(root, [...parts, "report.md"], `# Research incomplete\n\n${message}\n\n${evidence.map(item => `[${item.id}] ${item.summary}`).join("\n\n")}\n`);
      await atomic(root, [...parts, "plan.json"], json({ schemaVersion: 1, status: "no-action", authorization: "not-granted", summary: message, steps: [] }));
      await atomic(root, [...parts, "run.json"], json(record)); await saveRun(run);
    }
  }

  let origin = "";
  const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer", "content-security-policy": "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" };
  function response(value: unknown, status = 200) { return Response.json(value, { status, headers }); }
  async function requestJson(request: Request) {
    if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new DeskError("Use application/json", 415);
    if (Number(request.headers.get("content-length")) > 327680) throw new DeskError("Request exceeds 320 KiB", 413);
    const reader = request.body?.getReader(); if (!reader) throw new DeskError("JSON body is required");
    let length = 0; const chunks: Uint8Array[] = [];
    try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length; if (length > 327680) throw new DeskError("Request exceeds 320 KiB", 413); chunks.push(value); } }
    finally { await reader.cancel().catch(() => {}); }
    try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new DeskError("Invalid JSON request"); }
  }
  const server = await (async () => { try { return Bun.serve({
    hostname: "127.0.0.1", port: options.port ?? 0, maxRequestBodySize: 327680,
    async fetch(request) {
      try {
        if (stopped) throw new DeskError("This desk is shutting down", 503);
        const url = new URL(request.url);
        if (request.headers.get("host") !== new URL(origin).host || url.origin !== origin) throw new DeskError("Unexpected desk host", 403);
        const requestOrigin = request.headers.get("origin");
        if (requestOrigin && requestOrigin !== origin || request.headers.get("sec-fetch-site") === "cross-site") throw new DeskError("Only the local desk origin is allowed", 403);
        const path = url.pathname;
        if (path.startsWith("/api/")) {
          const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
          if (!/^[0-9a-f]{64}$/.test(supplied) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) throw new DeskError("This desk session requires its launch token", 401);
          if (!["GET", "POST"].includes(request.method)) throw new DeskError("Method not allowed", 405);
          if (request.method === "GET" && path === "/api/status") return response(await status());
          if (request.method === "GET" && path === "/api/projects") return response({ projects: await projects() });
          if (request.method === "POST" && ["/api/setup", "/api/model-setup"].includes(path)) {
            if (active.size || preparing.size || setup?.state === "running") throw new DeskError("A capture or setup is already running", 409);
            const callback = path === "/api/setup" ? options.onSetup : options.onModelSetup;
            if (!callback) throw new DeskError("This launcher does not provide this setup action", 409);
            setup = { state: "running", action: path === "/api/setup" ? "public-tools" : "model", message: path === "/api/setup" ? "Installing reviewed public research tools" : "Preparing Hermes's browser setup; the first build can take several minutes" };
            setupController = new AbortController();
            setupPromise = Promise.resolve().then(() => callback(setupController!.signal)).then(value => {
              profileCheckedAt = 0; profileGeneration++; profileController?.abort();
              let result;
              if (object(value) && typeof value.url === "string") {
                const destination = new URL(value.url);
                if (destination.protocol === "http:" && destination.hostname === "127.0.0.1" && !destination.username && !destination.password) result = { url: value.url };
              }
              setup = { ...setup!, state: "complete", message: result ? "Native model setup is available in its local window" : "Setup completed; readiness is checked against the selected profile", ...(result ? { result } : {}) };
            }).catch(error => { setup = { ...setup!, state: "failed", message: (error as Error).message }; });
            return response({ setup }, 202);
          }
          if (request.method === "POST" && path === "/api/projects") return response({ project: await create(await requestJson(request)) }, 201);
          const match = path.match(/^\/api\/projects\/([a-z0-9-]+)(?:\/runs\/([^/]+)(?:\/(export|cancel|evidence|compare)(?:\/([^/]+))?)?|\/(run|refresh|followup))?$/);
          if (!match) throw new DeskError("Unknown desk route", 404);
          const [, name, id, action, observationId, operation] = match;
          if (!id && !operation && request.method === "GET") return response({ project: await projectDto(await readProject(root, name)) });
          if (operation === "followup" && request.method === "POST") return response(await followup(name, await requestJson(request)), 202);
          if (operation && request.method === "POST") return response({ run: await startRun(name) }, 202);
          if (id) {
            if (action === "compare" && request.method === "GET") {
              const params = new URL(request.url).searchParams, baseline = params.get("baseline");
              if (!baseline || params.getAll("baseline").length !== 1 || [...params.keys()].some(key => key !== "baseline") || observationId) throw new DeskError("Choose one baseline run from this project");
              validRun(baseline); validRun(id);
              const before = await comparisonSnapshot(name, baseline), after = await comparisonSnapshot(name, id);
              return response(compareDeskRuns(after.run.kind, before, after));
            }
            if (action === "cancel" && request.method === "POST") {
              const run = await readDeskRun(name, id), pending = active.get(name);
              if (!pending || !["queued", "running"].includes(run.state)) throw new DeskError("This run is no longer active", 409);
              const current = (await projectRuns(root, name)).at(-1);
              if (current?.id !== id) throw new DeskError("Only the active run can be cancelled", 409);
              pending.controller.abort(); await pending.done; return response({ run: await readDeskRun(name, id) });
            }
            if (request.method === "GET" && action === "evidence") {
              if (!observationId || !slug.test(observationId)) throw new DeskError("Invalid observation ID");
              const detail = await runDetails(name, id), evidence = detail.evidence?.observations?.find((item: Evidence) => item.id === observationId) as Evidence | undefined;
              if (!evidence || !/^sources\/(?:[a-zA-Z0-9][a-zA-Z0-9._-]*\/)*[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(evidence.artifact)) throw new DeskError("Unknown captured observation", 404);
              const bytes = await limitedBytes(await safe(root, [...runParts(name, id), ...evidence.artifact.split("/")]), 20_971_520);
              if (sha(bytes) !== evidence.sha256) throw new DeskError("Captured artifact hash differs from its evidence record", 409);
              return new Response(bytes, { headers: { ...headers, "content-type": "text/plain; charset=utf-8" } });
            }
            if (request.method === "GET" && (!action || action === "export")) {
              const detail = await runDetails(name, id);
              if (action === "export") return new Response(json(detail), { headers: { ...headers, "content-type": "application/json", "content-disposition": `attachment; filename="${name}-${id}.json"` } });
              return response(detail);
            }
          }
          throw new DeskError("Unknown desk operation", 404);
        }
        if (request.method !== "GET" && request.method !== "HEAD") throw new DeskError("Method not allowed", 405);
        const files: Record<string, { parts: string[]; type: string }> = {
          "/": { parts: ["index.html"], type: "text/html; charset=utf-8" },
          "/index.html": { parts: ["index.html"], type: "text/html; charset=utf-8" },
          "/app.js": { parts: ["app.js"], type: "text/javascript; charset=utf-8" },
          "/style.css": { parts: ["style.css"], type: "text/css; charset=utf-8" },
          "/assets/app.js": { parts: ["app.js"], type: "text/javascript; charset=utf-8" },
          "/assets/ui.js": { parts: ["ui.js"], type: "text/javascript; charset=utf-8" },
          "/assets/desk.css": { parts: ["desk.css"], type: "text/css; charset=utf-8" },
          "/assets/favicon.svg": { parts: ["assets", "favicon.svg"], type: "image/svg+xml" },
          "/assets/manrope.ttf": { parts: ["assets", "manrope.ttf"], type: "font/ttf" },
          "/assets/strategy-engine.mjs": { parts: ["vendor", "strategy-engine.mjs"], type: "text/javascript; charset=utf-8" },
          "/assets/bitcoin-180d.json": { parts: ["data", "bitcoin-180d.json"], type: "application/json" },
          "/assets/synthetic-daily.json": { parts: ["data", "synthetic-daily.json"], type: "application/json" },
        };
        if (!Object.hasOwn(files, path)) throw new DeskError("Unknown desk asset", 404);
        const file = files[path], filePath = await safe(assets, file.parts);
        const stat = await lstat(filePath);
        if (!stat.isFile() || stat.size > 1_048_576) throw new DeskError("Expected a bounded regular asset", 409);
        const contents = await readFile(filePath);
        return new Response(request.method === "HEAD" ? null : contents, { headers: { ...headers, "content-type": file.type } });
      } catch (error) {
        const status = error instanceof DeskError ? error.status : (error as NodeJS.ErrnoException).code === "ENOENT" ? 404 : 500;
        return response({ error: { message: status === 500 ? "Desk operation failed; saved files were preserved" : (error as Error).message } }, status);
      }
    },
  }); } catch (error) { await rm(lock, { recursive: true, force: true }); throw error; } })();
  origin = `http://127.0.0.1:${server.port}`;
  return { url: `${origin}/#token=${token}`, server, async stop() {
    if (stopping) return stopping;
    stopped = true;
    stopping = (async () => {
    profileController?.abort();
    setupController?.abort();
    for (const entry of preparing.values()) entry.controller.abort();
    for (const entry of active.values()) entry.controller.abort();
    await Promise.allSettled([...preparing.values()].map(entry => entry.done));
    // A preparation can register its owned run while shutdown is waiting.
    for (const entry of active.values()) entry.controller.abort();
    await Promise.allSettled([...active.values()].map(entry => entry.done));
    await Promise.allSettled([profilePromise, setupPromise]); server.stop(true); await rm(lock, { recursive: true, force: true });
    })();
    return stopping;
  } };
}
