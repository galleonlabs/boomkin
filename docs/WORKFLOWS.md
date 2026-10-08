# Protocol workflows

**27 jobs with explicit inputs, results and access requirements.** Choose by the question you need answered, then inspect its evidence contract before installing or running it.

Find a task with `boomkin workflows`. Inspect one with `--workflow <id>`, or install its pack with `boomkin onboard --workflow <id>`. From a source checkout, use `bun run boomkin` in place of `boomkin`. Discovery is local and does not connect wallets or send transactions.

Use [saved projects](PROJECTS.md) to keep task inputs, source evidence, successive reports and unsigned plans. Creating a project makes no model call; running it explicitly launches native Hermes.

## Capture a bounded market snapshot with source evidence

Skill: `galleon-defi-market-snapshot`. Task ID: `market-snapshot`.

Inputs: Resolved CoinGecko IDs and quote currency; snapshot or daily-history request with an explicit observation limit; maximum acceptable age and comparison provider.

Output: Timestamped source observations and raw response hashes, stale/partial coverage, aligned discrepancies and a daily-history envelope when requested.

Access: Bounded public CoinGecko and documented public comparison reads; limits and outages remain explicit. Use the contract-aware token workflow when resolving chain/contract identities.

## Test a strategy against a reproducible daily price history

Skill: `galleon-defi-strategy-backtest`. Task ID: `strategy-backtest`.

Inputs: Sourced, ordered daily prices with asset identity and units; buy-and-hold, funded DCA or moving-average rule; funding schedule, fees, slippage and comparison period.

Output: A deterministic next-observation backtest, same-cash-flow benchmark, costs, time-weighted return, drawdown, source hash and explicit model limitations.

Access: Local Node.js helper and a supplied evidence dataset. No exchange, wallet or trading account needed. Daily observations do not prove executable fills.

## Review an investment thesis against explicit invalidation conditions

Skill: `galleon-defi-data`. Task ID: `thesis-review`.

Inputs: Exact asset identity, written thesis, invalidation conditions, evidence standard, review frequency and meaningful notification rule.

