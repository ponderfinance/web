import { formatUnits, parseUnits } from 'viem'

// Constants - don't hardcode prices in this list, just identify which tokens are stablecoins
// Adding both cases to ensure case-insensitive matching
export const STABLECOIN_ADDRESSES: string[] = [
  '0x7d984C24d2499D840eB3b7016077164e15E5faA6', // USDT
  '0x7d984c24d2499d840eb3b7016077164e15e5faa6', // USDT lowercase
  '0x77071ad51ca93fc90e77BCdECE5aa6F1B40fcb21', // USDC
  '0x77071ad51ca93fc90e77bcdece5aa6f1b40fcb21', // USDC lowercase
].map((address) => address.toLowerCase())

// Map symbols to addresses for easier reference
export const STABLECOIN_SYMBOLS = ['USDT', 'USDC']

// Identify the main token for pricing
export const MAIN_TOKEN_SYMBOL = 'KKUB'

/**
 * Process price history data to ensure values are properly formatted
 * This is critical for charting to display correct values
 */
export function processPriceHistoryData(
  data: Array<{ time: number; value: number | string }>,
  tokenDecimals?: number
): Array<{ time: number; value: number }> {
  // First, convert all values to numbers
  const convertedData = data.map((point) => ({
    time: point.time,
    value: typeof point.value === 'string' ? parseFloat(point.value) : point.value,
  }))

  // Check if values need decimal normalization
  const needsNormalization = detectNeedsDecimalNormalization(
    convertedData.map((d) => d.value),
    tokenDecimals
  )

  if (needsNormalization) {
    // Apply normalization based on detected decimal offset
    return convertedData.map((point) => ({
      time: point.time,
      value: normalizePrice(point.value, tokenDecimals),
    }))
  }

  return convertedData
}

/**
 * Detect if a series of price values needs decimal normalization
 * This happens when we have raw blockchain values instead of human-readable values
 * Improved to better detect when normalization is necessary
 */
export function detectNeedsDecimalNormalization(
  values: number[],
  tokenDecimals?: number
): boolean {
  if (!values || values.length === 0) return false

  // Filter out zeros and invalid values to avoid skewing detection
  const nonZeroValues = values.filter((v) => v !== 0 && !isNaN(v))
  if (nonZeroValues.length === 0) return false
  
  // Get the average magnitude of values
  const avgMagnitude =
    nonZeroValues.reduce((sum, val) => {
      return sum + Math.log10(Math.abs(val))
    }, 0) / nonZeroValues.length
  
  // Check the range of values to see if they're consistent
  const magnitudes = nonZeroValues.map(v => Math.log10(Math.abs(v)))
  const maxMagnitude = Math.max(...magnitudes)
  const minMagnitude = Math.min(...magnitudes)
  
  // If we know token decimals, use that for a more accurate check
  if (tokenDecimals && tokenDecimals > 0) {
    // If average magnitude is close to or greater than decimals, it's likely raw blockchain values
    if (avgMagnitude > tokenDecimals - 3) {
      return true
    }
    
    // If magnitude is suspiciously large (not reasonable for token prices), normalize
    if (avgMagnitude > 6) {
      return true
    }
  } else {
    // Without token decimals, use more aggressive heuristics
    // Most token prices are well below 100,000, so magnitudes above 5 are suspicious
    if (avgMagnitude > 5) {
      return true
    }
    
    // If the magnitude range is extreme, this indicates issues with scaling
    if (maxMagnitude - minMagnitude > 8) {
      return true
    }
  }
  
  // Default case: values are likely correctly scaled already
  return false
}

/**
 * Normalize a price value that's incorrectly scaled
 * Improved to handle a wider range of scaling scenarios
 */
