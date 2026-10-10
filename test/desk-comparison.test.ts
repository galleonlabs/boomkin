import { expect, test } from "bun:test";
import { compareDeskRuns, type ComparisonSnapshot } from "../src/desk-comparison.ts";

const digest = "a".repeat(64), otherDigest = "b".repeat(64);
function snapshot(kind: "market" | "wallet" | "strategy", current = false): ComparisonSnapshot {
  const createdAt = current ? "2026-10-10T10:00:00.000Z" : "2026-10-09T10:00:00.000Z";
  const base: ComparisonSnapshot = {
    run: { id: current ? "current" : "baseline", project: "example", kind, state: "complete", createdAt, finishedAt: createdAt },
    inputs: { asset: "ethereum" }, packRevision: "1".repeat(40), result: {}, resultVerified: true, integrityIssues: [],
    evidence: [{ id: "read-001", source: "https://api.example.com/info?b=2&a=1", sha256: digest, limitations: ["Captured source scope."] }],
  };
  if (kind === "market") base.result = marketResult(current);
  if (kind === "wallet") {
    base.inputs = { account: "0x" + "1".repeat(40), network: "mainnet", startTime: "2026-09-01T00:00:00.000Z", endTime: "2026-09-30T00:00:00.000Z" };
    base.result = {
      scope: { address: base.inputs.account, network: "mainnet", startTime: Date.parse(String(base.inputs.startTime)), endTime: Date.parse(String(base.inputs.endTime)) },
      coverage: { completeWindow: false, gaps: ["History page budget reached."] },
      outcome: { fillCount: 2, observedNetUsdc: current ? "9007199254740993.000000000000000001" : "9007199254740993", closedPnlUsdc: "42", signedFeesByToken: { USDC: current ? "-0.100000000000000001" : "0.1" }, fundingUsdc: current ? "0.2" : "-0.1" },
      evidence: { entries: ["userFillsByTime", "userFunding"].map(type => ({ type, endpoint: "https://api.hyperliquid.xyz/info", httpStatus: 200, error: null, responseSha256: digest })) },
      exposure: { grossNotionalUsdc: current ? "1.01" : "0", accountSnapshotTime: Date.parse(createdAt) }, limitations: ["No complete portfolio return."],
    };
  }
  if (kind === "strategy") base.result = strategyResult();
  return base;
}
function marketResult(current = false): any {
  const timestamp = current ? "2026-10-10T10:00:00.000Z" : "2026-10-09T10:00:00.000Z";
  return { status: "complete", parameters: { maxAgeSeconds: 300 }, limitations: ["Aggregate marks, not quotes."], reads: ["coingecko", "defillama"].map(provider => ({ provider, observations: [{ ok: true, provider, identity: { namespace: "coingecko", id: "ethereum" }, unit: "USD", priceUsd: current ? 2750 : 2500, observedAt: timestamp, retrievedAt: timestamp }] })) };
}
function strategyResult(): any {
  const metrics = { timeWeightedReturnPct: 10, endingEquityUsd: 11000, maxDrawdownPct: 5, tradeCount: 4 };
  return { model: "daily-frozen-rule-validation-v1", identity: { namespace: "coingecko", id: "ethereum" }, inputHashes: { datasetSha256: digest, specificationSha256: digest, engineSha256: digest },
    costScenarios: { baseline: { feeBps: 10, slippageBps: 5 }, higherCosts: { feeBps: 20, slippageBps: 15 } },
    periods: Object.fromEntries(["reference", "heldOut"].map((period, index) => [period, { period: { firstObservation: `2026-0${index + 1}-01T00:00:00.000Z`, lastObservation: `2026-0${index + 1}-28T00:00:00.000Z`, observations: 28 }, baseline: { metrics: { ...metrics } }, higherCosts: { metrics: { ...metrics, timeWeightedReturnPct: 9, endingEquityUsd: 10900 } } }])),
    limitations: ["Historical simulation only."],
  };
}
const rows = (value: ReturnType<typeof compareDeskRuns>) => value.sections.flatMap(section => section.rows);

