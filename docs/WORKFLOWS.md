# Protocol workflows

Find a task with `bun run boomkin workflows`. Inspect one with `--workflow <id>`, or install its pack with `bun run boomkin onboard --workflow <id>`. Discovery is local and does not connect wallets or send transactions.

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

Skill: `hyperliquid-analyze`. Task ID: `hyperliquid-risk`.

Inputs: Public account address and venue/market; Exposure or funding question.

Output: Account mode, margin exposure, funding and market evidence for a trade decision.

Access: Official Hyperliquid public info API; no trading key required for public reads.

## Cross-protocol tasks

The primitive packs remain useful for multi-venue portfolio, governance, payments, security and tokenized-asset work. Load only the relevant references, and use the protocol-specific skill when a task reaches its venue.
