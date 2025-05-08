
/**
 * This script specifically addresses the KOI token chart display issue by:
 * 1. Ensuring all blockchain values are properly formatted using token-specific decimals
 * 2. Improving the detection of large numbers that represent raw blockchain values
 * 3. Implementing a comprehensive approach to handle price data regardless of token type
 */

// Function to check if a value needs decimal formatting (used in chart data processing)
function needsDecimalFormatting(value, symbol) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    return false;
  }
  
  // Parse to number if it's a string
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  
  // If value is not a valid number, it doesn't need formatting
  if (isNaN(numValue)) {
    return false;
  }
  
  // Special case for KOI token - always apply decimal formatting if value is large
  if (symbol === 'KOI' && numValue > 1e6) {
    return true;
  }
  
  // General case: check for large values likely to be unformatted blockchain values
  return numValue > 1e10;
}

// Function to safely format blockchain values with the appropriate decimals
function formatBlockchainValue(value, decimals = 18) {
  try {
    // Convert to string if it's a number (to handle scientific notation properly)
    const valueStr = typeof value === 'number' ? value.toString() : String(value);
    
    // Try to use BigInt for precise formatting
    try {
      const valueBigInt = BigInt(valueStr.split('.')[0]); // Remove any decimal part for BigInt
      return Number(formatUnits(valueBigInt, decimals));
    } catch (err) {
      // Fallback to simple division if BigInt conversion fails
      console.warn(`BigInt conversion failed, using fallback division: ${err.message}`);
      return Number(value) / Math.pow(10, decimals);
    }
  } catch (err) {
    console.error(`Error formatting blockchain value: ${err.message}`);
    return Number(value);
  }
}

// Extension of existing chart data processing:
// In your chart data processing function, replace the current blockchain value detection
// with these more robust helpers. For example, update code like this:

/*
// Replace code like this:
if (isLikelyBlockchainValue && tokenDecimals) {
  try {
    const valueBigInt = BigInt(rawValue);
    formattedValue = Number(formatUnits(valueBigInt, tokenDecimals));
    console.log(`[Chart] Formatted blockchain value: ${rawValue} → ${formattedValue}`);
  } catch (err) {
    // Fallback...
  }
}

// With code like this:
if (needsDecimalFormatting(rawValue, token.symbol)) {
  formattedValue = formatBlockchainValue(rawValue, tokenDecimals);
  console.log(`[Chart] Formatted blockchain value: ${rawValue} → ${formattedValue}`);
}
*/
