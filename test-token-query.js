// Test tokenByAddress query
const postgres = require('postgres');

const sql = postgres('postgresql://postgres:GYdUIxtHuNeWqmursENlXUjhrvLyhXwK@interchange.proxy.rlwy.net:44717/railway', {
  ssl: 'require',
  max: 1,
  connection: { search_path: 'ponder' }
});

async function test() {
  const address = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5';

  console.log('Testing token.findFirst with address:', address);
  const result = await sql`SELECT * FROM token WHERE address = ${address} LIMIT 1`;
  console.log('Result:', result);

  console.log('\n Testing with lowercase:');
  const result2 = await sql`SELECT * FROM token WHERE address = ${address.toLowerCase()} LIMIT 1`;
  console.log('Result2:', result2);

  await sql.end();
}

test();
