import { PrismaClient } from '@prisma/client';
import { formatUnits } from 'viem';

async function fixStablecoinPrices() {
  console.log('Starting stablecoin price fix using viem...');
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
    
    console.log(`Found KKUB token with price ${kkubToken.priceUSD}`);
    
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
          token1: true,
          priceSnapshots: {
            take: 1,
            orderBy: { timestamp: 'desc' }
          }
        }
      });
      
      if (!pair) {
        console.log(`No pair found for ${stablecoin.symbol}-KKUB`);
        continue;
      }
      
      console.log(`Found pair ${pair.address} (${pair.token0.symbol}-${pair.token1.symbol})`);
      
      // Calculate price based on reserves (more accurate for stablecoins)
      const isToken0 = pair.token0Id === stablecoin.id;
      const reserve0 = BigInt(pair.reserve0);
      const reserve1 = BigInt(pair.reserve1);
      
      if (reserve0 <= 0n || reserve1 <= 0n) {
        console.log(`Pair has invalid reserves: ${pair.reserve0}, ${pair.reserve1}`);
        continue;
      }
      
      const token0Decimals = pair.token0.decimals || 18;
      const token1Decimals = pair.token1.decimals || 18;
      
      try {
        let priceFromReserves: number;
        
        if (isToken0) {
          // Stablecoin is token0, KKUB is token1
          // Calculate how much KKUB per stablecoin
          // For 1 stablecoin, we get (reserve1/reserve0) of KKUB
          const kkubPerStablecoin = Number(formatUnits(
            reserve1 * BigInt(10**token0Decimals) / reserve0, 
            token1Decimals
          ));
          
          // The price in USD is (KKUB per stablecoin) * (KKUB price in USD)
          priceFromReserves = kkubPerStablecoin * parseFloat(kkubToken.priceUSD);
        } else {
          // Stablecoin is token1, KKUB is token0
          // Calculate how much KKUB per stablecoin
          // For 1 stablecoin, we get (reserve0/reserve1) of KKUB
          const kkubPerStablecoin = Number(formatUnits(
            reserve0 * BigInt(10**token1Decimals) / reserve1, 
            token0Decimals
          ));
          
          // The price in USD is (KKUB per stablecoin) * (KKUB price in USD)
          priceFromReserves = kkubPerStablecoin * parseFloat(kkubToken.priceUSD);
        }
        
        console.log(`Calculated price from reserves: ${priceFromReserves}`);
        
        // As a sanity check for stablecoins, the price should be reasonably close to $1
        // We'll accept a wider range for liquidity-constrained markets
        if (priceFromReserves > 0.5 && priceFromReserves < 1.5) {
          await prisma.token.update({
            where: { id: stablecoin.id },
            data: { 
              priceUSD: priceFromReserves.toString(),
              lastPriceUpdate: new Date()
            }
          });
          console.log(`✅ Updated price for ${stablecoin.symbol} to ${priceFromReserves}`);
        } else {
          console.log(`❌ Calculated price ${priceFromReserves} is outside reasonable range for a stablecoin`);
          
          // For stablecoins, if the market-derived price is unreasonable, 
          // we can use a fallback value close to $1.00 but note this in logs
          console.log(`Using fallback price of 1.00 for ${stablecoin.symbol}`);
          await prisma.token.update({
            where: { id: stablecoin.id },
            data: { 
              priceUSD: "1.00",
              lastPriceUpdate: new Date()
            }
          });
          console.log(`✅ Updated price for ${stablecoin.symbol} to fallback value 1.00`);
        }
      } catch (error) {
        console.error(`Error calculating price for ${stablecoin.symbol}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Error fixing stablecoin prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
fixStablecoinPrices()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 