test("market matches by provider despite source ordering, preserving exact identity and captured timestamps", () => {
  const before = snapshot("market"), after = snapshot("market", true);
  (after.result as any).reads.reverse();
  const value = compareDeskRuns("market", before, after);
  expect(value.status).toBe("compared"); expect(rows(value)).toHaveLength(2);
  expect(rows(value).every(row => row.delta === "250" && row.changePct === "10")).toBe(true);
  expect(rows(value)[0].note).toContain("Observed 2026-10-09");
  expect(rows(value)[0].note).toContain("Observed 2026-10-10");
  expect(value.notes.join(" ")).toContain("Aggregate marks"); expect(value.notes.join(" ")).toContain("Captured source scope");
});

test("source comparison canonicalizes URLs and ordering, detects changed bytes and keeps distinct artifacts", () => {
  const before = snapshot("market"), after = snapshot("market", true);
  before.evidence.push({ id: "read-002", source: "https://other.example/info", sha256: digest, limitations: [] });
  after.evidence[0].source = "https://api.example.com/info?a=1&b=2#ignored";
  after.evidence[0].sha256 = otherDigest;
  after.evidence.push({ id: "read-003", source: "https://api.example.com/info?a=1&b=2", sha256: digest, limitations: [] });
  after.evidence.reverse();
  const value = compareDeskRuns("market", before, after);
  expect(value.sourceChanges.changed).toEqual(["read-001 · https://api.example.com/info?a=1&b=2"]);
  expect(value.sourceChanges.removed).toEqual(["read-002 · https://other.example/info"]);
  expect(value.sourceChanges.added).toEqual(["read-003 · https://api.example.com/info?a=1&b=2"]);
});

test("cached and reversed observed timestamps never turn retrieval changes into market movement", () => {
  for (const timestamp of ["2026-10-09T10:00:00.000Z", "2026-10-09T09:59:59.000Z"]) {
    const before = snapshot("market"), after = snapshot("market", true);
    for (const read of (after.result as any).reads) {
      read.observations[0].observedAt = timestamp;
      read.observations[0].retrievedAt = "2026-10-09T10:01:00.000Z";
    }
    const value = compareDeskRuns("market", before, after);
    expect(value.status).toBe("limited"); expect(rows(value).every(row => row.delta === null && row.changePct === null)).toBe(true);
    expect(rows(value)[0].after).toBe("2750"); expect(rows(value)[0].note).toContain("cached, reversed");
    expect(value.summary).toBe("Saved values are shown, but their changes cannot be compared.");
  }
});

test("market partial, failed, missing and stale observations remain unavailable rather than zero", () => {
  const before = snapshot("market"), after = snapshot("market", true);
  after.run.state = "partial";
  (after.result as any).reads[0].observations[0] = { ok: false, provider: "coingecko", identity: { namespace: "coingecko", id: "ethereum" }, error: "stale_observation" };
  let value = compareDeskRuns("market", before, after);
  expect(value.status).toBe("limited"); expect(rows(value)[0].after).toBeNull(); expect(rows(value)[0].delta).toBeNull(); expect(rows(value)[1].delta).toBe("250");
  (after.result as any).reads = [(after.result as any).reads[0]];
  value = compareDeskRuns("market", before, after); expect(rows(value)[1].after).toBeNull();
  (before.result as any).reads = [];
  value = compareDeskRuns("market", before, after); expect(value.status).toBe("unavailable");
});

