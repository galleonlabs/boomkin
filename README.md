# Boomkin

**Your open-source DeFi desk.**

Research markets, inspect positions and test a thesis with a native [Hermes agent](https://github.com/NousResearch/hermes-agent). Keep the sources, assumptions and run history in your own profile.

[![Boomkin: research, inspect and test your DeFi thesis](https://raw.githubusercontent.com/galleonlabs/boomkin/main/docs/assets/boomkin-hero.svg)](https://galleonlabs.github.io/boomkin/lab/)

**[Try the strategy lab →](https://galleonlabs.github.io/boomkin/lab/)** · [Explore workflows](https://galleonlabs.github.io/boomkin/#workflows) · [Read the docs](https://galleonlabs.github.io/boomkin/docs/)

The browser demo needs no installation. Choose a research rule, compare held-out periods and higher trading costs, and inspect simulated trades using a dated Bitcoin capture, synthetic prices or your own dataset. Uploaded data stays in your browser.

**31 workflows · 60 providers in discovery · 17 independent packs · 49 reviewed skills**

[![CI](https://github.com/galleonlabs/boomkin/actions/workflows/ci.yml/badge.svg)](https://github.com/galleonlabs/boomkin/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/boomkin)](https://www.npmjs.com/package/boomkin)
[![MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Get started

Use macOS or Linux with [Bun](https://bun.sh) 1.3.12+ and Git. Windows users can use WSL2.

```bash
bun install -g boomkin@0.10.0
boomkin onboard
boomkin doctor --live
boomkin start
```

Onboarding prepares `~/.boomkin/hermes`, installs the reviewed packs, configures public CoinGecko data and opens native Hermes model setup. Choose your model provider and sign in there. `start` opens chat in that profile.

CoinGecko is the sole default connection. Model access uses your account or local configuration; optional providers can require credentials, subscriptions or paid requests. Setup creates no wallet, makes no model call and starts no background service.

[Profiles, install options and source setup](docs/GETTING-STARTED.md) · [Model connections](docs/CONNECTIONS.md)

## First useful task

Paste this into your new Hermes chat:

> Use galleon-coingecko-token-research. Resolve CoinGecko ID ethereum and capture a public ETH/USD market observation. Show the asset identity, source URL, observation time and freshness limits. Mark missing data clearly and keep this task read-only.

The result should separate supported observations from unknowns. `doctor --live` establishes public tool discovery; this first task checks whether your configured model can retrieve and explain market evidence.

## Start from a research template

```bash
boomkin templates
boomkin templates --template wallet-audit --json
boomkin project create --name wallet-review \
  --template wallet-audit --input-file ./inputs.json
boomkin project run --name wallet-review --dry-run
```

Four reviewed templates cover public wallet cost audits, frozen strategy validation, stablecoin income and thesis review. Supply your public account/window or local dataset/rule paths; required fields and defaults are visible before saving. Templates preserve the question and evidence in your own profile. [Inputs and run guide](docs/PROJECTS.md)

## Pick a job

```bash
boomkin workflows
boomkin workflows --protocol Aave
boomkin workflows --workflow transaction-simulation --json
boomkin onboard --workflow aave-health
```

Workflow discovery runs locally. Each job names its inputs, expected result and provider requirements. Selecting a workflow installs its pack and saves that selection for updates. Already copied skills remain; choose a separate `--directory` for a dedicated profile.

| You want to… | Start with |
| --- | --- |
| Capture market evidence or test a rule | `market-snapshot`, `strategy-backtest` |
| Inspect lending or an exit | `aave-health`, `aave-v4-health`, `morpho-market`, `lido-exit` |
| Review liquidity and routes | `uniswap-position`, `aerodrome-position`, `across-route` |
| Screen income or streaming obligations | `yield-screen`, `sablier-stream`, `superfluid-stream` |
| Review an exact unsigned payload | `unsigned-plan`, `transaction-simulation` |
| Research prediction markets | `prediction-research`, `prediction-resolution` |

[All 31 workflows, inputs and outputs](docs/WORKFLOWS.md)

## Keep the question and the evidence

Save this public research example as `inputs.json`:

```json
{
  "chain": "Ethereum",
  "asset": "USDC",
  "minimumTvlUsd": "10000000",
  "yieldPreference": "Separate base yield from incentive emissions",
  "limit": 5,
  "question": "What evidence is missing before a deposit decision?"
}
```

```bash
boomkin project create --name stablecoin-yields \
  --workflow yield-screen --input-file ./inputs.json
boomkin project run --name stablecoin-yields --dry-run
boomkin onboard --workflow yield-screen --skip-model-setup
boomkin project run --name stablecoin-yields
boomkin project check --name stablecoin-yields
```

Creation and preview make no model or data calls. Onboarding prepares the selected workflow and preserves your configured model. A live run uses that model and your tools, then saves a separate report, raw sources, hashes and unsigned plan. Checks establish the saved evidence contract; they do not certify economic safety or authorize execution. [Project guide](docs/PROJECTS.md)

## Discover the right provider

```bash
boomkin providers --search simulation --json
boomkin providers --capability Data --access keyless
boomkin providers --provider blockscout
```

The directory covers 58 studied [skills.eth.sh](https://skills.eth.sh/) entries and two existing connections. Dated sources distinguish authorship, access, cost and authority. Discovery does not install or connect all 60 providers. Keyless access can still cost money; wallet and x402 capabilities need separate choices. [Provider guide](docs/PROVIDERS.md)

## Connect your tools

```bash
boomkin connect --provider blockscout
boomkin doctor --live
```

Blockscout adds optional keyless explorer reads. Other supported connections include AIXBT, Alchemy, DeFiLlama, Tenderly and Coinbase account data, each with its own setup and access boundary. Restart Hermes after changing MCP settings.

Hermes owns tools and authentication. MCP tool selection does not constrain its terminal or replace provider-enforced account and spending limits. [Exact prerequisites and connection scope](docs/CONNECTIONS.md)

## Skill packs

Boomkin installs reviewed releases from [crypto-defi-skills](https://github.com/galleonlabs/crypto-defi-skills): agent plans, prediction markets, infrastructure, data, strategy, liquidity, Hyperliquid, lending, staking, yield, tokenized assets, routing, derivatives, portfolio, security, payments and governance.

Each pack installs independently. The [catalog](catalog/skills.json) pins its package, version, immutable source commit and expected skills. Installation checks the copied supporting files; later integrity checks reveal missing or modified instructions and scripts.

Fresh onboarding includes all 17 packs. Repeated `--pack` options choose fewer; updates preserve that selection and future packs remain opt-in. Hermes supplies the native runtime, sessions, memory and model setup. [Other harnesses](docs/HARNESSES.md) receive portable skills only.

## Updates and recovery

```bash
bun install -g boomkin@0.10.0
boomkin check --directory "$HOME/.boomkin/hermes"
boomkin update --directory "$HOME/.boomkin/hermes"
boomkin doctor --directory "$HOME/.boomkin/hermes" --live
```

Update Boomkin, selected skill packs and Hermes separately. Preserve local skill edits before updates. [Updates, backups and recovery](docs/UPDATES.md)

## ChatGPT authentication

Use `boomkin chatgpt --action login` and `--action status` for native Hermes ChatGPT OAuth. Model selection stays with Hermes. [The authentication guide](docs/CHATGPT.md) distinguishes sign-in, partner plan consent and verified usage attribution.

## Contributing

Bug reports, clearer guides and focused pull requests are welcome. [Contributing guide](CONTRIBUTING.md) · [Issues](https://github.com/galleonlabs/boomkin/issues) · [Private security reporting](SECURITY.md)

### Local development

```bash
bun install --frozen-lockfile
bun run check
bun run build
```

Run the [change-specific checks](CONTRIBUTING.md#work-locally) before a pull request. Agents can start with [the documentation index](docs/AGENT-INDEX.md) and [AGENTS.md](AGENTS.md).

## License and credit

[MIT licensed](LICENSE). Created by [Andrew Wilkinson](https://andrewwilkinson.io) and [Galleon Labs](https://github.com/galleonlabs). Preserve copyright and license notices when reusing the project; [attribution guidance](ATTRIBUTION.md) includes an optional credit line. A repository star is appreciated and entirely optional.

Documentation copy controls were inspired by [Rare UI](https://www.rareui.com/components/code-block) and implemented independently.
