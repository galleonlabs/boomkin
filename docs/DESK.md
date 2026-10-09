# Your local crypto desk

Open Boomkin in your browser, choose a question and keep the result with its sources. Market snapshots, public Hyperliquid wallet reviews and daily strategy tests work without a model account or funded wallet.

```bash
bun install -g boomkin@0.11.0
boomkin desk
```

Use macOS or Linux with Bun 1.3.12+ and Git; Windows users can use WSL2. Keep the launching terminal open. Closing it stops the desk. The local server binds only to `127.0.0.1`; it installs no background service or scheduler.

## First useful result

Choose **Prepare public tools** on first use. Boomkin installs the reviewed data, Hyperliquid and strategy packs into the selected profile. Existing instructions, unrelated configuration and selected packs are retained. This step downloads public source; it makes no model or financial call.

Choose **Review a wallet**, enter a public Hyperliquid account and a date range, then start the review. **Try a public vault** supplies an example address for HLP Strategy A; it is an example, not your wallet. Review fees, signed funding and current exposure, then expand the sources. Refresh creates a separate run. Your earlier evidence stays available in Recent research.

The other two jobs are:

- **Research an asset:** compare bounded public USD price marks using the exact CoinGecko identity. This captures market data; optional native research can explain a broader question.
- **Test a strategy:** choose buy-and-hold, funded weekly DCA, a 10-day moving average or a 30-day moving average. Test independently restarted reference and held-out periods at baseline and higher costs. Use a public daily history, the explicitly dated bundled Bitcoin series, or an uploaded dataset. An upload is sent only to the local desk and saved with its project.

Wallet results cover observed default-perpetual activity. Provider retention, page budgets, unknown opening inventory and unsupported spot/HIP-3 activity prevent treating this as a complete portfolio return. Fee and funding signs remain explicit. Historical strategy simulations use stated daily execution assumptions and establish no future return. Missing or stale market reads remain visible.

## Add native research when you need it

Open **Settings**, choose native model setup, then open **Hermes sign-in** when its browser dashboard is ready. Hermes owns OAuth, keys and model selection. Use its model page to choose the provider/model, return to Boomkin and check the configuration.

This starts an owned, isolated native Hermes dashboard in the same profile. It may install the official runtime or build its browser assets; the first build can take several minutes. Hermes manages its own supported Node.js prerequisites and repair. Boomkin stops its owned dashboard and preparation processes when the desk exits. It does not resume another Hermes service or create a scheduler.

An explicit follow-up uses native Hermes and your configured model/tools, may incur provider usage, and saves a separate research project. Model configuration, authentication and successful inference are separate facts. Boomkin's readiness check reports local configuration; it does not make a model call. Native tools retain their existing permissions; a research prompt is not a sandbox. [Connections](CONNECTIONS.md) and [ChatGPT](CHATGPT.md) cover native access in detail.

## Saved work and recovery

By default, files live under `~/.boomkin/hermes/.boomkin/projects/`. Each project has frozen inputs and each run keeps its brief, progress record, report, result, evidence, raw sources and unsigned no-action plan. The same evidence hashes and citation checks used by CLI projects run before a completed desk result is shown. These checks establish file integrity and structure; they do not certify economics or source accuracy.

**Inspect evidence** shows observation times, source URLs, limitations and SHA-256 hashes. The report export includes the saved result, evidence and current integrity issues. Raw observations can be inspected separately. `complete` describes a completed capture; `partial` retains missing/limited coverage. Failed, cancelled and interrupted runs remain visible. Cancel stops the active capture or owned native research process; Refresh starts a new run.

Only one desk owns a profile at a time. A stopped process's verified stale desk lock is recovered on reopening; unverifiable locks remain untouched. Concurrent recovery is serialized. If recovery itself was interrupted, inspect the owner of `.boomkin/desk-recovery.lock` before removing it. Reopening records unfinished desk runs as interrupted. Native CLI project locks remain authoritative, so inspect their owner/process before manual recovery. [Project evidence and recovery](PROJECTS.md).

```bash
boomkin desk --directory "$HOME/research-desk"
boomkin desk --no-open --port 4178
boomkin desk --dry-run
```

`--directory` selects the whole profile; use the same path for CLI/model commands. The default port is an available local port. `--no-open` prints the launch URL without opening a browser. The launch fragment contains a short-lived session token: treat the URL as local access, do not share it, and use a new launch URL after restarting.

## Agent API contract

The desk's narrow HTTP API is for the launched local session. Use its base origin and `Authorization: Bearer <launch token>`; mutations send `Content-Type: application/json`. Host and browser Origin must match the exact loopback origin. There is no arbitrary command, URL, file path or credential API. JSON bodies are bounded to 320 KiB; uploaded daily datasets to 256 KiB.

| Method and route | Contract |
| --- | --- |
| `GET /api/status` | Local public-tool integrity, native configuration, setup state and version |
| `POST /api/setup` | Explicit public-pack preparation; poll status for completion/failure |
| `POST /api/model-setup` | Explicit owned native dashboard preparation; status contains its loopback sign-in URL |
| `GET /api/projects` | Saved desk projects and their run states |
| `POST /api/projects` | `{kind, title, inputs}`; kind is `market`, `wallet` or `strategy` |
| `GET /api/projects/<name>` | Frozen inputs and separate runs |
| `POST /api/projects/<name>/run` or `/refresh` | Start a new capture; `202` returns its run identity |
| `GET /api/projects/<name>/runs/<id>` | Run, result, report, observations and current integrity issues |
| `POST /api/projects/<name>/runs/<id>/cancel` | Cancel the active run; earlier evidence is retained |
| `GET /api/projects/<name>/runs/<id>/export` | Download the structured result/report/evidence envelope |
| `GET /api/projects/<name>/runs/<id>/evidence/<observation-id>` | Hash-checked captured source text |
| `POST /api/projects/<name>/followup` | `{question, maxTurns?}`; explicit native research, default bounded turns |

Wallet inputs: `account`, UTC `startTime`/`endTime`, optional `network` (`mainnet`/`testnet`) and `maxPages` (1–50). Market input: `asset` (exact CoinGecko ID). Strategy inputs: `asset`, `days` (91–365), `template` (`buy-and-hold`, `weekly-dca`, `sma-10`, `sma-30`), `initialCashUsd`, `feeBps`, `slippageBps`, optional funded-DCA `amountUsd`, `datasetSource` (`live`, `bundled`, `upload`) and an uploaded `dataset` when selected. [Daily dataset and modeling contract](https://galleonlabs.github.io/boomkin/docs/strategy/).

Run states are `queued`, `running`, `complete`, `partial`, `failed`, `cancelled` and `interrupted`. Errors use `{error: {message}}` with an appropriate non-success HTTP status. A successful HTTP start response is a queued run, not a completed result. [src/desk.ts](https://github.com/galleonlabs/boomkin/blob/main/src/desk.ts) owns the exact request validation and saved desk schema.
