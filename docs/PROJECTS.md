# Saved research projects

A project keeps a question, its inputs and successive evidence together. Each run uses native Hermes and writes a separate report and unsigned plan. A completed model response stays `needs-review` until its files pass the evidence checks.

[First session](GETTING-STARTED.md) · [Choose a workflow](WORKFLOWS.md) · [Provider access](CONNECTIONS.md)

Examples use the installed `boomkin` command. From a source checkout, replace it with `bun run boomkin`.

## Create a project

Start with a workflow from `boomkin workflows`. Put its public identifiers, constraints and question in a JSON object. Keep credentials in the selected Hermes profile's native configuration; never put keys, signed payloads or private recovery material in project inputs.

For a public yield screen, save `inputs.json`:

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

Then save and preview the task:

```bash
boomkin project create --name stablecoin-yields \
  --workflow yield-screen --input-file ./inputs.json
boomkin project run --name stablecoin-yields --dry-run
```

Creation and preview make no model or data calls. The preview prints the full research brief and output contract. `create --dry-run --json` also previews the saved project without creating files. Existing projects are never overwritten.

Inputs must be a nonempty JSON object under 64 KiB. Amounts, prices and raw onchain quantities should be exact strings. Required workflow inputs stay visible in the brief; missing facts must be reported by the agent. A saved question does not prove that the selected provider has coverage.

## Run with native Hermes

Install the workflow's pack and configure the model in the same profile, then start the research:

```bash
boomkin onboard --workflow yield-screen
boomkin project run --name stablecoin-yields --max-turns 30
boomkin project show --name stablecoin-yields
boomkin project check --name stablecoin-yields
```

Every project command accepts `--directory /absolute/hermes/home`. Omitting it selects `~/.boomkin/hermes`. Use `project list` for saved questions and `--json` for structured output. `show` and `check` emit JSON by default. A live `run` streams native Hermes output and rejects `--json`; use `run --dry-run --json` for a structured preview, then `show` or `check` for saved results.

`run` checks the installed skill's release and recorded file integrity before invoking Hermes. It passes a saved prompt through native `chat --query-file`, preloads the relevant skill and sets `--max-turns` (1–100, default 30). A one-shot session exits after its answer. Hermes owns the model, tools, credentials, permissions and session record. The pinned launch contract is checked by [native compatibility smoke](../scripts/hermes-native-smoke.py) without a model call.

Running uses the configured model and data connections; usage may incur provider costs. The research brief forbids financial actions and requires separate permission for paid data or account changes. That instruction is not a sandbox: Hermes's existing tools, terminal and provider permissions remain in effect. Use provider-enforced scopes and spending limits for consequential accounts.

Each later run points to the previous report for comparison. Earlier observations remain historical evidence; the agent must fetch fresh state before claiming a current result. Creating a second run never overwrites the first.

## What a run saves

Files live outside this repository:

```text
<HERMES_HOME>/.boomkin/projects/stablecoin-yields/
  project.json
  runs/<UTC timestamp and random ID>/
    brief.json
    prompt.md
    run.json
    sources/
    evidence.json
    report.md
    plan.json
```

The saved brief and prompt have SHA-256 digests in the run record. The record also contains the exact installed pack version and source revision. The agent writes the sources, evidence, report and plan; Boomkin validates them after Hermes exits.

An evidence file has this shape:

```json
{
  "schemaVersion": 1,
  "observations": [
    {
      "id": "pool-terms",
      "source": "https://official-public-source.example/pools",
      "observedAt": "2026-10-02T10:00:00Z",
      "summary": "What the captured response supports",
      "artifact": "sources/pools.json",
      "sha256": "<64 lowercase hexadecimal characters>",
      "limitations": ["Missing withdrawal queue state"],
      "expiresAt": "2026-10-02T10:05:00Z"
    }
  ]
}
```

This schema illustration is not live data. `observedAt` records retrieval time; historical sample dates and chain/block identity belong in the raw response and reported observation. `expiresAt` is optional and should reflect the source or decision's actual validity requirement. Quote expiration must remain explicit when present. Use public source URLs without embedded credentials; redact private endpoint credentials before saving responses.

`report.md` cites each captured observation as `[pool-terms]`. `plan.json` is either:

```json
{
  "schemaVersion": 1,
  "status": "no-action",
  "authorization": "not-granted",
  "summary": "Decision, unknowns and remaining requirements",
  "steps": []
}
```

Or an `unsigned` plan with at least one step containing `description`, an `evidence` array of captured observation IDs, and optional `parameters`. Use exact chain, target, amounts, authority, expiration and verification requirements in those parameters when the proposed action needs them. A plan file grants no authority and is never submitted by Boomkin.

## Read the result honestly

| State | Meaning |
| --- | --- |
| `prepared` | The brief was saved before launching Hermes. |
| `running` | Hermes started; an interrupted process can leave this state behind. |
| `failed` | Native launch or result handling failed; earlier files remain available. |
| `needs-review` | Hermes exited, but required evidence/report/plan checks found gaps. |
| `ready-for-review` | Structural, source hash, citation and supplied expiration checks passed. |

`ready-for-review` is a file-contract result. It does not certify source accuracy, completeness, economic validity, fresh executable prices or authorization. `check` reruns validation, returns issues as JSON and exits nonzero if any issue exists. An observation can expire after a run first passed. Check a specific earlier run with `--run-id`.

Missing sources, changed raw files, future observation timestamps, expired deadlines, uncited observations and signed/authorized plans fail validation. A blocked research report remains useful even when it has no observation and therefore stays `needs-review`. Missing evidence is never filled with a fabricated observation.

Only one run per project starts at a time. An interrupted process can leave `run.lock` and a `running` record. Inspect `run.lock/owner.json`, the active native process and preserved files before removing a stale lock. Retrying creates a fresh run; it does not repeat any financial action or rewrite the interrupted result. Back up the profile before manual recovery.

## Keep a thesis explicit

The `thesis-review` workflow requires a saved asset, thesis, invalidation conditions, evidence standard, review frequency and notification rule. For example:

```json
{
  "asset": "Ethereum native ETH; CoinGecko ID ethereum",
  "thesis": "Example research question: usage and fee demand support this asset's role as settlement collateral",
  "invalidationConditions": [
    "Sustained decline in the agreed usage and fee metrics over the defined comparison period",
    "Evidence that changes the asset's collateral or settlement assumptions"
  ],
  "evidenceStandard": "Use primary network metrics, record units/time windows, and mark unsupported claims unknown",
  "reviewFrequency": "Weekly, after a comparable observation window",
  "notifyWhen": "A cited invalidation condition changes verdict or a required source fails"
}
```

```bash
boomkin project create --name eth-thesis \
  --workflow thesis-review --input-file ./thesis.json
boomkin onboard --workflow thesis-review
boomkin project run --name eth-thesis
```

The first run establishes a cited baseline. Later runs compare the same conditions and report `holds`, `weakened`, `invalidated` or `unknown`. A price move alone does not invalidate a condition about network usage. Resolve vague comparison periods or thresholds before interpreting a verdict.

Saving `reviewFrequency` and `notifyWhen` does not create a scheduled job or send a notification. If recurring review is wanted, use the selected profile's native Hermes scheduling flow and verify the saved job, destination and first execution independently. Boomkin does not install another scheduler, and it does not equate a scheduling handoff with a running monitor.
