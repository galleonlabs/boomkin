# Find a provider by capability and authority

Boomkin's local discovery catalog studies all 58 entries in [skills.eth.sh](https://skills.eth.sh/), plus the existing AIXBT and Coinbase account connections. Primary documentation, repository instructions and public package readmes were reviewed on October 8, 2026. Discovery records a tool's capabilities, authorship, prerequisites, cost and financial authority separately. It makes no network call, installs no third-party skill and grants no account permissions.

```bash
boomkin providers
boomkin providers --search simulation --json
boomkin providers --capability Data --access keyless
boomkin providers --provider blockscout
boomkin providers --provider morpho --json
```

`--provider` selects one catalog ID. `--search` matches names, interfaces, categories and the task summary; `--capability` matches one listed category, case-insensitively. `--access` accepts `keyless`, `credentials`, `mixed`, `local` or `unknown`. Combine filters to narrow a job. Empty JSON results are `providers: []`; unknown IDs, categories and access values fail with a recovery message.

## Read the source boundary

`primary-source-reviewed` means the linked provider documentation, repository or package readme was checked. It does not prove that an endpoint is reachable, the current schemas match, a credential works, a wallet has funds or a request settled. `directory-listed` retains a useful discovery pointer with its unknowns. The linked Fluid skill returns a page-not-found body, so its entry remains unavailable and unverified.

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

