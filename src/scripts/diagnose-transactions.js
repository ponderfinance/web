#!/usr/bin/env node
// diagnose-transactions.js
// Script to diagnose transaction display issues

const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const { formatUnits } = require('viem');

dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.MONGO_URI,
    },
  },
  log: ['query', 'info', 'warn', 'error'],
});

async function ensureNumberTimestamp(timestamp) {
  if (timestamp === null || timestamp === undefined) {
    return 0;
  }
  
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  
  if (typeof timestamp === 'bigint') {
    return Number(timestamp);
  }
  
  // Handle string timestamps
  if (typeof timestamp === 'string') {
    return parseInt(timestamp, 10);
  }
  
  return 0;
}

async function diagnoseTransactions() {
  try {
    console.log('Starting transaction diagnosis...');
    console.log('Connecting to database...');
    
    await prisma.$connect();
    console.log('Connected to database!');
    
    // Check recent transactions
    console.log('\n--- Checking Recent Transactions ---');
    const recentSwaps = await prisma.swap.findMany({
      take: 5,
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
    
    console.log(`Found ${recentSwaps.length} recent swaps.`);
    
    if (recentSwaps.length > 0) {
      console.log('\nExamining most recent swap:');
      const swap = recentSwaps[0];
      console.log(`ID: ${swap.id}`);
      console.log(`Transaction Hash: ${swap.txHash}`);
      console.log(`Timestamp: ${swap.timestamp} (type: ${typeof swap.timestamp})`);
      console.log(`Timestamp (converted): ${ensureNumberTimestamp(swap.timestamp)}`);
      console.log(`Human readable: ${new Date(ensureNumberTimestamp(swap.timestamp) * 1000).toISOString()}`);

      console.log(`Pair Address: ${swap.pair.address}`);
      console.log(`Token0: ${swap.pair.token0.symbol} (${swap.pair.token0.address})`);
      console.log(`Token1: ${swap.pair.token1.symbol} (${swap.pair.token1.address})`);
      
      const token0Decimals = swap.pair.token0.decimals || 18;
      const token1Decimals = swap.pair.token1.decimals || 18;
      
      console.log(`Amount In 0: ${formatUnits(BigInt(swap.amountIn0), token0Decimals)} ${swap.pair.token0.symbol}`);
      console.log(`Amount In 1: ${formatUnits(BigInt(swap.amountIn1), token1Decimals)} ${swap.pair.token1.symbol}`);
      console.log(`Amount Out 0: ${formatUnits(BigInt(swap.amountOut0), token0Decimals)} ${swap.pair.token0.symbol}`);
      console.log(`Amount Out 1: ${formatUnits(BigInt(swap.amountOut1), token1Decimals)} ${swap.pair.token1.symbol}`);
    }
    
    // Check for swaps in the last 24 hours
    console.log('\n--- Checking Swaps in Last 24 Hours ---');
    const oneDayAgo = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    
    // First check using numeric comparison
    const swapsNumeric = await prisma.swap.count({
      where: {
        timestamp: {
          gte: oneDayAgo,
        },
      },
    });
    
    console.log(`Swaps in last 24h (numeric comparison): ${swapsNumeric}`);
    
    // Then check using string comparison
    const swapsString = await prisma.swap.count({
      where: {
        timestamp: {
          gte: oneDayAgo.toString(),
        },
      },
    });
    
    console.log(`Swaps in last 24h (string comparison): ${swapsString}`);
    
    // Check timestamp data types in the database
    console.log('\n--- Checking Timestamp Types ---');
    const timestampTypes = await prisma.$queryRaw`
      SELECT
        typeof(timestamp) as type,
        COUNT(*) as count
      FROM Swap
      GROUP BY typeof(timestamp)
    `;
    
    console.log('Timestamp types in database:');
    console.log(timestampTypes);
    
    // Check for TVL data
    console.log('\n--- Checking TVL Data ---');
    const protocolMetrics = await prisma.protocolMetric.findFirst({
      orderBy: { timestamp: 'desc' },
    });
    
    if (protocolMetrics) {
      console.log('Latest protocol metrics:');
      console.log(`Total Value Locked USD: ${protocolMetrics.totalValueLockedUSD}`);
      console.log(`Liquidity Pools TVL: ${protocolMetrics.liquidityPoolsTVL}`);
      console.log(`Daily Volume USD: ${protocolMetrics.dailyVolumeUSD}`);
      console.log(`Timestamp: ${protocolMetrics.timestamp} (type: ${typeof protocolMetrics.timestamp})`);
      console.log(`Updated at: ${protocolMetrics.updatedAt.toISOString()}`);
    } else {
      console.log('No protocol metrics found!');
    }
    
    // Check token TVL
    console.log('\n--- Checking Top Tokens by Volume ---');
    const topTokens = await prisma.token.findMany({
      take: 5,
      orderBy: { volumeUSD24h: 'desc' },
    });
    
    console.log(`Found ${topTokens.length} top tokens by volume.`);
    topTokens.forEach((token, i) => {
      console.log(`\nToken #${i + 1}:`);
      console.log(`Symbol: ${token.symbol}`);
      console.log(`Price USD: ${token.priceUSD}`);
      console.log(`Volume USD 24h: ${token.volumeUSD24h}`);
      console.log(`TVL: ${token.tvl || 'Not set'}`);
    });
    
    console.log('\nDiagnosis complete!');
  } catch (error) {
    console.error('Error diagnosing transactions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run diagnosis
diagnoseTransactions().catch(console.error); 