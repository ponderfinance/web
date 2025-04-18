import { PrismaClient } from '@prisma/client';
import { TokenPriceService } from '../lib/services/tokenPriceService';

// Force update all token prices in the system

async function refreshAllTokenPrices() {
  console.log('Starting token price refresh...');
  const prisma = new PrismaClient();
  
  try {
    // Get all tokens
    const tokens = await prisma.token.findMany({
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    console.log(`Found ${tokens.length} tokens to refresh`);
    
    // Clear the token price cache first
    await TokenPriceService.clearTokenPriceCache();
    console.log('Token price cache cleared');
    
    // Process each token
    let successCount = 0;
    let failCount = 0;
    
    for (const token of tokens) {
      try {
        console.log(`Processing token ${token.symbol || token.address} (${token.id})...`);
        console.log(`Current price in DB: ${token.priceUSD || 'Not set'}`);
        
        // Force a new price calculation
        const price = await TokenPriceService.getReliableTokenUsdPrice({
          id: token.id,
          address: token.address,
          decimals: token.decimals || 18,
          symbol: token.symbol || undefined
        }, prisma);
        
        console.log(`New calculated price: ${price}`);
        
        // Update the database directly
        if (price > 0) {
          await prisma.token.update({
            where: { id: token.id },
            data: { priceUSD: price.toString() }
          });
          console.log(`✅ Updated price for ${token.symbol || token.address} to ${price}`);
          successCount++;
        } else {
          console.log(`❌ Could not determine a valid price for ${token.symbol || token.address}`);
          failCount++;
        }
      } catch (error) {
        console.error(`Error processing token ${token.id}:`, error);
        failCount++;
      }
    }
    
    console.log(`
    Price refresh completed:
    - Total tokens: ${tokens.length}
    - Successfully updated: ${successCount}
    - Failed to update: ${failCount}
    `);
    
  } catch (error) {
    console.error('Error during token price refresh:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
refreshAllTokenPrices()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 