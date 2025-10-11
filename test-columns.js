// Check token table columns
const postgres = require('postgres');

const sql = postgres('postgresql://postgres:GYdUIxtHuNeWqmursENlXUjhrvLyhXwK@interchange.proxy.rlwy.net:44717/railway', {
  ssl: 'require',
  max: 1
});

async function test() {
  try {
    console.log('Checking token table columns...');
    const columns = await sql`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'ponder' AND table_name = 'token'
      ORDER BY ordinal_position
    `;
    console.log('Token columns:', columns);

    console.log('\nQuerying with ORDER BY...');
    const tokens = await sql`
      SELECT address, symbol, name, volume_usd_24h, price_usd
      FROM ponder.token
      ORDER BY volume_usd_24h DESC NULLS LAST, price_usd DESC NULLS LAST
      LIMIT 5
    `;
    console.log('Ordered tokens:', tokens);

    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();