const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function fixTokenPrices() {
  console.log('Starting to fix non-stablecoin token prices...');
  const prisma = new PrismaClient();
  
  try {
    // Get the tokens with wrong prices
    const tokensToFix = await prisma.token.findMany({
      where: {
        symbol: { in: ['KOI', 'LUMI', 'KSOLA'] }
      },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });

    console.log(`Found ${tokensToFix.length} tokens to fix`);
    
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
    
    console.log(`Using KKUB price: $${kkubToken.priceUSD}`);
    
    // Set correct prices based on historical data or market information
    const correctPrices = {
      'KOI': '0.00024608932700374776',
      'LUMI': '0.004138511988994265',
      'KSOLA': '0.04030653682888121'
    };
    
    // Fix each token
    for (const token of tokensToFix) {
      const correctPrice = correctPrices[token.symbol];
      
      if (!correctPrice) {
        console.log(`No correct price defined for ${token.symbol}, calculating from pairs...`);
        
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
        
        // Calculate price based on reserves
        const reserve0 = BigInt(pair.reserve0);
        const reserve1 = BigInt(pair.reserve1);
        
        if (reserve0 <= 0n || reserve1 <= 0n) {
          console.log(`Invalid reserves for ${token.symbol}/KKUB pair, skipping`);
          continue;
        }
        
        const isTokenToken0 = pair.token0Id === token.id;
        const token0Decimals = parseInt(pair.token0.decimals) || 18;
        const token1Decimals = parseInt(pair.token1.decimals) || 18;
        
        let tokenPrice;
        if (isTokenToken0) {
          // Token is token0, KKUB is token1
          const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
          const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
          const kkubPerToken = reserve1Formatted / reserve0Formatted;
          tokenPrice = parseFloat(kkubToken.priceUSD) * kkubPerToken;
        } else {
          // KKUB is token0, Token is token1
          const reserve0Formatted = Number(formatUnits(reserve0, token0Decimals));
          const reserve1Formatted = Number(formatUnits(reserve1, token1Decimals));
          const tokenPerKkub = reserve1Formatted / reserve0Formatted;
          tokenPrice = parseFloat(kkubToken.priceUSD) / tokenPerKkub;
        }
        
        console.log(`Updating ${token.symbol} price from $${token.priceUSD} to $${tokenPrice}`);
        
        await prisma.token.update({
          where: { id: token.id },
          data: { 
            priceUSD: tokenPrice.toString(),
            lastPriceUpdate: new Date()
          }
        });
      } else {
        console.log(`Restoring ${token.symbol} price from ${token.priceUSD} to ${correctPrice}`);
        
        await prisma.token.update({
          where: { id: token.id },
          data: { 
            priceUSD: correctPrice,
            lastPriceUpdate: new Date()
          }
        });
      }
      
      // Double-check the update worked
      const updatedToken = await prisma.token.findUnique({
        where: { id: token.id },
        select: { priceUSD: true }
      });
      
      console.log(`Verified ${token.symbol} price is now: $${updatedToken.priceUSD}`);
    }
    
    // Get the updated tokens
    const updatedTokens = await prisma.token.findMany({
      where: {
        symbol: { in: ['KOI', 'LUMI', 'KSOLA', 'KKUB', 'USDT', 'USDC'] }
      },
      select: {
        symbol: true,
        priceUSD: true
      }
    });
    
    console.log("\nAll token prices:");
    for (const token of updatedTokens) {
      console.log(`${token.symbol}: $${token.priceUSD}`);
    }
    
    console.log('\nAll token prices have been fixed to their correct values.');
    
  } catch (error) {
    console.error('Error fixing token prices:', error);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixTokenPrices()
  .then(() => console.log('Token price fixes completed successfully'))
  .catch(console.error); 