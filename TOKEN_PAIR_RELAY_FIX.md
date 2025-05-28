# TokenPair Component Relay Integration Fix

## Problem Statement

The TokenPair component was failing to render properly in two scenarios:
1. **Swap success toast** - Runtime error: "Expected to receive an object where `...TokenPairFragment` was spread, but the fragment reference was not found"
2. **Add liquidity stepper** - Similar fragment reference errors

The root causes were:
1. Using multiple `RelayEnvironmentProvider` instances creating separate Relay contexts
2. Mixing SDK's `useTokenInfo` with Relay fragments 
3. Using `Suspense` inside toast components (poor UX)
4. No proper GraphQL queries in components that needed token data

## Solution Architecture

### 🔧 **Core Principles Applied**
- **Single Relay Environment**: Use the global `RelayEnvironmentProvider` only
- **Fragment-First**: Always use Relay fragments for token data, never SDK hooks
- **No Suspense in Toasts**: Toasts should render immediately with available data
- **Query at Component Level**: Components that need token data should query for it

### 🛠 **Implementation Details**

#### 1. **Clean TokenPair Component**
```typescript
// components/TokenPair.tsx - Only accepts Relay fragments
export interface TokenPairProps {
  tokenA: TokenPairFragment$key
  tokenB: TokenPairFragment$key
  size?: 'small' | 'large'
  showSymbols?: boolean
}
```

#### 2. **New SwapWithRelay Component**
Created `SwapWithRelay.tsx` that demonstrates the correct pattern:

```typescript
// GraphQL query at component level
const swapTokenDataQuery = graphql`
  query SwapTokenDataQuery($tokenInAddress: String!, $tokenOutAddress: String!, $skipTokenIn: Boolean!, $skipTokenOut: Boolean!) {
    tokenIn: tokenByAddress(address: $tokenInAddress) @skip(if: $skipTokenIn) {
      ...TokenPairFragment
      decimals
      symbol  
      name
    }
    tokenOut: tokenByAddress(address: $tokenOutAddress) @skip(if: $skipTokenOut) {
      ...TokenPairFragment
      decimals
      symbol
      name  
    }
  }
`

// Component uses useLazyLoadQuery to get token data
const tokenData = useLazyLoadQuery<SwapTokenDataQuery>(
  swapTokenDataQuery,
  {
    tokenInAddress: tokenIn || '',
    tokenOutAddress: tokenOut || '',
    skipTokenIn: !tokenIn || isNativeKUB(tokenIn),
    skipTokenOut: !tokenOut || isNativeKUB(tokenOut),
  },
  { fetchPolicy: 'store-or-network' }
)
```

#### 3. **Proper Toast Implementation**
```typescript
const showSuccessToast = (swappedAmountIn: bigint, swappedAmountOut: bigint, txHash: string) => {
  const id = toast.show({
    color: 'positive',
    title: 'Swap Successful',
    text: `${formattedAmountIn} ${tokenInInfo?.symbol} for ${formattedAmountOut} ${tokenOutInfo?.symbol}`,
    actionsSlot: (
      <View direction="row" gap={2} align="center">
        {/* Only show TokenPair if we have fragment data for both tokens */}
        {tokenData.tokenIn && tokenData.tokenOut && (
          <TokenPair
            tokenA={tokenData.tokenIn}
            tokenB={tokenData.tokenOut}
            size="small"
          />
        )}
        <Actionable onClick={() => window.open(`${CHAIN.blockExplorers?.default.url}/tx/${txHash}`, '_blank')}>
          <Text variant="body-3" color="primary">View Transaction</Text>
        </Actionable>
        <Button onClick={() => toast.hide(id)} variant="ghost" size="small">
          <Icon svg={X} />
        </Button>
      </View>
    ),
    timeout: 0,
  })
}
```

### 📋 **Key Improvements**

#### ✅ **Relay Best Practices**
- **Single Environment**: Removed duplicate `RelayEnvironmentProvider` wrappers
- **Fragment Consistency**: All token data comes from GraphQL fragments
- **Query Collocation**: Components that need data query for it directly
- **Type Safety**: Full TypeScript support with generated types

#### ✅ **User Experience**
- **No Loading States in Toasts**: Toast renders immediately with available data
- **Graceful Fallbacks**: Shows text-only if token images fail to load
- **Consistent Rendering**: TokenPair always renders with proper fragment data

#### ✅ **Performance**
- **Efficient Queries**: Uses `@skip` directives to avoid unnecessary queries for native KUB
- **Store Optimization**: `fetchPolicy: 'store-or-network'` leverages Relay cache
- **No Redundant Requests**: Single query per component, not per token

### 🔄 **Migration Path**

#### For Existing Components:
1. **Add GraphQL Query**: Include token data query at component level
2. **Replace SDK Hooks**: Use `useLazyLoadQuery` instead of `useTokenInfo`
3. **Update Props**: Pass fragment data to TokenPair components
4. **Remove Extra Providers**: Don't wrap with additional `RelayEnvironmentProvider`

#### Example Migration:
```typescript
// ❌ Before (problematic)
const { data: tokenInfo } = useTokenInfo(tokenAddress)
return (
  <RelayEnvironmentProvider environment={newEnv}>
    <Suspense>
      <TokenPairWrapper tokenAAddress={tokenA} tokenBAddress={tokenB} />
    </Suspense>
  </RelayEnvironmentProvider>
)

// ✅ After (correct)
const tokenData = useLazyLoadQuery(tokenQuery, { tokenAddress })
return (
  tokenData.token && (
    <TokenPair tokenA={tokenData.token} tokenB={tokenData.token} />
  )
)
```

### 🎯 **Results**

#### ✅ **Fixed Issues**
- **Swap Success Toast**: Now renders TokenPair correctly with proper fragments
- **Add Liquidity Stepper**: TokenPair displays without fragment errors
- **No Runtime Errors**: All Relay fragment references are properly available
- **Smooth UX**: No loading states in toasts, immediate rendering

#### ✅ **Performance Benefits**
- **Reduced Queries**: Single environment prevents duplicate requests
- **Better Caching**: Proper Relay store utilization
- **Type Safety**: Full end-to-end TypeScript support

#### ✅ **Maintainability**
- **Clear Patterns**: Consistent approach across all components
- **Self-Documenting**: GraphQL queries show exactly what data is needed
- **Extensible**: Easy to add more token fields as needed

### 📚 **Best Practices Established**

1. **Always use fragments for token data** - Never mix SDK and Relay
2. **Query at component level** - Don't rely on parent queries for critical data
3. **No Suspense in toasts** - Toast UX should be immediate
4. **Single Relay environment** - Use the global provider only
5. **Graceful degradation** - Handle missing data elegantly

This fix ensures that TokenPair components work reliably across all contexts while following Relay and React best practices for optimal performance and user experience. 