# Your first DeFi job

Boomkin gives a native Hermes agent a dedicated financial workspace. Choose a model, add the workflows you need, and keep the research and run records in your own profile.

## Install Boomkin

Use macOS or Linux with [Bun](https://bun.sh) and Git. Windows users can use WSL2.

```bash
bun install -g boomkin@0.8.0
boomkin onboard
boomkin doctor --live
boomkin start
```

Bun installs the `boomkin` command in its global bin directory. Keep that directory on your shell path. To work from the source instead:

```bash
git clone https://github.com/galleonlabs/boomkin.git
cd boomkin
bun install --frozen-lockfile
bun run boomkin onboard
bun run boomkin doctor --live
bun run boomkin start
```

Onboarding prepares `~/.boomkin/hermes`, installs the reviewed official Hermes runtime when needed, installs the selected skill packs and adds the public CoinGecko connection. Model sign-in happens through native Hermes setup.

Hermes owns chat, models, sessions, memory and tools. Boomkin supplies reviewed skill packs, protocol workflows, integrity checks and research project records. An existing working Hermes installation is preserved.

## Start with one workflow

```bash
bun run boomkin workflows
bun run boomkin workflows --workflow yield-screen
bun run boomkin onboard --workflow yield-screen
```

Choose a job by protocol and inspect its required inputs, result and data access before installing. A fresh full onboarding includes the reviewed catalog; `--workflow` selects one job's pack.

On an existing profile, selection affects future updates and preserves previously copied skills. To keep projects with different tool access separate, use distinct profile directories.

## Choose a profile

```bash
bun run boomkin onboard --directory "$HOME/research-desk"
bun run boomkin doctor --directory "$HOME/research-desk" --live
bun run boomkin start --directory "$HOME/research-desk"
```

Use the same `--directory` with every later command. A profile holds its native Hermes configuration and skills. Boomkin keeps its own records under `.boomkin/` inside that profile.

Preview onboarding with `--dry-run`. Prepare files before model login with `--skip-model-setup`. Revisit model setup with `bun run boomkin model`.

## Save a research project

[Projects](projects/) keep the question and inputs, run the selected workflow through native Hermes, then preserve its report, sources and review status. Previewing a project makes no model or data call. Running it uses your configured model and tools.

## Connect only the tools you need

Public market research is the starting point. Optional providers use their official authentication and tooling. [Connections](connections/) explain data access, account access and financial authorization separately.

## Update and check

```bash
bun run boomkin check --directory "$HOME/.boomkin/hermes"
bun run boomkin update --directory "$HOME/.boomkin/hermes"
```

Source pins record reviewed pack releases. File integrity checks detect missing or altered supporting files. Updates preserve your saved pack selection and custom instructions. New packs are opt-in for an existing installation.

## Use the skills in another harness

The packs install independently in supported agent harnesses. [Compatibility setup](harnesses/) covers Codex, Claude Code and other skill-only installations. The full Boomkin agent flow uses native Hermes.
