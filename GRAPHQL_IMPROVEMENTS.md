# GraphQL Improvements: Fixing Duplicate Requests

## Summary

We've fixed duplicate GraphQL requests across the application by properly implementing the Relay pattern. This resolved several issues:

1. Multiple parallel fetch requests for the same data
2. Missing cache/deduplication of requests
3. Separate loading states causing UI skeletons to flash repeatedly
4. Inefficient Redis update handling triggering unnecessary fetches

## Components Refactored

### 1. PriceChartContainer

**Before:**
- Made separate queries for price and volume data
- Used loading states that caused UI flashing
- Had no integration with parent component for timeframe selection

**After:**
- Uses fragments that receive data from parent component
- Single query at the page level includes all chart data
- Loading state handled at the page level

### 2. TokenPriceChartContainer

**Before:**
- Made direct queries for price chart data
- Had complex Redis update handling that triggered duplicate requests
- Used separate loading states

**After:**
- Uses fragments to receive data from parent
- Single query at the page level includes token and chart data
- Redis update handling centralized at the page level

### 3. TokenDetailContent

**Before:**
- Made separate queries for token data and chart data
- Components had their own Redis update handling

**After:**
- Single query includes token data and chart data
- Centralized timeframe management
- Single Redis update handler

## Key Pattern Implemented

We've implemented the proper Relay pattern across the application:

1. **One query per page:** Each page has a single top-level query that fetches all necessary data
2. **Components use fragments:** Components define their data needs via fragments
3. **No direct fetch calls:** Eliminated all direct `fetch('/api/graphql')` calls
4. **Consistent loading patterns:** Loading indicators appear only once per page load

## Benefits

- **Fewer network requests:** Dramatically reduced the number of GraphQL requests
- **Better caching:** Relay's normalized store properly manages cached data
- **Smoother UI:** Eliminated loading skeleton flashing and UI jumps
- **More efficient:** Reduced server load from duplicate requests
- **Better Redis handling:** Updates trigger fewer refreshes

## Additional Improvements

- Deleted `useTokenData` hook that made direct GraphQL calls
- Created guidelines for proper GraphQL usage
- Simplified component structure and props
- Improved error handling and loading states
- Better type safety with generated Relay types

## Components to Review in the Future

The following components still use useLazyLoadQuery, which is appropriate for page-level queries, but should be reviewed to ensure they're following the proper pattern:

1. **TokenSelector** - This component might need its own query due to its specific purpose
2. **PoolsList** - Could potentially be refactored to use fragments from a parent component
3. **Launch components** - Lower priority since they're not part of the main app flow
4. **GlobalProtocolMetrics** - Has some complex loading patterns that could be simplified

Each of these components should be evaluated to determine if:
1. They're properly using a parent-child fragment relationship
2. They're sharing data effectively with sibling components
3. They have appropriate loading states that don't cause UI flickering

The main focus should remain on ensuring chart components and data displays follow the one-query-per-page pattern and properly cascade data down to child components via fragments. 