import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { installedVersion, parseCatalog, parseConfig, selectPacks, identity, type Catalog } from "./core.ts";
import { ensureRuntime, runHermes, initializeProfile, configureMcpServers, localProfileStatus, setMcpTrustUntrusted } from "./hermes.ts";
import { verifyIntegrity, readIntegrity } from "./integrity.ts";
import { discoverPublicMcp, type Fetcher } from "./mcp-discovery.ts";

export const defaultProfile = () => join(homedir(), ".boomkin", "hermes");
export const providers = {
  coingecko: { url: "https://mcp.api.coingecko.com/mcp", access: "Public data; no key. Enabled by onboard with a reviewed tool selection." },
  blockscout: { url: "https://mcp.blockscout.com/mcp", access: "Optional keyless explorer reads through a shared gateway with stricter rate limits and possible chain/dataset restrictions. Reviewed read tools only." },
  defillama: { url: "https://mcp.defillama.com/mcp", access: "Optional API subscription and OAuth; queries consume credits. One MCP client per account." },
  aixbt: { url: "https://api.aixbt.tech/mcp", access: "Optional crypto intelligence. Set AIXBT_API_KEY in the selected Hermes profile; only Topic reads are public. Protected tools use account access and quotas." },
  tenderly: { url: "https://mcp.tenderly.co/mcp", access: "Optional paid-plan OAuth and project access. Select simulation and inspection tools; simulation results persist in the project." },
  alchemy: { url: "https://mcp.alchemy.com/mcp", access: "Optional OAuth and selected app. Review tool selection, RPC limits and app costs." },
} as const;
export const coinGeckoConfig = {
  url: providers.coingecko.url,
  enabled: true,
  trust: "untrusted",
  tools: { include: ["execute", "search_docs"], resources: false, prompts: false },
};

// Official hosted docs and unauthenticated tools/list reviewed 2026-10-08,
// server 1.26.0. Exclude the generic direct_api_call and all future tools.
export const blockscoutConfig = {
  url: providers.blockscout.url,
  enabled: true,
  trust: "untrusted",
  tools: {
    include: ["__unlock_blockchain_analysis__", "get_block_info", "get_block_number", "get_address_by_ens_name", "get_transactions_by_address", "get_token_transfers_by_address", "lookup_token_by_symbol", "get_contract_abi", "inspect_contract_code", "read_contract", "get_address_info", "get_tokens_by_address", "nft_tokens_by_address", "get_transaction_info", "get_chains_list"],
    resources: false, prompts: false,
  },
};

// Reviewed through unauthenticated tools/list on 2026-09-05. New upstream tools
// remain excluded until reviewed; schemas are discovered by native Hermes.
export const aixbtConfig = {
  url: providers.aixbt.url,
  headers: { Authorization: "Bearer ${AIXBT_API_KEY}" },
  enabled: true,
  trust: "untrusted",
  tools: {
    include: ["list_projects", "get_project", "get_project_series", "list_intel", "get_intel", "get_report", "get_vocabulary", "list_clusters", "me", "list_topics", "get_topic", "get_topic_series"],
    resources: false, prompts: false,
  },
};

export function coinbaseSettings(directory: string) {
  const environment = `live-boomkin-${createHash("sha256").update(directory).digest("hex").slice(0, 12)}`;
  return {
    command: "npx", args: ["--yes", "@coinbase/coinbase-cli@0.0.7", "mcp"],
    env: { COINBASE_CONFIG_DIR: join(directory, ".boomkin", "coinbase"), COINBASE_ENV: environment, COINBASE_KEY_ID: "", COINBASE_KEY_SECRET: "", COINBASE_URL: "", npm_config_ignore_scripts: "true" },
    enabled: true, trust: "untrusted",
    tools: { include: ["coinbase_balance", "coinbase_portfolios_list", "coinbase_portfolios_get", "coinbase_products_get", "coinbase_products_list", "coinbase_fees"], resources: false, prompts: false },
  };
}

export async function prepareHermes(directory: string, options: { install: boolean; dryRun?: boolean; skipModelSetup?: boolean; signal?: AbortSignal }) {
  options.signal?.throwIfAborted();
  if (!options.dryRun) await initializeProfile(directory, identity);
  const executable = await ensureRuntime(directory, options);
  if (options.dryRun) return;
  options.signal?.throwIfAborted();
  await configureMcpServers(directory, { coingecko: coinGeckoConfig });
  if (!options.skipModelSetup) {
    if (!process.stdin.isTTY) throw new Error("Hermes model setup needs a terminal. Rerun onboard interactively, or use --skip-model-setup to prepare the profile and configure it later.");
    await runHermes(directory, ["setup", "model"], { executable, signal: options.signal });
  }
}

