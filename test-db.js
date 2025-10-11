// Quick test script to check tokens in database
const postgres = require('postgres');

const sql = postgres(process.env.PONDER_DATABASE_URL || process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  connection: {
    search_path: 'ponder'
  }
});

async function test() {
  try {
    console.log('Testing token query...');
    const tokens = await sql`SELECT address, symbol, name FROM token LIMIT 5`;
    console.log('Tokens:', tokens);

    console.log('\nTesting pair query...');
    const pairs = await sql`SELECT address FROM pair LIMIT 5`;
    console.log('Pairs:', pairs);

    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();