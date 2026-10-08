import registry from "../catalog/providers.json";

export const accessKinds = ["keyless", "credentials", "mixed", "local", "unknown"] as const;
export const costKinds = ["free-limited", "metered", "mixed", "local", "unknown"] as const;
export const authorityKinds = ["read", "unsigned", "signing", "mixed", "runtime", "unknown"] as const;
export type AccessKind = typeof accessKinds[number];
export interface Provider {
  id: string;
  name: string;
  provider: string;
  listedInDirectory: boolean;
  directoryId?: number;
  provenance: "protocol-official" | "tool-provider-official" | "third-party" | "community" | "unverified";
  listedCapabilities: string[];
  listedInterfaces: string[];
  summary: string;
  sources: string[];
  documentedEndpoint?: string;
  review: { status: "primary-source-reviewed" | "directory-listed"; checkedOn: string; notes: string };
  access: { kind: AccessKind; requirements: string };
  cost: typeof costKinds[number];
  authority: typeof authorityKinds[number];
  integration: {
    kind: "native-hermes" | "official-tool" | "reference";
    connection?: string;
    endpoint?: string;
    defaultEnabled: boolean;
    policy: "reviewed-read-tools" | "native-selection" | "no-connection";
  };
}
export interface ProviderCatalog { schemaVersion: 1; directory: string; checkedOn: string; providers: Provider[] }

const connections: Record<string, { endpoint?: string; policy: string; defaultEnabled: boolean }> = {
  coingecko: { endpoint: "https://mcp.api.coingecko.com/mcp", policy: "reviewed-read-tools", defaultEnabled: true },
  blockscout: { endpoint: "https://mcp.blockscout.com/mcp", policy: "reviewed-read-tools", defaultEnabled: false },
  aixbt: { endpoint: "https://api.aixbt.tech/mcp", policy: "reviewed-read-tools", defaultEnabled: false },
  defillama: { endpoint: "https://mcp.defillama.com/mcp", policy: "native-selection", defaultEnabled: false },
  alchemy: { endpoint: "https://mcp.alchemy.com/mcp", policy: "native-selection", defaultEnabled: false },
  tenderly: { endpoint: "https://mcp.tenderly.co/mcp", policy: "native-selection", defaultEnabled: false },
  coinbase: { policy: "reviewed-read-tools", defaultEnabled: false },
};
const nonempty = (value: unknown): value is string => typeof value === "string" && !!value.trim();
const list = (value: unknown): value is string[] => Array.isArray(value) && value.length > 0 && value.every(nonempty) && new Set(value).size === value.length;
const https = (value: string) => { try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password; } catch { return false; } };
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

