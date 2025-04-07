const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Examining swap records for null fields...');
    
    // Count total swaps
    const totalSwapsCount = await prisma.swap.count();
    console.log('Total swaps count:', totalSwapsCount);
    
    // Check for null amount0In
    const null0InCount = await prisma.swap.count({
      where: {
        amount0In: null
      }
    });
    console.log('Swaps with null amount0In:', null0InCount);
    
    // Check for null amount1In
    const null1InCount = await prisma.swap.count({
      where: {
        amount1In: null
      }
    });
    console.log('Swaps with null amount1In:', null1InCount);
    
    // Check for null amount0Out
    const null0OutCount = await prisma.swap.count({
      where: {
        amount0Out: null
      }
    });
    console.log('Swaps with null amount0Out:', null0OutCount);
    
    // Check for null amount1Out
    const null1OutCount = await prisma.swap.count({
      where: {
        amount1Out: null
      }
    });
    console.log('Swaps with null amount1Out:', null1OutCount);
    
    // Check for '0' string values which might cause issues
    const zero0InCount = await prisma.swap.count({
      where: {
        amount0In: '0'
      }
    });
    console.log('Swaps with amount0In = "0":', zero0InCount);
    
    // Get sample of records that might be problematic
    console.log('\nSample of potentially problematic records:');
    
    // Try to get the first error-causing record
    try {
      const recentSwaps = await prisma.swap.findMany({
        take: 1,
        orderBy: { timestamp: 'desc' }
      });
      console.log('Most recent swap:', JSON.stringify(recentSwaps, null, 2));
    } catch (error) {
      console.error('Error fetching the most recent swap:', error);
      
      // If error occurred, try with a more careful query that selects only specific fields
      console.log('Trying a more careful query...');
      const safeSwaps = await prisma.swap.findMany({
        select: {
          id: true,
          timestamp: true,
          blockNumber: true
        },
        take: 3,
        orderBy: { timestamp: 'desc' }
      });
      console.log('Safe query results:', JSON.stringify(safeSwaps, null, 2));
      
      // Now try to read one specific record with all fields
      if (safeSwaps.length > 0) {
        const swapId = safeSwaps[0].id;
        try {
          const fullSwap = await prisma.swap.findUnique({
            where: { id: swapId }
          });
          console.log(`Full details of swap ${swapId}:`, JSON.stringify(fullSwap, null, 2));
        } catch (detailError) {
          console.error(`Error fetching details for swap ${swapId}:`, detailError);
        }
      }
    }
  } catch (error) {
    console.error('Error in script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 