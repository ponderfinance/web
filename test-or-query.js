// Test OR query through PonderDB
const { ponderDb } = require('./src/lib/db/ponderDb.ts');

async function test() {
  const tokenAddress = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5';

  console.log('Testing pair.findMany with OR query...');
  try {
    const pairs = await ponderDb.pair.findMany({
      where: {
        OR: [
          { token0Address: tokenAddress },
          { token1Address: tokenAddress }
        ]
      },
      select: {
        address: true,
        token0Address: true,
        token1Address: true,
        reserve0: true,
        reserve1: true
      }
    });

    console.log('Pairs found:', pairs.length);
    console.log('Pairs:', pairs);
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }

  await ponderDb.$disconnect();
}

test();