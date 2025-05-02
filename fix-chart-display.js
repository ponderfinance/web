// Script to fix chart display issues
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Path to the service file
const SERVICE_PATH = path.join(__dirname, 'src/lib/services/priceChartService.ts');

async function main() {
  console.log('Preparing to fix chart display issues...');

  // Read the current service file
  console.log(`Reading service file at ${SERVICE_PATH}...`);
  const originalContent = fs.readFileSync(SERVICE_PATH, 'utf8');

  // Create a backup of the original file
  const backupPath = `${SERVICE_PATH}.bak2`;
  console.log(`Creating backup at ${backupPath}...`);
  fs.writeFileSync(backupPath, originalContent);

  // Find the findBestPriceDataPair method and modify it
  console.log('Modifying the findBestPriceDataPair method...');
  
  // This is the updated version that balances our needs:
  // 1. Doesn't have special cases for stablecoins that prevent their own charts from working
  // 2. Prioritizes high-liquidity pairs but still uses appropriate sorting fields
  const improvedMethodContent = `
  /**
   * Find the best trading pair to use for price chart data
   */
  static async findBestPriceDataPair(
    tokenId: string,
    tokenAddress: string,
    prisma: PrismaClient
  ): Promise<{ pairId: string; isToken0: boolean } | null> {
    try {
      console.log(\`[DEBUG] Finding best pair for token \${tokenId} (\${tokenAddress})\`);
      
      // Get token information
      const token = await prisma.token.findUnique({
        where: { id: tokenId },
        select: {
          symbol: true,
          decimals: true
        }
      });
      
      if (!token) {
        console.error(\`[DEBUG] Token not found: \${tokenId}\`);
        return null;
      }
      
      // Find all pairs where this token is involved
      const pairsAsToken0 = await prisma.pair.findMany({
        where: { token0Id: tokenId },
        orderBy: [{ createdAt: 'desc' }, { reserve0: 'desc' }], // Sort by creation date and reserve amount
        include: {
          token1: { select: { symbol: true, decimals: true } }
        }
      });
      
      const pairsAsToken1 = await prisma.pair.findMany({
        where: { token1Id: tokenId },
        orderBy: [{ createdAt: 'desc' }, { reserve1: 'desc' }], // Sort by creation date and reserve amount
        include: {
          token0: { select: { symbol: true, decimals: true } }
        }
      });
      
      console.log(\`[DEBUG] Found \${pairsAsToken0.length} pairs as token0 and \${pairsAsToken1.length} pairs as token1\`);
      
      // Use simplified approach for stablecoins (USDT, USDC, etc.)
      const isStablecoin = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(token.symbol?.toUpperCase() || '');
      
      if (isStablecoin) {
        // For stablecoins, just use highest liquidity pair
        if (pairsAsToken0.length > 0) {
          console.log(\`[DEBUG] Using highest liquidity pair for stablecoin \${token.symbol} as token0: \${pairsAsToken0[0].id}\`);
          return { pairId: pairsAsToken0[0].id, isToken0: true };
        }
        
        if (pairsAsToken1.length > 0) {
          console.log(\`[DEBUG] Using highest liquidity pair for stablecoin \${token.symbol} as token1: \${pairsAsToken1[0].id}\`);
          return { pairId: pairsAsToken1[0].id, isToken0: false };
        }
      }
      
      // For other tokens (including KKUB), prefer pairs with stablecoins
      const stablecoinSymbols = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'];
      
      // Look for pairs with stablecoins as token1
      for (const pair of pairsAsToken0) {
        if (stablecoinSymbols.includes(pair.token1.symbol?.toUpperCase() || '')) {
          console.log(\`[DEBUG] Found pair with stablecoin \${pair.token1.symbol} for token \${token.symbol}\`);
          return { pairId: pair.id, isToken0: true };
        }
      }
      
      // Look for pairs with stablecoins as token0
      for (const pair of pairsAsToken1) {
        if (stablecoinSymbols.includes(pair.token0.symbol?.toUpperCase() || '')) {
          console.log(\`[DEBUG] Found pair with stablecoin \${pair.token0.symbol} for token \${token.symbol}\`);
          return { pairId: pair.id, isToken0: false };
        }
      }
      
      // If no stablecoin pairs found, fall back to highest liquidity pair
      if (pairsAsToken0.length > 0) {
        console.log(\`[DEBUG] Using highest liquidity pair as token0: \${pairsAsToken0[0].id}\`);
        return { pairId: pairsAsToken0[0].id, isToken0: true };
      }
      
      if (pairsAsToken1.length > 0) {
        console.log(\`[DEBUG] Using highest liquidity pair as token1: \${pairsAsToken1[0].id}\`);
        return { pairId: pairsAsToken1[0].id, isToken0: false };
      }
      
      console.error(\`[DEBUG] No pairs found for token \${tokenId}\`);
      return null;
    } catch (error) {
      console.error('[DEBUG] Error finding best price data pair:', error);
      return null;
    }
  }`;

  // Replace the existing method
  const methodStartPattern = /static async findBestPriceDataPair\(/;
  const methodEndPattern = /\n  }/;
  
  let inMethod = false;
  let methodDepth = 0;
  let methodStart = -1;
  let methodEnd = -1;
  
  // Find the method boundaries
  const lines = originalContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (methodStartPattern.test(line)) {
      methodStart = i;
      inMethod = true;
      methodDepth = 1;
    } else if (inMethod) {
      if (line.includes('{')) {
        methodDepth++;
      }
      if (line.includes('}')) {
        methodDepth--;
        if (methodDepth === 0) {
          methodEnd = i;
          break;
        }
      }
    }
  }
  
  // Only proceed if we found the method
  if (methodStart >= 0 && methodEnd >= 0) {
    console.log(`Found method at lines ${methodStart} to ${methodEnd}`);
    
    // Replace the method
    const modifiedContent = [
      ...lines.slice(0, methodStart),
      ...improvedMethodContent.split('\n'),
      ...lines.slice(methodEnd + 1)
    ].join('\n');
    
    // Write the modified content back to the file
    console.log('Writing modified content back to file...');
    fs.writeFileSync(SERVICE_PATH, modifiedContent);
    
    console.log('Chart display fix applied successfully!');
    console.log('Please restart your server for changes to take effect.');
  } else {
    console.error('Could not find the findBestPriceDataPair method in the file.');
  }
}

main().catch(console.error); 