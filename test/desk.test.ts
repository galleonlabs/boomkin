import { expect, test } from "bun:test";
import { chmod, cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import catalogFile from "../catalog/skills.json";
import { parseCatalog } from "../src/core.ts";
import { startDesk, type DeskOptions } from "../src/desk.ts";
import { skillFiles } from "../src/integrity.ts";
import { hermesModelConfigured } from "../src/hermes.ts";
import { checkProjectRun, projectRuns } from "../src/projects.ts";

const catalog = parseCatalog(catalogFile);
const source = join(import.meta.dir, "../site");
const marketModule = `
export async function marketSnapshot(options, deps) {
  const reads = [];
  for (const provider of ['coingecko','defillama']) {
    const source = provider === 'coingecko' ? 'https://api.coingecko.com/api/v3/simple/price' : 'https://coins.llama.fi/prices/current/';
    const response = await deps.fetch(source);
    const raw = await response.json();
    reads.push({provider,source,observations:[raw.unavailable ? {ok:false,provider,error:'fixture_unavailable',identity:{namespace:'coingecko',id:options.ids[0]}} : {ok:true,provider,unit:'USD',priceUsd:raw.price,observedAt:raw.observedAt ?? new Date().toISOString(),retrievedAt:new Date().toISOString(),identity:{namespace:'coingecko',id:options.ids[0]}}]});
  }
  const count = reads.flatMap(x=>x.observations).filter(x=>x.ok).length;
  return {ok:count===2,status:count===2?'complete':count?'partial':'unavailable',parameters:{maxAgeSeconds:300},reads,comparisons:[],limitations:['Synthetic fixture: not a live quote.']};
}
export async function collectHistory(options,deps) { const response=await deps.fetch('https://api.coingecko.com/api/v3/coins/'+options.id+'/market_chart'); return {ok:true,dataset:await response.json()}; }
`;
const walletModule = String.raw`
export async function captureWallet(scope,{fetchImpl}) {
  const evidence=[];
  for (const type of ['userRole','userAbstraction','clearinghouseState','spotClearinghouseState','frontendOpenOrders','userFillsByTime','userFunding']) {
    const startedAt=new Date().toISOString(), response=await fetchImpl('https://api.hyperliquid.xyz/info',{method:'POST',body:JSON.stringify({type,user:scope.address}),signal:AbortSignal.timeout(2000)});
    evidence.push({sequence:evidence.length+1,type,endpoint:'https://api.hyperliquid.xyz/info',startedAt,finishedAt:new Date().toISOString(),responseText:await response.text(),httpStatus:response.status,error:null});
  }
  return {scope,evidence,finishedAt:new Date().toISOString()};
}
export function analyzeCapture(capture) { return {fixture:true,source:'synthetic',scope:capture.scope,coverage:{status:'partial',completeWindow:false,gaps:['Fixture coverage']},outcome:{observedNetUsdc:'18.75',closedPnlUsdc:'20',signedFeesByToken:{USDC:'1.5'},fundingUsdc:'0.25'},exposure:{positions:[],grossNotionalUsdc:'0',protectionStatus:'not-assessed'},execution:{costConcentration:[]},evidence:{entries:capture.evidence},limitations:['Synthetic fixture only; no portfolio-return claim.']}; }
export function renderReport(report) { return '# Wallet fixture\n\nObserved default-perp outcome '+report.outcome.observedNetUsdc+' USDC. Synthetic fixture only. Complete window unverified.\n'; }
`;
async function fixtureProfile(root: string) {
  await mkdir(join(root, ".boomkin"), { recursive: true });
  const packs = catalog.packs.filter(pack => ["hyperliquid-skills", "defi-data-skills", "defi-strategy-skills"].includes(pack.id));
  const integrity: Record<string, Record<string, string>> = {};
  for (const pack of packs) for (const skill of pack.skills) {
    const path = join(root, "skills", skill);
    await mkdir(path, { recursive: true });
    await writeFile(join(path, "SKILL.md"), `---\nname: ${skill}\nmetadata:\n  version: "${pack.version}"\n---\nFixture: no live model or financial action.\n`);
    if (["hyperliquid-wallet-audit", "galleon-defi-market-snapshot", "galleon-defi-strategy-backtest"].includes(skill)) await mkdir(join(path, "scripts"));
    if (skill === "hyperliquid-wallet-audit") await writeFile(join(path, "scripts", "audit-engine.mjs"), walletModule);
    if (skill === "galleon-defi-market-snapshot") await writeFile(join(path, "scripts", "market-data.mjs"), marketModule);
    if (skill === "galleon-defi-strategy-backtest") await cp(join(source, "vendor", "strategy-engine.mjs"), join(path, "scripts", "engine.mjs"));
    integrity[skill] = await skillFiles(path);
  }
  const runtime = join(root, ".boomkin", "runtime", ".venv", "bin");
  await mkdir(runtime, { recursive: true });
  await writeFile(join(runtime, "hermes"), "#!/bin/sh\nprintf 'Hermes Agent 0.21.5\\n'\n");
  await chmod(join(runtime, "hermes"), 0o700);
  await writeFile(join(root, ".boomkin", "last-sync.json"), JSON.stringify({ catalog: { schemaVersion: 3, packs }, integrity }));
}
async function withDesk(action: (ctx: Context) => Promise<void>, options: Partial<DeskOptions> = {}) {
  const base = await mkdtemp(join(tmpdir(), "boomkin-desk-")), root = join(base, "profile"), assets = join(base, "assets");
  await mkdir(root); await mkdir(assets); await mkdir(join(assets, "data")); await mkdir(join(assets, "assets"));
  await writeFile(join(assets, "index.html"), "<!doctype html><title>Boomkin fixture</title>");
  await writeFile(join(assets, "assets", "manrope.ttf"), new Uint8Array([0, 255, 127, 254]));
  await cp(join(source, "data", "bitcoin-180d.json"), join(assets, "data", "bitcoin-180d.json"));
  await fixtureProfile(root);
  let desk = await startDesk({ directory: root, assetsDirectory: assets, fetcher: (async () => Response.json({ fixture: true, price: 2500 })), ...options });
  const make = () => {
    const url = new URL(desk.url), token = new URLSearchParams(url.hash.slice(1)).get("token")!;
    const call = (path: string, method = "GET", body?: unknown, headers?: Record<string, string>) => fetch(url.origin + path, { method, headers: { authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    return { base, root, assets, desk, origin: url.origin, call, restart: async () => { await desk.stop(); desk = await startDesk({ directory: root, assetsDirectory: assets, fetcher: (async () => Response.json({ fixture: true, price: 2500 })), ...options }); return make(); } };
  };
  try { await action(make()); } finally { await desk.stop(); await rm(base, { recursive: true, force: true }); }
}
type Context = { base: string; root: string; assets: string; desk: Awaited<ReturnType<typeof startDesk>>; origin: string; call: (path: string, method?: string, body?: unknown, headers?: Record<string, string>) => Promise<Response>; restart: () => Promise<Context> };
async function create(ctx: Context, kind = "market", inputs: unknown = { asset: "ethereum" }) {
  const response = await ctx.call("/api/projects", "POST", { kind, inputs });
  expect(response.status).toBe(201);
  return (await response.json()).project;
}
async function start(ctx: Context, name: string) { const response = await ctx.call(`/api/projects/${name}/run`, "POST"); expect(response.status).toBe(202); return (await response.json()).run; }
async function finish(ctx: Context, name: string, id: string) {
  for (let i = 0; i < 100; i++) {
    const response = await ctx.call(`/api/projects/${name}/runs/${id}`), value = await response.json();
    if (!["queued", "running"].includes(value.run.state)) return value;
    await Bun.sleep(10);
  }
  throw new Error("Fixture run did not finish");
}

test("desk loopback API authenticates every route, refuses hostile origins and bounds request/path input", async () => withDesk(async ctx => {
  expect((await fetch(ctx.origin + "/api/status")).status).toBe(401);
  expect((await ctx.call("/api/status", "GET", undefined, { origin: "https://malicious.example" })).status).toBe(403);
  expect((await ctx.call("/api/status", "GET", undefined, { host: "malicious.example" })).status).toBe(403);
  expect((await ctx.call("/api/status", "GET", undefined, { "sec-fetch-site": "cross-site" })).status).toBe(403);
  expect((await ctx.call("/api/status", "DELETE")).status).toBe(405);
  expect((await ctx.call("/api/projects", "POST", { kind: "market", inputs: { asset: "ethereum", executable: "/tmp/tool" } })).status).toBe(400);
  expect((await ctx.call("/api/projects", "POST", { kind: "market", inputs: { asset: "../etc/passwd" } })).status).toBe(400);
  expect((await ctx.call("/api/projects", "POST", { kind: "market", inputs: { asset: "ethereum" }, title: "x".repeat(330000) })).status).toBe(413);
  expect((await ctx.call("/api/projects/../../.env")).status).toBe(404);
  expect((await fetch(ctx.origin + "/.env")).status).toBe(404);
  const html = await fetch(ctx.origin + "/");
  expect(html.headers.get("cache-control")).toBe("no-store");
  expect(html.headers.get("referrer-policy")).toBe("no-referrer");
  expect(html.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  expect(new Uint8Array(await (await fetch(ctx.origin + "/assets/manrope.ttf")).arrayBuffer())).toEqual(new Uint8Array([0, 255, 127, 254]));
}));

test("market capture saves real raw response bytes, supports reopening, refresh and evidence downloads", async () => withDesk(async ctx => {
  const status = await (await ctx.call("/api/status")).json();
  expect(status.ready).toBe(true); expect(status.profile.authenticated).toBe("unverified");
  expect(JSON.stringify(status)).not.toContain("token=");
  const project = await create(ctx), run = await start(ctx, project.name), details = await finish(ctx, project.name, run.id);
  expect(details.run.error).toBeUndefined(); expect(details.run.state).toBe("complete"); expect(details.integrity.issues).toEqual([]);
  expect(details.result.reads[0].observations[0].priceUsd).toBe(2500);
  expect(details.report).toContain("Synthetic fixture");
  expect(details.evidence.observations).toHaveLength(2);
  const observation = details.evidence.observations[0];
  const raw = await (await ctx.call(`/api/projects/${project.name}/runs/${run.id}/evidence/${observation.id}`)).text();
  expect(JSON.parse(raw)).toEqual({ fixture: true, price: 2500 });
  const exported = await ctx.call(`/api/projects/${project.name}/runs/${run.id}/export`);
  expect(exported.headers.get("content-disposition")).toContain("attachment");
  expect((await exported.json()).result).toEqual(details.result);
  const reopened = await ctx.restart(), saved = await (await reopened.call(`/api/projects/${project.name}/runs/${run.id}`)).json();
  expect(saved.result).toEqual(details.result); expect(saved.evidence).toEqual(details.evidence);
  const refreshed = await reopened.call(`/api/projects/${project.name}/refresh`, "POST");
  expect(refreshed.status).toBe(202);
  const next = (await refreshed.json()).run; expect(next.id).not.toBe(run.id);
  await finish(reopened, project.name, next.id);
  expect(await projectRuns(ctx.root, project.name)).toHaveLength(2);
  expect((await checkProjectRun(ctx.root, project.name, run.id)).issues).toEqual([]);
}));

test("wallet capture passes explicit scope and preserves all seven raw read observations", async () => {
  const requests: any[] = [];
  await withDesk(async ctx => {
    const project = await create(ctx, "wallet", { account: "0x" + "1".repeat(40), startTime: "2026-09-01T00:00:00Z", endTime: "2026-09-03T00:00:00Z", network: "testnet", maxPages: 2 });
    const run = await start(ctx, project.name), detail = await finish(ctx, project.name, run.id);
    expect(detail.run.error).toBeUndefined(); expect(detail.run.state).toBe("partial"); expect(detail.result.coverage.completeWindow).toBe(false);
    expect(detail.result.outcome.observedNetUsdc).toBe("18.75"); expect(detail.result.source).toBe("synthetic");
    expect(detail.evidence.observations).toHaveLength(8); expect(detail.integrity.issues).toEqual([]);
    expect(requests.map(item => item.type)).toEqual(["userRole", "userAbstraction", "clearinghouseState", "spotClearinghouseState", "frontendOpenOrders", "userFillsByTime", "userFunding"]);
    expect(requests.every(item => item.user === "0x" + "1".repeat(40))).toBe(true);
  }, { fetcher: (async (_url, init) => { requests.push(JSON.parse(String(init?.body))); return Response.json({ fixture: true }); }) });
});

test("raw public captures preserve original UTF-8 bytes including a BOM", async () => {
  const bytes = Buffer.from('\uFEFF{"fixture":true,"price":2500}');
  await withDesk(async ctx => {
    const project = await create(ctx), run = await start(ctx, project.name), detail = await finish(ctx, project.name, run.id);
    expect(detail.run.state).toBe("complete");
    expect(detail.integrity.issues).toEqual([]);
    for (const observation of detail.evidence.observations) {
      expect(observation.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
      const downloaded = await ctx.call(`/api/projects/${project.name}/runs/${run.id}/evidence/${observation.id}`);
      expect(Buffer.from(await downloaded.arrayBuffer())).toEqual(bytes);
    }
  }, { fetcher: async () => new Response(bytes, { headers: { "content-type": "application/json" } }) });
});

test("strategy execution uses the exact released engine and independently restarted periods", async () => withDesk(async ctx => {
  const project = await create(ctx, "strategy", { asset: "bitcoin", days: 180, datasetSource: "bundled", template: "sma-10", initialCashUsd: 10000, feeBps: 10, slippageBps: 5 });
  const run = await start(ctx, project.name), details = await finish(ctx, project.name, run.id);
  expect(details.run.error).toBeUndefined(); expect(details.run.state).toBe("complete"); expect(details.integrity.issues).toEqual([]);
  expect(details.result.model).toBe("daily-frozen-rule-validation-v1");
  expect(details.result.accounting.mode).toBe("independent-restarts");
  expect(details.result.periods.reference.baseline.metrics.initialCashUsd).toBe(10000);
  expect(details.result.periods.heldOut.baseline.metrics.initialCashUsd).toBe(10000);
  expect(details.result.costScenarios.higherCosts.feeBps).toBeGreaterThan(10);
  expect(details.result.inputHashes.engineSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(details.evidence.observations).toHaveLength(2);
  expect(details.report).toContain("Dataset retrieved");
}));

test("upload validates dataset identity, provenance and cash inputs without arbitrary file access", async () => withDesk(async ctx => {
  const dataset = JSON.parse(await readFile(join(ctx.assets, "data", "bitcoin-180d.json"), "utf8"));
  const project = await create(ctx, "strategy", { asset: "ethereum", datasetSource: "upload", dataset, template: "buy-and-hold" });
  const run = await start(ctx, project.name), details = await finish(ctx, project.name, run.id);
  expect(details.run.state).toBe("failed"); expect(details.run.error).toContain("identity differs");
  const invalid = await ctx.call("/api/projects", "POST", { kind: "strategy", inputs: { asset: "bitcoin", datasetSource: "upload", dataset, initialCashUsd: 0 } });
  expect(invalid.status).toBe(400);
  const noDcaBudget = await ctx.call("/api/projects", "POST", { kind: "strategy", inputs: { template: "weekly-dca" } });
  expect(noDcaBudget.status).toBe(400);
}));

test("cancel terminates the owned capture, prevents duplicate runs and preserves prior completed research", async () => {
  let blocked = false, calls = 0;
  await withDesk(async ctx => {
    const project = await create(ctx), first = await start(ctx, project.name);
    await finish(ctx, project.name, first.id); blocked = true;
    const run = await start(ctx, project.name);
    expect((await ctx.call(`/api/projects/${project.name}/run`, "POST")).status).toBe(409);
    for (let i = 0; i < 50 && calls < 3; i++) await Bun.sleep(5);
    const cancelled = await ctx.call(`/api/projects/${project.name}/runs/${run.id}/cancel`, "POST");
    expect(cancelled.status).toBe(200); expect((await cancelled.json()).run.state).toBe("cancelled");
    expect((await (await ctx.call(`/api/projects/${project.name}/runs/${first.id}`)).json()).run.state).toBe("complete");
    const records = await projectRuns(ctx.root, project.name); expect(records.at(-1)?.state).toBe("failed");
    expect((await readdir(join(ctx.root, ".boomkin/projects", project.name))).includes("run.lock")).toBe(false);
  }, { fetcher: (async (_url, init) => {
    calls++;
    if (!blocked) return Response.json({ fixture: true, price: 42 });
    return new Promise<Response>((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }); });
  }) });
});

test("partial and unavailable data remain explicit; tampered installed helpers and artifacts are refused", async () => {
  let calls = 0;
  await withDesk(async ctx => {
    const project = await create(ctx), run = await start(ctx, project.name), details = await finish(ctx, project.name, run.id);
    expect(details.run.state).toBe("partial"); expect(details.result.reads[1].observations[0].error).toBe("fixture_unavailable");
    const observation = details.evidence.observations[0];
    await writeFile(join(ctx.root, ".boomkin/projects", project.name, "runs", run.id, observation.artifact), "tampered");
    expect((await ctx.call(`/api/projects/${project.name}/runs/${run.id}/evidence/${observation.id}`)).status).toBe(409);
    expect((await (await ctx.call(`/api/projects/${project.name}/runs/${run.id}`)).json()).integrity.issues.join(" ")).toContain("hash differs");
    await writeFile(join(ctx.root, "skills/galleon-defi-market-snapshot/scripts/market-data.mjs"), "throw Error('changed');");
    expect((await ctx.call(`/api/projects/${project.name}/refresh`, "POST")).status).toBe(409);
    expect((await (await ctx.call("/api/status")).json()).capabilities.find((item: any) => item.kind === "market").ready).toBe(false);
  }, { fetcher: (async () => Response.json(++calls === 1 ? { price: 42 } : { unavailable: true })) });
  await withDesk(async ctx => {
    const project = await create(ctx), run = await start(ctx, project.name), details = await finish(ctx, project.name, run.id);
    expect(details.run.state).toBe("failed"); expect(details.run.error).toContain("unavailable");
  }, { fetcher: (async () => Response.json({ unavailable: true })) });
});

test("managed paths reject symlinks and profile locks prevent a second desk", async () => withDesk(async ctx => {
  await expect(startDesk({ directory: ctx.root, assetsDirectory: ctx.assets })).rejects.toThrow("already owns");
  const project = await create(ctx), root = join(ctx.root, ".boomkin/projects", project.name);
  await rm(join(root, "runs"), { recursive: true }); await symlink(ctx.assets, join(root, "runs"));
  expect((await ctx.call(`/api/projects/${project.name}/run`, "POST")).status).toBe(409);
  expect(await readdir(ctx.assets)).not.toContain("run.json");
}));

test("concurrent stale profile recovery admits exactly one desk", async () => withDesk(async ctx => {
  await ctx.desk.stop();
  const lock = join(ctx.root, ".boomkin", "desk.lock");
  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify({ pid: 2147483647 }));
  const launches = await Promise.allSettled(Array.from({ length: 4 }, () => startDesk({ directory: ctx.root, assetsDirectory: ctx.assets })));
  const owners = launches.filter(result => result.status === "fulfilled");
  try {
    expect(owners).toHaveLength(1);
    expect(JSON.parse(await readFile(join(lock, "owner.json"), "utf8")).pid).toBe(process.pid);
    await expect(startDesk({ directory: ctx.root, assetsDirectory: ctx.assets })).rejects.toThrow("already owns");
  } finally { await Promise.all(owners.map(result => result.status === "fulfilled" ? result.value.stop() : undefined)); }
}));

test("setup is single-flight and exposes only a validated local native setup URL", async () => {
  let release!: () => void;
  await withDesk(async ctx => {
    const response = await ctx.call("/api/model-setup", "POST"); expect(response.status).toBe(202);
    expect((await ctx.call("/api/setup", "POST")).status).toBe(409);
    release(); await Bun.sleep(10);
    const status = await (await ctx.call("/api/status")).json();
    expect(status.setup.result).toEqual({ url: "http://127.0.0.1:12345/env" });
    expect(JSON.stringify(status)).not.toContain("fake-secret");
  }, { onModelSetup: () => new Promise(resolve => { release = () => resolve({ url: "http://127.0.0.1:12345/env", secret: "fake-secret" }); }), onSetup: async () => undefined });
});

test("a crashed capture is visible as interrupted after reopening and never silently reruns", async () => {
  const base = await mkdtemp(join(tmpdir(), "boomkin-desk-crash-")), root = join(base, "profile"), assets = join(base, "assets");
  await mkdir(root); await mkdir(assets); await fixtureProfile(root);
  const script = join(base, "desk-child.ts");
  await writeFile(script, `import { startDesk } from ${JSON.stringify(join(import.meta.dir, "../src/desk.ts"))};\nconst desk = await startDesk({ directory:process.argv[2],assetsDirectory:process.argv[3],fetcher:async()=>new Promise(()=>{}) });\nconsole.log(desk.url);\n`);
  const child = Bun.spawn([process.execPath, script, root, assets], { stdout: "pipe", stderr: "pipe" });
  let desk: Awaited<ReturnType<typeof startDesk>> | undefined;
  try {
    const reader = child.stdout.getReader(), first = await reader.read(), url = new URL(new TextDecoder().decode(first.value).trim());
    const token = new URLSearchParams(url.hash.slice(1)).get("token")!;
    const call = (path: string, body?: unknown) => fetch(url.origin + path, { method: body ? "POST" : "GET", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const project = (await (await call("/api/projects", { kind: "market", inputs: { asset: "bitcoin" } })).json()).project;
    const started = await fetch(url.origin + `/api/projects/${project.name}/run`, { method: "POST", headers: { authorization: "Bearer " + token } });
    const run = (await started.json()).run;
    child.kill("SIGKILL"); await child.exited;
    desk = await startDesk({ directory: root, assetsDirectory: assets });
    const resumed = new URL(desk.url), resumedToken = new URLSearchParams(resumed.hash.slice(1)).get("token")!;
    const detail = await (await fetch(resumed.origin + `/api/projects/${project.name}/runs/${run.id}`, { headers: { authorization: "Bearer " + resumedToken } })).json();
    expect(detail.run.state).toBe("interrupted"); expect(detail.run.progress).toContain("previous desk stopped");
    expect((await projectRuns(root, project.name)).at(-1)?.state).toBe("failed");
    expect((await readdir(join(root, ".boomkin/projects", project.name))).includes("run.lock")).toBe(false);
    expect((await projectRuns(root, project.name))).toHaveLength(1);
  } finally { child.kill(); await child.exited; await desk?.stop(); await rm(base, { recursive: true, force: true }); }
});

test("follow-up uses the native Hermes loop and saves an independent evidence-backed project", async () => withDesk(async ctx => {
  await writeFile(join(ctx.root, "config.yaml"), "model: fixture-model\n");
  const runtime = join(ctx.root, ".boomkin/runtime/.venv/bin/hermes");
  await writeFile(runtime, `#!/usr/bin/env bun
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
if(args.includes('--version')){console.log('Hermes Agent 0.21.5');process.exit(0);}
if(args.includes('--help')){console.log('--query-file --skills --max-turns --oneshot --cli');process.exit(0);}
const prompt=args[args.indexOf('--query-file')+1],output=dirname(prompt),context=readFileSync(prompt,'utf8');
if(!context.includes('previousReport')||!context.includes('fresh public reads')||!context.includes('not-granted'))process.exit(9);
if(context.includes('wait-for-cancellation')){writeFileSync(join(output,'waiting'),'yes');await Bun.sleep(60000);}
const raw=JSON.stringify({fixture:true,answer:'Native fixture only'});
mkdirSync(join(output,'sources','provider'));
writeFileSync(join(output,'sources','provider','native.json'),raw);
writeFileSync(join(output,'evidence.json'),JSON.stringify({schemaVersion:1,observations:[{id:'native-fixture',source:'https://example.com/fixture',observedAt:new Date().toISOString(),summary:'Native contract fixture',artifact:'sources/provider/native.json',sha256:createHash('sha256').update(raw).digest('hex'),limitations:['No model call or live market assertion']}]}));
writeFileSync(join(output,'report.md'),'Native fixture follow-up with an independently saved run [native-fixture].');
writeFileSync(join(output,'plan.json'),JSON.stringify({schemaVersion:1,status:'no-action',authorization:'not-granted',summary:'No financial action',steps:[]}));
`);
  await chmod(runtime, 0o700);
  const project = await create(ctx), run = await start(ctx, project.name); await finish(ctx, project.name, run.id);
  const newerRun = await start(ctx, project.name); await finish(ctx, project.name, newerRun.id);
  const response = await ctx.call(`/api/projects/${project.name}/followup`, "POST", { question: "What changed in the sources?", maxTurns: 2, runId: run.id });
  expect(response.status).toBe(202);
  const derived = await response.json();
  expect(derived.project.name).not.toBe(project.name); expect(derived.project.execution).toBe("native-hermes");
  expect(derived.project.parent).toEqual({ project: project.name, runId: run.id });
  expect(derived.project.inputs.previousRunId).toBe(run.id);
  expect(derived.project.inputs.previousReport).toContain(`/runs/${run.id}/report.md`);
  const prompt = await readFile(join(ctx.root, ".boomkin/projects", derived.project.name, "runs", derived.run.id, "prompt.md"), "utf8");
  expect(prompt).toContain(`/runs/${run.id}/report.md`);
  expect(prompt).not.toContain(`/runs/${newerRun.id}/report.md`);
  const details = await finish(ctx, derived.project.name, derived.run.id);
  expect(details.run.state).toBe("complete"); expect(details.run.execution).toBe("native-hermes");
  expect(details.report).toContain("Native fixture follow-up"); expect(details.integrity.issues).toEqual([]);
  expect((await checkProjectRun(ctx.root, project.name, run.id)).issues).toEqual([]);
  expect(details.result).toBeNull();
  const captured = await ctx.call(`/api/projects/${derived.project.name}/runs/${derived.run.id}/evidence/native-fixture`);
  expect(captured.status).toBe(200);
  expect(await captured.json()).toEqual({fixture:true,answer:'Native fixture only'});
  const pending = await (await ctx.call(`/api/projects/${project.name}/followup`, "POST", { question: "wait-for-cancellation", maxTurns: 2 })).json();
  expect(pending.project.parent.runId).toBe(newerRun.id);
  const waiting = join(ctx.root, ".boomkin/projects", pending.project.name, "runs", pending.run.id, "waiting");
  let observed = false;
  for (let i = 0; i < 100; i++) { try { observed = (await readFile(waiting, "utf8")) === "yes"; } catch {} if (observed) break; await Bun.sleep(10); }
  expect(observed).toBe(true);
  const cancelled = await ctx.call(`/api/projects/${pending.project.name}/runs/${pending.run.id}/cancel`, "POST");
  expect(cancelled.status).toBe(200); expect((await cancelled.json()).run.state).toBe("cancelled");
  expect((await projectRuns(ctx.root, pending.project.name)).at(-1)?.state).toBe("failed");
  expect((await readdir(join(ctx.root, ".boomkin/projects", pending.project.name))).includes("run.lock")).toBe(false);
}));

test("readiness stays responsive and shares one pending native version probe", async () => withDesk(async ctx => {
  const runtime = join(ctx.root, ".boomkin/runtime/.venv/bin/hermes"), count = join(ctx.root, "version-count"), release = join(ctx.root, "version-release");
  await writeFile(runtime, `#!/usr/bin/env bun\nimport {appendFileSync,existsSync} from 'node:fs';\nappendFileSync(${JSON.stringify(count)},'probe\\n');\nwhile(!existsSync(${JSON.stringify(release)}))await Bun.sleep(10);\nconsole.log('Hermes Agent 0.21.5');\n`);
  await chmod(runtime, 0o700);
  const statuses = await Promise.all(Array.from({ length: 6 }, async () => (await ctx.call("/api/status")).json()));
  expect(statuses.every(value => value.profile.runtimeChecking)).toBe(true);
  expect(statuses.every(value => value.ready)).toBe(true);
  for (let i = 0; i < 100; i++) { try { if ((await readFile(count, "utf8")).trim()) break; } catch {} await Bun.sleep(10); }
  expect((await readFile(count, "utf8")).trim().split("\n")).toHaveLength(1);
  await writeFile(release, "continue");
  let status;
  for (let i = 0; i < 100; i++) { status = await (await ctx.call("/api/status")).json(); if (!status.profile.runtimeChecking) break; await Bun.sleep(10); }
  expect(status.profile.runtimeAvailable).toBe(true);
  await writeFile(join(ctx.root, "config.yaml"), "model:\n  default: changed-model\n");
  const updated = await (await ctx.call("/api/status")).json();
  expect(updated.profile.modelConfigured).toBe(true);
  expect((await readFile(count, "utf8")).trim().split("\n")).toHaveLength(1);
}));

test("setup and shutdown cannot pass a reserved native follow-up preparation", async () => {
  let setups = 0;
  await withDesk(async ctx => {
    const project = await create(ctx), run = await start(ctx, project.name); await finish(ctx, project.name, run.id);
    await writeFile(join(ctx.root, "config.yaml"), "model:\n  default: fixture-model\n");
    const runtime = join(ctx.root, ".boomkin/runtime/.venv/bin/hermes"), marker = join(ctx.root, "preparing"), release = join(ctx.root, "release");
    await writeFile(runtime, `#!/usr/bin/env bun\nimport {writeFileSync,existsSync} from 'node:fs';\nwriteFileSync(${JSON.stringify(marker)},'ready');\nwhile(!existsSync(${JSON.stringify(release)}))await Bun.sleep(10);\nconsole.log('Hermes Agent 0.21.5');\n`);
    await chmod(runtime, 0o700);
    const pending = ctx.call(`/api/projects/${project.name}/followup`, "POST", { question: "A fixture question" });
    let observed = false;
    for (let i = 0; i < 100; i++) { try { observed = (await readFile(marker, "utf8")) === "ready"; } catch {} if (observed) break; await Bun.sleep(10); }
    expect(observed).toBe(true);
    expect((await ctx.call("/api/setup", "POST")).status).toBe(409);
    expect(setups).toBe(0);
    const shutdown = ctx.desk.stop();
    expect((await readdir(join(ctx.root, ".boomkin"))).includes("desk.lock")).toBe(true);
    await writeFile(release, "continue");
    await pending; await shutdown;
    expect((await readdir(join(ctx.root, ".boomkin"))).includes("desk.lock")).toBe(false);
    expect((await readdir(join(ctx.root, ".boomkin/projects")))).toEqual([project.name]);
    expect((await projectRuns(ctx.root, project.name))).toHaveLength(1);
  }, { onSetup: async () => { setups++; } });
});

test("shutdown cancels an owned first-use setup and waits for its terminal callback", async () => {
  let cancelled = false;
  await withDesk(async ctx => {
    expect((await ctx.call("/api/setup", "POST")).status).toBe(202);
    await ctx.desk.stop();
    expect(cancelled).toBe(true);
    expect((await readdir(join(ctx.root, ".boomkin"))).includes("desk.lock")).toBe(false);
  }, { onSetup: signal => new Promise((_resolve, reject) => { signal.addEventListener("abort", () => { cancelled = true; reject(new Error("Setup cancelled")); }, { once: true }); }) });
});

test("native model readiness preserves both supported legacy and current config shapes", async () => withDesk(async ctx => {
  expect(hermesModelConfigured({ model: "fixture-model" })).toBe(true);
  expect(hermesModelConfigured({ model: { default: "fixture-model", provider: "fixture" } })).toBe(true);
  for (const model of [{ model: "fixture-model" }, { name: "fixture-model" }, { default: { provider: "fixture", model: "fixture-model" } }, { model: { default: "fixture-model" } }]) expect(hermesModelConfigured({ model })).toBe(true);
  for (const model of [undefined, null, 42, " ", [], { default: " " }, { default: 42 }]) expect(hermesModelConfigured({ model })).toBe(false);
  await writeFile(join(ctx.root, "config.yaml"), "model: legacy-model\n");
  expect((await (await ctx.call("/api/status")).json()).profile.modelConfigured).toBe(true);
}));

test("saved comparisons recheck both captures, export exact run identities and survive reopening", async () => {
  let capture = 0;
  const observedAt = Date.now() - 10_000;
  await withDesk(async ctx => {
    const project = await create(ctx), before = await start(ctx, project.name);
    const original = await finish(ctx, project.name, before.id);
    expect(original.integrity.resultVerified).toBe(true);
    capture = 1;
    const after = await start(ctx, project.name); await finish(ctx, project.name, after.id);
    const path = `/api/projects/${project.name}/runs/${after.id}/compare?baseline=${before.id}`;
    const response = await ctx.call(path); expect(response.status).toBe(200);
    const comparison = await response.json();
    expect(comparison.status).toBe("compared");
    expect(comparison.baseline.id).toBe(before.id); expect(comparison.current.id).toBe(after.id);
    expect(comparison.sections.flatMap((group: any) => group.rows).some((row: any) => row.delta === "100")).toBe(true);
    expect(JSON.stringify(comparison)).not.toContain(ctx.root);
    const reopened = await ctx.restart();
    expect(await (await reopened.call(path)).json()).toEqual(comparison);
    expect((await reopened.call(path, "POST")).status).toBe(404);
    expect((await reopened.call(path.split("?")[0])).status).toBe(400);
    expect((await reopened.call(path + `&baseline=${before.id}`)).status).toBe(400);
    expect((await reopened.call(path.replace(before.id, "invalid"))).status).toBe(400);
    const foreign = await create(reopened), foreignRun = await start(reopened, foreign.name); await finish(reopened, foreign.name, foreignRun.id);
    expect((await reopened.call(path.replace(before.id, foreignRun.id))).status).toBe(404);
    const resultPath = join(ctx.root, ".boomkin/projects", project.name, "runs", before.id, "result.json");
    const bytes = await readFile(resultPath, "utf8");
    await writeFile(resultPath, bytes.replace('"priceUsd": 2500', '"priceUsd": 100'));
    const tampered = await (await reopened.call(path)).json();
    expect(tampered.status).toBe("unavailable"); expect(tampered.sections).toEqual([]);
    expect(tampered.issues.join(" ")).toContain("Structured result changed");
    await writeFile(resultPath, bytes);
    const sourcePath = join(ctx.root, ".boomkin/projects", project.name, "runs", before.id, "sources", "read-001.json");
    await writeFile(sourcePath, '{}');
    const sourceChanged = await (await reopened.call(path)).json();
    expect(sourceChanged.status).toBe("unavailable"); expect(sourceChanged.sections).toEqual([]);
  }, { fetcher: async () => Response.json({ price: 2500 + 100 * capture, observedAt: new Date(observedAt + 1000 * capture).toISOString() }) });
});

test("legacy captures remain readable but cannot claim verified numeric comparisons", async () => withDesk(async ctx => {
  const project = await create(ctx), before = await start(ctx, project.name); await finish(ctx, project.name, before.id);
  const after = await start(ctx, project.name); await finish(ctx, project.name, after.id);
  const saved = join(ctx.root, ".boomkin/projects", project.name, "runs", before.id, "desk.json");
  const record = JSON.parse(await readFile(saved, "utf8")); delete record.resultSha256;
  await writeFile(saved, JSON.stringify(record));
  const readable = await (await ctx.call(`/api/projects/${project.name}/runs/${before.id}/export`)).json();
  expect(readable.result).not.toBeNull(); expect(readable.integrity.issues).toEqual([]); expect(readable.integrity.resultVerified).toBe(false);
  const comparison = await (await ctx.call(`/api/projects/${project.name}/runs/${after.id}/compare?baseline=${before.id}`)).json();
  expect(comparison.status).toBe("unavailable"); expect(comparison.sections).toEqual([]);
  expect(comparison.issues.join(" ")).toMatch(/digest|verified|verification/i);
}));

test("exact-run follow-up rejects invalid, foreign, incomplete and modified captures before native launch", async () => withDesk(async ctx => {
  const project = await create(ctx), run = await start(ctx, project.name); await finish(ctx, project.name, run.id);
  const other = await create(ctx), foreignRun = await start(ctx, other.name); await finish(ctx, other.name, foreignRun.id);
  const path = `/api/projects/${project.name}/followup`;
  expect((await ctx.call(path, "POST", { question: "Inspect", runId: "../bad" })).status).toBe(400);
  expect((await ctx.call(path, "POST", { question: "Inspect", runId: foreignRun.id })).status).toBe(409);
  const recordPath = join(ctx.root, ".boomkin/projects", project.name, "runs", run.id, "desk.json");
  const record = JSON.parse(await readFile(recordPath, "utf8"));
  for (const state of ["running", "failed", "cancelled", "interrupted"]) {
    await writeFile(recordPath, JSON.stringify({ ...record, state }));
    expect((await ctx.call(path, "POST", { question: "Inspect", runId: run.id })).status).toBe(409);
  }
  await writeFile(recordPath, JSON.stringify(record));
  await writeFile(join(ctx.root, ".boomkin/projects", project.name, "runs", run.id, "result.json"), '{}');
  const rejected = await ctx.call(path, "POST", { question: "Inspect", runId: run.id });
  expect(rejected.status).toBe(409);
  expect((await rejected.json()).error.message).toContain("verified evidence");
  expect((await readdir(join(ctx.root, ".boomkin/projects"))).sort()).toEqual([project.name, other.name].sort());
}));

test("malformed saved evidence and result JSON produce unavailable comparisons instead of server errors", async () => withDesk(async ctx => {
  const project = await create(ctx), before = await start(ctx, project.name); await finish(ctx, project.name, before.id);
  const after = await start(ctx, project.name); await finish(ctx, project.name, after.id);
  const path = `/api/projects/${project.name}/runs/${after.id}/compare?baseline=${before.id}`;
  const directory = join(ctx.root, ".boomkin/projects", project.name, "runs", before.id);
  for (const [file, corrupt] of [
    ["evidence.json", '{"schemaVersion":1,"observations":[null]}'],
    ["evidence.json", '{"schemaVersion":1,"observations":{}}'],
    ["evidence.json", '{'], ["result.json", '{'], ["brief.json", '{'],
  ]) {
    const saved = await readFile(join(directory, file), "utf8");
    await writeFile(join(directory, file), corrupt);
    const response = await ctx.call(path); expect(response.status).toBe(200);
    const value = await response.json(); expect(value.status).toBe("unavailable"); expect(value.sections).toEqual([]); expect(value.issues.length).toBeGreaterThan(0);
    await writeFile(join(directory, file), saved);
  }
}));