Output: A cited baseline or comparison, verdict for each condition and unresolved evidence. [Thesis projects](PROJECTS.md#keep-a-thesis-explicit) validate the saved fields and carry prior reports into later runs.

Access: Existing public or explicitly connected official data sources. A saved review frequency does not create a running monitor; native Hermes owns any separately configured recurrence.

## Stress-test an Aave V3 position

Skill: `galleon-aave-position`. Task ID: `aave-health`.

Inputs: Chain ID, Aave V3 market and wallet; Collateral/debt and oracle state at one block; Your proposed borrow, repayment or withdrawal.

Output: Current and stressed health factor, debt capacity, reserve restrictions and an unsigned action plan.

Access: Read-only chain RPC or the official Aave client; no wallet connection needed for public address reads.

## Inspect a Morpho market or vault

Skill: `galleon-morpho-market`. Task ID: `morpho-market`.

Inputs: Chain and market ID or vault address; Asset amount and intended supply or borrow.

Output: Market identity, oracle/IRM/LLTV, liquidity and vault allocation or exit constraints.

Access: Official Morpho API and chain reads; market IDs are not token tickers.

## Check Compound III borrowing capacity

Skill: `galleon-compound-borrow`. Task ID: `compound-borrow`.

Inputs: Chain and Comet deployment; Wallet and desired base-asset borrow.

Output: Base debt, collateral limits, interest exposure and an unsigned borrow or repay plan.

Access: Read-only RPC against the selected Comet deployment.

## Track a Lido withdrawal to claimability

Skill: `galleon-lido-withdrawals`. Task ID: `lido-exit`.

Inputs: Ethereum wallet or withdrawal request IDs; stETH or wstETH amount if planning a new request.

Output: Request ownership, finalized/claimed status, claimable ETH and the next supported step.

Access: Ethereum RPC and official Lido deployment registry; queue timing is not a guarantee.

## Compare holding PT to maturity with exiting

Skill: `galleon-pendle-maturity`. Task ID: `pendle-maturity`.

Inputs: Chain and Pendle market address; PT/YT holdings, valuation time and proposed exit size.

Output: Maturity terms, underlying accounting unit, executable exit comparison and post-expiry route.

Access: Official Pendle market/API data and chain state.

## Check what a vault withdrawal can return now

Skill: `galleon-vault-exit`. Task ID: `vault-exit`.

Inputs: Chain, vault address and share owner; Shares or assets to exit.

Output: Preview versus owner limits, rounding, liquidity and asynchronous exit constraints.

Access: Read-only RPC; a share conversion alone does not prove withdrawable assets.

## Inspect a Uniswap V3 liquidity position

Skill: `uniswap-v3-liquidity`. Task ID: `uniswap-position`.

Inputs: Chain and position NFT ID; Token amounts or position sizing budget; Range intent or monitoring question.

Output: Position composition, tick bounds, fee state and a bounded liquidity plan.

Access: Official deployments and read-only RPC; explicitly V3, not V4 hooks.

## Inspect Slipstream liquidity and gauge rewards

Skill: `aerodrome-slipstream`. Task ID: `aerodrome-position`.

Inputs: Base pool and position NFT ID; Wallet and gauge if staked.

Output: Range status, gauge custody, fees versus emissions, and exit constraints.

Access: Base RPC and current Aerodrome/Slipstream deployment records.

## Prepare a Uniswap quote for review

Skill: `uniswap-swap`. Task ID: `uniswap-quote`.

Inputs: Input/output chain and token addresses; Exact input or output amount and wallet; Slippage limit and recipient.

Output: Quote identity, route type, approval/Permit2 requirements and unsigned transaction review.

Access: Official Uniswap Trading API access; quotes and permit requests never authorize signing.

## Compare a bridge route and reconcile arrival

Skill: `lifi-cross-chain`. Task ID: `bridge-status`.

Inputs: Source/destination chains and token addresses; Amount, sender and recipient or existing transaction hash.

Output: Net destination amount, gas needs, route limits and destination settlement evidence.

Access: Official LI.FI quote/status API; source confirmation alone is not arrival.

## Resolve a token before trusting its price

Skill: `galleon-coingecko-token-research`. Task ID: `token-research`.

Inputs: Chain and contract address, or explicit CoinGecko ID; Quote currency and freshness requirement.

Output: Resolved token identity, timestamped market evidence and unsupported or stale fields.

Access: Official CoinGecko MCP or REST; API tier affects access and freshness.

## Screen yields without mistaking emissions for income

Skill: `galleon-defillama-yield-screen`. Task ID: `yield-screen`.

Inputs: Chain, asset and minimum TVL; Base/reward APY preferences and result limit.

Output: A reproducible shortlist separating base yield, rewards, missing fields and exit diligence.

Access: Public DefiLlama yield data or existing official connection; listed APY is not a guaranteed return.

## Check AgentKit wallet capabilities

Skill: `galleon-coinbase-agentkit-readiness`. Task ID: `coinbase-readiness`.

Inputs: Intended network and wallet custody model; Existing CDP/AgentKit configuration without secrets.

Output: Capability and policy gaps, tested read access and the next required setup step.

Access: Official CDP/AgentKit tools; Coinbase account MCP and Agentic Wallet are separate products.

## Review a Hyperliquid account before trading

Skill: `hyperliquid-monitor`. Task ID: `hyperliquid-risk`.

Inputs: Public account address and venue/market; Exposure or funding question.

Output: Account mode, margin exposure, funding and market evidence for a trade decision.

Access: Official Hyperliquid public info API; no trading key required for public reads.

## Cross-protocol tasks

The primitive packs remain useful for multi-venue portfolio, governance, payments, security and tokenized-asset work. Load only the relevant references, and use the protocol-specific skill when a task reaches its venue.

## Agent tools and unsigned transactions

### Choose a tool without granting excess authority

Skill: `galleon-defi-infra`. Task ID: `agent-capabilities`.

Inputs: Research question, chain and available official tools; Required reads or unsigned outputs; Existing account/cost limits without secrets.

Output: A dated capability/access matrix separating public reads, unsigned preparation, simulation, account writes, signing and paid requests; a concrete unsupported-capability result.

Access: Existing official tools and primary docs; discovery does not create wallets, accept delegated permissions or purchase data.

### Build a deterministic unsigned transaction plan

Skill: `galleon-defi-agent-plan`. Task ID: `unsigned-plan`.

Inputs: Chain, protocol/version and verified deployment; Sender, recipient, token identities and raw-unit amounts; Action parameters, finite approval limits and current state block.

Output: Ordered unsigned prerequisites and payloads, target/value/calldata identity, capability evidence, exact units, continuing permission review and construction limits.

Access: Official protocol builders or version-matched Nethermind playbooks; local construction has no signer and makes no broadcast.

### Simulate the exact unsigned payload before review

Skill: `galleon-defi-agent-simulate`. Task ID: `transaction-simulation`.

Inputs: Chain, sender, target, value and unsigned calldata; State block and preceding approval/action sequence; Expected balance/allowance changes and permitted provider costs.

Output: Exact payload/state identity, simulated balance/allowance changes, decoded errors and trace evidence, artificial overrides and unresolved coverage; no execution guarantee.

Access: Existing official simulation provider or disposable local fork; Tenderly project access, Alchemy quotas or Portals x402 cost remain explicit opt-ins.

### Inspect hub and spoke risk at a verified Aave V4 deployment

Skill: `galleon-aave-v4`. Task ID: `aave-v4-health`.

Inputs: Chain, verified V4 hub/spoke and deployment maturity; Wallet, position/reserve state and oracle block; Proposed supply, borrow, repay or withdrawal.

Output: Hub/spoke identity, collateral/debt and liquidity, health/capacity and configuration constraints with an unsigned plan; unsupported or preview deployments remain explicit.

Access: Official Aave docs/MCP and read-only chain RPC; no V3 assumptions transferred to V4 and no wallet approval.

### Review a vesting or payment stream and its exit rights

Skill: `galleon-sablier-streams`. Task ID: `sablier-stream`.

Inputs: Chain, deployment/module and stream ID or proposed terms; Token, sender, recipient, funding and schedule; Cancellation/transfer rights and the current observation time.

Output: Module-specific funding, vested/withdrawable amounts, ownership and cancellation rights, schedule/rounding checks and an unsigned plan or existing-stream reconciliation.

Access: Official Sablier deployments, SDK/indexer and public chain reads; setup and analysis neither fund nor create a stream.

### Review streaming obligations and Super Token liquidity

Skill: `galleon-superfluid-streams`. Task ID: `superfluid-stream`.

Inputs: Chain, verified Super Token and stream/agreement identity; Sender, recipient, signed flow rate and funding horizon; Current balance, deposit and operator permissions.

Output: Current flow, claimable/liquid balance, deposit/runway and operator authority; wrapping, cancellation and liquidation constraints with an unsigned plan.

Access: Official Superfluid contracts/SDK and public reads; no wrapping, stream creation or delegated operator grant.

### Review a cross-chain quote and reconcile deposit delivery

Skill: `galleon-defi-routing`. Task ID: `across-route`.

Inputs: Source/destination chains and exact token contracts; Amount, sender, recipient and slippage/fee ceiling; Quote intent or existing Across deposit/transaction identity.

Output: Dated route/quote, fees and destination minimum, exact unsigned target/calldata, deposit identity and separate fill/refund reconciliation with unresolved outcomes.

Access: Official Across API/MCP reads; embedded actions, quote expiry and destination execution need separate review; no source approval or bridge submission.

### Inspect token controls and transaction evidence through a read-only explorer

Skill: `galleon-defi-security-token-diligence`. Task ID: `explorer-diligence`.

Inputs: Chain ID and exact contract/wallet/transaction identity; Pinned state block and the economic claim to examine; Required code, proxy, balance/flow and exit evidence.

Output: Verified source/implementation correspondence, visible controls and transaction/balance evidence with coverage and freshness limits; no unconditional safety score.

Access: Optional keyless Blockscout named reads or existing explorer/RPC; shared gateway limits and indexer lag remain explicit.

### Research prediction markets with bounded public evidence

Skill: `galleon-prediction-market-research`. Task ID: `prediction-research`.

Inputs: Exact event/market/condition identity and outcome; Observation window, source limit and liquidity question; Resolution terms and comparison requirements.

Output: Cited event/market identity, outcome order, bounded orderbook/activity evidence, pricing/liquidity limitations and explicit resolution uncertainty.

Access: Official Polymarket public APIs or official CLI read commands; no private key, order placement, funding or redemption.

### Reconcile prediction market resolution and payout evidence

Skill: `galleon-prediction-market-resolution`. Task ID: `prediction-resolution`.

Inputs: Exact market/condition and outcome token identities; Resolution rules, disputed outcome or observed status; Optional public holder/transaction identity.

Output: Current resolution state, oracle/dispute/finality evidence and payout/redemption constraints; data evidence is distinct from any actual redemption.

Access: Official public Polymarket data and onchain reads; no claim/redeem transaction, approval or signing.
