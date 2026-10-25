# Changelog

## 0.13.1

- Prune obsolete research drafts/screenshots, superseded artwork, unused CSS and unused desk bindings; keep the current UI, incoming routes and saved-profile contracts.
- Replace duplicated provider documentation with the source catalog and CLI, remove the unavailable Fluid discovery entry and retain all seven native connections.
- Simplify design and agent-discovery guidance; refresh the reviewed DeFi pack pins after the corpus cleanup.

## 0.13.0

- Expand protocol discovery to 63 workflows and 81 reviewed skills, including 32 dedicated lending, staking, savings, liquidity, routing, derivatives, tokenized-asset and governance procedures. Keep existing workflow IDs compatible.
- Open the exact reviewed SKILL.md from each workflow, install one skill into an existing agent, share workflow links and search by multiple terms or skill name. Improve mobile selection.
- Simplify onboarding and native agent instructions; generate workflow documentation from the source catalog and reject stale guides or missing skill targets.
- Refresh Across access guidance and review native Hermes 0.22.5 with its pinned installer and frozen upstream dependency lock. Native verification uses the candidate catalog in an isolated profile.

## 0.12.2 · 2026-10-19

- Review native Hermes 0.22.2 and pin it for fresh installs. Its installer now provides a managed launcher at `.hermes/bin/hermes` instead of a virtual environment, so Boomkin finds that launcher and still reuses runtimes from earlier layouts.
- The native compatibility check, isolated installation, onboarding, live doctor and browser model setup pass against 0.22.2.

## 0.12.1 · 2026-10-19

- Let in-flight local desk requests deliver their responses before the server stops.
- Review ten independently released skill packs. Hyperliquid 0.4.1 stops counting outcome fills as default perps in wallet audits; LP 0.6.2 covers the 2026-10-22 Aero upgrade that deactivates Aerodrome and Velodrome gauges; derivatives 0.1.6 records Drift's move to Velocity. Agent, governance, infra, lending, routing, security and yield receive dated source updates. Immutable source pins and existing profile selections are preserved.
- Read native Hermes releases tagged with semantic versions, so the freshness report shows the latest release again instead of "unavailable".
- State that the compatibility check covers Hermes 0.21.5 and that Hermes 0.22 is not yet reviewed; date the 58 studied skills.eth.sh entries.
- Say who Boomkin is for, point agent users to the skill packs and describe what the installer checks; credit Galleon Labs in the website footer.

## 0.12.0 · 2026-10-12

- Add **What changed?** to the local desk: compare a saved research capture against an explicit earlier one for market marks, wallet accounting and strategy results, withholding deltas when inputs, helper revision or source bytes differ.
- Bind follow-up research to the displayed run and link it back to that capture. API callers that omit `runId` keep the latest-completed behavior.
- Review the independently released yield 0.3.0 pack, which adds offline vault exit assessment; preserve immutable source pins and existing profile selections.

## 0.11.0 · 2026-10-09

- Add a local browser desk with guided public-tool preparation, asset snapshots, Hyperliquid wallet cost reviews and documented strategy comparisons.
- Preserve frozen inputs and separate saved runs with progress, cancellation, sources, hashes, exports and explicit partial/failure/interruption states.
- Add optional native Hermes browser model setup and explicit research follow-ups; keep credentials and the agent loop with Hermes.
- Bind the desk to authenticated loopback access, reject foreign origins and unsafe paths, and verify installed helper resources before execution.
- Simplify the human start path and document the local API, evidence contracts and recovery for agents.

## 0.10.0 · 2026-10-09

- Add four reviewed project templates with explicit defaults and required inputs, frozen per-project context and previews without model or data calls.
- Add public Hyperliquid wallet audits, market research, completed-trade review and frozen strategy validation workflows, expanding discovery to 31 tasks.
- Add research rule presets and separate held-out/higher-cost validation to the browser strategy lab, with downloadable reports and disclosed restart accounting.
- Review independently released Hyperliquid 0.4.0 and strategy 0.2.0 resources; preserve immutable source pins and existing profile selections.

## 0.9.1 · 2026-10-08

- Refresh the GitHub and npm introduction with a browser demo, clear installation steps and a public-data first task.
- Add human and agent documentation indexes, accessible README artwork and current discovery metadata.
- Update the reviewed catalog to independently published documentation patches for all 17 skill packs.
- Route Hyperliquid account inspection to its account-monitoring skill.
- Keep npm commands and the website setup guide aligned; fix the strategy lab heading after an invalid run.

## 0.9.0 · 2026-10-08

- Add local discovery of 60 providers with primary-source provenance, capability, access, cost and transaction authority metadata.
- Expand to 27 workflows and 17 reviewed packs containing 48 active skills, including unsigned plans, simulations, Aave V4, payment streams and prediction-market evidence.
- Add optional Blockscout discovery with 15 explicitly reviewed reads; keep provider selection and connections scoped to the selected profile.
- Bound public MCP discovery by time, response size and pagination; preserve redacted failures and reject redirected endpoints.
- Publish source-backed provider documentation and catalogs on the website, and validate tool filters against the pinned native Hermes contract.

## 0.8.1 · 2026-10-02

- Correct the published README catalog count and list the strategy pack and three new workflows. Keep npm and website installation commands aligned with this patch release.

## 0.8.0 · 2026-10-02

- Publish the Bun-based `boomkin` CLI to npm, including correct dependency discovery from hoisted consumer installs.
- Preserve research projects and successive native Hermes runs with saved briefs, source/resource hashes, citations, declared freshness checks and unsigned-plan review.
- Add market-snapshot, strategy-backtest and thesis-review workflows; review data 0.5.0 and strategy 0.1.0 source releases.
- Ship the public website, source-backed documentation, searchable workflow catalog and browser strategy lab using the same released simulation engine.
- Document Minara's real architecture, transferable product patterns and the limits of current open-source coverage from primary-source research.


## 0.7.3

- Add scoped native Hermes ChatGPT login, status, refresh and model commands with interactive guards.
- Document official partner plan consent and usage verification separately from existing native Codex OAuth. Keep the reviewed Hermes runtime pin and native token ownership.


## 0.7.1 - 2026-09-28

- Update the direct YAML parser to 2.9.1 while preserving configuration editing and fail-closed alias handling.
- Keep catalog pins, profile selections and the upstream skills installer dependency tree unchanged.

## 0.7.0 - 2026-09-27

- Add task discovery with `workflows`, protocol filtering and JSON output, including inputs, deliverables and access requirements for fourteen tasks.
- Add `onboard --workflow <id>` to select a task's independent pack while retaining existing profile and instruction preservation.
- Upgrade seven reviewed packs with thirteen protocol-specific skills for lending, liquidity, routing, staking, yields, market data and CDP readiness.
- Route new Hermes profiles directly to protocol skills and retain the existing cross-protocol workflows.
- Bind the new protocol skill names to their explicitly reviewed packs while retaining source, revision, path and duplicate checks.
- Verify task-to-catalog integrity, invalid-option failures and write-free onboarding previews.

Earlier releases are recorded in GitHub Releases.
