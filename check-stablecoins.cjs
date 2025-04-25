require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// Helper function to safely stringify BigInt values
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  , 2);
}

async function checkStablecoins() {
  try {
    console.log("Checking stablecoin configuration...");
    
    // First check the tokenPriceUtils.ts file to see the STABLECOIN_ADDRESSES constant
    const utilsPath = path.join(__dirname, 'src', 'lib', 'utils', 'tokenPriceUtils.ts');
    if (fs.existsSync(utilsPath)) {
      const content = fs.readFileSync(utilsPath, 'utf8');
      console.log("\nTokenPriceUtils stablecoin addresses:");
      
      // Extract STABLECOIN_ADDRESSES from the file
      const addressMatch = content.match(/STABLECOIN_ADDRESSES: string\[\] = \[([\s\S]*?)\]/);
      if (addressMatch && addressMatch[1]) {
        console.log(addressMatch[1].trim());
      } else {
        console.log("Could not find STABLECOIN_ADDRESSES in the file");
      }
      
      // Extract STABLECOIN_SYMBOLS from the file
      const symbolsMatch = content.match(/STABLECOIN_SYMBOLS = \[([\s\S]*?)\]/);
      if (symbolsMatch && symbolsMatch[1]) {
        console.log("\nTokenPriceUtils stablecoin symbols:");
        console.log(symbolsMatch[1].trim());
      } else {
        console.log("Could not find STABLECOIN_SYMBOLS in the file");
      }
    } else {
      console.log("Could not find tokenPriceUtils.ts file");
    }
    
    // Get all stablecoin tokens
    console.log("\nFinding stablecoin tokens in database:");
    const stablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC', 'DAI', 'BUSD'] }
      },
      select: {
        id: true,
        address: true,
        symbol: true,
        priceUSD: true
      }
    });

    console.log(`Found ${stablecoins.length} stablecoins`);
    stablecoins.forEach(coin => {
      console.log(`${coin.symbol}: ${coin.address} (priceUSD: ${coin.priceUSD})`);
    });
    
    // Get KKUB token
    const kkub = await prisma.token.findFirst({
      where: { symbol: 'KKUB' },
      select: {
        id: true,
        address: true,
        symbol: true
      }
    });
    
    if (!kkub) {
      console.log("KKUB token not found");
      return;
    }
    
    console.log(`\nFound KKUB token: ${kkub.symbol} (${kkub.address})`);
    
    // Find pairs between KKUB and stablecoins
    console.log("\nChecking for KKUB-stablecoin pairs:");
    for (const stablecoin of stablecoins) {
      // Check as token0-token1
      const pairsAsToken0 = await prisma.pair.findMany({
        where: {
          token0Id: kkub.id,
          token1Id: stablecoin.id
        },
        select: {
          id: true,
          address: true,
          token0: { select: { symbol: true } },
          token1: { select: { symbol: true } }
        }
      });
      
      // Check as token1-token0
      const pairsAsToken1 = await prisma.pair.findMany({
        where: {
          token0Id: stablecoin.id,
          token1Id: kkub.id
        },
        select: {
          id: true,
          address: true,
          token0: { select: { symbol: true } },
          token1: { select: { symbol: true } }
        }
      });
      
      const pairs = [...pairsAsToken0, ...pairsAsToken1];
      console.log(`Pairs between KKUB and ${stablecoin.symbol}: ${pairs.length}`);
      
      for (const pair of pairs) {
        console.log(`  Pair: ${pair.address} (${pair.token0.symbol}-${pair.token1.symbol})`);
        
        // Check if there are snapshots for this pair
        const snapshots = await prisma.priceSnapshot.findMany({
          where: { pairId: pair.id },
          orderBy: { timestamp: 'desc' },
          take: 3,
          select: { 
            timestamp: true,
            price0: true,
            price1: true
          }
        });
        
        console.log(`  Snapshots: ${snapshots.length}`);
        if (snapshots.length > 0) {
          console.log(`  Recent snapshot: ${safeStringify(snapshots[0])}`);
        }
      }
    }
    
    // Check tokenPriceChart resolver for a token to see if it's returning data
    console.log("\nTesting tokenPriceChart with a token...");
    // Get a token with price data
    const testTokens = await prisma.token.findMany({
      take: 3,
      select: { 
        id: true, 
        address: true, 
        symbol: true, 
        priceUSD: true 
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (testTokens.length > 0) {
      console.log("Test tokens to try in GraphQL tokenPriceChart:");
      testTokens.forEach(token => {
        console.log(`${token.symbol}: ${token.address} (priceUSD: ${token.priceUSD})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStablecoins().catch(e => {
  console.error(e);
  process.exit(1);
}); 