export async function connectProvider(directory: string, provider: string, dryRun = false, keyFile?: string) {
  if (provider === "coinbase") {
    const settings = coinbaseSettings(directory);
    console.log("Coinbase uses its official local MCP, with read tools only. Node.js 22+, a supported OS keychain and a scoped Coinbase key are required; login and account permissions remain separate.");
    if (dryRun) return;
    await configureMcpServers(directory, { coinbase: settings });
    if (keyFile) {
      const env: NodeJS.ProcessEnv = { ...process.env, ...settings.env };
      // Native environment-scoped keychain storage must not be overridden by a
      // different globally configured account or API endpoint.
      for (const key of ["COINBASE_KEY_ID", "COINBASE_KEY_SECRET", "COINBASE_URL"]) delete env[key];
      const child = Bun.spawn(["npx", "--yes", "@coinbase/coinbase-cli@0.0.7", "env", settings.env.COINBASE_ENV, "--key-file", keyFile], { cwd: directory, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
      if (await child.exited !== 0) throw new Error("Coinbase's native credential setup failed. Resolve its keychain or key-file issue; Boomkin never enables plaintext secret storage.");
    }
    console.log(JSON.stringify({ configDirectory: settings.env.COINBASE_CONFIG_DIR, environment: settings.env.COINBASE_ENV, nextAction: "Use connect --provider coinbase --key-file /absolute/path/to/scoped-key.json to configure the native CLI, or follow docs/CONNECTIONS.md. Balances and account authority have not been checked." }, null, 2));
    return;
  }
  if (!Object.hasOwn(providers, provider)) throw new Error("Choose coingecko, blockscout, aixbt, defillama, alchemy, tenderly or coinbase. Run providers for source-reviewed discovery; other official tools are separate opt-ins.");
  const selected = providers[provider as keyof typeof providers];
  console.log(`${provider}: ${selected.access}`);
  if (dryRun) return;
  if (provider === "coingecko") {
    await configureMcpServers(directory, { coingecko: coinGeckoConfig });
  } else if (provider === "blockscout") {
    await configureMcpServers(directory, { blockscout: blockscoutConfig });
  } else if (provider === "aixbt") {
    await configureMcpServers(directory, { aixbt: aixbtConfig });
  } else {
    if (!process.stdin.isTTY) throw new Error("This provider requires interactive OAuth and tool selection. Run connect in your terminal.");
    await runHermes(directory, ["mcp", "add", provider, "--url", selected.url, "--auth", "oauth"]);
  }
  // Native MCP setup can exit successfully after cancellation or a failed probe.
  const status = await localProfileStatus(directory);
  const server = status.mcpServers.find(entry => entry.name === provider);
  if (!server?.enabled || server.missingEnvironment.length) throw new Error("Provider setup is incomplete. Resolve its native authentication/configuration before relying on it.");
  if (!["coingecko", "blockscout", "aixbt"].includes(provider)) await setMcpTrustUntrusted(directory, provider);
  console.log(`${provider} configuration is present. Restart Hermes to load it; configuration alone does not prove a successful data read.`);
}

export async function publicDataProbe(fetcher: Fetcher = fetch, provider: "coingecko" | "aixbt" | "blockscout" = "coingecko") {
  // Discovery never sends configured credentials or invokes tools/call.
  const selected = { coingecko: coinGeckoConfig, aixbt: aixbtConfig, blockscout: blockscoutConfig }[provider];
  try {
    const discovered = await discoverPublicMcp(selected.url, selected.tools.include, fetcher);
    return { provider, status: "verified" as const, observedAt: new Date().toISOString(), evidence: "public MCP initialization and reviewed tool discovery", tools: discovered.tools, discovered: discovered.discovered, marketRead: "not-tested", scope: "Provider connectivity only; Hermes tool loading is checked by the native runtime" };
  } catch {
    return { provider, status: "unavailable" as const, observedAt: new Date().toISOString(), evidence: "Public MCP could not verify the reviewed tool contract. Retry later or consult the provider connection guide." };
  }
}

export async function doctor(directory: string, catalog: Catalog, live = false) {
  const profile = await localProfileStatus(directory);
  const gaps: string[] = [];
  const packs: { id: string; version: string; installed: boolean }[] = [];
  try {
    const config = parseConfig(JSON.parse(await readFile(join(directory, ".boomkin/config.json"), "utf8")), directory);
    if (config.harness !== "hermes") throw new Error("Not a Hermes profile");
    gaps.push(...await verifyIntegrity(join(directory, "skills"), selectPacks(parseCatalog(catalog), config.packs), await readIntegrity(directory)));
    for (const pack of selectPacks(parseCatalog(catalog), config.packs).packs) {
      let installed = true;
      for (const skill of pack.skills) {
        try { if (installedVersion(await readFile(join(directory, "skills", skill, "SKILL.md"), "utf8")) !== pack.version) installed = false; }
        catch { installed = false; }
      }
      packs.push({ id: pack.id, version: pack.version, installed });
      if (!installed) gaps.push(`Update ${pack.id}`);
    }
  } catch { gaps.push("Run onboard in this Hermes profile"); }
  if (!profile.runtime.available) gaps.push("Install Hermes with onboard");
  if (!profile.hasSoul) gaps.push("Initialize the Boomkin profile with onboard");
  if (!profile.modelConfigured) gaps.push("Complete native Hermes model setup");
  if (!profile.mcpServers.some(server => server.name === "coingecko" && server.enabled)) gaps.push("Connect public CoinGecko data with onboard or connect --provider coingecko");
  for (const server of profile.mcpServers) if (server.missingEnvironment.length) gaps.push(`Configure missing environment for ${server.name}`);
  const publicData = live ? await publicDataProbe() : { status: "not-tested", nextAction: "Run doctor --live for a keyless public MCP connection check" };
  const optionalData = live ? await Promise.all((["aixbt", "blockscout"] as const).filter(name => profile.mcpServers.some(server => server.name === name && server.enabled)).map(name => publicDataProbe(fetch, name))) : [];
  return { directory, state: gaps.length ? "needs-setup" : "configured", ...profile, packs, publicData, optionalData, gaps, financialAccess: "No wallet, payment or trading authority is granted by onboarding", nextAction: gaps.length ? gaps[0] : "Run start; authentication and a successful model response are verified by Hermes at use time" };
}