test("market validates runtime identity, numeric values, age and duplicate provider observations", () => {
  for (const invalid of [NaN, Infinity, "2750", null, -3, 0]) {
    const before = snapshot("market"), after = snapshot("market", true);
    (after.result as any).reads[0].observations[0].priceUsd = invalid;
    expect(rows(compareDeskRuns("market", before, after))[0].after).toBeNull();
  }
  for (const mutation of [
    (row: any) => { row.identity.id = "bitcoin"; },
    (row: any) => { row.identity.namespace = "ticker"; },
    (row: any) => { row.observedAt = "2026-10-10T09:00:00.000Z"; },
    (row: any) => { row.unit = "ETH"; },
  ]) {
    const before = snapshot("market"), after = snapshot("market", true); mutation((after.result as any).reads[0].observations[0]);
    expect(rows(compareDeskRuns("market", before, after)).find(row => row.id === "coingecko")?.after).toBeNull();
  }
  const before = snapshot("market"), after = snapshot("market", true);
  (after.result as any).reads.push((after.result as any).reads[0]);
  const value = compareDeskRuns("market", before, after); expect(rows(value)[0].after).toBeNull(); expect(value.issues.join(" ")).toContain("Duplicate");
});

test("integrity, missing digests, legacy results, native runs and unfinished runs block every numeric row", () => {
  const mutations: Array<(s: ComparisonSnapshot) => void> = [
    s => { s.integrityIssues = ["Captured artifact hash differs"]; },
    s => { s.resultVerified = false; }, s => { s.evidence[0].sha256 = ""; }, s => { s.evidence = []; },
    s => { s.evidence.push(s.evidence[0]); }, s => { s.run.execution = "native-hermes"; },
    ...["queued", "running", "failed", "cancelled", "interrupted"].map(state => (s: ComparisonSnapshot) => { s.run.state = state; }),
  ];
  for (const mutation of mutations) {
    const before = snapshot("market"), after = snapshot("market", true); mutation(before);
    const value = compareDeskRuns("market", before, after); expect(value.status).toBe("unavailable"); expect(rows(value)).toEqual([]); expect(value.issues.length).toBeGreaterThan(0);
  }
  const before = snapshot("market"); before.resultVerified = false;
  expect(compareDeskRuns("market", before, snapshot("market", true)).issues.join(" ")).toContain("Recapture");
});

test("same project, inputs, pack revision and chronological distinct runs are required", () => {
  const mutations: Array<(s: ComparisonSnapshot) => void> = [
    s => { s.run.id = "baseline"; }, s => { s.run.createdAt = "2026-10-09T10:00:00.000Z"; }, s => { s.run.createdAt = "invalid"; },
    s => { s.run.project = "other"; }, s => { s.run.kind = "wallet"; }, s => { s.inputs.asset = "bitcoin"; }, s => { s.packRevision = "different"; },
  ];
  for (const mutation of mutations) {
    const after = snapshot("market", true); mutation(after);
    expect(rows(compareDeskRuns("market", snapshot("market"), after))).toEqual([]);
  }
  const before = snapshot("market"), after = snapshot("market", true);
  before.inputs = { asset: "ethereum", nested: { one: 1, two: 2 } }; after.inputs = { nested: { two: 2, one: 1 }, asset: "ethereum" };
  expect(compareDeskRuns("market", before, after).status).toBe("compared");
});

test("wallet signed amounts use exact decimal differences even above Number safe precision", () => {
  const value = compareDeskRuns("wallet", snapshot("wallet"), snapshot("wallet", true));
  expect(value.status).toBe("limited");
  const byId = Object.fromEntries(rows(value).map(row => [row.id, row]));
  expect(byId["observed-net"].delta).toBe("0.000000000000000001");
  expect(byId["signed-fees"].delta).toBe("-0.200000000000000001");
  expect(byId["signed-funding"].delta).toBe("0.3"); expect(byId["gross-exposure"].delta).toBe("1.01");
  expect(rows(value).every(row => row.changePct === null)).toBe(true);
  expect(value.notes.join(" ")).toContain("not newly earned profit"); expect(value.notes.join(" ")).toContain("History page budget");
  expect(value.issues.join(" ")).toContain("full-window history is unverified");
});

