# ChatGPT in native Hermes

[OpenAI lists Hermes Agent as a ChatGPT plan-usage partner](https://learn.chatgpt.com/docs/sign-in-with-chatgpt). Account sign-in, permission to consume plan usage, a successful inference and usage attributed to Hermes are separate milestones. Boomkin is an onboarding layer, not a separately registered OpenAI partner.

Boomkin retains reviewed Hermes 0.21.5 at `f97608f178d1ffeca59860195ab7da295f7c8e5f`. Its native `auth add openai-codex --type oauth` supports a fresh ChatGPT device login, profile-native credential pools and refresh; `auth status` reports authentication. Its source uses the Codex OAuth client and Codex inference route. This proves native ChatGPT OAuth capability; it does **not** prove the new Hermes partner plan-consent or per-app attribution path. Use the [official Nous portal](https://portal.nousresearch.com/) for the partner connection and review its actual permission screen. Do not replace the pinned runtime or invent partner client IDs/endpoints to bridge that gap.

```sh
bun run boomkin chatgpt --action login --directory /absolute/path/to/boomkin-profile
bun run boomkin chatgpt --action status --directory /absolute/path/to/boomkin-profile
bun run boomkin chatgpt --action model --directory /absolute/path/to/boomkin-profile
```

Login uses native Hermes authentication with automatic browser opening disabled. Complete the displayed device flow with the intended personal ChatGPT account. Choose fresh login if Hermes offers credentials from other apps. Boomkin never reads or copies Codex credentials and maintains no token store; native Hermes owns credentials in the selected profile. Model setup remains native: choose GPT-6.1 Sol only if the provider's catalog offers it. Availability and supported reasoning levels vary; never force an unavailable slug or route silently through a paid API fallback.

For expiry, use `chatgpt --action refresh`. Hermes handles refresh, quota cooldown and account selection. An invalid or revoked grant needs fresh login; inspect native `auth list openai-codex` and remove only the explicitly selected obsolete credential through native Hermes. Multiple accounts require native selection, not guessing. Rate limits need a reset, not repeated sign-ins. Disconnect partner access through ChatGPT Settings > Security and login > Sign in with ChatGPT. Review the selected Hermes profile before removing local sessions.

To verify actual plan use: approve the explicit **Use your ChatGPT plan** permission in the official partner flow, record the selected provider/model without tokens, run one harmless request through that provider, then inspect ChatGPT Settings > Usage for Hermes's attributed change. Record request time and native result separately from app attribution. Neither an OAuth token nor a generic Codex quota change establishes partner attribution. No authenticated probe runs during install, doctor or automated validation. Current release verification leaves these account-owned steps unverified.

Cloud onboarding uses the same isolated HERMES_HOME, official pinned installer and native device authentication. Do not copy personal runtime credentials into a cloud job. Prepare with `onboard --skip-model-setup`, complete native login interactively, check `doctor --live`, then start the agent. Native loop/hosting configuration stays with Hermes; Boomkin does not create a cloud service or infer a healthy deployment from profile files.

Before sharing model-generated changes, use repository-native checks and a focused review for credential exposure, prompt-injection from token descriptions, financial writes, provider fallback costs, and stale/missing market evidence. The public data connections grant no financial authority.

Verified against official docs and pinned upstream parser/auth source on 2026-09-30. Partner consent, eligible-model access and per-app usage attribution remain pending live account proof.
