# Changelog

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