test("wallet scope mismatch blocks comparison; missing currency/amounts never become zero", () => {
  const before = snapshot("wallet"), after = snapshot("wallet", true);
  (after.result as any).scope.endTime += 1;
  expect(rows(compareDeskRuns("wallet", before, after))).toEqual([]);
  after.result = snapshot("wallet", true).result;
  (after.result as any).outcome.signedFeesByToken = { HYPE: "3" };
  (after.result as any).outcome.observedNetUsdc = null;
  (after.result as any).exposure.grossNotionalUsdc = "NaN";
  const value = compareDeskRuns("wallet", before, after);
  expect(rows(value).filter(row => ["signed-fees", "observed-net", "gross-exposure"].includes(row.id)).every(row => row.after === null && row.delta === null)).toBe(true);
});

test("strategy compares four metrics independently for reference/held-out and both costs", () => {
  const before = snapshot("strategy"), after = snapshot("strategy", true);
  (after.result as any).periods.heldOut.higherCosts.metrics.timeWeightedReturnPct = 8;
  const value = compareDeskRuns("strategy", before, after);
  expect(value.status).toBe("compared"); expect(value.sections).toHaveLength(4); expect(rows(value)).toHaveLength(16);
  expect(rows(value).find(row => row.id === "heldOut-higherCosts-timeWeightedReturnPct")?.delta).toBe("-1");
  expect(rows(value).every(row => row.changePct === null)).toBe(true); expect(value.notes.join(" ")).toContain("restart each period independently");
});

test("strategy dataset/specification/engine changes show values with no invalid performance deltas", () => {
  for (const key of ["datasetSha256", "specificationSha256", "engineSha256"]) {
    for (const replacement of [otherDigest, "", undefined]) {
      const before = snapshot("strategy"), after = snapshot("strategy", true);
      (after.result as any).inputHashes[key] = replacement;
      const value = compareDeskRuns("strategy", before, after);
      expect(value.status).toBe("limited"); expect(rows(value).every(row => row.after !== null && row.delta === null)).toBe(true);
      expect(value.issues.join(" ")).toContain("hashes changed or are missing");
      expect(value.summary).toBe("Saved values are shown, but their changes cannot be compared.");
    }
  }
});

test("strategy period mismatch and malformed metrics suppress only validly unavailable deltas", () => {
  const before = snapshot("strategy"), after = snapshot("strategy", true);
  (after.result as any).periods.heldOut.period.lastObservation = "2026-02-27T00:00:00.000Z";
  (after.result as any).periods.reference.baseline.metrics.tradeCount = -1;
  (after.result as any).periods.reference.baseline.metrics.endingEquityUsd = "12000";
  const value = compareDeskRuns("strategy", before, after);
  expect(value.status).toBe("limited"); expect(rows(value).filter(row => row.id.startsWith("heldOut")).every(row => row.delta === null)).toBe(true);
  expect(rows(value).find(row => row.id === "reference-baseline-tradeCount")?.after).toBeNull();
  expect(rows(value).find(row => row.id === "reference-baseline-endingEquityUsd")?.after).toBeNull();
  expect(rows(value).find(row => row.id === "reference-higherCosts-endingEquityUsd")?.delta).toBe("0");
});

test("unknown result structures never crash, invent values or coerce nulls to zero", () => {
  for (const kind of ["market", "wallet", "strategy"] as const) for (const malformed of [null, [], "not a result", 42, { reads: [null, { observations: [null] }] }]) {
    const before = snapshot(kind), after = snapshot(kind, true); before.result = malformed; after.result = malformed;
    const value = compareDeskRuns(kind, before, after); expect(value.status).toBe("unavailable"); expect(rows(value).every(row => row.delta === null)).toBe(true);
  }
});

