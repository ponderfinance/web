// Test OR query with fixed toSnakeCase
const postgres = require('postgres');

const sql = postgres('postgresql://postgres:GYdUIxtHuNeWqmursENlXUjhrvLyhXwK@interchange.proxy.rlwy.net:44717/railway', {
  ssl: 'require',
  max: 1,
  connection: { search_path: 'ponder' }
});

// Fixed toSnakeCase function
function toSnakeCase(str) {
  return str
    .replace(/USD/g, 'Usd')
    .replace(/TVL/g, 'Tvl')
    .replace(/URI/g, 'Uri')
    .replace(/([A-Z])(\d)/g, '$1_$2')     // Capital before digit
    .replace(/(\d)([A-Z])/g, '$1_$2')     // Digit before capital - THIS IS THE FIX
    .replace(/([a-z])([A-Z])/g, '$1_$2')  // Lowercase before capital
    .toLowerCase();
}

async function test() {
  const tokenAddress = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5';

  console.log('Testing field name conversions:');
  console.log('  token0Address =>', toSnakeCase('token0Address'));
  console.log('  token1Address =>', toSnakeCase('token1Address'));

  console.log('\nTesting pair.findMany with OR query...');

  const values = [tokenAddress, tokenAddress];
  const query = `
    SELECT address, token0_address, token1_address, reserve0, reserve1
    FROM pair
    WHERE (token0_address = $1 OR token1_address = $2)
  `;

  console.log('Query:', query);
  console.log('Values:', values);

  try {
    const result = await sql.unsafe(query, values);
    console.log('\nSuccess! Pairs found:', result.length);
    console.log('Pairs:', result);
  } catch (error) {
    console.error('\nError:', error.message);
    console.error('Stack:', error.stack);
  }

  await sql.end();
}

test();