The source-controlled [provider catalog](../catalog/providers.json) carries all source URLs, dated notes, access/cost/authority fields and documented endpoints. Its public website copy is available at [assets/providers.json](https://galleonlabs.github.io/boomkin/assets/providers.json). Both CLI and website use that same catalog; endpoint metadata does not extend the connection allowlist.

| Provider/source | Authorship | Access / cost | Authority | Boomkin path |
| --- | --- | --- | --- | --- |
| [Polymarket CLI](https://github.com/Polymarket/polymarket-cli) (`polymarket`) | protocol-official | mixed / mixed | mixed | Source reference |
| [Hyperliquid CLI](https://github.com/hypurrclaw/hyperliquid-cli) (`hyperliquid-cli`) | third-party | mixed / mixed | mixed | Source reference |
| [WalletChan MCP](https://www.npmjs.com/package/@walletchan/mcp) (`walletchan`) | tool-provider-official | mixed / mixed | signing | Source reference |
| [Phantom MCP](https://docs.phantom.com/phantom-mcp-server) (`phantom`) | protocol-official | credentials / mixed | signing | Source reference |
| [Aave for Agents](https://aave.com/agents) (`aave`) | protocol-official | keyless / free-limited | unsigned | Source reference |
| [Coinbase Wallet MCP (formerly Base MCP)](https://docs.base.org/agents/quickstart) (`base`) | protocol-official | credentials / mixed | signing | Source reference |
| [Uniswap AI](https://github.com/Uniswap/uniswap-ai) (`uniswap`) | protocol-official | local / mixed | mixed | Source reference |
| [0x AI](https://0x.org/post/0x-agent-skills) (`zero-x`) | protocol-official | mixed / mixed | signing | Source reference |
| [Aerodrome Sugar](https://aerodrome-finance.github.io/agents/) (`aerodrome`) | protocol-official | local / mixed | unsigned | Source reference |
| [Doppler Skills](https://github.com/whetstoneresearch/doppler-skills) (`doppler`) | protocol-official | local / mixed | mixed | Source reference |
| [CTRL Skill & MCP](https://github.com/CTRLabs/ctrl-skill) (`ctrl`) | tool-provider-official | mixed / mixed | mixed | Source reference |
| [Morpho Agents](https://morpho.org/blog/introducing-morpho-agents-beta-interface-built-for-ai-agents/) (`morpho`) | protocol-official | keyless / free-limited | unsigned | Source reference |
| [Fluid Skill](https://fluid.io/skill.md) (`fluid`) | unverified | unknown / unknown | unknown | Unavailable; verify source |
| [Pendle AI](https://github.com/pendle-finance/pendle-ai) (`pendle`) | protocol-official | mixed / mixed | mixed | Source reference |
| [Panoptic MCP](https://www.npmjs.com/package/@panoptic-eng/mcp) (`panoptic`) | protocol-official | local / mixed | read | Source reference |
| [OpenSea Skills](https://github.com/ProjectOpenSea/opensea-skill) (`opensea`) | protocol-official | credentials / mixed | signing | Source reference |
| [Across Skills](https://skills.across.to/) (`across`) | protocol-official | mixed / mixed | mixed | Source reference |
| [Socket for Agents](https://docs.socket.tech/for-agents/intro) (`socket`) | protocol-official | mixed / mixed | signing | Source reference |
| [DeFi Skills](https://defi-skills.nethermind.io/) (`nethermind`) | tool-provider-official | mixed / mixed | unsigned | Source reference |
| [Sablier Agent Skills](https://blog.sablier.com/sablier-agent-skills-onchain-token-vesting-powered-by-ai) (`sablier`) | protocol-official | local / mixed | mixed | Source reference |
| [Superfluid Skills](https://skills.superfluid.org/) (`superfluid`) | protocol-official | local / mixed | unsigned | Source reference |
| [YO Protocol Skills](https://github.com/yoprotocol/yo-protocol-skills) (`yo`) | protocol-official | mixed / mixed | mixed | Source reference |
| [Octav API](https://docs.octav.fi/api/ai-development/overview) (`octav`) | tool-provider-official | mixed / mixed | mixed | Source reference |
| [DefiLlama Skills](https://github.com/DefiLlama/defillama-skills) (`defillama`) | tool-provider-official | credentials / metered | read | `connect --provider defillama` |
| [Ethereum Research MCP](https://github.com/ETHCF/ethereum-mcp) (`ethereum-research`) | third-party | credentials / mixed | read | Source reference |
| [Dune](https://dune.com/agents) (`dune`) | tool-provider-official | mixed / mixed | mixed | Source reference |
| [CoinGecko MCP](https://mcp.api.coingecko.com/) (`coingecko`) | tool-provider-official | keyless / free-limited | read | `connect --provider coingecko` |
| [Blockscout MCP](https://mcp.blockscout.com/) (`blockscout`) | protocol-official | keyless / free-limited | read | `connect --provider blockscout` |
| [Etherscan AI Tools](https://docs.etherscan.io/build-with-ai/introduction) (`etherscan`) | tool-provider-official | mixed / mixed | read | Source reference |
| [Tenderly MCP](https://docs.tenderly.co/ai-tools/quickstart) (`tenderly`) | tool-provider-official | credentials / metered | mixed | `connect --provider tenderly` |
| [Alchemy CLI](https://www.alchemy.com/docs/alchemy-cli) (`alchemy`) | tool-provider-official | credentials / mixed | mixed | `connect --provider alchemy` |
| [Portals Foresight](https://foresight.portals.fi/docs/skill/) (`portals-foresight`) | tool-provider-official | mixed / mixed | unsigned | Source reference |
| [Herd](https://herd.eco/skill.md) (`herd`) | tool-provider-official | credentials / mixed | mixed | Source reference |
| [GoldRush Agent Skills & MCP](https://goldrush.dev/docs/goldrush-agent-skills/overview) (`goldrush`) | tool-provider-official | mixed / mixed | mixed | Source reference |
| [poidh Bounty Skill](https://github.com/picsoritdidnthappen/poidh-app/blob/prod/SKILL.md) (`poidh`) | protocol-official | local / mixed | signing | Source reference |
| [Fileverse](https://www.npmjs.com/package/@fileverse/api) (`fileverse`) | tool-provider-official | credentials / mixed | mixed | Source reference |
| [Veil Cash MCP](https://www.npmjs.com/package/@veil-cash/mcp) (`veil-cash`) | protocol-official | mixed / mixed | mixed | Source reference |
| [WalletConnect Agent SDK](https://github.com/WalletConnect/agent-sdk) (`walletconnect`) | protocol-official | mixed / mixed | signing | Source reference |
| [Safe CLI](https://github.com/safe-global/safe-cli) (`safe`) | protocol-official | local / mixed | signing | Source reference |
| [JustaLab / JAW smart accounts](https://jaw.id/) (`jaw`) | protocol-official | mixed / mixed | signing | Source reference |
| [Steer CLI](https://www.npmjs.com/package/@steerprotocol/cli) (`steer`) | protocol-official | local / mixed | mixed | Source reference |
| [Bankr Skills](https://skills.bankr.bot/) (`bankr`) | tool-provider-official | credentials / mixed | signing | Source reference |
| [Bitrefill Skill](https://www.bitrefill.com/agents/SKILL.md) (`bitrefill`) | protocol-official | mixed / mixed | signing | Source reference |
| [Pashov Skills](https://github.com/pashov/skills) (`pashov`) | tool-provider-official | local / local | read | Source reference |
| [Trail of Bits Skills](https://github.com/trailofbits/skills) (`trail-of-bits`) | tool-provider-official | local / local | read | Source reference |
| [QuillShield Security Skills](https://github.com/quillai-network/quillshield_skills) (`quillshield`) | tool-provider-official | local / local | read | Source reference |
| [ETHSkills](https://ethskills.com/) (`ethskills`) | community | keyless / free-limited | mixed | Source reference |
| [OpenZeppelin MCP](https://mcp.openzeppelin.com/) (`openzeppelin`) | protocol-official | mixed / mixed | unsigned | Source reference |
| [Foundry MCP Server](https://github.com/PraneshASP/foundry-mcp-server) (`foundry-mcp`) | third-party | local / mixed | mixed | Source reference |
| [Ethereum Developer MCP](https://github.com/gskril/ethereum-mcp) (`ethereum-developer`) | third-party | keyless / free-limited | read | Source reference |
| [Cryo MCP](https://github.com/z80dev/cryo-mcp) (`cryo`) | third-party | local / mixed | read | Source reference |
| [EIP-7702 Rescue](https://github.com/trustless-ai/eip7702-rescue) (`eip7702-rescue`) | third-party | local / mixed | unsigned | Source reference |
| [Nani Qwen 3.5 2B](https://huggingface.co/NaniDAO/nani-qwen-3.5-2B-gguf-q4km) (`nani`) | community | local / local | runtime | Source reference |
| [Venice MCP](https://github.com/veniceai/venice-mcp-server) (`venice`) | tool-provider-official | mixed / metered | runtime | Source reference |
| [Trustless AI Agent SDK](https://github.com/trustless-ai/agent-sdk) (`trustless-agent-sdk`) | third-party | local / mixed | mixed | Source reference |
| [Recompute Kit](https://github.com/trustless-ai/recompute-kit) (`recompute`) | third-party | local / mixed | read | Source reference |
| [Aeon](https://github.com/aeonfun/aeon) (`aeon`) | tool-provider-official | mixed / mixed | runtime | Source reference |
| [Cult OS CLI](https://www.npmjs.com/package/@cultos/cli) (`cult-os`) | tool-provider-official | mixed / mixed | mixed | Source reference |
| [AIXBT crypto intelligence](https://docs.aixbt.tech/developers/mcp) (`aixbt`) | tool-provider-official | mixed / mixed | read | `connect --provider aixbt` |
| [Coinbase account MCP](https://docs.cdp.coinbase.com/x402/agentic-accounts/coinbase-for-agents) (`coinbase`) | protocol-official | credentials / mixed | mixed | `connect --provider coinbase` |