test("malformed source evidence returns unavailable before source comparison, including known integrity failures", () => {
  const valid = snapshot("market").evidence[0];
  const malformed: unknown[] = [null, {}, "sources", [null], [42], [{ ...valid, id: {} }], [{ ...valid, source: { toString: null, valueOf: null } }], [{ ...valid, sha256: [] }], [{ ...valid, limitations: null }], [{ ...valid, limitations: [null] }]];
  for (const evidence of malformed) for (const integrityIssues of [[], ["Malformed evidence record"]]) {
    const before = snapshot("market"), after = snapshot("market", true);
    before.evidence = evidence as ComparisonSnapshot["evidence"]; before.integrityIssues = integrityIssues;
    const value = compareDeskRuns("market", before, after);
    expect(value.status).toBe("unavailable"); expect(rows(value)).toEqual([]);
    expect(value.sourceChanges).toEqual({ added: [], removed: [], changed: [] });
    expect(value.issues.length).toBeGreaterThan(0);
  }
  const before = snapshot("market"); before.resultVerified = false;
  Object.defineProperty(before, "evidence", { get() { throw new Error("Evidence must not be touched after a gate fails"); } });
  expect(compareDeskRuns("market", before, snapshot("market", true)).status).toBe("unavailable");
});

test("wallet failed first history pages never turn helper zero defaults into observed accounting changes", () => {
  for (const type of ["userFillsByTime", "userFunding"]) for (const failure of [
    { httpStatus: 503, error: "HTTP 503" }, { httpStatus: null, error: "Timed out" }, { httpStatus: 200, error: "Invalid JSON" },
    { httpStatus: 200, error: null, endpoint: "https://api.hyperliquid-testnet.xyz/info" },
  ]) {
    const before = snapshot("wallet"), after = snapshot("wallet", true), result = after.result as any;
    Object.assign(result.evidence.entries.find((entry: any) => entry.type === type), failure);
    // The released helper exposes zero from an absent history even though no successful read established it.
    if (type === "userFunding") result.outcome.fundingUsdc = "0";
    else { result.outcome.closedPnlUsdc = "0"; result.outcome.fillCount = 0; result.outcome.signedFeesByToken = {}; }
    result.outcome.observedNetUsdc = null;
    const value = compareDeskRuns("wallet", before, after), byId = Object.fromEntries(rows(value).map(row => [row.id, row]));
    const blocked = type === "userFunding" ? ["signed-funding", "observed-net"] : ["closed-pnl", "signed-fees", "observed-net"];
    expect(blocked.every(id => byId[id].after === null && byId[id].delta === null)).toBe(true);
    expect(value.issues.join(" ")).toContain(`no successful ${type} history read`);
    expect(byId[type === "userFunding" ? "closed-pnl" : "signed-funding"].delta).not.toBeNull();
  }
});

test("wallet successful empty history establishes observed zeros and later-page failures retain bounded totals", () => {
  const before = snapshot("wallet"), after = snapshot("wallet", true), result = after.result as any;
  result.outcome = { fillCount: 0, observedNetUsdc: "0", closedPnlUsdc: "0", signedFeesByToken: {}, fundingUsdc: "0" };
  const value = compareDeskRuns("wallet", before, after);
  expect(rows(value).filter(row => row.id !== "gross-exposure").every(row => row.after === "0" && row.delta !== null)).toBe(true);
  for (const snapshotValue of [before, after]) {
    (snapshotValue.result as any).evidence.entries.push({ type: "userFunding", endpoint: "https://api.hyperliquid.xyz/info", httpStatus: 503, error: "HTTP 503", responseSha256: digest });
    (snapshotValue.result as any).coverage.gaps.push("userFunding: read-error");
  }
  const partial = compareDeskRuns("wallet", before, after);
  expect(partial.status).toBe("limited"); expect(rows(partial).find(row => row.id === "signed-funding")?.delta).toBe("0.1");
  expect(partial.notes.join(" ")).toContain("userFunding: read-error");
  (after.result as any).evidence.entries = {};
  expect(rows(compareDeskRuns("wallet", before, after)).filter(row => row.id !== "gross-exposure").every(row => row.after === null)).toBe(true);
});
