const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function updateRealPrices() {
  console.log('Starting to update token prices based on actual on-chain reserves...');
  const prisma = new PrismaClient();
  
  try {
    // Get stablecoins
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
    
    // First calculate exact stablecoin prices based on current reserves
    for (const stablecoin of stablecoins) {
      console.log(`\nAnalyzing ${stablecoin.symbol} pair with KKUB...`);
      
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
      
      // Get current reserves from pair
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);
      
      if (reserve0 <= 0n || reserve1 <= 0n) {
        console.log(`Invalid reserves for ${stablecoin.symbol}/KKUB pair, skipping`);
        continue;
      }
      
      const isStablecoinToken0 = pair.token0Id === stablecoin.id;
      const token0Decimals = parseInt(pair.token0.decimals) || 18;
      const token1Decimals = parseInt(pair.token1.decimals) || 18;

      // Calculate current exchange rate based on reserves
      let exchangeRate;
      let stablecoinPrice;
      
      if (isStablecoinToken0) {
        // Stablecoin is token0, KKUB is token1
        const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
        const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
        
        // Exchange rate: how much KKUB per stablecoin
        exchangeRate = reserve1Formatted / reserve0Formatted;
        console.log(`Current exchange rate: ${exchangeRate} KKUB per ${stablecoin.symbol}`);
        
        // Stablecoin price = KKUB price × exchange rate
        stablecoinPrice = parseFloat(kkubToken.priceUSD) * exchangeRate;
      } else {
        // KKUB is token0, Stablecoin is token1
        const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
        const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
        
        // Exchange rate: how much stablecoin per KKUB
        exchangeRate = reserve1Formatted / reserve0Formatted;
        console.log(`Current exchange rate: ${exchangeRate} ${stablecoin.symbol} per KKUB`);
        
        // Stablecoin price = KKUB price / exchange rate
        stablecoinPrice = parseFloat(kkubToken.priceUSD) / exchangeRate;
      }
      
      console.log(`Calculated ${stablecoin.symbol} price: $${stablecoinPrice}`);
      
      // Update stablecoin price in database
      console.log(`Updating ${stablecoin.symbol} price from $${stablecoin.priceUSD} to $${stablecoinPrice}`);
      
      await prisma.token.update({
        where: { id: stablecoin.id },
        data: { priceUSD: stablecoinPrice.toString() }
      });
      
      console.log(`Updated ${stablecoin.symbol} price to $${stablecoinPrice}`);
    }
    
    // Get the updated stablecoin prices
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
    
    console.log("\nUpdated stablecoin prices:");
    for (const stablecoin of updatedStablecoins) {
      console.log(`${stablecoin.symbol}: $${stablecoin.priceUSD}`);
    }
    
    console.log('\nAll prices updated based on actual on-chain reserves.');
    
  } catch (error) {
    console.error('Error updating token prices:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
updateRealPrices()
  .then(() => console.log('Price update completed successfully'))
  .catch(console.error); 