import { PrismaClient } from '@prisma/client';
import { formatUnits } from 'viem';

async function fixTokenPrices() {
  console.log('Starting token price fix using viem...');
  const prisma = new PrismaClient();
  
  try {
    // Tokens with pricing issues
    const tokens = await prisma.token.findMany({
      where: {
        OR: [
          { priceUSD: null },
          { priceUSD: '0' }
        ]
      },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true
      }
    });
    
    console.log(`Found ${tokens.length} tokens with missing/zero prices`);
    
    // Process each token
    for (const token of tokens) {
      console.log(`\nProcessing ${token.symbol || token.address}...`);
      
      // Find pairs containing this token
      const pairs = await prisma.pair.findMany({
        where: {
          OR: [
            { token0Id: token.id },
            { token1Id: token.id }
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
      
      if (pairs.length === 0) {
        console.log(`No pairs found for ${token.symbol || token.address}`);
        continue;
      }
      
      console.log(`Found ${pairs.length} pairs for ${token.symbol || token.address}`);
      
      // Try each pair until we calculate a valid price
      let calculatedPrice = 0;
      
      for (const pair of pairs) {
        console.log(`\nTrying pair ${pair.address} (${pair.token0.symbol}-${pair.token1.symbol})...`);
        
        const isToken0 = pair.token0Id === token.id;
        const counterpartToken = isToken0 ? pair.token1 : pair.token0;
        
        // Check if we have a price for the counterpart token
        if (!counterpartToken.priceUSD || parseFloat(counterpartToken.priceUSD) === 0) {
          console.log(`Counterpart token ${counterpartToken.symbol} has no price, skipping pair`);
          continue;
        }
        
        console.log(`Counterpart token ${counterpartToken.symbol} price: ${counterpartToken.priceUSD}`);
        
        // Get latest snapshot
        if (pair.priceSnapshots.length === 0) {
          console.log(`No price snapshots found for pair ${pair.address}, skipping`);
          continue;
        }
        
        const snapshot = pair.priceSnapshots[0];
        console.log(`Latest snapshot: ${JSON.stringify(snapshot)}`);
        
        // Get the raw price from the snapshot
        const rawPrice = isToken0 ? snapshot.price0 : snapshot.price1;
        console.log(`Raw ${isToken0 ? 'price0' : 'price1'}: ${rawPrice}`);
        
        try {
          // Convert the raw price to a proper decimal using viem
          const decimals = isToken0 ? pair.token0.decimals : pair.token1.decimals;
          console.log(`Using ${decimals} decimals for normalization`);
          
          // Use viem's formatUnits to handle the large blockchain integer
          // For token prices, we generally need to use 18 decimals
          const normalizedPrice = formatUnits(BigInt(rawPrice), (decimals || 18) + (isToken0 ? 0 : 0));
          console.log(`Normalized price: ${normalizedPrice}`);
          
          // Calculate the final USD price using the counterpart token
          // If we're token0, then price0 represents how much of token1 we get for 1 token0
          // If we're token1, then price1 represents how much of token0 we get for 1 token1
          const counterpartPriceUSD = parseFloat(counterpartToken.priceUSD);
          let finalPrice = 0;
          
          if (isToken0) {
            // price0 represents how much of token1 we get for 1 token0
            // So the USD value is price0 * token1's USD price
            finalPrice = parseFloat(normalizedPrice) * counterpartPriceUSD;
          } else {
            // price1 represents how much of token0 we get for 1 token1
            // So the USD value is price1 * token0's USD price
            finalPrice = parseFloat(normalizedPrice) * counterpartPriceUSD;
          }
          
          console.log(`Calculated price in USD: ${finalPrice}`);
          
          if (finalPrice > 0 && finalPrice < 1000000) {  // Sanity check
            calculatedPrice = finalPrice;
            console.log(`Found valid price: ${calculatedPrice}`);
            break;  // Use the first valid price we find
          } else {
            console.log(`Price out of reasonable range: ${finalPrice}, trying another approach`);
            
            // Alternative calculation based on reserves ratio
            const reserve0 = BigInt(pair.reserve0);
            const reserve1 = BigInt(pair.reserve1);
            
            const token0Decimals = pair.token0.decimals || 18;
            const token1Decimals = pair.token1.decimals || 18;
            
            if (isToken0) {
              // 1 token0 = (reserve1 / reserve0) token1
              // Use viem to format these large numbers
              const ratio = Number(formatUnits(reserve1 * BigInt(10**token0Decimals) / reserve0, token1Decimals));
              finalPrice = ratio * counterpartPriceUSD;
            } else {
              // 1 token1 = (reserve0 / reserve1) token0
              // Use viem to format these large numbers
              const ratio = Number(formatUnits(reserve0 * BigInt(10**token1Decimals) / reserve1, token0Decimals));
              finalPrice = ratio * counterpartPriceUSD;
            }
            
            console.log(`Recalculated from reserves: ${finalPrice}`);
            
            if (finalPrice > 0 && finalPrice < 1000000) {
              calculatedPrice = finalPrice;
              console.log(`Found valid price from reserves: ${calculatedPrice}`);
              break;
            }
          }
        } catch (error) {
          console.error(`Error calculating price from snapshot:`, error);
        }
      }
      
      // Update the token price if we calculated a valid one
      if (calculatedPrice > 0) {
        await prisma.token.update({
          where: { id: token.id },
          data: { 
            priceUSD: calculatedPrice.toString(),
            lastPriceUpdate: new Date()
          }
        });
        console.log(`✅ Updated price for ${token.symbol || token.address} to ${calculatedPrice}`);
      } else {
        console.log(`❌ Could not calculate a valid price for ${token.symbol || token.address}`);
      }
    }
    
  } catch (error) {
    console.error('Error fixing token prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
fixTokenPrices()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 