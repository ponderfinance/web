import postgres from 'postgres';

const DATABASE_URL = 'postgresql://postgres:TJnAPMxCanOePxuLprSqtjpNOrjtlxof@ballast.proxy.rlwy.net:11606/railway';
const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  connection: { search_path: 'ponder_local' }
});

const result = await sql`
  SELECT address, symbol, price_usd, fdv, total_supply 
  FROM token 
  WHERE address = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'
`;

console.log('Web DB Result:', result);
await sql.end();
