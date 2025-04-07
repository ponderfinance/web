const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Check if there are any swap records
    const swapCount = await prisma.swap.count();
    console.log('Total swap count:', swapCount);
    
    if (swapCount > 0) {
      // Get a sample of swap records
      const swaps = await prisma.swap.findMany({ take: 2 });
      console.log('Sample swaps:', JSON.stringify(swaps, null, 2));
    }

    // Check if there are any recent swaps
    const recentSwaps = await prisma.swap.findMany({
      take: 2,
      orderBy: { timestamp: 'desc' }
    });
    console.log('Recent swaps:', JSON.stringify(recentSwaps, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 