import { expect, test } from "bun:test";
import { mkdtemp, access, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { providerCatalog, parseProviderCatalog, filterProviders, selectProvider } from "../src/provider-catalog.ts";
import skills from "../catalog/skills.json";
import { parseCatalog } from "../src/core.ts";

test("provider discovery includes the entire studied directory without expanding the installation trust boundary", () => {
  expect(providerCatalog.providers.filter(provider => provider.listedInDirectory)).toHaveLength(58);
  expect(providerCatalog.providers.filter(provider => provider.integration.defaultEnabled).map(provider => provider.id)).toEqual(["coingecko"]);
  expect(parseCatalog(skills).packs.every(pack => pack.source === "galleonlabs/crypto-defi-skills")).toBe(true);
  expect(providerCatalog.providers.filter(provider => provider.integration.connection).map(provider => provider.integration.connection).sort()).toEqual(["aixbt", "alchemy", "blockscout", "coinbase", "coingecko", "defillama", "tenderly"]);
});

test("discovery cannot enable an external server, repoint an official endpoint or misrepresent a paid provider as default", () => {
  const sample = structuredClone(providerCatalog);
  sample.providers = [selectProvider("blockscout")];
  for (const patch of [
    { endpoint: "https://example.com/mcp" }, { defaultEnabled: true },
    { connection: "morpho" }, { policy: "no-connection" },
  ]) {
    const candidate = structuredClone(sample);
    Object.assign(candidate.providers[0]!.integration, patch);
    expect(() => parseProviderCatalog(candidate)).toThrow("reviewed Hermes contract");
  }
  for (const patch of [
    { sources: ["http://example.com"] }, { sources: ["https://user:password@example.com"] },
    { review: { status: "directory-listed", checkedOn: "2026-10-08", notes: "Listed only" } },
    { cost: "free" }, { access: { kind: "none", requirements: "Unreviewed" } },
  ]) {
    const candidate = structuredClone(sample);
    Object.assign(candidate.providers[0]!, patch);
    expect(() => parseProviderCatalog(candidate)).toThrow();
  }
  const unconnected = structuredClone(providerCatalog);
  unconnected.providers = [selectProvider("walletchan")];
  unconnected.providers[0] = structuredClone(unconnected.providers[0]!);
  unconnected.providers[0].integration.endpoint = "https://example.com/mcp";
  expect(() => parseProviderCatalog(unconnected)).toThrow("unreviewed connections");
});

test("search and access filters keep keyless discovery separate from cost and authority", () => {
  expect(filterProviders({ search: "BLOCKSCOUT" }).map(provider => provider.id)).toContain("blockscout");
  expect(filterProviders({ access: "keyless" }).map(provider => provider.id)).toContain("coingecko");
  expect(filterProviders({ capability: "wAlLeT" }).every(provider => provider.listedCapabilities.includes("Wallet"))).toBe(true);
  expect(filterProviders({ search: "does-not-exist" })).toEqual([]);
  expect(() => filterProviders({ access: "free" })).toThrow("Choose --access");
  expect(() => filterProviders({ search: "" })).toThrow("nonempty");
  expect(() => filterProviders({ capability: "made-up" })).toThrow("Unknown capability");
  expect(() => selectProvider("missing")).toThrow("Unknown provider");
});

test("primary review retains migrated endpoints, paid paths, external writes and independent tool authorship", () => {
  expect(selectProvider("base")).toMatchObject({ name: "Coinbase Wallet MCP (formerly Base MCP)", documentedEndpoint: "https://wallet-mcp.coinbase.com", authority: "signing" });
  expect(selectProvider("hyperliquid-cli").provenance).toBe("third-party");
  expect(selectProvider("panoptic").authority).toBe("read");
  expect(selectProvider("steer").authority).toBe("mixed");
  expect(selectProvider("ctrl").authority).toBe("mixed");
  expect(selectProvider("sablier").authority).toBe("mixed");
  expect(selectProvider("fluid")).toMatchObject({ review: { status: "directory-listed" }, access: { kind: "unknown" }, cost: "unknown", authority: "unknown" });
  expect(selectProvider("zero-x").cost).toBe("mixed");
  expect(selectProvider("morpho")).toMatchObject({ documentedEndpoint: "https://mcp.morpho.org/", authority: "unsigned", integration: { policy: "no-connection" } });
});

async function cli(args: string[]) {
  const child = Bun.spawn([process.execPath, "src/cli.ts", ...args], { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
  return { stdout, stderr, code };
}
test("provider discovery emits structured source evidence without profiles or network calls", async () => {
  const root = await mkdtemp(join(tmpdir(), "boomkin-discovery-"));
  try {
    const result = await cli(["providers", "--provider", "blockscout", "--json"]);
    expect(result.code).toBe(0);
    const item = JSON.parse(result.stdout).providers[0];
    expect(item.review.status).toBe("primary-source-reviewed");
    expect(item.cost).toBe("free-limited");
    expect(item.integration.defaultEnabled).toBe(false);
    expect(item.sources).toContain("https://mcp.blockscout.com/");
    const empty = await cli(["providers", "--search", "does-not-exist", "--json"]);
    expect(empty.code).toBe(0);
    expect(JSON.parse(empty.stdout).providers).toEqual([]);
    for (const args of [
      ["providers", "--provider", "blockscout", "--access", "keyless"],
      ["providers", "--directory", join(root, "profile")],
      ["connect", "--provider", "morpho", "--dry-run"],
      ["workflows", "--search", "aave"], ["providers", "--capability", "typo"],
      ["providers", "--provider", ""],
    ]) expect((await cli(args)).code).toBe(1);
    await expect(access(join(root, "profile"))).rejects.toThrow();
  } finally { await rm(root, { recursive: true, force: true }); }
});
