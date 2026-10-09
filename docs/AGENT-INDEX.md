# Boomkin documentation index for agents

Boomkin prepares a native Hermes DeFi research profile with reviewed Galleon skills. Start with the human [README](../README.md), then read only the guides needed for the user's task. Repository contributors also read [AGENTS.md](../AGENTS.md).

## Route the task

| User intent | Read | First command or artifact |
| --- | --- | --- |
| Try before installation | [Live strategy lab](https://galleonlabs.github.io/boomkin/lab/) | Dated or synthetic daily simulation in the browser |
| Open the local crypto interface | [Local desk](DESK.md) | `boomkin desk`; scoped HTTP schemas and evidence states |
| Prepare an agent and model | [Getting started](GETTING-STARTED.md) | `boomkin onboard`; `boomkin doctor --live` |
| Choose a protocol job | [Workflows](WORKFLOWS.md) | `boomkin workflows --workflow <id> --json` |
| Find a tool by capability/cost | [Providers](PROVIDERS.md) | `boomkin providers --search <term> --json` |
| Configure a supported integration | [Connections](CONNECTIONS.md) | `boomkin connect --provider <id>` |
| Use native ChatGPT authentication | [ChatGPT](CHATGPT.md) | `boomkin chatgpt --action status` |
| Start from a reviewed research brief | [Projects](PROJECTS.md) | `boomkin templates`; `project create --template <id> --input-file <file>` |
| Preserve a research question and evidence | [Projects](PROJECTS.md) | Create with an input JSON file; preview with `run --dry-run` |
| Maintain or repair a profile | [Updates](UPDATES.md) | `boomkin check --directory <profile>` |
| Add skills to another harness | [Harness compatibility](HARNESSES.md) | `boomkin setup --harness <id> --directory <workspace>` |
| Review the agent's instruction routing | [Identity](IDENTITY.md) | [src/core.ts](../src/core.ts) |
| Change the CLI, catalog or docs | [Contributing](../CONTRIBUTING.md) | Native checks appropriate to the changed files |
| Build or verify the public website | [Website delivery](WEBSITE.md) | Exact Website run plus public `release.json` and affected UI |

## Read the authoritative artifacts

- [catalog/skills.json](../catalog/skills.json): 17 independently published packs, 49 expected skill IDs, immutable source pins and npm versions.
- [catalog/workflows.json](../catalog/workflows.json): 31 workflow IDs, selected pack/skill, inputs, outputs and access requirements. [src/workflows.ts](../src/workflows.ts) validates and queries these contracts.
- [catalog/templates.json](../catalog/templates.json): four reviewed starting points, explicit defaults, required inputs and replaceable examples.
- [catalog/providers.json](../catalog/providers.json): 60 discovery entries, sources, review dates, authorship, cost and authority. Discovery entries do not all have native integrations.
- [src/hermes.ts](../src/hermes.ts): native runtime/installer pin and launch/authentication contracts.
- [src/projects.ts](../src/projects.ts): project and evidence schemas, run states and validation limits.
- [src/desk.ts](../src/desk.ts): authenticated loopback API, fixed helper adapters and saved desk results. [src/desk-model.ts](../src/desk-model.ts) owns the isolated native dashboard launch.
- [Public catalog](https://galleonlabs.github.io/boomkin/assets/catalog.json), [provider catalog](https://galleonlabs.github.io/boomkin/assets/providers.json) and [release manifest](https://galleonlabs.github.io/boomkin/release.json): deployed revision and public documentation data.

The installed/checked-out CLI catalog and deployed website can reflect different revisions during a release. `update` fetches the public Boomkin source catalog; `--offline-catalog` uses the installed/checked-out copy and still needs access to download pinned sources. Preserve exact package, version and source identity when reporting results.

## Keep the operating boundary explicit

Local workflow/provider discovery, project creation and previews make no model or data call. `doctor --live` performs credential-free public MCP initialization and tool discovery. A live project run uses native Hermes and its configured model/tools. CoinGecko is the sole default connection; optional providers can consume credits or grant broader account permissions.

Skills and MCP selection are instructions/configuration, not a sandbox around Hermes's terminal. Use account-enforced scopes and spending limits. Never treat file installation, model login, tool discovery, simulation, scheduling configuration or `ready-for-review` as transaction execution or verified settlement. Required evidence and limits are documented beside each workflow and in the project contract.

Use `boomkin --help` for command syntax. From source, use `bun run boomkin`. Read [SECURITY.md](../SECURITY.md) before publishing a security report; keep secrets and private profiles out of repository changes.
