# Ponder DEX Metrics System

This document outlines the unified metrics system implemented in Ponder DEX, explaining how metrics are calculated, stored, and displayed across both the indexer and frontend components.

## Overview

The Ponder DEX metrics system is built on a clear separation of responsibilities:

1. **Indexer**: Responsible for calculating, updating, and storing all metrics
2. **Frontend**: Responsible for reading and displaying metrics only

This architecture ensures data consistency by maintaining a single source of truth (the indexer) for all financial metrics across the platform.

## Architectural Flow

```
┌─────────────┐     ┌─────────────────────────────────┐     ┌─────────────────┐     ┌───────────┐
│  Blockchain │────▶│ Ponder Indexer                  │────▶│ Database & Redis │────▶│ Frontend  │
│  Events     │     │ (UnifiedMetricsService)         │     │ Cache            │     │           │
└─────────────┘     └─────────────────────────────────┘     └─────────────────┘     └───────────┘
                     Calculates & updates all metrics        Stores all metrics       Reads only
```

## Backend: Ponder Indexer

The indexer is the heart of the metrics system, responsible for calculating and updating all metrics.

### Key Components

#### UnifiedMetricsService

This singleton service acts as the central hub for all metrics calculations and updates:

- **Calculation Methods**:
  - `calculateTokenTVL(tokenId)`: Calculates TVL for a specific token
  - `calculatePairTVL(pairId)`: Calculates TVL for a specific trading pair
  - `calculateProtocolTVL()`: Calculates the total protocol TVL
  - `calculateEntityVolume(entity, entityId, timeframe)`: Calculates volume for any entity

- **Scheduling and Updates**:
  - Automatically refreshes metrics at different intervals
  - Hourly metrics: Every 5 minutes
  - Daily metrics: Every 15 minutes
  - Weekly metrics: Every hour
  - Triggered by on-chain events (e.g., trades, liquidity changes)

#### MetricsPublisher

Responsible for triggering metric updates at regular intervals:

- Manages the publishing frequency
- Ensures metrics are updated even if no events occur
- Prevents concurrent updates with locking mechanism

### Data Storage

Metrics are stored in two locations:

1. **Database (MongoDB)** using these models:
   - `EntityMetrics`: Current metrics for entities (tokens, pairs, protocol)
   - `MetricSnapshot`: Historical snapshots for time-series data

2. **Redis Cache**:
   - Provides fast access to frequently accessed metrics
   - Cache is synchronized with database updates

## Frontend: Ponder DEX Web App

The frontend is designed to be read-only for metrics, never calculating or updating metrics directly.

### Key Components

#### GraphQL Resolvers

GraphQL resolvers are configured to fetch metrics from two sources:

1. **Redis Cache** (Primary):
   - Used for high-frequency queries
   - Provides cached metrics for tokens, pairs, and protocol
   - Falls back to database if cache misses

2. **Database** (Fallback):
   - Used when Redis cache doesn't have the requested data
   - Direct queries to EntityMetrics and MetricSnapshot tables
   - More comprehensive historical data

Example resolver paths:
```javascript
// Protocol metrics resolver
protocolMetrics: async (_parent, _args, {prisma}) => {
  try {
    // First tries EntityMetrics, falls back to defaults
    const metrics = await prisma.entityMetrics.findFirst({
      where: { entity: 'protocol', entityId: 'global' }
    });
    // Convert and return metrics
  } catch (error) {
    // Return default values
  }
}
```

#### MetricsService (Frontend)

A lightweight service that handles fetching and caching metrics on the frontend:

- Manages in-memory caching
- Handles staleness detection
- Provides consistent formatting for UI components

## Metrics Types and Calculations

### Token Metrics

- **TVL**: Sum of token value in all liquidity pools
- **Price**: Determined from liquidity pool reserves and market trades
- **Price Change**: Percentage change over different timeframes (1h, 24h, 7d)
- **Volume**: Trading volume across different timeframes

### Pair Metrics

- **TVL**: Combined value of both tokens in the pair
- **Volume**: Trading volume for the pair
- **APR**: Annual percentage rate based on fees and volume
- **Reserves**: Current token reserves in the pair

### Protocol Metrics

- **Total TVL**: Sum of all pair TVLs in the protocol
- **Volume**: Total trading volume across all pairs
- **Active Pools**: Count of pools with recent trading activity
- **Growth Metrics**: Changes in TVL and volume over time

## Usage in Frontend

The frontend accesses metrics through GraphQL queries:

```graphql
# Protocol metrics
query {
  protocolMetrics {
    totalValueLockedUSD
    dailyVolumeUSD
    volume1hChange
    volume24hChange
  }
}

# Token metrics
query {
  token(address: "0x...") {
    tvl
    volumeUSD24h
    volume1h
    priceChange24h
  }
}

# Pair metrics
query {
  pair(address: "0x...") {
    tvl
    volume24h
    volumeChange24h
    poolAPR
  }
}
```

## Troubleshooting

If metrics appear stale or incorrect:

1. The issue is likely in the indexer, not the frontend
2. Check indexer logs for calculation errors
3. Verify the metrics update frequency in UnifiedMetricsService
4. Check Redis connectivity between indexer and frontend
5. Run diagnostics with `npm run debug-metrics`

## Maintaining the System

For developers maintaining the metrics system:

1. All calculation logic should be added to the UnifiedMetricsService
2. Frontend should only read metrics, never calculate them
3. When adding new metrics, update both EntityMetrics schema and GraphQL schema
4. Monitor performance of high-frequency metric calculations

## Manual Refresh Commands

```bash
# On the indexer:
npm run refresh:metrics          # Refresh all metrics
npm run refresh:metrics:protocol # Refresh only protocol metrics
npm run refresh:metrics:tokens   # Refresh all token metrics
npm run refresh:metrics:pairs    # Refresh all pair metrics
``` 