export function normalizePrice(value: number, tokenDecimals?: number): number {
  if (value === 0 || isNaN(value)) return value

  // Detect the magnitude of the value
  const magnitude = Math.floor(Math.log10(Math.abs(value)))
  
  // If we know the token's decimals, use that for more accurate normalization
  if (tokenDecimals !== undefined && tokenDecimals > 0) {
    // If the magnitude is close to the token's decimals, normalize using tokenDecimals
    if (magnitude >= tokenDecimals - 3) {
      try {
        // Use viem's formatUnits for precise normalization
        return parseFloat(formatUnits(BigInt(Math.round(value)), tokenDecimals))
      } catch (error) {
        // Fallback to simple division if BigInt conversion fails
        return value / Math.pow(10, tokenDecimals)
      }
    }
    
    // For large values that don't match token decimals but are still too big
    if (magnitude > 6) {
      // Find the closest power of 10 multiple of 3 (to match common decimal places)
      const normalizeDecimals = Math.floor(magnitude / 3) * 3
      return value / Math.pow(10, normalizeDecimals)
    }
  } else {
    // Without token decimals, use adaptive normalization based on magnitude
    
    // Very large values (billions+) - assume 18 decimals (common for ERC20)
    if (magnitude >= 12) {
      try {
        return parseFloat(formatUnits(BigInt(Math.round(value)), 18))
      } catch (error) {
        return value / 1e18
      }
    }
    // Large values (millions) - try 9 decimals
    else if (magnitude >= 8) {
      try {
        return parseFloat(formatUnits(BigInt(Math.round(value)), 9))
      } catch (error) {
        return value / 1e9
      }
    }
    // Medium values (thousands) - try 6 decimals 
    else if (magnitude >= 5) {
      try {
        return parseFloat(formatUnits(BigInt(Math.round(value)), 6))
      } catch (error) {
        return value / 1e6
      }
    }
    // Smaller values that still need normalization
    else if (magnitude >= 3) {
      return value / 1e3
    }
  }

  // If we reach here, no normalization was applied
  return value
}

/**
 * Check if a token is a stablecoin by address
 */
export function isStablecoin(address?: string): boolean {
  if (!address) return false
  return STABLECOIN_ADDRESSES.includes(address.toLowerCase())
}

/**
 * Check if a token is a stablecoin by symbol
 */
export function isStablecoinBySymbol(symbol?: string): boolean {
  if (!symbol) return false
  return STABLECOIN_SYMBOLS.includes(symbol.toUpperCase())
}

/**
 * Get common stablecoin addresses
 */
export function getStablecoinAddresses(): string[] {
  return STABLECOIN_ADDRESSES
}

/**
 * Get common stablecoin symbols
 */
export function getStablecoinSymbols(): string[] {
  return STABLECOIN_SYMBOLS
}

/**
 * Helper to format currency for display
 * Enhanced to better handle very small values
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  options = {}
): string {
  try {
    if (isNaN(amount)) {
      return '$0.00'
    }

    const defaults = {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }

    const config = { ...defaults, ...options }

    if (currency === 'USD') {
      // Special handling for different value ranges
      if (Math.abs(amount) < 0.000001) {
        // Extremely small values (show scientific notation to avoid truncating to zero)
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 10,
          maximumFractionDigits: 10,
          notation: 'standard',
        }).format(amount)
      }
      
      if (Math.abs(amount) < 0.0001) {
        // Very small values (show up to 8 decimals)
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 8,
          maximumFractionDigits: 8,
        }).format(amount)
      }

      if (Math.abs(amount) < 0.001) {
        // Small values (show up to 6 decimals)
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 6,
          maximumFractionDigits: 6,
        }).format(amount)
      }

      if (Math.abs(amount) < 0.01) {
        // Values less than 1 cent (show up to 4 decimals)
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }).format(amount)
      }

      if (Math.abs(amount) < 1) {
        // Values less than $1 (show up to 4 decimals)
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 3,
          maximumFractionDigits: 4,
        }).format(amount)
      }

      // Default formatting for normal values
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: config.minimumFractionDigits,
        maximumFractionDigits: config.maximumFractionDigits,
      }).format(amount)
    }

    // For other currencies
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: config.minimumFractionDigits,
      maximumFractionDigits: config.maximumFractionDigits,
    }).format(amount)
  } catch (error) {
    console.error('Error formatting currency:', error)
    // If we have a very small but non-zero value and an error occurred,
    // return a reasonable string rather than default to $0.00
    if (amount > 0 && amount < 0.01) {
      return '<$0.01'
    }
    return '$0.00'
  }
}

/**
 * Format token amount with appropriate decimal places based on value
 */
export function formatTokenAmount(
  amount: number,
  symbol: string,
  decimals: number = 2
): string {
  if (isNaN(amount)) {
    return `0 ${symbol}`
  }

  // For very small values, use more decimal places
  if (Math.abs(amount) < 0.001) {
    return `${amount.toFixed(6)} ${symbol}`
  } else if (Math.abs(amount) < 0.01) {
    return `${amount.toFixed(5)} ${symbol}`
  } else if (Math.abs(amount) < 1) {
    return `${amount.toFixed(4)} ${symbol}`
  }

  // Default to requested decimals for larger values
  return `${amount.toFixed(decimals)} ${symbol}`
}
