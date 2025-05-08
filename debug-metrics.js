import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function debugMetrics() {
  try {
    // Check protocol metrics
    console.log('---- Checking Protocol Metrics ----');
    const protocolMetrics = await prisma.entityMetrics.findFirst({
      where: {
        entity: 'protocol',
        entityId: 'global'
      },
      orderBy: { lastUpdated: 'desc' }
    });
    
    if (protocolMetrics) {
      console.log('Protocol metrics found:', protocolMetrics);
      console.log('Formatted for frontend:');
      console.log({
        id: protocolMetrics.id,
        timestamp: protocolMetrics.lastUpdated,
        totalValueLockedUSD: protocolMetrics.tvl || '0',
        dailyVolumeUSD: protocolMetrics.volume24h || '0',
        weeklyVolumeUSD: protocolMetrics.volume7d || '0',
        monthlyVolumeUSD: protocolMetrics.volume30d || '0',
        volume1hChange: protocolMetrics.volumeChange1h ? parseFloat(protocolMetrics.volumeChange1h.toString()) : 0,
        volume24hChange: protocolMetrics.volumeChange24h ? parseFloat(protocolMetrics.volumeChange24h.toString()) : 0
      });
    } else {
      console.log('No protocol metrics found');
    }
    
    // Check one token's price change data
    console.log('\n---- Checking Token Price Change Data ----');
    const token = await prisma.token.findFirst({
      where: {
        symbol: { not: null }
      },
      select: {
        id: true,
        symbol: true,
        priceChange1h: true,
        priceChange24h: true
      }
    });
    
    if (token) {
      console.log(`Token ${token.symbol} price changes from Token table:`, {
        priceChange1h: token.priceChange1h,
        priceChange24h: token.priceChange24h
      });
      
      // Check if there's corresponding data in EntityMetrics
      const tokenMetrics = await prisma.entityMetrics.findFirst({
        where: {
          entity: 'token',
          entityId: token.id
        }
      });
      
      if (tokenMetrics) {
        console.log(`Token ${token.symbol} price changes from EntityMetrics:`, {
          priceChange24h: tokenMetrics.priceChange24h,
          priceUSD: tokenMetrics.priceUSD
        });
      } else {
        console.log(`No EntityMetrics found for token ${token.symbol}`);
      }
    }
    
    // Check pair data
    console.log('\n---- Checking Pair Data ----');
    const pair = await prisma.pair.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        address: true,
        token0: { select: { symbol: true } },
        token1: { select: { symbol: true } },
        reserve0: true,
        reserve1: true,
        volume24h: true,
        poolAPR: true
      }
    });
    
    if (pair) {
      console.log(`Pair ${pair.token0.symbol}/${pair.token1.symbol} data from Pair table:`, {
        reserve0: pair.reserve0,
        reserve1: pair.reserve1,
        volume24h: pair.volume24h,
        poolAPR: pair.poolAPR
      });
      
      // Check if there's corresponding data in EntityMetrics
      const pairMetrics = await prisma.entityMetrics.findFirst({
        where: {
          entity: 'pair',
          entityId: pair.id
        }
      });
      
      if (pairMetrics) {
        console.log(`Pair ${pair.token0.symbol}/${pair.token1.symbol} data from EntityMetrics:`, {
          tvl: pairMetrics.tvl,
          volume24h: pairMetrics.volume24h,
          reserveUSD: pairMetrics.reserveUSD,
          poolAPR: pairMetrics.poolAPR
        });
      } else {
        console.log(`No EntityMetrics found for pair ${pair.token0.symbol}/${pair.token1.symbol}`);
      }
    }
    
  } catch (e) {
    console.error('Error debugging metrics:', e);
  } finally {
    await prisma.$disconnect();
  }
}

debugMetrics(); 