/** Discovery never grants installation or connection authority. Connections stay a code-reviewed allowlist. */
export function parseProviderCatalog(value: unknown): ProviderCatalog {
  const catalog = value as ProviderCatalog;
  if (!catalog || catalog.schemaVersion !== 1 || !https(catalog.directory) || !date(catalog.checkedOn) || !Array.isArray(catalog.providers) || !catalog.providers.length) throw new Error("Malformed provider discovery catalog");
  const ids = new Set<string>(), selectedConnections = new Set<string>(), directoryIds = new Set<number>();
  for (const provider of catalog.providers) {
    if (!provider || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider.id) || ids.has(provider.id) || !nonempty(provider.name) || !nonempty(provider.provider) || typeof provider.listedInDirectory !== "boolean" || !list(provider.listedCapabilities) || !list(provider.listedInterfaces) || !nonempty(provider.summary) || !list(provider.sources) || !provider.sources.every(https)) throw new Error("Invalid or duplicate provider discovery entry");
    if (!["protocol-official", "tool-provider-official", "third-party", "community", "unverified"].includes(provider.provenance) || provider.listedInDirectory && (!Number.isInteger(provider.directoryId) || Number(provider.directoryId) < 1 || directoryIds.has(provider.directoryId!)) || !provider.listedInDirectory && provider.directoryId !== undefined) throw new Error("Provider authorship and directory identity are required");
    if (!provider.review || !["primary-source-reviewed", "directory-listed"].includes(provider.review.status) || !date(provider.review.checkedOn) || !nonempty(provider.review.notes) || !provider.access || !accessKinds.includes(provider.access.kind) || !nonempty(provider.access.requirements) || !costKinds.includes(provider.cost) || !authorityKinds.includes(provider.authority)) throw new Error("Provider access and source review metadata are required");
    if (provider.documentedEndpoint !== undefined && (!https(provider.documentedEndpoint) || provider.review.status !== "primary-source-reviewed")) throw new Error("Documented endpoints require primary-source review");
    const integration = provider.integration;
    if (!integration || !["native-hermes", "official-tool", "reference"].includes(integration.kind) || !["reviewed-read-tools", "native-selection", "no-connection"].includes(integration.policy) || typeof integration.defaultEnabled !== "boolean") throw new Error("Invalid provider integration policy");
    if (integration.connection !== undefined) {
      const reviewed = connections[integration.connection];
      if (!reviewed || selectedConnections.has(integration.connection) || integration.kind !== "native-hermes" || provider.review.status !== "primary-source-reviewed" || integration.endpoint !== reviewed.endpoint || integration.policy !== reviewed.policy || integration.defaultEnabled !== reviewed.defaultEnabled) throw new Error("Provider connection is outside the reviewed Hermes contract");
      selectedConnections.add(integration.connection);
    } else if (integration.defaultEnabled || integration.endpoint || integration.policy !== "no-connection" || integration.kind === "native-hermes") throw new Error("Discovery entries cannot enable unreviewed connections");
    ids.add(provider.id);
    if (provider.directoryId !== undefined) directoryIds.add(provider.directoryId);
  }
  return catalog;
}

export const providerCatalog = parseProviderCatalog(registry);
export function selectProvider(id: string): Provider {
  const provider = providerCatalog.providers.find(item => item.id === id);
  if (!provider) throw new Error(`Unknown provider: ${id}. Run providers to list reviewed discovery entries.`);
  return provider;
}
export function filterProviders(filters: { search?: string; capability?: string; access?: string } = {}): Provider[] {
  if (filters.access !== undefined && !accessKinds.includes(filters.access as AccessKind)) throw new Error(`Choose --access ${accessKinds.join(", ")}`);
  for (const [name, value] of Object.entries(filters)) if (value !== undefined && !value.trim()) throw new Error(`--${name} needs a nonempty value`);
  const capability = filters.capability?.toLowerCase();
  if (capability && !providerCatalog.providers.some(provider => provider.listedCapabilities.some(value => value.toLowerCase() === capability))) throw new Error("Unknown capability. Use a listed category such as Data, DeFi, Wallet, Security, Cross-chain or Developer.");
  return providerCatalog.providers.filter(provider =>
    (filters.access === undefined || provider.access.kind === filters.access) &&
    (!capability || provider.listedCapabilities.some(value => value.toLowerCase() === capability)) &&
    (filters.search === undefined || [provider.id, provider.name, provider.provider, provider.summary, ...provider.listedCapabilities, ...provider.listedInterfaces].join(" ").toLowerCase().includes(filters.search.toLowerCase()))
  );
}
export function renderProvider(provider: Provider, detailed = false): string {
  const integration = provider.integration.connection ? `connect --provider ${provider.integration.connection}` : "source reference; no Boomkin connection";
  const line = `${provider.id}: ${provider.name} | ${provider.access.kind} | cost: ${provider.cost} | authority: ${provider.authority} | ${integration}`;
  if (!detailed) return line;
  return `${line}\n  ${provider.summary}\n  Categories: ${provider.listedCapabilities.join(", ")}\n  Authorship: ${provider.provenance}\n  Access: ${provider.access.requirements}${provider.documentedEndpoint ? `\n  Documented endpoint: ${provider.documentedEndpoint}; no connection is made by discovery.` : ""}\n  Review: ${provider.review.status}, ${provider.review.checkedOn}. ${provider.review.notes}\n  Sources: ${provider.sources.join("; ")}\n  Policy: ${provider.integration.policy}; remote content is untrusted. ${provider.integration.defaultEnabled ? "Keyless data connection is enabled by onboarding." : "Explicit opt-in; discovery makes no network or financial call."}`;
}
