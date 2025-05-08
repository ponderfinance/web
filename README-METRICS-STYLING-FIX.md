# Protocol Metrics Styling Fix

## Issue

There was a styling inconsistency between the skeleton loading state and the actual rendered metrics components in the Explore layout. When loading, the metrics displayed with a clean, simple styling, but when the data loaded, they were being rendered inside Card components with different styling.

## Solution

We updated both metrics components to use consistent styling:

1. **GlobalProtocolMetrics.tsx**:
   - Removed Card components from the rendered metrics
   - Updated layout to match the skeleton loading state
   - Kept label text consistent ("24h Volume" and "Total TVL")
   - Maintained proper alignment with `align="center"` and `className="justify-between"`
   - Removed arrow icons from percentage changes, keeping only the text

2. **ProtocolMetrics.tsx**:
   - Made the same styling changes for consistency across all metrics displays
   - Updated both the rendered component and the loading skeleton
   - Removed arrow icons from percentage changes, keeping only the text

## Files Modified

- `src/modules/explore/components/GlobalProtocolMetrics.tsx`
- `src/modules/explore/components/ProtocolMetrics.tsx`

## Before/After

### Before
- Loading state showed simple, clean metrics
- Loaded state displayed metrics inside Card components with padding and different styling
- Percentage changes were displayed with arrow icons

### After
- Both loading and loaded states use the same consistent styling
- Removed Card components for a cleaner, flatter UI
- Maintained proper spacing and alignment
- Percentage changes now display only the text with proper +/- signs and colors (green/red)

## Benefits

1. Consistent UI between loading and loaded states
2. No jarring layout shift when data loads
3. Cleaner, simpler metrics display that's easier to scan
4. Better matches the design language of the rest of the application
5. Reduced visual noise by removing unnecessary arrow icons 