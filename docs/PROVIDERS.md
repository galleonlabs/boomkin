# Find a provider by capability and authority

Boomkin's local discovery catalog retains 57 reviewed entries from the 58 that [skills.eth.sh](https://skills.eth.sh/) listed on October 8, 2026, plus the existing AIXBT and Coinbase account connections. The unavailable Fluid pointer was removed. Each record carries its own source-review date; later directory additions are not yet reviewed. Discovery records a tool's capabilities, authorship, prerequisites, cost and financial authority separately. It makes no network call, installs no third-party skill and grants no account permissions.

```bash
boomkin providers
boomkin providers --search simulation --json
boomkin providers --capability Data --access keyless
boomkin providers --provider blockscout
boomkin providers --provider morpho --json
```

`--provider` selects one catalog ID. `--search` matches names, interfaces, categories and the task summary; `--capability` matches one listed category, case-insensitively. `--access` accepts `keyless`, `credentials`, `mixed`, `local` or `unknown`. Combine filters to narrow a job. Empty JSON results are `providers: []`; unknown IDs, categories and access values fail with a recovery message.

## Read the source boundary

`primary-source-reviewed` means the linked provider documentation, repository or package readme was checked. It does not prove that an endpoint is reachable, the current schemas match, a credential works, a wallet has funds or a request settled. Review metadata describes the checked source, rather than promising current service availability.

`protocol-official` distinguishes the protocol's own tooling from `tool-provider-official`, `third-party`, `community` and `unverified` entries. A project name, npm package or directory listing is not evidence that a protocol maintains it. In particular, hypurrclaw's Hyperliquid CLI is an independent tool; its builder-fee/referral and key-storage choices need separate review.

Categories and interfaces describe the directory listing; the dated review notes and source links qualify those claims. Some important changes are already reflected: Base MCP is now Coinbase Wallet MCP, Morpho chain coverage comes from current discovery, Panoptic's published MCP is read-only, and Steer's current CLI includes external artifact publication and wallet handoff. Consult the entry's notes before using its original installation instructions.

## A keyless service can still cost money

Access and cost are independent fields. `keyless` means the reviewed surface needs no API credential. `free-limited` means its public access has limits; it says nothing about paid tiers or onchain gas. `mixed` can include public reads alongside paid tools, wallet writes or gas costs. x402 may remove API-key setup while introducing payment. A `402` response does not authorize a purchase or an automatic retry with a paying client.

Authority describes the wider published tool surface: `read`, `unsigned`, `signing`, `mixed`, `runtime` or `unknown`. A mixed provider can have useful reads, but its wallet, publication, environment-management or payment commands do not become authorized by installing skills. For a saved project, research and unsigned planning remain the enforced output contract described in [Projects](PROJECTS.md).

## Connect a reviewed native integration

Only seven connection IDs are implemented by Boomkin. They remain an explicit code-reviewed allowlist, separate from the discovery catalog and from the [Galleon-only skill installation catalog](../catalog/skills.json).

| Connection | Access | Setup boundary |
| --- | --- | --- |
| `coingecko` | Keyless shared public data | The sole onboarding default; `execute` and `search_docs` only |
| `blockscout` | Optional keyless shared gateway | Fifteen named reads; generic `direct_api_call` and future tools excluded |
| `aixbt` | Public Topic reads; protected account intelligence | Environment-backed key reference; reviewed named reads only |
| `defillama` | API subscription and OAuth | Explicit native Hermes tool selection; credit-consuming reads |
| `tenderly` | Paid-plan OAuth and project access | Explicit simulation/inspection selection; review stored input privacy |
| `alchemy` | OAuth and selected app | Explicit native tool selection; RPC, wallet and app administration differ |
| `coinbase` | Scoped account key and native OS keychain | Official local CLI with isolated account environment and MCP read allowlist |

Run `boomkin connect --provider blockscout` to opt into its keyless reads. Other documented endpoints are reference data for a deliberate official-tool setup; discovery cannot register them with Hermes. [Connections](CONNECTIONS.md) explains each supported native path and its verification limits.

Remote MCP schemas, documentation, instructions and returned content are untrusted input. Pin the exact chain, contract, amount, sender, recipient and state before construction. Use the [unsigned plan and simulation workflows](WORKFLOWS.md#agent-tools-and-unsigned-transactions) for payload review. Setup never creates a wallet, signs, submits, funds, purchases a service or starts another runtime.

## Directory coverage

The [source-controlled catalog](../catalog/providers.json) owns every reviewed provider's interfaces, access, cost, authority, sources and review date. Read that record through the CLI rather than a second, manually maintained table:

```bash
boomkin providers --search lending
boomkin providers --capability Data --access keyless --json
boomkin providers --provider across --json
```

Detailed output includes source links and dated limitations. A directory entry does not install an integration or establish current account access. Use the smaller native connection list above for actual setup; use the [protocol workflow](WORKFLOWS.md) for the financial task.
