import { PrismaClient } from '@prisma/client';

async function checkPair() {
  const prisma = new PrismaClient();
  
  try {
    // KOI-KKUB pair
    const koiPair = await prisma.pair.findFirst({
      where: { address: '0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74' },
      include: {
        token0: true,
        token1: true,
        priceSnapshots: {
          take: 1,
          orderBy: { timestamp: 'desc' }
        }
      }
    });
    
    console.log('KOI-KKUB Pair:');
    console.log(JSON.stringify(koiPair, null, 2));
    
    // Check snapshots separately
    const snapshots = await prisma.priceSnapshot.findMany({
      where: { pairId: koiPair?.id },
      orderBy: { timestamp: 'desc' },
      take: 3
    });
    
    console.log('\n\nRecent price snapshots:');
    console.log(JSON.stringify(snapshots, null, 2));
    
  } catch (error) {
    console.error('Error checking pair:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
checkPair()
  .then(() => {
    console.log('Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  }); 