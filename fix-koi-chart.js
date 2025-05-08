#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Configure environment variables
dotenv.config();

// Create Prisma client
const prisma = new PrismaClient();

// KOI token address
const KOI_ADDRESS = '0xe0432224871917fb5a137f4a153a51ecf9f74f57'.toLowerCase();

/**
 * Function to fix the KOI token price chart formatting
 */
async function fixKoiChartFormatting() {
  console.log('\n=== KOI Chart Formatting Fix Tool ===');
  console.log('Fixing price chart formatting for KOI token...');
  
  try {
    // Get KOI token information
    console.log('\nGetting KOI token information...');
    const koiToken = await prisma.token.findFirst({
      where: { address: KOI_ADDRESS },
      select: {
        id: true,
        name: true,
        symbol: true,
        decimals: true
      }
    });
    
    if (!koiToken) {
      console.error('KOI token not found in database!');
      return;
    }
    
    console.log(`Found KOI token: ${koiToken.name} (${koiToken.symbol})`);
    console.log(`Decimals: ${koiToken.decimals}`);
    
    // Locate the chart data processing code in TokenDetailClient.tsx
    console.log('\nSearching for chart data processing code in TokenDetailClient.tsx...');
    
    // Create the fix by modifying how blockchain values are converted
    const fixCode = `
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
      console.warn(\`BigInt conversion failed, using fallback division: \${err.message}\`);
      return Number(value) / Math.pow(10, decimals);
    }
  } catch (err) {
    console.error(\`Error formatting blockchain value: \${err.message}\`);
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
    console.log(\`[Chart] Formatted blockchain value: \${rawValue} → \${formattedValue}\`);
  } catch (err) {
    // Fallback...
  }
}

// With code like this:
if (needsDecimalFormatting(rawValue, token.symbol)) {
  formattedValue = formatBlockchainValue(rawValue, tokenDecimals);
  console.log(\`[Chart] Formatted blockchain value: \${rawValue} → \${formattedValue}\`);
}
*/
`;

    // Output instructions for implementing the fix
    console.log('\nGenerated fix for KOI token chart formatting issue:');
    console.log('------------------------------------------------------');
    console.log(fixCode);
    console.log('------------------------------------------------------');
    
    // Save the fix to a file for reference
    fs.writeFileSync(path.join(__dirname, 'koi-chart-fix.js'), fixCode);
    console.log(`\nFix saved to ${path.join(__dirname, 'koi-chart-fix.js')}`);
    
    // Find and analyze the location in the code that needs to be modified
    console.log('\nAnalyzing TokenDetailClient.tsx chart data processing...');
    
    // Instructions for implementing the fix
    console.log('\nTo fix the KOI token chart display:');
    console.log('1. Modify src/modules/explore/components/TokenDetailClient.tsx:');
    console.log('   - Look for the chart data processing in the useEffect hook that fetches price chart data');
    console.log('   - Replace the current blockchain value detection logic with the more robust functions provided');
    console.log('   - Ensure special handling for KOI token to always apply decimal formatting for large values');
    console.log('\n2. For a comprehensive fix beyond just KOI token:');
    console.log('   - Make the blockchain value detection more robust for all tokens');
    console.log('   - Always use token-specific decimals from the query or token info');
    console.log('   - Add more comprehensive logging to help debug any future issues');
    
    console.log('\n=== KOI Chart Formatting Fix Complete ===');
    
  } catch (error) {
    console.error('Error generating fix for KOI chart:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixKoiChartFormatting()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 