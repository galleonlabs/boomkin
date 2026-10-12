/** Comparisons are derived from verified saved captures, never from a live read. */
export type ComparisonKind = "market" | "wallet" | "strategy";
export interface ComparisonSnapshot {
  run: { id: string; project: string; kind: ComparisonKind; state: string; createdAt: string; finishedAt?: string; execution?: string };
  inputs: Record<string, unknown>; packRevision: string; result: unknown;
  evidence: Array<{ id: string; source: string; sha256: string; limitations: string[] }>;
  integrityIssues: string[]; resultVerified: boolean;
}
export interface ComparisonRow {
  id: string; label: string; unit: "USD" | "USDC" | "percent" | "count";
  before: string | null; after: string | null; delta: string | null; changePct: string | null; note: string;
}
export interface DeskComparison {
  schemaVersion: 1; kind: ComparisonKind; status: "compared" | "limited" | "unavailable"; summary: string;
  baseline: { id: string; createdAt: string; state: string }; current: { id: string; createdAt: string; state: string };
  sections: Array<{ title: string; description: string; rows: ComparisonRow[] }>;
  notes: string[]; issues: string[]; sourceChanges: { added: string[]; removed: string[]; changed: string[] };
}
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const at = (value: unknown, ...path: string[]): unknown => path.reduce((next, key) => record(next)[key], value);
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const strings = (value: unknown) => list(value).filter((item): item is string => typeof item === "string");
const time = (value: unknown) => typeof value === "string" && Number.isFinite(Date.parse(value)) ? Date.parse(value) : NaN;
const hash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const number = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;
const display = (value: number | null) => value === null || !Number.isFinite(value) ? null : String(Object.is(value, -0) ? 0 : value);
function stable(value: unknown): string | undefined {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(record(value)[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
function sourceKey(value: unknown): string | null {
  const item = record(value);
  if (typeof item.id !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(item.id) || typeof item.source !== "string") return null;
  try {
    const url = new URL(item.source);
    if (!item.id || !["https:", "http:"].includes(url.protocol) || url.username || url.password) return null;
    url.hash = ""; url.searchParams.sort();
    return `${item.id} · ${url.href}`;
  } catch { return null; }
}
// Wallet helpers emit canonical decimal strings. Keep integer arithmetic all the way to display.
function decimal(value: unknown): { units: bigint; scale: number; text: string } | null {
  if (typeof value !== "string" || !/^-?\d{1,60}(?:\.\d{1,36})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const units = BigInt(whole + fraction), scale = fraction.length;
  return { units, scale, text: decimalText(units, scale) };
}
function decimalText(units: bigint, scale: number): string {
  const digits = (units < 0n ? -units : units).toString().padStart(scale + 1, "0");
  const value = scale ? `${digits.slice(0, -scale)}.${digits.slice(-scale)}`.replace(/\.?0+$/, "") : digits;
  return `${units < 0n ? "-" : ""}${value}`;
}
function walletRow(id: string, label: string, before: unknown, after: unknown, note: string): ComparisonRow {
  const a = decimal(before), b = decimal(after), scale = Math.max(a?.scale ?? 0, b?.scale ?? 0);
  return { id, label, unit: "USDC", before: a?.text ?? null, after: b?.text ?? null,
    delta: a && b ? decimalText(b.units * 10n ** BigInt(scale - b.scale) - a.units * 10n ** BigInt(scale - a.scale), scale) : null,
    changePct: null, note: a && b ? note : `${note} Missing or invalid amounts remain unavailable.` };
}
function numericRow(id: string, label: string, unit: ComparisonRow["unit"], before: unknown, after: unknown, comparable: boolean, note: string, relative = false): ComparisonRow {
  const a = number(before), b = number(after), delta = comparable && a !== null && b !== null ? b - a : null;
  return { id, label, unit, before: display(a), after: display(b), delta: display(delta),
    changePct: relative && delta !== null && a !== null && a > 0 ? display(delta / a * 100) : null,
    note: a === null || b === null ? `${note} Missing or invalid values remain unavailable.` : note };
}

export function compareDeskRuns(kind: ComparisonKind, before: ComparisonSnapshot, after: ComparisonSnapshot): DeskComparison {
  const select = ({ id, createdAt, state }: ComparisonSnapshot["run"]) => ({ id, createdAt, state });
  const output: DeskComparison = { schemaVersion: 1, kind, status: "unavailable", summary: "These runs cannot be compared.", baseline: select(before.run), current: select(after.run), sections: [], notes: [], issues: [], sourceChanges: { added: [], removed: [], changed: [] } };
  if (before.run.id === after.run.id || !(time(before.run.createdAt) < time(after.run.createdAt))) output.issues.push("Choose a different baseline run captured before the current run.");
  if (before.run.project !== after.run.project || before.run.kind !== kind || after.run.kind !== kind) output.issues.push("Runs must belong to the same project and research kind.");
  if (stable(before.inputs) !== stable(after.inputs)) output.issues.push("Saved research inputs differ; comparisons require the same question and scope.");
  if (!before.packRevision || before.packRevision !== after.packRevision) output.issues.push("Installed helper revisions differ or are missing; recapture both runs with the same helper revision.");
  for (const [label, snapshot] of [["Baseline", before], ["Current", after]] as const) {
    if (snapshot.run.execution || !["complete", "partial"].includes(snapshot.run.state)) output.issues.push(`${label}: only completed deterministic captures can be compared; native or unfinished runs are unavailable.`);
    if (snapshot.resultVerified !== true) output.issues.push(`${label}: this saved result has no verified result digest. Recapture the research to create a comparable run; legacy results remain readable.`);
    if (!Array.isArray(snapshot.integrityIssues) || snapshot.integrityIssues.some(issue => typeof issue !== "string")) output.issues.push(`${label}: integrity validation is unavailable.`);
    output.issues.push(...strings(snapshot.integrityIssues).map(issue => `${label}: ${issue}`));
  }
  // Do not inspect untrusted evidence after an integrity, scope or execution gate fails.
  if (output.issues.length) return finish(output);
  const indexes: Map<string, string>[] = [];
  for (const [label, snapshot] of [["Baseline", before], ["Current", after]] as const) {
    const index = new Map<string, string>();
    if (!Array.isArray(snapshot.evidence) || !snapshot.evidence.length) output.issues.push(`${label}: captured source evidence is missing or malformed.`);
    for (const value of list(snapshot.evidence)) {
      const item = record(value);
      const key = sourceKey(item);
      if (!key || !hash(item.sha256) || index.has(key) || !Array.isArray(item.limitations) || item.limitations.some(note => typeof note !== "string")) output.issues.push(`${label}: captured source identity, digest or limitations are missing, malformed or duplicated.`);
      else index.set(key, item.sha256 as string);
      output.notes.push(...strings(item.limitations).map(note => `${label} source: ${note}`));
    }
    indexes.push(index);
    output.notes.push(...strings(at(snapshot.result, "limitations")).map(note => `${label}: ${note}`));
    output.notes.push(`${label} captured ${snapshot.run.createdAt}${snapshot.run.finishedAt ? `; finished ${snapshot.run.finishedAt}` : ""}.`);
  }
  if (output.issues.length) return finish(output);
  const [oldSources, newSources] = indexes;
  output.sourceChanges = {
    added: [...newSources.keys()].filter(key => !oldSources.has(key)).sort(),
    removed: [...oldSources.keys()].filter(key => !newSources.has(key)).sort(),
    changed: [...newSources.keys()].filter(key => oldSources.has(key) && oldSources.get(key) !== newSources.get(key)).sort(),
  };
  output.notes.push("Source changes compare captured bytes by artifact identity and source URL; a new retrieval time alone is not market movement. Hashes verify saved bytes, not provider truth.");
  if (output.issues.length) return finish(output);
  if (kind === "market") market(output, before, after);
  if (kind === "wallet") wallet(output, before, after);
  if (kind === "strategy") strategy(output, before, after);
  const rows = output.sections.flatMap(section => section.rows), valid = rows.some(row => row.before !== null || row.after !== null);
  output.status = !valid ? "unavailable" : output.issues.length || rows.some(row => row.delta === null) || before.run.state === "partial" || after.run.state === "partial" ? "limited" : "compared";
  output.summary = output.status === "compared" ? "Saved observations compared within the same research scope." : output.status === "limited" ? rows.some(row => row.delta !== null) ? "Some saved observations are comparable; read the gaps and limitations below." : "Saved values are shown, but their changes cannot be compared." : "No comparable observations are available in these saved runs.";
  return finish(output);
}
function finish(output: DeskComparison) { output.notes = [...new Set(output.notes)]; output.issues = [...new Set(output.issues)]; return output; }

function market(output: DeskComparison, before: ComparisonSnapshot, after: ComparisonSnapshot) {
  function observations(snapshot: ComparisonSnapshot) {
    const rows = new Map<string, { value: number | null; observed: number; note: string }>();
    const age = number(at(snapshot.result, "parameters", "maxAgeSeconds")) ?? 300;
    for (const read of list(at(snapshot.result, "reads"))) for (const row of list(at(read, "observations"))) {
      const provider = at(read, "provider"), identity = at(row, "identity");
      if (typeof provider !== "string" || !["coingecko", "defillama"].includes(provider) || at(row, "provider") !== provider || at(identity, "namespace") !== "coingecko" || at(identity, "id") !== snapshot.inputs.asset) { output.issues.push("A market observation has an unsupported provider or mismatched CoinGecko identity."); continue; }
      const key = String(provider), observed = time(at(row, "observedAt")), retrieved = time(at(row, "retrievedAt"));
      const price = number(at(row, "priceUsd")), delay = (retrieved - observed) / 1000;
      const valid = at(row, "ok") === true && at(row, "unit") === "USD" && price !== null && price >= 1e-12 && price <= 1e12 && delay >= -60 && delay <= age && age >= 1 && age <= 86400;
      const note = valid ? `Observed ${at(row, "observedAt")}; retrieved ${at(row, "retrievedAt")}.` : `Unavailable: ${typeof at(row, "error") === "string" ? at(row, "error") : "missing, stale or invalid observation"}.`;
      if (rows.has(key)) { output.issues.push(`Duplicate ${key} observations cannot be matched reliably.`); rows.set(key, { value: null, observed: NaN, note: "Duplicate source observations." }); }
      else rows.set(key, { value: valid ? price : null, observed, note });
    }
    return rows;
  }
  const a = observations(before), b = observations(after);
  const rows = [...new Set([...a.keys(), ...b.keys()])].sort().map(provider => {
    const old = a.get(provider), current = b.get(provider), newer = !!old && !!current && old.observed < current.observed;
    const chronology = !old || !current ? "Source missing in one run." : !newer ? "Provider timestamp is cached, reversed or unavailable; no price movement is inferred." : "Change is between provider observations, not a portfolio return.";
    return numericRow(provider, provider === "coingecko" ? "CoinGecko USD mark" : "DefiLlama USD mark", "USD", old?.value, current?.value, newer, `Baseline: ${old?.note ?? "unavailable"} Current: ${current?.note ?? "unavailable"} ${chronology}`, true);
  });
  output.sections.push({ title: "Market observations", description: "Same provider and exact CoinGecko asset identity. Missing and stale marks remain unavailable.", rows });
  output.notes.push("Aggregate marks are not executable quotes. Providers may share upstream data; agreement does not establish independent corroboration.");
}

function wallet(output: DeskComparison, before: ComparisonSnapshot, after: ComparisonSnapshot) {
  const a = before.result, b = after.result;
  for (const snapshot of [before, after]) {
    const scope = at(snapshot.result, "scope"), input = snapshot.inputs;
    const address = at(scope, "address");
    if (typeof input.account !== "string" || typeof address !== "string" || address.toLowerCase() !== input.account.toLowerCase() || at(scope, "network") !== input.network || at(scope, "startTime") !== time(input.startTime) || at(scope, "endTime") !== time(input.endTime)) {
      output.issues.push("Wallet result scope does not match the saved account, network and time window."); return;
    }
  }
  function historyAvailable(result: unknown, type: string) {
    const network = at(result, "scope", "network");
    const endpoint = network === "testnet" ? "https://api.hyperliquid-testnet.xyz/info" : network === "mainnet" ? "https://api.hyperliquid.xyz/info" : null;
    return endpoint !== null && list(at(result, "evidence", "entries")).some(entry => at(entry, "type") === type && at(entry, "endpoint") === endpoint && at(entry, "httpStatus") === 200 && at(entry, "error") === null);
  }
  function amount(result: unknown, field: string) {
    const fills = historyAvailable(result, "userFillsByTime"), funding = historyAvailable(result, "userFunding");
    if (field === "fundingUsdc" ? !funding : field === "observedNetUsdc" ? !fills || !funding : !fills) return null;
    if (field !== "signedFeesByToken") return at(result, "outcome", field);
    const fees = at(result, "outcome", field);
    // An evidenced empty fill history reports no fee entries. A missing currency in a nonempty history stays unavailable.
    if (at(result, "outcome", "fillCount") === 0 && fees !== null && typeof fees === "object" && !Array.isArray(fees) && Object.keys(fees).length === 0) return "0";
    return at(fees, "USDC");
  }
  for (const [label, result] of [["Baseline", a], ["Current", b]] as const) {
    for (const type of ["userFillsByTime", "userFunding"]) if (!historyAvailable(result, type)) output.issues.push(`${label}: no successful ${type} history read was captured; dependent amounts are unavailable, not zero.`);
    output.notes.push(...strings(at(result, "coverage", "gaps")).map(note => `${label} coverage: ${note}`));
    if (at(result, "coverage", "completeWindow") !== true) output.issues.push(`${label}: full-window history is unverified; results describe only observed activity.`);
    const observed = at(result, "exposure", "accountSnapshotTime");
    output.notes.push(`${label} exposure snapshot: ${typeof observed === "number" && Number.isFinite(observed) && !Number.isNaN(new Date(observed).getTime()) ? new Date(observed).toISOString() : "timestamp unavailable"}.`);
  }
  const accounting = "Change is revised evidence for the same historical window, not newly earned profit or a portfolio return.";
  output.sections.push({ title: "Observed wallet activity", description: accounting, rows: [
    walletRow("observed-net", "Observed net outcome", amount(a, "observedNetUsdc"), amount(b, "observedNetUsdc"), "Closed PnL minus signed fees plus signed funding; excludes unrealized PnL and unseen cashflows."),
    walletRow("closed-pnl", "Observed closed PnL", amount(a, "closedPnlUsdc"), amount(b, "closedPnlUsdc"), accounting),
    walletRow("signed-fees", "Signed USDC fees", amount(a, "signedFeesByToken"), amount(b, "signedFeesByToken"), "Positive fees are costs; negative fees are rebates. Builder fees are already included. Missing fee currencies are not assumed zero."),
    walletRow("signed-funding", "Signed funding", amount(a, "fundingUsdc"), amount(b, "fundingUsdc"), "Positive funding is received; negative funding is paid. Signed cashflow changes have no percentage-return interpretation."),
  ] });
  output.sections.push({ title: "Current exposure", description: "Sequential capture-time observations, not historical window-end balances.", rows: [walletRow("gross-exposure", "Gross default-perp exposure", at(a, "exposure", "grossNotionalUsdc"), at(b, "exposure", "grossNotionalUsdc"), "Gross notional is exposure, not account equity or profit. Stop protection is not assessed.")] });
  output.notes.push(accounting, "Default-perpetual scope only. Provider retention, page budgets and unknown opening inventory limit coverage; spot, HIP-3, transfers and unenumerated accounts prevent a complete portfolio-return claim.");
}

function strategy(output: DeskComparison, before: ComparisonSnapshot, after: ComparisonSnapshot) {
  const a = before.result, b = after.result;
  if ([a, b].some(result => at(result, "model") !== "daily-frozen-rule-validation-v1" || at(result, "identity", "namespace") !== "coingecko" || at(result, "identity", "id") !== before.inputs.asset)) { output.issues.push("Strategy result model or asset identity is unsupported or inconsistent."); return; }
  const sameHashes = ["datasetSha256", "specificationSha256", "engineSha256"].every(key => hash(at(a, "inputHashes", key)) && at(a, "inputHashes", key) === at(b, "inputHashes", key));
  if (!sameHashes) output.issues.push("Dataset, specification or engine hashes changed or are missing. Values are shown for inspection; deltas are unavailable across incompatible experiments.");
  for (const period of ["reference", "heldOut"] as const) {
    const pa = at(a, "periods", period, "period"), pb = at(b, "periods", period, "period");
    const validPeriod = (value: unknown) => time(at(value, "firstObservation")) < time(at(value, "lastObservation")) && Number.isSafeInteger(at(value, "observations")) && Number(at(value, "observations")) >= 2;
    const samePeriod = validPeriod(pa) && validPeriod(pb) && stable(pa) === stable(pb);
    if (!samePeriod) output.issues.push(`${period === "heldOut" ? "Held-out" : "Reference"} period boundaries changed or are unavailable; period deltas are suppressed.`);
    const periodLabel = (value: unknown) => validPeriod(value) ? `${at(value, "firstObservation")} to ${at(value, "lastObservation")} (${at(value, "observations")} observations)` : "unavailable";
    for (const scenario of ["baseline", "higherCosts"] as const) {
      const metricsA = at(a, "periods", period, scenario, "metrics"), metricsB = at(b, "periods", period, scenario, "metrics");
      const comparable = sameHashes && samePeriod && stable(at(a, "costScenarios", scenario)) === stable(at(b, "costScenarios", scenario));
      const note = comparable ? "Same data, frozen specification, engine and period. Percentage metrics change in percentage points." : "Different or unverifiable experiments; values are shown without a performance delta.";
      const metrics: Array<[string, string, ComparisonRow["unit"]]> = [["timeWeightedReturnPct", "Time-weighted return", "percent"], ["endingEquityUsd", "Ending equity", "USD"], ["maxDrawdownPct", "Maximum drawdown", "percent"], ["tradeCount", "Modeled trades", "count"]];
      const validMetric = (value: unknown, key: string) => key === "tradeCount" ? Number.isSafeInteger(value) && Number(value) >= 0 ? value : null : key === "maxDrawdownPct" ? number(value) !== null && Number(value) >= 0 && Number(value) <= 100 ? value : null : value;
      output.sections.push({ title: `${period === "heldOut" ? "Held-out" : "Reference"} · ${scenario === "higherCosts" ? "Higher costs" : "Baseline costs"}`, description: `Baseline: ${periodLabel(pa)}. Current: ${periodLabel(pb)}.`, rows: metrics.map(([key, label, unit]) => numericRow(`${period}-${scenario}-${key}`, label, unit, validMetric(at(metricsA, key), key), validMetric(at(metricsB, key), key), comparable, note)) });
    }
  }
  output.notes.push("Historical simulations restart each period independently. Comparing captures is not a continuous equity curve, an out-of-sample guarantee or a reason to tune a rule on held-out results.");
}
