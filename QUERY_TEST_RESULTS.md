# GraphQL Query Test Results

Ponder v2 PostgreSQL migration - **ALL QUERIES WORKING (9/9)** ✅

## ✅ Working Queries (9/9)

### 1. tokens (List)
**Status:** ✅ WORKING
**Returns:** 6 tokens with Relay pagination structure

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { tokens(first: 10) { edges { node { address symbol name priceUSD volumeUSD24h } } totalCount } }"}'
```

**Expected:** `{"data":{"tokens":{"edges":[...],"totalCount":6}}}`

---

### 2. pairs (List)
**Status:** ✅ WORKING
**Returns:** 6 pairs with Relay pagination structure

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { pairs(first: 10) { edges { node { address reserve0 reserve1 volumeUSD volume24hChange } } totalCount } }"}'
```

**Expected:** `{"data":{"pairs":{"edges":[...],"totalCount":6}}}`

---

### 3. recentTransactions (List)
**Status:** ✅ WORKING
**Returns:** 5 most recent swaps

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { recentTransactions(first: 5) { edges { node { id timestamp amountIn amountOut } } } }"}'
```

**Expected:** `{"data":{"recentTransactions":{"edges":[...]}}}`

---

### 4. tokenByAddress (Single)
**Status:** ✅ WORKING
**Returns:** Single token data with full metadata

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { tokenByAddress(address: \"0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5\") { address symbol name priceUSD } }"}'
```

**Expected:** `{"data":{"tokenByAddress":{"address":"0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5","symbol":"KKUB","name":"Wrapped KUB",...}}}`

**Notes:**
- Uses OR query to find related pairs: `OR: [{ token0Address }, { token1Address }]`
- Token metadata populated via backfill script

---

### 5. protocolMetrics (Single)
**Status:** ✅ WORKING
**Returns:** Protocol-level metrics (currently all zeros)

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { protocolMetrics { totalValueLockedUSD total24hVolumeUSD } }"}'
```

**Expected:** `{"data":{"protocolMetrics":{"totalValueLockedUSD":"0"}}}`

**Notes:** Table is empty, no computed metrics yet

---

---

### 6. pairByAddress (Single)
**Status:** ✅ WORKING
**Returns:** Single pair data with TVL calculation

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { pairByAddress(address: \"0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74\") { address reserve0 reserve1 token0 { address symbol } token1 { address symbol } } }"}'
```

**Expected:** `{"data":{"pairByAddress":{"address":"0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74",...}}}`

---

### 7. tokenPriceChart (Chart)
**Status:** ✅ WORKING
**Returns:** Chart data with time/value pairs

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { tokenPriceChart(tokenAddress: \"0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5\", timeframe: \"1d\") { time value } }"}'
```

**Expected:** `{"data":{"tokenPriceChart":[{"time":...,"value":...}]}}`

---

### 8. pairPriceChart (Chart)
**Status:** ✅ WORKING
**Returns:** Pair price chart data from price_observation table

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { pairPriceChart(pairAddress: \"0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74\", timeframe: \"1d\") { time value } }"}'
```

**Expected:** `{"data":{"pairPriceChart":[{"time":...,"value":...}]}}`

**Notes:** Falls back to current price from reserves if no historical data

---

### 9. pairVolumeChart (Chart)
**Status:** ✅ WORKING
**Returns:** Volume chart data aggregated from swaps

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"query { pairVolumeChart(pairAddress: \"0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74\", timeframe: \"1d\") { time value volume0 volume1 count } }"}'
```

**Expected:** `{"data":{"pairVolumeChart":[{"time":...,"value":...,"volume0":...,"volume1":...,"count":...}]}}`

**Notes:** Aggregates swap data into time buckets for volume analysis

---

## 🔧 Technical Details

### PonderDB Adapter Fix
Fixed `toSnakeCase()` function in `/Users/milesxb/dev/ponder/web/src/lib/db/ponderDb.ts:31-43`

**Key Changes:**
1. Apply capital+digit regex BEFORE acronym replacements
2. Added digit+capital regex for `token0Address` → `token0_address`
3. Handles Ponder's inconsistent snake_case: `volume_usd_24h` vs `volume24h`

**Conversion Rules:**
```javascript
// Apply in this order:
1. /([A-Z])(\d)/g → $1_$2     // USD24h → USD_24h
2. USD → Usd, TVL → Tvl       // USD_24h → Usd_24h
3. /(\d)([A-Z])/g → $1_$2     // token0Address → token0_Address
4. /([a-z])([A-Z])/g → $1_$2  // camelCase → camel_Case
5. toLowerCase()               // camel_Case → camel_case
```

### Database State
- **Tokens:** 6 with full metadata (KKUB, KUSDC, KUSDT, LUMI, kSOLA, KOI)
- **Pairs:** 6
- **Swaps:** 3097+
- **Protocol Metrics:** Empty table (will populate as indexer runs)

### Implementation Summary
- ✅ **All core queries working** (9/9) - 100% success rate
- ✅ **Token metadata backfilled** - All tokens have symbol/name
- ✅ **pairByAddress resolver** - Implemented at `src/lib/graphql/resolvers.ts:735-793`
- ✅ **pairPriceChart resolver** - Implemented at `src/lib/graphql/resolvers.ts:1183-1255`
- ✅ **pairVolumeChart resolver** - Implemented at `src/lib/graphql/resolvers.ts:1257-1325`
- ✅ **Comprehensive test suite** - `test-all-queries.js` validates all 9 queries

### Test Suite
Run automated tests with:
```bash
node test-all-queries.js
```

This validates all 9 queries and ensures correct response structure.