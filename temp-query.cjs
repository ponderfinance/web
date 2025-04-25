require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Helper function to handle BigInt serialization
const replacer = (key, value) =>
  typeof value === 'bigint' ? value.toString() : value;

async function main() {
  try {
    console.log('Fetching price snapshots...');
    const snapshots = await prisma.priceSnapshot.findMany({
      take: 5,
      orderBy: {
        timestamp: 'desc'
      },
      include: {
        pair: {
          include: {
            token0: true,
            token1: true
          }
        }
      }
    });

    console.log('\nFound snapshots:');
    console.log(JSON.stringify(snapshots, replacer, 2));

    const count = await prisma.priceSnapshot.count();
    console.log('\nTotal snapshots:', count);

    // Get a sample pair with its tokens
    console.log('\nFetching sample pair...');
    const pair = await prisma.pair.findFirst({
      include: {
        token0: true,
        token1: true
      }
    });

    console.log('Sample pair:');
    console.log(JSON.stringify(pair, replacer, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 