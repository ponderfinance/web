const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Testing direct database connection...');
    
    // Query directly with the same parameters used in the resolver
    const swaps = await prisma.swap.findMany({
      take: 6,
      orderBy: { timestamp: 'desc' },
      include: {
        pair: {
          include: {
            token0: true,
            token1: true,
          },
        },
      },
    });
    
    console.log(`Found ${swaps.length} swaps directly from the database`);
    
    // Print basic information about each swap
    for (const swap of swaps) {
      console.log('---------------------');
      console.log(`ID: ${swap.id}`);
      console.log(`Timestamp: ${swap.timestamp}`);
      console.log(`txHash: ${swap.txHash}`);
      console.log(`userAddress: ${swap.userAddress}`);
      console.log(`Pair: ${swap.pairId}`);
      console.log(`amountIn0: ${swap.amountIn0}`);
      console.log(`amountIn1: ${swap.amountIn1}`);
      
      // Check if pair data is being properly populated
      console.log(`Has pair data: ${swap.pair ? 'Yes' : 'No'}`);
      if (swap.pair) {
        console.log(`Has token0: ${swap.pair.token0 ? 'Yes' : 'No'}`);
        console.log(`Has token1: ${swap.pair.token1 ? 'Yes' : 'No'}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 