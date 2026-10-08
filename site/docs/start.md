# Your first DeFi job

Research a token, inspect a position or test an investment rule with a native Hermes agent and evidence you can review.

Want to explore first? [Open the strategy lab](../lab/) in your browser. Compare a moving-average rule, scheduled buys and buy-and-hold on a dated Bitcoin capture or labeled synthetic data. No installation or account is needed for the lab.

## Install and start

Use macOS or Linux with [Bun](https://bun.sh) and Git. Windows users can use WSL2.

```bash
bun install -g boomkin@0.9.1
boomkin onboard
boomkin doctor --live
boomkin start
```

Onboarding prepares `~/.boomkin/hermes`, installs the reviewed official Hermes runtime when needed, adds the 17 reviewed skill packs and the public CoinGecko connection, then opens native model setup. Choose your model provider and sign in there. Keep Bun's global bin directory on your shell path.

Hermes owns chat, models, sessions, memory and tools. Boomkin adds 27 workflows, source-pinned skills, file checks and research project records. Model usage follows your chosen provider's terms. Optional data and wallet providers have their own access requirements. [The setup reference](../../docs/GETTING-STARTED.md) covers prerequisites, source installation and existing Hermes profiles.

## Ask your first question

In the native Hermes chat, try:

> Use galleon-coingecko-token-research to research Ethereum's current USD market data. Resolve the exact CoinGecko ID, show source URLs, provider and retrieval times, and mark any missing or stale fields. Use public reads only.

The result should identify the asset and include dated sources you can inspect. Public data may be unavailable or rate-limited; the workflow keeps those gaps visible. This first task needs no funded wallet.

## Choose the next job

```bash
boomkin workflows
boomkin workflows --workflow aave-health
boomkin providers --search simulation --json
```

[Browse workflows](workflows/) for position risk, yield screening, bridge settlement, payment streams and prediction-market research. The provider directory contains 60 source-reviewed entries with capability, access and cost metadata. Discovery runs locally; it lets you inspect a provider before connecting it.

To prepare one job's pack in a separate profile:

```bash
boomkin onboard --directory "$HOME/aave-desk" --workflow aave-health
boomkin doctor --directory "$HOME/aave-desk" --live
boomkin start --directory "$HOME/aave-desk"
```

Use the same `--directory` in later commands. Existing instructions and unrelated settings are preserved. A fresh full onboarding includes all reviewed packs. On an existing profile, `--workflow` selects that pack for future updates while preserving previously copied skills.

## Keep a question and its evidence

[Research projects](projects/) save the question and inputs, run the workflow through native Hermes and preserve its report, sources and review status. A preview makes no model or data call; a run uses your configured model and tools.

## Connect and update deliberately

[Connections](connections/) describe native tool configuration, optional credentials and provider permissions. CoinGecko is the onboarding default. Financial actions require your own provider access and authorization.

```bash
boomkin check --directory "$HOME/.boomkin/hermes"
boomkin update --directory "$HOME/.boomkin/hermes"
```

These commands name the default `~/.boomkin/hermes` profile. Use your own profile path with `--directory` for a custom profile. Updates preserve selected packs and custom instructions; future packs are opt-in. [Update reference](../../docs/UPDATES.md).

The skills also install independently into other harnesses. [Compatibility setup](harnesses/) covers those paths. Agents reading this documentation can start with the [agent reference](agents/).
