const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkTokens() {
  try {
    console.log('Checking database for tokens...');
    
    // Get token count
    const count = await prisma.token.count();
    console.log(`Total tokens in database: ${count}`);
    
    // Get a sample token (USDT if it exists)
    const usdt = await prisma.token.findFirst({
      where: { 
        symbol: 'USDT'
      }
    });
    
    if (usdt) {
      console.log('Found USDT token:');
      console.log(JSON.stringify(usdt, null, 2));
      
      // Check price data
      if (usdt.priceUSD) {
        console.log(`USDT price: $${usdt.priceUSD}`);
      } else {
        console.log('USDT has no price data');
      }
    } else {
      console.log('USDT token not found');
    }
    
    // Get a few tokens to check prices
    const tokens = await prisma.token.findMany({
      take: 5,
      select: {
        id: true,
        symbol: true,
        address: true,
        priceUSD: true,
        lastPriceUpdate: true
      }
    });
    
    console.log('\nSample tokens:');
    tokens.forEach(token => {
      console.log(`${token.symbol || token.address.slice(0, 8)}: ${token.priceUSD || 'No price'} (Last updated: ${token.lastPriceUpdate || 'Never'})`);
    });
    
    // Check token with chart data
    console.log('\nChecking chart data for a token...');
    const tokenId = tokens.length > 0 ? tokens[0].id : null;
    
    if (tokenId) {
      const priceSnapshots = await prisma.priceSnapshot.findMany({
        where: {
          pair: {
            OR: [
              { token0Id: tokenId },
              { token1Id: tokenId }
            ]
          }
        },
        take: 5,
        orderBy: { timestamp: 'desc' }
      });
      
      console.log(`Found ${priceSnapshots.length} price snapshots for token ${tokens[0].symbol || tokens[0].address.slice(0, 8)}`);
      if (priceSnapshots.length > 0) {
        console.log('Latest snapshot:', JSON.stringify(priceSnapshots[0], null, 2));
      }
    }
    
  } catch (error) {
    console.error('Error checking tokens:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTokens(); 