const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function fixStablecoinPrices() {
  console.log('Starting token price correction based on trading activity...');
  const prisma = new PrismaClient();
  
  try {
    // First, let's check what entities are available in the schema
    console.log('Checking database schema...');
    
    // Get reference stablecoins
    const stablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC'] }
      },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });

    console.log(`Found ${stablecoins.length} stablecoins to analyze`);
    
    // Get KKUB token
    const kkubToken = await prisma.token.findFirst({
      where: { symbol: 'KKUB' },
      select: {
        id: true,
        address: true,
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
    
    // For each stablecoin pair with KKUB, fix its price and corresponding KKUB price
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
      
      // Calculate price based on the current reserves in the pool and UI screenshot values
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);
      
      if (reserve0 <= 0n || reserve1 <= 0n) {
        console.log(`Invalid reserves for ${stablecoin.symbol}/KKUB pair, skipping`);
        continue;
      }
      
      const isStablecoinToken0 = pair.token0Id === stablecoin.id;
      const token0Decimals = pair.token0.decimals || 18;
      const token1Decimals = pair.token1.decimals || 18;
      
      let ratio;
      
      if (isStablecoinToken0) {
        // Stablecoin is token0, KKUB is token1
        const adjustedReserve1 = reserve1 * BigInt(10 ** token0Decimals);
        const rawRatio = adjustedReserve1 / reserve0;
        ratio = Number(formatUnits(rawRatio, token1Decimals));
        console.log(`Current ratio: ${ratio} KKUB per ${stablecoin.symbol}`);
      } else {
        // KKUB is token0, Stablecoin is token1
        const adjustedReserve0 = reserve0 * BigInt(10 ** token1Decimals);
        const rawRatio = adjustedReserve0 / reserve1;
        ratio = Number(formatUnits(rawRatio, token0Decimals));
        console.log(`Current ratio: ${ratio} ${stablecoin.symbol} per KKUB`);
      }
      
      // From the screenshot, calculate the stablecoin/KKUB ratio
      let stablecoinValue = 1.0; // Assume stablecoin should be $1
      let kkubValue;
      
      if (stablecoin.symbol === 'USDT') {
        // From screenshot: 1 USDT = 0.689842591835 KKUB
        if (isStablecoinToken0) {
          // Here, ratio is KKUB per USDT, so stablecoinValue = 1
          kkubValue = ratio * stablecoinValue;
        } else {
          // Here, ratio is USDT per KKUB
          kkubValue = stablecoinValue / ratio;
        }
      } else if (stablecoin.symbol === 'USDC') {
        // From screenshot: 1 USDC = 0.343749764593 KKUB
        if (isStablecoinToken0) {
          // Here, ratio is KKUB per USDC, so stablecoinValue = 1
          kkubValue = ratio * stablecoinValue;
        } else {
          // Here, ratio is USDC per KKUB
          kkubValue = stablecoinValue / ratio;
        }
      } else {
        console.log(`Unknown stablecoin ${stablecoin.symbol}, skipping`);
        continue;
      }
      
      console.log(`Calculated ${stablecoin.symbol} price: $${stablecoinValue}`);
      console.log(`Calculated KKUB price from ${stablecoin.symbol}: $${kkubValue}`);
      
      // Update stablecoin price
      await prisma.token.update({
        where: { id: stablecoin.id },
        data: { priceUSD: stablecoinValue }
      });
      
      console.log(`Updated ${stablecoin.symbol} price to $${stablecoinValue}`);
    }
    
    // After updating stablecoins, get the updated values
    const updatedStablecoins = await prisma.token.findMany({
      where: {
        symbol: { in: ['USDT', 'USDC'] }
      },
      select: {
        id: true,
        symbol: true,
        priceUSD: true
      }
    });
    
    // Get all pairs with stablecoins and KKUB
    const stablecoinKkubPairs = await prisma.pair.findMany({
      where: {
        OR: updatedStablecoins.map(sc => ({
          OR: [
            { token0Id: sc.id, token1Id: kkubToken.id },
            { token0Id: kkubToken.id, token1Id: sc.id }
          ]
        }))
      },
      include: {
        token0: true,
        token1: true
      }
    });
    
    // Calculate KKUB price from each stablecoin pair using current stablecoin values
    let kkubPriceEstimates = [];
    
    for (const pair of stablecoinKkubPairs) {
      const stablecoin = pair.token0Id === kkubToken.id ? pair.token1 : pair.token0;
      const stablecoinData = updatedStablecoins.find(sc => sc.id === stablecoin.id);
      
      if (!stablecoinData) continue;
      
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);
      
      if (reserve0 <= 0n || reserve1 <= 0n) continue;
      
      const isStablecoinToken0 = pair.token0Id === stablecoin.id;
      const token0Decimals = pair.token0.decimals || 18;
      const token1Decimals = pair.token1.decimals || 18;
      
      let kkubPrice;
      if (isStablecoinToken0) {
        // Stablecoin is token0, KKUB is token1
        const adjustedReserve1 = reserve1 * BigInt(10 ** token0Decimals);
        const rawRatio = adjustedReserve1 / reserve0;
        const ratio = Number(formatUnits(rawRatio, token1Decimals));
        
        // KKUB price = stablecoin price / ratio
        kkubPrice = stablecoinData.priceUSD / ratio;
      } else {
        // KKUB is token0, Stablecoin is token1
        const adjustedReserve0 = reserve0 * BigInt(10 ** token1Decimals);
        const rawRatio = adjustedReserve0 / reserve1;
        const ratio = Number(formatUnits(rawRatio, token0Decimals));
        
        // KKUB price = stablecoin price * ratio
        kkubPrice = stablecoinData.priceUSD * ratio;
      }
      
      console.log(`KKUB price from ${stablecoin.symbol} pair: $${kkubPrice}`);
      kkubPriceEstimates.push(kkubPrice);
    }
    
    if (kkubPriceEstimates.length === 0) {
      console.log('Could not calculate KKUB price from any stablecoin pair');
      return;
    }
    
    // Take the median KKUB price to avoid outliers
    kkubPriceEstimates.sort((a, b) => a - b);
    const medianKkubPrice = kkubPriceEstimates.length % 2 === 0
      ? (kkubPriceEstimates[kkubPriceEstimates.length / 2 - 1] + kkubPriceEstimates[kkubPriceEstimates.length / 2]) / 2
      : kkubPriceEstimates[Math.floor(kkubPriceEstimates.length / 2)];
    
    console.log(`\nCalculated median KKUB price: $${medianKkubPrice}`);
    console.log(`Updating KKUB price from $${kkubToken.priceUSD} to $${medianKkubPrice}`);
    
    // Update KKUB price
    await prisma.token.update({
      where: { id: kkubToken.id },
      data: { priceUSD: medianKkubPrice }
    });
    
    // Now recalculate all other token prices based on KKUB pairs
    const allTokens = await prisma.token.findMany({
      where: {
        symbol: { notIn: ['USDT', 'USDC', 'KKUB'] }
      },
      select: {
        id: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    console.log(`\nRecalculating prices for ${allTokens.length} tokens based on new KKUB price...`);
    
    for (const token of allTokens) {
      // Find token-KKUB pair
      const pair = await prisma.pair.findFirst({
        where: {
          OR: [
            { token0Id: token.id, token1Id: kkubToken.id },
            { token0Id: kkubToken.id, token1Id: token.id }
          ]
        },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) {
        console.log(`No pair found for ${token.symbol}/KKUB, skipping`);
        continue;
      }
      
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);
      
      if (reserve0 <= 0n || reserve1 <= 0n) {
        console.log(`Invalid reserves for ${token.symbol}/KKUB pair, skipping`);
        continue;
      }
      
      const isTokenToken0 = pair.token0Id === token.id;
      const token0Decimals = pair.token0.decimals || 18;
      const token1Decimals = pair.token1.decimals || 18;
      
      let tokenPrice;
      if (isTokenToken0) {
        // Token is token0, KKUB is token1
        const adjustedReserve1 = reserve1 * BigInt(10 ** token0Decimals);
        const rawRatio = adjustedReserve1 / reserve0;
        const ratio = Number(formatUnits(rawRatio, token1Decimals));
        
        // Token price = KKUB price / ratio
        tokenPrice = medianKkubPrice / ratio;
      } else {
        // KKUB is token0, Token is token1
        const adjustedReserve0 = reserve0 * BigInt(10 ** token1Decimals);
        const rawRatio = adjustedReserve0 / reserve1;
        const ratio = Number(formatUnits(rawRatio, token0Decimals));
        
        // Token price = KKUB price / ratio
        tokenPrice = medianKkubPrice / ratio;
      }
      
      console.log(`Updating ${token.symbol} price from $${token.priceUSD} to $${tokenPrice}`);
      
      // Update token price
      await prisma.token.update({
        where: { id: token.id },
        data: { priceUSD: tokenPrice }
      });
    }
    
    console.log('\nAll token prices have been recalculated');
    
  } catch (error) {
    console.error('Error fixing token prices:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the price correction
fixStablecoinPrices()
  .then(() => {
    console.log('Price correction completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Price correction failed:', error);
    process.exit(1);
  }); 