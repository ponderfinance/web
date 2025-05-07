import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI;
console.log(`Using MongoDB URI: ${MONGO_URI ? 'Found URI (length: ' + MONGO_URI.length + ')' : 'MISSING'}`);

async function main() {
  try {
    console.log('Creating Prisma client...');
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: MONGO_URI,
        },
      },
      log: ['query', 'info', 'warn', 'error'],
    });

    // Check connection
    console.log('Testing database connection...');
    await prisma.$connect();
    console.log('Successfully connected to database');

    // Check protocol metrics
    console.log('\nFetching protocol metrics...');
    const protocolMetrics = await prisma.protocolMetric.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    if (protocolMetrics) {
      console.log('Latest protocol metrics:');
      console.log('- totalValueLockedUSD:', protocolMetrics.totalValueLockedUSD);
      console.log('- liquidityPoolsTVL:', protocolMetrics.liquidityPoolsTVL);
      console.log('- dailyVolumeUSD:', protocolMetrics.dailyVolumeUSD);
      console.log('- timestamp:', protocolMetrics.timestamp, 'type:', typeof protocolMetrics.timestamp);
    } else {
      console.log('No protocol metrics found!');
    }

    // Check tokens
    console.log('\nFetching tokens...');
    const tokens = await prisma.token.findMany({
      take: 5,
      orderBy: { volumeUSD24h: 'desc' },
    });

    if (tokens.length > 0) {
      console.log(`Found ${tokens.length} tokens:`);
      tokens.forEach((token, i) => {
        console.log(`\nToken #${i + 1}:`);
        console.log('- id:', token.id);
        console.log('- symbol:', token.symbol);
        console.log('- name:', token.name);
        console.log('- address:', token.address);
        console.log('- priceUSD:', token.priceUSD);
        console.log('- volumeUSD24h:', token.volumeUSD24h);
        console.log('- tvl:', token.tvl);
      });
    } else {
      console.log('No tokens found!');
    }

    // Check swaps
    console.log('\nFetching recent swaps...');
    const swaps = await prisma.swap.findMany({
      take: 5,
      orderBy: { timestamp: 'desc' },
    });

    if (swaps.length > 0) {
      console.log(`Found ${swaps.length} recent swaps:`);
      swaps.forEach((swap, i) => {
        console.log(`\nSwap #${i + 1}:`);
        console.log('- id:', swap.id);
        console.log('- pairId:', swap.pairId);
        console.log('- timestamp:', swap.timestamp, 'type:', typeof swap.timestamp);
        console.log('- amountIn0:', swap.amountIn0);
        console.log('- amountIn1:', swap.amountIn1);
        console.log('- valueUSD:', swap.valueUSD);
      });
    } else {
      console.log('No swaps found!');
    }

    // Check pairs
    console.log('\nFetching pairs...');
    const pairs = await prisma.pair.findMany({
      take: 5,
      orderBy: { reserve0: 'desc' },
      include: {
        token0: true,
        token1: true,
      }
    });

    if (pairs.length > 0) {
      console.log(`Found ${pairs.length} pairs:`);
      pairs.forEach((pair, i) => {
        console.log(`\nPair #${i + 1}:`);
        console.log('- id:', pair.id);
        console.log('- address:', pair.address);
        console.log('- token0:', pair.token0.symbol);
        console.log('- token1:', pair.token1.symbol);
        console.log('- reserve0:', pair.reserve0);
        console.log('- reserve1:', pair.reserve1);
        console.log('- volume24h:', pair.volume24h);
        console.log('- tvl:', pair.tvl);
      });
    } else {
      console.log('No pairs found!');
    }

    // Close connection
    await prisma.$disconnect();
    console.log('\nDiagnostic complete');
  } catch (error) {
    console.error('Error in diagnostic script:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 