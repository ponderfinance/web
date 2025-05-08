# Volume Metrics System

This document explains how volume metrics, especially volume change percentages, are calculated, stored, and displayed in the Ponder DEX.

## Overview

Volume metrics are calculated in the ponder-indexer service and are displayed in the ponder-dex frontend. The metrics include:

- 24-hour volume (`volume24h`)
- 24-hour volume change percentage (`volume24hChange`)
- Other time periods (1h, 7d, 30d)

## How Volume Metrics Work

1. **Calculation**: The ponder-indexer calculates volume by summing all swaps in the specified time period.
2. **Change Percentage**: The 24h volume change is calculated by comparing the current 24h volume with the previous 24h period.
3. **Storage**: Values are stored in multiple places:
   - `ProtocolMetric` table in the database
   - `EntityMetrics` table (for consistency)
   - Redis cache for fast frontend access

## Recent Fixes

We've implemented several fixes to ensure volume change percentages are displayed correctly:

1. **Backend Calculation**: Enhanced the calculation in `unifiedMetricsService.ts` to properly track and store volume change percentages.
2. **Redis Caching**: Ensured Redis caching properly includes the volume change values.
3. **Frontend Fetching**: Modified the React components to always fetch the latest data from the server.

## Troubleshooting

If you encounter issues with volume change percentages:

### Redis Cache Issues

If Redis doesn't have the correct values, run:

```bash
node manual-fix-24h-change.js
```

This script:
- Checks what's in Redis
- Sets the volume24h and volume24hChange values directly
- Verifies the values were set correctly

### Frontend Display Issues

If the frontend isn't showing the correct values:

1. Use `network-only` fetch policy in GraphQL queries
2. Add a refresh mechanism to periodically refetch data
3. Clear browser cache with hard refresh (Ctrl+F5 or Cmd+Shift+R)

### Complete Refresh

To completely refresh all metrics:

```bash
node force-refresh-metrics.js
```

This:
- Clears Redis cache
- Forces recalculation in the backend
- Prompts for browser cache clearing

## Understanding the Calculation

- **Current Period Volume**: Sum of all swap volumes in the past 24 hours
- **Previous Period Volume**: Sum of all swap volumes from 48 to 24 hours ago
- **Change Formula**: `((current - previous) / previous) * 100`

Example:
- Current 24h volume: $7.56
- Previous 24h volume: $2.90
- Change: `((7.56 - 2.90) / 2.90) * 100 = 160.7%`

## Scheduled Updates

The system automatically updates these metrics:
- 24h metrics update every 15 minutes
- 1h metrics update every 5 minutes
- Token prices update every 1 minute

## Components Involved

1. **Backend**:
   - `unifiedMetricsService.ts`: Main calculation service
   - `cache-triggers.ts`: Synchronizes values between database and Redis

2. **Frontend**:
   - `ProtocolMetrics.tsx`: Displays metrics with proper formatting
   - `GlobalProtocolMetrics.tsx`: Used on landing pages 
   - GraphQL resolvers for fetching the data

## Custom Scripts

- `verify-volume-change.js`: Verifies that volume change is calculated correctly
- `manual-fix-24h-change.js`: Directly sets values in Redis
- `force-refresh-metrics.js`: Comprehensive refresh of all metrics 