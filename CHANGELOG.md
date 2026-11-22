# Changelog

## 0.13.9 · 2026-11-22

- Add the LCX Liberty DEX quote workflow and pin routing pack 0.5.0. The CLI and workflow explorer now expose its inputs, API key requirement and evidence before installation.
- Link Andrew Wilkinson’s maintainer and sponsorship profiles from the package, repository and website.

## 0.13.8 · 2026-11-18

- Review native Hermes 0.23.2 and pin it for fresh installs with its official installer checksum. Its installer no longer gives the builder's uid ownership of the uv it unpacks when run as root, and an exported `GIT_DIR` or a git-managed home directory can no longer redirect its rerun stash and reset to another repository. The native compatibility check passes against it, and its OpenAI Codex OAuth provider is unchanged.

## 0.13.7 · 2026-11-17

- Pin the released strategy 0.2.2 pack, from the same upstream revision as the ten packs repinned in 0.13.6. It states the retrieval-time rule as the engine enforces it: no observation may be later than the retrieval time. The catalog keeps 17 packs, 81 skills and 63 workflow IDs, and every pin matches a published upstream release tag.

## 0.13.6 · 2026-11-17

- Pin the released LP 0.7.7, Hyperliquid 0.4.7, routing 0.4.5, payments 0.2.4, agent 0.1.5, infra 0.4.7, lending 0.4.6, yield 0.4.4, staking 0.3.3 and data 0.6.5 packs, all from one upstream revision. They correct wrong provider facts and instructions that contradicted each other across skills, and the LP range helper now reports the exact current tick more than 20,000 ticks from zero. The catalog keeps 17 packs, 81 skills and 63 workflow IDs, every repinned pack matches a published upstream release tag, and the workflow guide links the new revision.
- `boomkin check` reports an installed skill whose frontmatter does not parse as "version unknown" instead of failing with a YAML error.
- Correct the connections guide: the CoinGecko price helper returns JSON whether a read succeeds or fails.

## 0.13.5 · 2026-11-16

- Pin the released data 0.6.4 and infra 0.4.6 packs, which drop untested per-skill eval files. The catalog keeps 17 packs, 81 skills and 63 workflow IDs, and every pin matches a published upstream release tag.
- Point the Coinbase wallet guidance at the current Wallet MCP installation and approval references. The former Agentic Wallet guide returns 404 and Coinbase no longer documents the `awal` CLI, so existing `awal` installations are now treated as legacy. The Coinbase account note now records documented x402 payments from the retail USDC balance.
- State the Nethermind provider's access requirements once; its hosted-page 404 stays in the review notes.
- Remove the unused Vercel redirect (`vercel.json`, `redirect/`). The site is served from GitHub Pages, and no Vercel project serves the repository.

## 0.13.4 · 2026-11-15

- Pin the latest released data 0.6.3, lending 0.4.5, staking 0.3.2, yield 0.4.3, routing 0.4.4, derivatives 0.2.3, portfolio 0.2.3, security 0.2.8, payments 0.2.3, agent 0.1.4 and LP 0.7.6 packs. The catalog keeps 17 packs, 81 skills and 63 workflow IDs, every pin matches its package's latest published upstream release tag, and the workflow guide links the new revisions.

## 0.13.3 · 2026-11-15

- Pin the independently released LP 0.7.5, Hyperliquid 0.4.6 and infra 0.4.5 packs. The catalog keeps 17 packs, 81 skills and 63 workflow IDs, and every pin matches a published upstream release tag.
- Review native Hermes 0.23.1 and pin it for fresh installs with its official installer checksum. The native compatibility check, ChatGPT auth and browser model setup contracts pass against it.
- Update the bundled `skills` installer to 1.8.1, and the website's single-skill install command with it. Install paths for Claude Code, Codex, Cursor, Gemini CLI, Hermes and OpenClaw are unchanged.

## 0.13.2 · 2026-11-12

- Correct the published provider discovery count to 59 after the Fluid entry was removed.
- State which commands accept `--directory`, and list `project show`, `status`, `--protocol` and the ChatGPT refresh and model actions in `--help`.
- Reject profile, harness, pack and `--offline-catalog` flags on commands that do not use them.
- Fail closed on non-string harness names, oversized or redirected catalog fetches, provider URLs with embedded credentials or paths, and a missing desk response body; match workflow protocol names exactly.
- Correct nine provider catalog records whose official sources moved or changed, with review dates refreshed only where the source was re-read.
- Website: fix contrast failures, keyboard access to scrolling tables, the mobile docs landmark and missing Open Graph tags.

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
