const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Looking for swaps with null sender...');
    const swapsWithNullSender = await prisma.swap.findMany({
      where: { sender: null },
      take: 5
    });
    console.log('Swaps with null sender:', JSON.stringify(swapsWithNullSender, null, 2));
    
    console.log('\nLooking for total count of swaps...');
    const totalSwapsCount = await prisma.swap.count();
    console.log('Total swaps count:', totalSwapsCount);
    
    console.log('\nLooking for total count of swaps with null sender...');
    const nullSenderCount = await prisma.swap.count({
      where: { sender: null }
    });
    console.log('Swaps with null sender count:', nullSenderCount);
    
    console.log('\nLooking for a sample of recent swaps...');
    const recentSwaps = await prisma.swap.findMany({
      take: 3,
      orderBy: { timestamp: 'desc' }
    });
    console.log('Recent swaps:', JSON.stringify(recentSwaps, null, 2));
  } catch (error) {
    console.error('Error querying swaps:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 