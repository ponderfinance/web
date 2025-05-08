# KOI Price Chart Fix Documentation

## Issue

The KOI token price chart was displaying incorrect values after May 8th, 14:38. While the actual price of KOI should be around $0.00032, the chart was showing much higher values.

The issue was related to how blockchain values were being processed in the price calculation. KOI is token1 in its pair with KKUB (token0), which affected how exchange rates needed to be handled.

## Solution

We implemented a two-part solution:

1. Fixed the `PriceChartService.ts` file to properly format blockchain values using the appropriate token decimals before calculating USD prices.

2. Created and ran cleanup scripts to remove incorrect price snapshots from the database.

However, during cleanup, we accidentally deleted some correct early price snapshots, which needed to be recreated.

## Snapshot Recreation

We created and ran a script to recreate the missing price snapshots from swap data:

```
node recreate-koi-price-snapshots.js
```

This script:
- Identified the KOI/KKUB pair
- Retrieved all swap data for this pair
- Calculated price snapshots based on the swap data
- Created new price snapshots in the database
- Successfully recreated 26 price snapshots with correct values

## Verification

We created and ran a verification script to confirm that the price chart data is now correct:

```
node verify-koi-snapshots.js
```

The verification confirmed that:
- All price snapshots are now showing the correct KOI price (around $0.0003)
- The price history is consistent and within the expected range

## Scripts

- `cleanup-price-snapshots.js`: The initial script that cleaned up incorrect snapshots (but accidentally removed some correct ones)
- `recreate-koi-price-snapshots.js`: Script to recreate price snapshots from swap data
- `verify-koi-snapshots.js`: Script to verify that the price chart data is correct

## Root Cause

The root cause of the original issue was in the price calculation logic, which wasn't properly formatting blockchain values with the appropriate token decimals. The calculated price was off by several orders of magnitude.

The `PriceChartService.ts` fix ensures that all blockchain values are properly formatted before being used in price calculations.

## Future Considerations

To prevent similar issues in the future:
1. Add more validation checks for price data
2. Implement alerts for abnormal price changes
3. Consider a more robust data quality monitoring system 