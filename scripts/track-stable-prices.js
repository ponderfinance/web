const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function trackStablecoinPrices() {
  console.log('Starting stablecoin price tracking at ' + new Date().toISOString());
  const prisma = new PrismaClient();
  
  try {
    // Get stablecoins
    const stablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC'] }
      },
      select: {
        id: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });

    console.log(`Found ${stablecoins.length} stablecoins to track`);
    
    // Get KKUB token
    const kkubToken = await prisma.token.findFirst({
      where: { symbol: 'KKUB' },
      select: {
        id: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    if (!kkubToken) {
      console.log('KKUB token not found');
      return;
    }
    
    console.log(`Current KKUB price: $${kkubToken.priceUSD}`);
    
    // For each stablecoin, get earliest snapshot and current reserves
    for (const stablecoin of stablecoins) {
      console.log(`\nAnalyzing ${stablecoin.symbol} price evolution...`);
      
      // Find stablecoin-KKUB pair
      const pair = await prisma.pair.findFirst({
        where: {
          OR: [
            { token0Id: stablecoin.id, token1Id: kkubToken.id },
            { token0Id: kkubToken.id, token1Id: stablecoin.id }
          ]
        },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) {
        console.log(`No pair found for ${stablecoin.symbol}/KKUB, skipping`);
        continue;
      }
      
      // Get the earliest price snapshot for this pair
      let initialSnapshot = null;
      try {
        const earliestSnapshots = await prisma.priceSnapshot.findMany({
          where: {
            pairId: pair.id
          },
          orderBy: {
            timestamp: 'asc'
          },
          take: 1
        });
        
        if (earliestSnapshots && earliestSnapshots.length > 0) {
          initialSnapshot = earliestSnapshots[0];
          console.log(`Found earliest snapshot from ${new Date(Number(initialSnapshot.timestamp) * 1000).toISOString()}`);
        } else {
          console.log(`No historical price snapshots found for ${stablecoin.symbol}/KKUB pair`);
        }
      } catch (err) {
        console.error(`Error fetching price snapshots: ${err.message}`);
        console.log(`No historical price snapshots could be retrieved for ${stablecoin.symbol}/KKUB pair`);
      }
      
      // Get current reserves directly from the pair
      const currentReserve0 = BigInt(pair.reserve0);
      const currentReserve1 = BigInt(pair.reserve1);
      
      // Determine which token is the stablecoin and which is KKUB
      const isStablecoinToken0 = pair.token0Id === stablecoin.id;
      const token0Decimals = parseInt(pair.token0.decimals) || 18;
      const token1Decimals = parseInt(pair.token1.decimals) || 18;
      
      // For initial snapshot, use the price from the price snapshot
      let initialPrice = 1; // Default to 1:1 if no snapshot is available
      if (initialSnapshot) {
        try {
          if (isStablecoinToken0) {
            // If stablecoin is token0, use price0 (price of token0 in terms of token1)
            initialPrice = Number(formatUnits(BigInt(initialSnapshot.price0), token1Decimals));
            console.log(`Initial price: ${initialPrice} KKUB per ${stablecoin.symbol}`);
          } else {
            // If stablecoin is token1, use price1 (price of token1 in terms of token0)
            initialPrice = Number(formatUnits(BigInt(initialSnapshot.price1), token0Decimals));
            console.log(`Initial price: ${initialPrice} KKUB per ${stablecoin.symbol}`);
          }
        } catch (err) {
          console.error(`Error processing initial price: ${err.message}`);
          console.log(`Using default 1:1 ratio for initial price due to conversion error`);
        }
      } else {
        console.log(`Using default 1:1 ratio for initial price due to missing snapshot`);
      }
      
      // Calculate current price based on reserves
      let currentPrice;
      try {
        if (isStablecoinToken0) {
          // Stablecoin is token0, KKUB is token1
          const reserve0Str = formatUnits(currentReserve0, token0Decimals);
          const reserve1Str = formatUnits(currentReserve1, token1Decimals);
          currentPrice = Number(reserve1Str) / Number(reserve0Str);
          console.log(`Current price: ${currentPrice} KKUB per ${stablecoin.symbol}`);
        } else {
          // KKUB is token0, Stablecoin is token1
          const reserve0Str = formatUnits(currentReserve0, token0Decimals);
          const reserve1Str = formatUnits(currentReserve1, token1Decimals);
          currentPrice = Number(reserve0Str) / Number(reserve1Str);
          console.log(`Current price: ${currentPrice} KKUB per ${stablecoin.symbol}`);
        }
      } catch (err) {
        console.error(`Error calculating current price: ${err.message}`);
        continue;
      }
      
      // Calculate the price change from initial to current
      const priceChange = currentPrice / initialPrice;
      console.log(`Price change ratio: ${priceChange.toFixed(6)}`);
      
      // Calculate USD value - improved method
      let currentStablecoinValueUSD;
      
      // Method 1: Assuming stablecoins should be $1, calculate what the KKUB price would be
      const impliedKkubUSD = isStablecoinToken0 ? 
        1.0 / currentPrice : 
        currentPrice;
      console.log(`Implied KKUB price if ${stablecoin.symbol} = $1: $${impliedKkubUSD.toFixed(6)}`);
      
      // Method 2: Using the known KKUB price from database, calculate stablecoin value
      currentStablecoinValueUSD = isStablecoinToken0 ? 
        kkubToken.priceUSD * currentPrice : 
        kkubToken.priceUSD / currentPrice;
      console.log(`${stablecoin.symbol} value based on KKUB price ($${kkubToken.priceUSD}): $${currentStablecoinValueUSD.toFixed(6)}`);
      
      // Method 3: Using price change from initial value (assuming initial was $1)
      const historicalValue = isStablecoinToken0 ? 
        1.0 / priceChange : 
        1.0 * priceChange;
      console.log(`${stablecoin.symbol} value based on historical price change: $${historicalValue.toFixed(6)}`);
      
      // Compare with the price stored in the database
      console.log(`${stablecoin.symbol} price in database: $${stablecoin.priceUSD}`);
      
      // Calculate difference percentage between methods
      const dbToCurrent = ((stablecoin.priceUSD / currentStablecoinValueUSD) - 1) * 100;
      console.log(`Difference between database and calculated price: ${dbToCurrent.toFixed(2)}%`);
    }
    
    console.log("\nBased on the above analysis, you can see how stablecoin prices have evolved and compare different calculation methods.");
    
  } catch (error) {
    console.error('Error tracking stablecoin prices:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the analysis
trackStablecoinPrices()
  .then(() => console.log('Analysis completed'))
  .catch(console.error); 