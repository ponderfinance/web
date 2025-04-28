const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function updateStablecoinPrices() {
  console.log('Starting stablecoin price update based on KKUB pairs...');
  const prisma = new PrismaClient();
  
  try {
    // Find KKUB token for reference
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
      console.error('Could not find KKUB token');
      return;
    }
    
    if (!kkubToken.priceUSD || parseFloat(kkubToken.priceUSD) === 0) {
      console.error('KKUB token does not have a valid price');
      return;
    }
    
    console.log(`Found KKUB token with price $${kkubToken.priceUSD}`);
    
    // Find stablecoins
    const stablecoins = await prisma.token.findMany({
      where: {
        symbol: {
          in: ['USDT', 'USDC']
        }
      },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    console.log(`Found ${stablecoins.length} stablecoins`);
    
    // Process each stablecoin
    for (const stablecoin of stablecoins) {
      console.log(`\nProcessing ${stablecoin.symbol}...`);
      console.log(`Current price in DB: ${stablecoin.priceUSD || 'Not set'}`);
      
      // Find pair with KKUB
      const pair = await prisma.pair.findFirst({
        where: {
          OR: [
            {
              token0Id: stablecoin.id,
              token1Id: kkubToken.id
            },
            {
              token0Id: kkubToken.id,
              token1Id: stablecoin.id
            }
          ]
        },
        include: {
          token0: true,
          token1: true
        }
      });
      
      if (!pair) {
        console.log(`No pair found for ${stablecoin.symbol}-KKUB`);
        
        // Try to find pairs with other tokens that have prices
        const otherPairs = await prisma.pair.findMany({
          where: {
            OR: [
              { token0Id: stablecoin.id },
              { token1Id: stablecoin.id }
            ]
          },
          include: {
            token0: {
              select: {
                id: true,
                symbol: true,
                priceUSD: true,
                decimals: true
              }
            },
            token1: {
              select: {
                id: true,
                symbol: true,
                priceUSD: true,
                decimals: true
              }
            }
          }
        });
        
        console.log(`Found ${otherPairs.length} other pairs for ${stablecoin.symbol}`);
        
        // Find a pair where the counterpart token has a price
        let derivedPrice = 0;
        
        for (const otherPair of otherPairs) {
          const isToken0 = otherPair.token0Id === stablecoin.id;
          const counterToken = isToken0 ? otherPair.token1 : otherPair.token0;
          
          if (counterToken.priceUSD && parseFloat(counterToken.priceUSD) > 0) {
            console.log(`Using pair with ${counterToken.symbol} to derive price`);
            
            try {
              // Calculate price from reserves
              const reserve0 = BigInt(otherPair.reserve0);
              const reserve1 = BigInt(otherPair.reserve1);
              
              if (reserve0 <= 0n || reserve1 <= 0n) {
                console.log(`Pair has invalid reserves`);
                continue;
              }
              
              const token0Decimals = otherPair.token0.decimals || 18;
              const token1Decimals = otherPair.token1.decimals || 18;
              
              // Calculate price based on which token is the stablecoin
              let ratio;
              if (isToken0) {
                // stablecoin = token0, calculate token0 in terms of token1
                ratio = Number(formatUnits(reserve1 * BigInt(10**token0Decimals) / reserve0, token1Decimals));
              } else {
                // stablecoin = token1, calculate token1 in terms of token0
                ratio = Number(formatUnits(reserve0 * BigInt(10**token1Decimals) / reserve1, token0Decimals));
              }
              
              // Get price in USD
              const counterTokenPriceUSD = parseFloat(counterToken.priceUSD);
              const calculatedPrice = isToken0 ? ratio * counterTokenPriceUSD : counterTokenPriceUSD / ratio;
              
              console.log(`Calculated price: $${calculatedPrice}`);
              
              // Accept any non-zero price
              if (calculatedPrice > 0) {
                derivedPrice = calculatedPrice;
                break;
              } else {
                console.log(`Invalid zero or negative price`);
              }
            } catch (error) {
              console.error(`Error calculating price:`, error);
            }
          }
        }
        
        if (derivedPrice > 0) {
          await prisma.token.update({
            where: { id: stablecoin.id },
            data: {
              priceUSD: derivedPrice.toString(),
              lastPriceUpdate: new Date()
            }
          });
          console.log(`✅ Updated price for ${stablecoin.symbol} to ${derivedPrice}`);
        } else {
          console.log(`❌ Could not derive a valid price for ${stablecoin.symbol}`);
        }
        
        continue;
      }
      
      console.log(`Found pair ${pair.address} (${pair.token0.symbol}-${pair.token1.symbol})`);
      
      try {
        // Calculate price based on reserves
        const isToken0 = pair.token0Id === stablecoin.id;
        const reserve0 = BigInt(pair.reserve0);
        const reserve1 = BigInt(pair.reserve1);
        
        if (reserve0 <= 0n || reserve1 <= 0n) {
          console.log(`Pair has invalid reserves: ${pair.reserve0}, ${pair.reserve1}`);
          continue;
        }
        
        const token0Decimals = pair.token0.decimals || 18;
        const token1Decimals = pair.token1.decimals || 18;
        
        // Calculate price based on which token is the stablecoin
        let priceInKKUB;
        if (isToken0) {
          // stablecoin = token0, calculate how much KKUB per stablecoin
          priceInKKUB = Number(formatUnits(reserve1 * BigInt(10**token0Decimals) / reserve0, token1Decimals));
        } else {
          // stablecoin = token1, calculate how much stablecoin per KKUB
          priceInKKUB = Number(formatUnits(reserve0 * BigInt(10**token1Decimals) / reserve1, token0Decimals));
        }
        
        // Convert price to USD using KKUB price
        const kkubPriceUSD = parseFloat(kkubToken.priceUSD);
        let priceFromReserves;
        
        if (isToken0) {
          // If stablecoin is token0, price = KKUB per stablecoin * KKUB price
          priceFromReserves = priceInKKUB * kkubPriceUSD;
        } else {
          // If stablecoin is token1, price = KKUB price / stablecoin per KKUB
          priceFromReserves = kkubPriceUSD / priceInKKUB;
        }
        
        console.log(`Calculated price from reserves: $${priceFromReserves}`);
        
        // Update the price as long as it's not zero or negative
        if (priceFromReserves > 0) {
          await prisma.token.update({
            where: { id: stablecoin.id },
            data: { 
              priceUSD: priceFromReserves.toString(),
              lastPriceUpdate: new Date()
            }
          });
          console.log(`✅ Updated price for ${stablecoin.symbol} to ${priceFromReserves}`);
        } else {
          console.log(`❌ Calculated price ${priceFromReserves} is invalid (zero or negative)`);
        }
      } catch (error) {
        console.error(`Error calculating price for ${stablecoin.symbol}:`, error);
      }
    }
    
    // Print all token prices
    const allTokens = await prisma.token.findMany({
      select: {
        symbol: true,
        address: true,
        priceUSD: true,
        lastPriceUpdate: true
      }
    });
    
    console.log('\nCurrent token prices:');
    allTokens.forEach(token => {
      console.log(`${token.symbol || token.address.slice(0, 8)}: $${token.priceUSD || 'No price'} (Updated: ${token.lastPriceUpdate ? token.lastPriceUpdate.toISOString() : 'Never'})`);
    });
    
  } catch (error) {
    console.error('Error updating stablecoin prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
updateStablecoinPrices()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 