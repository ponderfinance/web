// Test ponderDb adapter directly
const { ponderDb } = require('./src/lib/db/ponderDb.ts');

async function testDB() {
  try {
    console.log('Testing ponderDb adapter directly...\n');

    const token = await ponderDb.token.findFirst({
      where: { address: '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5' },
      select: {
        address: true,
        symbol: true,
        priceUsd: true,
        fdv: true,
        totalSupply: true
      }
    });

    console.log('Token from ponderDb:', JSON.stringify(token, null, 2));

    await ponderDb.$disconnect();
  } catch (error) {
    console.error('Error:', error);
  }
}

testDB();