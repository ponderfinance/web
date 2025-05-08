#!/usr/bin/env node

/**
 * This script provides a pair-agnostic fix for token price chart calculations
 * that works regardless of token position in the pair.
 */

const { formatUnits } = require('viem');

/**
 * Correctly calculates the USD price from a blockchain exchange rate value
 * regardless of token position in the pair
 * 
 * @param {string|number} rawExchangeRate - The raw exchange rate from price snapshot
 * @param {boolean} isToken0 - Whether this token is token0 in the pair
 * @param {number} tokenDecimals - Decimals for the token
 * @param {number} counterpartDecimals - Decimals for the counterpart token
 * @param {number} counterpartTokenPrice - USD price of the counterpart token
 * @returns {number} - The calculated USD price
 */
function calculateCorrectUsdPrice(
  rawExchangeRate, 
  isToken0, 
  tokenDecimals, 
  counterpartDecimals,
  counterpartTokenPrice
) {
  // Convert to string if it's a number (to handle scientific notation properly)
  const exchangeRateStr = typeof rawExchangeRate === 'number' 
    ? rawExchangeRate.toString() 
    : String(rawExchangeRate);
  
  try {
    // The key is understanding what price0 and price1 actually represent:
    //
    // - price0 represents "how much of token1 you get for 1 unit of token0"
    // - price1 represents "how much of token0 you get for 1 unit of token1"
    //
    // But these values are stored in their blockchain format with decimals,
    // so we need to properly format them first.
    
    // First, format the exchange rate using the appropriate decimals
    const decimalPlaces = isToken0 ? counterpartDecimals : tokenDecimals;
    let exchangeRate;
    
    try {
      // Use BigInt for precise formatting of large numbers
      const valueBigInt = BigInt(exchangeRateStr.split('.')[0]); // Remove any decimal part
      exchangeRate = Number(formatUnits(valueBigInt, decimalPlaces));
    } catch (err) {
      // Fallback to simple division if BigInt conversion fails
      console.warn(`BigInt conversion failed, using fallback division: ${err.message}`);
      exchangeRate = Number(exchangeRateStr) / Math.pow(10, decimalPlaces);
    }
    
    // Now calculate the USD price correctly based on token position
    let usdPrice;
    
    if (isToken0) {
      // If our token is token0, then price0 represents "token1 per token0"
      // So we multiply by the USD price of token1
      usdPrice = exchangeRate * counterpartTokenPrice;
    } else {
      // If our token is token1, then price1 represents "token0 per token1"
      // So we multiply by the USD price of token0
      usdPrice = exchangeRate * counterpartTokenPrice;
    }
    
    return usdPrice;
  } catch (err) {
    console.error(`Error calculating USD price: ${err.message}`);
    return 0;
  }
}

/**
 * Implementation of the fix in the PriceChartService
 * 
 * This shows how to modify the dataPoints mapping function in getTokenPriceChartData
 */
function exampleImplementation() {
  // This is pseudocode showing how to apply the fix
  return `
  // Replace the current implementation in priceChartService.ts
  // Inside the dataPoints.map function:
  
  try {
    // Get the exchange rate from the snapshot
    const rawExchangeRate = isToken0 ? snapshot.price0! : snapshot.price1!;
    
    // Ensure timestamp is treated as a number
    const time = typeof snapshot.timestamp === 'number' 
      ? snapshot.timestamp 
      : Number(snapshot.timestamp);

    // Use our improved pair-agnostic calculation function
    const usdPrice = calculateCorrectUsdPrice(
      rawExchangeRate,
      isToken0,
      token.decimals || 18,
      counterpartToken.decimals || 18,
      counterpartTokenPrice
    );
    
    return {
      time,
      value: usdPrice
    };
  } catch (err) {
    console.error(\`[CHART] Error processing snapshot: \${err}\`);
    return null;
  }
  `;
}

// Show the explanation of the fix
console.log('\n=== Pair-Agnostic Chart Fix ===');
console.log('This fix properly handles token price calculations regardless of pair order');
console.log('\nThe primary issue with the current implementation:');
console.log('1. It does not correctly handle the decimal formatting for blockchain values');
console.log('2. It does not properly interpret what price0 and price1 represent in the pair');
console.log('\nThe fix:');
console.log('1. Properly format raw blockchain values using the correct token decimals');
console.log('2. Correctly interpret price0 and price1 values based on their meaning in the pair');
console.log('3. Apply a consistent calculation regardless of token position in the pair');
console.log('\nImplementation example:');
console.log(exampleImplementation()); 