# Your first DeFi job

Research an asset, review public wallet costs or test a strategy in your local browser desk. Keep each result with its sources and reopen your research later.

Want to explore first? [Open the strategy lab](../lab/) in your browser. Compare a moving-average rule, scheduled buys and buy-and-hold on a dated Bitcoin capture or labeled synthetic data. No installation or account is needed for the lab.

## Install and start

Use macOS or Linux with [Bun](https://bun.sh) and Git. Windows users can use WSL2.

```bash
bun install -g boomkin@0.11.0
boomkin desk
```

Keep Bun's global bin directory on your shell path. The desk opens a loopback browser page in `~/.boomkin/hermes`. Choose **Prepare public tools** to install its three reviewed skill packs. Existing instructions and selected packs remain intact. Keep the launching terminal open; Ctrl-C stops the desk.

Public desk jobs need no model account or funded wallet. Native model setup is optional: open Settings and use Hermes's own browser dashboard for sign-in and model selection. Explicit research follow-ups use your configured provider and may incur usage. [The desk guide](../../docs/DESK.md) covers saved results, native setup and recovery; [the setup reference](../../docs/GETTING-STARTED.md) covers native chat and advanced profiles.

## Ask your first question

Choose **Review a wallet**, enter a public Hyperliquid address and date range, or choose the labeled public vault example. Inspect observed fees, signed funding and current exposure. Expand the sources, export your report and reopen it from Recent research. Limited history stays visible; this is not a complete portfolio return.

Or choose **Research an asset** for a sourced market snapshot, or **Test a strategy** for a documented daily-rule comparison. The result shows source age and missing information. Refresh captures new evidence in a separate run.

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
