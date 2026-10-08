# Updates and recovery

Maintain Boomkin, its selected skill packs and the Hermes runtime separately. Use the same profile directory you chose during onboarding, and preserve local skill edits before updating.

[Getting started](GETTING-STARTED.md) · [Connections](CONNECTIONS.md) · [Release history](../CHANGELOG.md)

## Everyday updates

For the installed CLI and default profile:

```bash
bun install -g boomkin@0.9.1
boomkin check --directory "$HOME/.boomkin/hermes"
boomkin update --directory "$HOME/.boomkin/hermes"
boomkin doctor --directory "$HOME/.boomkin/hermes" --live
boomkin start --directory "$HOME/.boomkin/hermes"
```

Replace the directory in every command if you use another profile. Restart an active Hermes session after updating instructions or tools.

| Component | Update path |
| --- | --- |
| Boomkin CLI and packaged guides | Install the desired published Boomkin version with Bun |
| Selected skill packs | Run `boomkin update` in the chosen profile |
| Hermes runtime | Use native Hermes updates, then rerun `doctor --live` |
| Provider credentials and tools | Follow the provider's native [connection setup](CONNECTIONS.md) |

From a source checkout, first pull the reviewed branch and its locked dependencies, then use `bun run boomkin` in place of `boomkin`:

```bash
git pull --ff-only
bun install --frozen-lockfile
bun run boomkin check --directory "$HOME/.boomkin/hermes"
bun run boomkin update --directory "$HOME/.boomkin/hermes"
```

`doctor` checks configuration and recorded file integrity. `--live` probes public CoinGecko discovery, plus optional Blockscout and AIXBT discovery when configured; it sends no credentials or protected data calls. Verify a first task through Hermes before relying on the setup. Discovery does not establish authenticated data, wallet authority or execution.

## Select your packs

The catalog contains 17 independently selected packs and 48 skills. New skills in a selected pack arrive when that pack updates; newly added packs remain opt-in. Discover task names with `boomkin workflows`.

For a dedicated Aave profile:

```bash
boomkin onboard --workflow aave-health --directory "$HOME/aave-desk"
```

On an existing profile, `--workflow` replaces the saved pack selection while preserving already copied files. Repeated `--pack` options set the complete desired selection:

```bash
boomkin update --directory "$HOME/.boomkin/hermes" \
  --pack defi-infra-skills --pack defi-data-skills
```

Deselected files remain for review and local edits are not deleted. Deliberately include every pack in the installed/checked-out Boomkin catalog with:

```bash
boomkin onboard --directory "$HOME/.boomkin/hermes" --all-packs
```

Onboarding preserves existing SOUL and instructions. It opens model setup unless you pass `--skip-model-setup`. Older profiles without a recorded selection retain their legacy LP/Hyperliquid selection until explicitly expanded.

## Verified releases

Read [CHANGELOG.md](../CHANGELOG.md) and [GitHub releases](https://github.com/galleonlabs/boomkin/releases) for version history. The [skill catalog](../catalog/skills.json) is the current authority for each pack's npm identity, version, immutable source commit, package directory and expected skills.

`setup` and `onboard` use the installed/checked-out catalog. `update` fetches the public Boomkin source catalog. New pins enter through reviewed changes after upstream publication and verification. The scheduled freshness report identifies newer releases; it does not rewrite your selection or upgrade the runtime.

Before installation, Boomkin validates source revision, package identity/version, skill metadata and path containment. Packages with symlinks are rejected. Only selected paths and skill names reach the upstream installer; temporary source checkouts are removed afterward.

`--offline-catalog` makes `check` and `update` use the installed/checked-out catalog. An update still needs network access to download pinned sources.

`check` compares the last successful sync with the public catalog and verifies recorded file digests even when an update is pending. It additionally checks declared skill versions when comparable to the installed release. `status` lists installed skills. Neither command modifies them.

## Profile files

| Path within the profile | Purpose |
| --- | --- |
| `SOUL.md`, `AGENTS.md` | Agent identity and instructions; existing files are preserved |
| `config.yaml`, `.env` | Native Hermes configuration and secrets |
| `skills/` | Installed skills and supporting files |
| `.boomkin/config.json` | Selected packs and canonical profile/harness binding |
| `.boomkin/state/` | Profile-scoped upstream installer records |
| `.boomkin/last-sync.json` | Provenance and integrity from the last successful sync |
| `.boomkin/operation.lock` | Prevents concurrent installations in one profile |

Keep profiles, credentials and private evidence outside public repositories. Review saved paths and credentials before moving a profile. [Saved projects](PROJECTS.md) have their own per-project run records and locks.

## Recover an interrupted update

A failed catalog fetch or validation changes no packs. Installation is sequential, so an earlier pack may finish before a later one fails. Boomkin exits with an error, preserves retry configuration and leaves the last successful sync record unchanged. Resolve the reported cause and rerun the command.

A version mismatch prevents a success record. `check` reports incomplete state; a successful `setup` or `update` rebuilds it atomically. After a hard crash, confirm no installer is running before removing `.boomkin/operation.lock`.

For renamed skills, follow the [LP migration guide](https://github.com/galleonlabs/crypto-defi-skills/tree/main/packages/lp#updates-and-migration) or [Hyperliquid migration guide](https://github.com/galleonlabs/crypto-defi-skills/tree/main/packages/hyperliquid#updates-and-migration). Retired directories are reported and preserved for review.

## Back up and restore

Back up skills, lockfiles, instructions, Hermes configuration and `.boomkin/` records before updating. Stop the runtime before restoring; credential-bearing backups are private.

Retain source revisions and installed versions for reproducibility. Restoring local files does not update an already running remote agent; use and verify the same native deployment procedure afterward.

## Scheduled updates

Unattended instruction updates are optional. Review sources, use absolute paths and select the exact profile in the native scheduler. Monitor failures and restart Hermes during a maintenance window. Boomkin creates no background update service and does not restart sessions automatically.

## Installed file integrity

Every copied reference, script and asset is checked against its reviewed source before success is recorded. The sync record stores file digests, including the harness-normalized `SKILL.md`. Later `check` and `doctor` report missing or altered files even when the version header still matches. These digests detect local drift; they are not signed attestations.

Older sync records remain readable. Run `update` once to establish integrity records, preserving custom skill edits elsewhere first. Diagnostics do not delete or repair files automatically.
