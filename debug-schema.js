const { PrismaClient } = require('@prisma/client');

async function main() {
  // Create a fresh Prisma client
  const prisma = new PrismaClient();
  
  try {
    // Print the Prisma models to check schema structure
    console.log("=== Prisma Swap Model ===");
    console.log(Object.keys(prisma.swap));
    
    // Count swaps to verify our schema can access the data
    const swapCount = await prisma.swap.count();
    console.log(`Total swap count: ${swapCount}`);
    
    // Get basic info without relations
    const swapsBasic = await prisma.swap.findMany({
      take: 2,
      select: {
        id: true,
        pairId: true,
        txHash: true,
        userAddress: true,
        amountIn0: true,
        amountIn1: true,
        timestamp: true
      }
    });
    console.log("Basic swap data:", JSON.stringify(swapsBasic, null, 2));
    
    // Try with relations to see if that's the issue
    console.log("\nTesting relations...");
    const swapsWithRelations = await prisma.swap.findMany({
      take: 2,
      include: {
        pair: {
          include: {
            token0: true,
            token1: true
          }
        }
      }
    });
    
    const simplifiedSwaps = swapsWithRelations.map(swap => ({
      id: swap.id,
      pairId: swap.pairId,
      hasToken0: !!swap.pair?.token0,
      hasToken1: !!swap.pair?.token1,
      token0Symbol: swap.pair?.token0?.symbol,
      token1Symbol: swap.pair?.token1?.symbol
    }));
    
    console.log("Swaps with relations:", JSON.stringify(simplifiedSwaps, null, 2));
    
    // Check if this is a permission issue
    console.log("\nChecking Pair model...");
    const pairCount = await prisma.pair.count();
    console.log(`Total pair count: ${pairCount}`);
    
    const pairs = await prisma.pair.findMany({ take: 2 });
    console.log("Pairs sample:", JSON.stringify(pairs, null, 2));
    
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 