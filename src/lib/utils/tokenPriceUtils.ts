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
export const STABLECOIN_SYMBOLS = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'USDC.e', 'FRAX', 'USDP']

// Identify the main token for pricing
export const MAIN_TOKEN_SYMBOL = 'KKUB'

/**
 * Process price history data to ensure values are properly formatted
 * This is a simplified implementation that handles both regular tokens and stablecoins
 */
export function processPriceHistoryData(
  data: Array<{ time: number; value: number | string }>,
  tokenDecimals?: number,
  isStablecoin: boolean = false
): Array<{ time: number; value: number }> {
  console.log(`[DEBUG_CHART] processPriceHistoryData called with ${data?.length || 0} points, decimals=${tokenDecimals}, isStablecoin=${isStablecoin}`);
  
  if (!data || data.length === 0) {
    console.log(`[DEBUG_CHART] Empty or null data provided to processPriceHistoryData`);
    return [];
  }

  // Log the first few raw data points
  console.log(`[DEBUG_CHART] First few raw data points:`, 
    data.slice(0, 3).map(p => ({
      time: p.time,
      value: p.value,
      timeType: typeof p.time,
      valueType: typeof p.value
    }))
  );

  // Convert all values to numbers and ensure time is an integer
  const convertedData = data.map((point) => ({
    time: Math.floor(Number(point.time)),
    value: typeof point.value === 'string' ? parseFloat(point.value) : point.value,
  }));

  // Log after conversion
  console.log(`[DEBUG_CHART] After conversion:`, 
    convertedData.slice(0, 3).map(p => ({
      time: p.time,
      value: p.value,
      timeIsValid: !isNaN(p.time) && p.time > 0,
      valueIsValid: !isNaN(p.value) && p.value > 0
    }))
  );

  // Filter out invalid data points (NaN, negative or zero values)
  const validData = convertedData.filter(point => 
    !isNaN(point.time) && 
    point.time > 0 && 
    !isNaN(point.value) && 
    point.value > 0
  );
  
  console.log(`[DEBUG_CHART] After filtering invalid points: ${validData.length} points remain`);
  
  if (validData.length === 0) {
    console.log(`[DEBUG_CHART] No valid data points after filtering`);
    return [];
  }
  
  // For stablecoins: return the data directly without filtering
  if (isStablecoin) {
    console.log(`[DEBUG_CHART] Stablecoin detected, using original data without filtering`);
    return validData;
  }
  
  // For regular tokens: check if they need normalization
  // First, check if values are already in a reasonable range
  const values = validData.map(point => point.value);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;
  
  console.log(`[DEBUG_CHART] Regular token stats - min: ${minValue}, max: ${maxValue}, avg: ${avgValue}`);
  
  // If maximum value is already in a reasonable range (< 1 million), no normalization needed
  if (maxValue < 1_000_000) {
    console.log(`[DEBUG_CHART] No normalization needed, values in reasonable range`);
    return validData;
  }
  
  // Otherwise, apply normalization based on token decimals
  if (tokenDecimals && tokenDecimals > 0) {
    console.log(`[DEBUG_CHART] Normalizing based on token decimals: ${tokenDecimals}`);
    
    const normalizedData = validData.map(point => ({
      time: point.time,
      value: point.value / Math.pow(10, tokenDecimals)
    }));
    
    // Log after normalization
    if (normalizedData.length > 0) {
      const normalizedValues = normalizedData.map(p => p.value);
      const normalizedMin = Math.min(...normalizedValues);
      const normalizedMax = Math.max(...normalizedValues);
      console.log(`[DEBUG_CHART] After decimal normalization - min: ${normalizedMin}, max: ${normalizedMax}`);
    }
    
    return normalizedData;
  } else {
    // Without token decimals, guess based on magnitude
    const magnitude = Math.floor(Math.log10(maxValue));
    const decimalsToUse = Math.floor(magnitude / 3) * 3; // Round to nearest power of 1000
    
    console.log(`[DEBUG_CHART] Normalizing based on guessed decimals: ${decimalsToUse}`);
    
    const normalizedData = validData.map(point => ({
      time: point.time,
      value: point.value / Math.pow(10, decimalsToUse)
    }));
    
    // Log after normalization
    if (normalizedData.length > 0) {
      const normalizedValues = normalizedData.map(p => p.value);
      const normalizedMin = Math.min(...normalizedValues);
      const normalizedMax = Math.max(...normalizedValues);
      console.log(`[DEBUG_CHART] After magnitude normalization - min: ${normalizedMin}, max: ${normalizedMax}`);
    }
    
    return normalizedData;
  }
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
