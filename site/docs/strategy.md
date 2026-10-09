# Strategy testing

The strategy pack runs a deterministic daily spot simulation locally. It compares buy-and-hold, scheduled buys and a moving-average rule, with explicit price provenance, trading costs and a same-flow benchmark.

[Open the browser lab](../../lab/) to run the same engine without an installation. It includes a dated Bitcoin price capture and a labeled synthetic fixture. Uploaded datasets stay in your browser.

## Install the standalone pack

```bash
npm install galleon-defi-strategy-skills
npx galleon-defi-strategy-skills --help
```

The published package includes the agent skill, Node.js helpers, engine source, documented inputs and synthetic fixtures. It installs independently from Boomkin and the other packs.

## Daily USD observations

Each dataset identifies the asset, price type and source. Daily timestamps are midnight UTC and must be consecutive. Missing, duplicate, unordered and nonpositive observations are rejected, as are observations after the recorded retrieval time.

```json
{
  "schemaVersion": 1,
  "identity": { "namespace": "coingecko", "id": "ethereum" },
  "unit": "USD",
  "intervalSeconds": 86400,
  "priceType": "aggregate-snapshot",
  "provenance": {
    "provider": "coingecko",
    "source": "https://api.coingecko.com/api/v3/coins/ethereum/market_chart",
    "retrievedAt": "2026-10-02T12:00:00.000Z",
    "synthetic": false
  },
  "candles": [
    { "timestamp": "2026-09-29T00:00:00.000Z", "close": 3000 },
    { "timestamp": "2026-09-30T00:00:00.000Z", "close": 3100 },
    { "timestamp": "2026-10-01T00:00:00.000Z", "close": 3050 }
  ]
}
```

The numbers above illustrate the input schema. They are not verified historical prices. Use the data pack's historical helper or independently captured observations for a real test, and retain the raw response and its hash.

## Strategy rules

```json
{
  "schemaVersion": 1,
  "initialCashUsd": 1000,
  "feeBps": 10,
  "slippageBps": 20,
  "strategy": { "type": "sma", "period": 5 }
}
```

For buy-and-hold, use `{ "type": "buy-and-hold" }`. For scheduled buys, use `{ "type": "dca", "amountUsd": 100, "everyBars": 7 }`.

DCA deploys the existing cash budget in increments. Additional cash flows are separate positive `contributions` with observation timestamps and USD amounts. Withdrawals are unsupported.

## What the engine models

- Signals use observations through the decision timestamp. Orders execute at the next daily observation.
- Buying pays fixed adverse slippage and a fee; selling pays both too. Ten basis points equals 0.10%.
- The portfolio holds fractional long-only spot units and cash. It uses no leverage or short positions.
- Flow-neutral time-weighted returns and drawdown separate contributions from performance.
- The buy-and-hold benchmark uses identical dates, cash flows and costs. Both begin trading on the second observation.
- Final holdings are marked without a forced liquidation. The report contains every filled trade with its decision and execution timestamps.

## Check another period and higher costs

The lab's **Validate frozen rule** action divides the observations into two chronological periods, then runs the unchanged rule at baseline and higher fees/slippage. Each period starts independently with the declared initial cash, its own contributions and a fresh warmup. It does not carry balances, earlier positions or pending orders across the split.

The report shows strategy and same-cost benchmark returns, drawdown, trade counts and cost sensitivity for each period. It does not choose a winning rule or estimate future returns. A held-out period is meaningful only if you froze the rule before examining it; repeatedly editing parameters makes that period part of development.

The same validation runs from the independently installed skill:

```bash
node scripts/validate-strategy.mjs --data ./daily-prices.json --spec ./frozen-rule.json
```

Use `--split <index>` to choose the zero-based first held-out observation. The default uses half the observations. Both periods need enough observations for the rule and at least one later execution mark. Built-in templates describe their data requirements; they are examples of research rules, not ranked trade recommendations.

Boomkin can preserve the dataset/rule paths and successive reports with `boomkin project create --template strategy-validation --name my-rule --input-file ./inputs.json`. [Project documentation](../../docs/PROJECTS.md) covers required fields and evidence checks.

## Interpret the result

Aggregated daily market prices are research marks, not exchange candle closes or executable quotes. The next observation is an explicit simulation convention. The engine does not model intraday stops, order books, market impact, partial fills, latency, funding, borrow, staking yield, tax or cash interest.

Changing parameters until a strategy fits its past can overstate its usefulness. Keep the original hypothesis, evaluation window, cost assumptions and rejected variants. Test a separate period and inspect the trade log. Historical performance does not establish future returns or authorize a trade.

## Inspect the source

The [strategy package](https://github.com/galleonlabs/crypto-defi-skills/tree/main/packages/strategy) contains the pure engine, CLI wrapper, fixtures and tests. The [CoinGecko historical-data guide](https://docs.coingecko.com/docs/2-get-historical-data) explains upstream coverage and granularity. Coverage and access depend on the provider tier.
