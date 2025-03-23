import { formatUnits, parseUnits } from 'viem'

// Constants
const STABLECOIN_ADDRESSES: string[] = [
  '0x7d984c24d2499d840eb3b7016077164e15e5faa6', // USDT
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7', // USDT (Ethereum)
  '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
].map((address) => address.toLowerCase())

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
 * Detect if a set of price values needs decimal normalization
 * This helps address the issue where prices are displayed as extremely large numbers
 */
export function detectNeedsDecimalNormalization(
  values: number[],
  tokenDecimals?: number
): boolean {
  // Filter out zeros and invalid values
  const validValues = values.filter((v) => v !== 0 && !isNaN(v))
  if (validValues.length === 0) return false

  // Calculate the average magnitude
  const averageMagnitude =
    validValues.reduce((sum, val) => sum + Math.log10(Math.abs(val)), 0) /
    validValues.length

  // If we know the token's decimals, we can use that to determine if normalization is needed
  if (tokenDecimals !== undefined) {
    // If average magnitude is significantly larger than expected based on decimals
    return averageMagnitude > tokenDecimals / 2
  }

  // If we don't know the decimals, use a heuristic
  // If average magnitude is very large (> 8), values likely need normalization
  return averageMagnitude > 8
}

/**
 * Normalize a price value that's incorrectly scaled
 * This is specifically for the issue we saw with extremely large price values
 */
export function normalizePrice(value: number, tokenDecimals?: number): number {
  if (value === 0 || isNaN(value)) return value

  // Detect the magnitude of the value
  const magnitude = Math.floor(Math.log10(Math.abs(value)))

  // If we know the token's decimals, use that for normalization
  if (tokenDecimals !== undefined && tokenDecimals > 0) {
    // If the magnitude is close to the token's decimals, it's likely raw blockchain value
    if (magnitude >= tokenDecimals - 3) {
      try {
        // Use viem to format the value
        return parseFloat(formatUnits(BigInt(Math.round(value)), tokenDecimals))
      } catch (error) {
        // Fallback to traditional calculation if BigInt conversion fails
        return value / Math.pow(10, tokenDecimals)
      }
    }
  }

  // Fallback to heuristics if decimals are unknown
  // For very large values that are clearly incorrect token prices
  if (magnitude >= 15) {
    try {
      // Assume 18 decimals (common for ERC20 tokens)
      return parseFloat(formatUnits(BigInt(Math.round(value)), 18))
    } catch (error) {
      return value / 1e18
    }
  } else if (magnitude >= 8) {
    // For somewhat large values, use appropriate scaling
    let decimals = 6
    if (magnitude >= 12) decimals = 12
    else if (magnitude >= 10) decimals = 10
    else if (magnitude >= 9) decimals = 9

    try {
      return parseFloat(formatUnits(BigInt(Math.round(value)), decimals))
    } catch (error) {
      return value / Math.pow(10, decimals)
    }
  }

  return value
}

/**
 * Check if a token is a stablecoin
 */
export function isStablecoin(address: string): boolean {
  return STABLECOIN_ADDRESSES.includes(address.toLowerCase())
}

/**
 * Get common stablecoin addresses
 */
export function getStablecoinAddresses(): string[] {
  return STABLECOIN_ADDRESSES
}

/**
 * Helper to format currency for display
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
      if (Math.abs(amount) < 0.01) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 6,
          maximumFractionDigits: 6,
        }).format(amount)
      }

      if (Math.abs(amount) < 1) {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 4,
          maximumFractionDigits: 4,
        }).format(amount)
      }

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
    return '$0.00'
  }
}

/**
 * Format token amount for display (with symbol)
 */
export function formatTokenAmount(
  amount: number,
  symbol: string,
  decimals: number = 2
): string {
  try {
    if (isNaN(amount)) {
      return '0 ' + symbol
    }

    // Adjust decimal places based on amount
    let displayDecimals = decimals
    if (Math.abs(amount) < 0.01) {
      displayDecimals = 6
    } else if (Math.abs(amount) < 1) {
      displayDecimals = 4
    } else if (Math.abs(amount) >= 10000) {
      displayDecimals = 0 // No decimals for large numbers
    }

    const formatted = amount.toLocaleString('en-US', {
      minimumFractionDigits: displayDecimals,
      maximumFractionDigits: displayDecimals,
    })

    return `${formatted} ${symbol}`
  } catch (error) {
    console.error('Error formatting token amount:', error)
    return '0 ' + symbol
  }
}
