# Swap Interface Token Order Fix

## Issue

The swap interface needed to be standardized so that the first token (TokenA or input token) is always KKUB, except in the case of the KKUB token page, where it should show native KUB instead.

## Solution

We've made the following changes to ensure a consistent swap interface experience:

1. **Token Detail Pages**:
   - When viewing the KKUB token page, the input token is set to native KUB (`0x0000000000000000000000000000000000000000`)
   - When viewing any other token page, the input token is set to KKUB

2. **Main App Page and Swap Page**:
   - Updated to consistently show KKUB as the default input token (TokenA)
   - For the main app page, the output token is set to KOI
   - For the swap page, kept the existing pattern for output token

## Files Modified

- `src/modules/explore/components/TokenDetailClient.tsx`:
  - Updated to correctly handle token input selection based on whether the current page is for KKUB
  - Used CURRENT_CHAIN to reference the correct KKUB address for the active network
  - Fixed bug: Replaced hardcoded KKUB address with the imported one from constants/addresses

- `src/app/swap/page.tsx`:
  - Changed default input token from KOI to KKUB

- `src/app/page.tsx`:
  - Swapped the token order to use KKUB as the input and KOI as the output

## Bug Fix (2025-05-09)

Fixed a TypeError that occurred in the token detail page when comparing token addresses:
```
TypeError: Cannot read properties of undefined (reading 'toLowerCase')
```

The issue was caused by using a hardcoded KKUB address variable instead of the imported one from constants:
- Updated the import to use the correct `KKUB_ADDRESS` from `@/src/constants/addresses` 
- This ensures that the address is correctly indexed by chain ID (`CURRENT_CHAIN.id`)

## Testing

To verify the fix is working correctly, check:

1. Main app page - should show KKUB as the first token (TokenA) and KOI as the second token
2. Swap page - should show KKUB as the first token (TokenA)
3. KKUB token detail page - should show native KUB as the first token (TokenA) and KKUB as the second token
4. Other token detail pages (e.g., KOI) - should show KKUB as the first token (TokenA) and the token being viewed as the second token

## Benefits

- Creates a consistent user experience across the platform
- Aligns with industry best practices by putting the stablecoin/primary currency as the first token
- Makes it clearer for users to understand token relationships with KKUB as the common denominator 