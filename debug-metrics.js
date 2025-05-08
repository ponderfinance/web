const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugMetrics() {
  console.log('🔍 Debugging metrics inconsistencies...');
  
  try {
    // Get protocol metrics
    console.log('\n1. Checking protocol metrics...');
    
    // Check EntityMetrics
    const protocolMetrics = await prisma.entityMetrics.findUnique({
      where: {
        entity_entityId: {
          entity: 'protocol',
          entityId: 'global'
        }
      }
    });
    
    console.log('Protocol metrics from EntityMetrics:');
    if (protocolMetrics) {
      console.log(`  - TVL: ${protocolMetrics.tvl}`);
      console.log(`  - Volume (24h): ${protocolMetrics.volume24h}`);
      console.log(`  - Last updated: ${new Date(protocolMetrics.lastUpdated * 1000).toISOString()}`);
    } else {
      console.log('  - No protocol metrics found in EntityMetrics!');
    }
    
    // Get token metrics
    console.log('\n2. Checking token metrics for top tokens...');
    const tokens = await prisma.token.findMany({
      where: {
        priceUSD: {
          not: null
        }
      },
      select: {
        id: true,
        symbol: true,
        priceUSD: true,
        priceChange1h: true,
        priceChange24h: true
      },
      take: 5
    });
    
    console.log(`Found ${tokens.length} tokens with price data`);
    
    for (const token of tokens) {
      console.log(`\nToken: ${token.symbol}`);
      console.log(`  - Price: ${token.priceUSD}`);
      console.log(`  - Price Change (1h): ${token.priceChange1h !== null ? token.priceChange1h + '%' : 'null'}`);
      console.log(`  - Price Change (24h): ${token.priceChange24h !== null ? token.priceChange24h + '%' : 'null'}`);
      
      // Get EntityMetrics for comparison
      const tokenMetrics = await prisma.entityMetrics.findUnique({
        where: {
          entity_entityId: {
            entity: 'token',
            entityId: token.id
          }
        }
      });
      
      if (tokenMetrics) {
        console.log('  EntityMetrics data:');
        console.log(`  - Price: ${tokenMetrics.priceUSD}`);
        console.log(`  - Price Change (1h): ${tokenMetrics.priceChange1h !== null ? tokenMetrics.priceChange1h + '%' : 'null'}`);
        console.log(`  - Price Change (24h): ${tokenMetrics.priceChange24h !== null ? tokenMetrics.priceChange24h + '%' : 'null'}`);
        console.log(`  - TVL: ${tokenMetrics.tvl}`);
        console.log(`  - Volume (24h): ${tokenMetrics.volume24h}`);
      } else {
        console.log('  - No matching EntityMetrics record!');
      }
    }
    
    // Check resolvers for tokens page data source
    console.log('\n3. Checking GraphQL resolver reference in code...');
    console.log('  [This would require code analysis in resolvers.ts]');
    console.log('  - Token price changes should be coming from EntityMetrics');
    console.log('  - TVL should be coming from EntityMetrics');
    console.log('  - Volume should be coming from EntityMetrics');
    
  } catch (error) {
    console.error('Error debugging metrics:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugMetrics()
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 