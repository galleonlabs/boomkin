# Your first Boomkin session

[Open the local desk](DESK.md) for guided public research and saved results. [Try the browser lab](https://galleonlabs.github.io/boomkin/lab/) before installation. Native Hermes chat and advanced profile setup remain available below.

[README](../README.md#get-started) · [Choose a workflow](WORKFLOWS.md) · [Connect a provider](CONNECTIONS.md) · [Agent index](AGENT-INDEX.md)

## Install and start

Use macOS or Linux with [Bun](https://bun.sh) 1.3.12+ and Git. Keep Bun's global bin directory on your shell path. Windows users can use WSL2; an existing native Windows Hermes installation can also be reused through its official flow.

```bash
bun install -g boomkin@0.11.0
boomkin desk
```

Choose **Prepare public tools** in the browser, then research an asset, review a public Hyperliquid wallet or test a documented strategy. These tasks need no model or funded wallet. Optional browser model setup and saved-run recovery are covered in the [desk guide](DESK.md).

## Native agent chat

For the complete native Hermes chat and all reviewed packs:

```bash
boomkin onboard
boomkin doctor --live
boomkin start
```

Onboarding prepares `~/.boomkin/hermes`, installs the selected reviewed skill packs, writes Boomkin's initial identity and instructions, configures public CoinGecko MCP and opens native Hermes model setup. A fresh default profile includes all 17 packs and 49 skills. Select your model provider and complete its native sign-in. Existing instructions and unrelated settings are preserved; conflicting named MCP settings are reported for review.

Your account or local model configuration supplies inference. Optional services have their own credential, subscription and usage requirements. Onboarding makes no model call or paid data request, creates no wallet and starts no background service.

## Ask a public-data question

In the Hermes chat:

> Use galleon-coingecko-token-research. Resolve CoinGecko ID ethereum and capture a public ETH/USD market observation. Show asset identity, source URL, observation time and freshness limits. Mark unavailable fields clearly. Keep the task read-only.

Expect a bounded observation with its sources and limitations, or a useful explanation of missing access. A configured model is not proof of successful inference, and public MCP discovery is not proof of a data read. `doctor --live` initializes CoinGecko and lists its tools; it also probes optional Blockscout and AIXBT discovery when configured, without credentials or protected data calls.

For repeatable questions, [save a project](PROJECTS.md). Creation and preview run locally; a live project run uses the selected model and tools.

## Choose a profile or a single workflow

Use the same directory with every later command:

```bash
boomkin onboard --workflow aave-health --directory "$HOME/aave-desk"
boomkin doctor --directory "$HOME/aave-desk" --live
boomkin start --directory "$HOME/aave-desk"
```

`--workflow` selects one task's pack for updates. On an existing profile, previously copied skills stay in place. Use distinct directories when projects need distinct tool access.

| Option | When to use it |
| --- | --- |
| `--dry-run` | Preview onboarding without writing files or starting setup |
| `--skip-model-setup` | Prepare the profile before an interactive login |
| `--no-install` | Reuse an existing Hermes executable; fail if it is missing |
| Repeated `--pack <id>` | Choose the complete set of packs to install and update |
| `--all-packs` | Deliberately expand an existing profile to the current catalog |

```bash
boomkin onboard --directory "$HOME/research-desk" --dry-run
boomkin onboard --directory "$HOME/research-desk" --skip-model-setup
boomkin model --directory "$HOME/research-desk"
```

## Understand the runtime

Hermes owns chat, tools, memory, sessions, scheduling and model authentication. Boomkin supplies reviewed financial procedures, source pins, installation checks and research projects. Other harness adapters install [skills only](HARNESSES.md).

A fresh runtime installation uses reviewed Hermes 0.21.5, upstream tag `v2026.9.24`, through its pinned official installer. A working existing Hermes installation at 0.21.0 or newer is reused. Browser/computer-use dependencies are skipped initially; configure optional features through native Hermes setup. The reviewed runtime source and installer checksum live in [src/hermes.ts](../src/hermes.ts).

CoinGecko is the sole onboarding data connection. Optional provider setup stays explicit; [provider discovery](PROVIDERS.md) separates source references from the smaller native connection list. Tool availability, account authority and financial execution are different outcomes.

## Work from source

```bash
git clone https://github.com/galleonlabs/boomkin.git
cd boomkin
bun install --frozen-lockfile
bun run build
bun run boomkin desk
```

For native agent chat:

```bash
bun run boomkin onboard
bun run boomkin doctor --live
bun run boomkin start
```

In a checkout, replace `boomkin` in the guides with `bun run boomkin`. Use [CONTRIBUTING.md](../CONTRIBUTING.md) for development checks and [updates and recovery](UPDATES.md) for maintenance. Keep profiles, credentials and private evidence outside the repository.
