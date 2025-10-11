// Test the exact query the resolver runs
const postgres = require('postgres');

const DATABASE_URL = 'postgresql://postgres:GYdUIxtHuNeWqmursENlXUjhrvLyhXwK@interchange.proxy.rlwy.net:44717/railway';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 1,
  connection: {
    search_path: 'ponder'
  }
});

// Simulate the buildOrderByClause function
function buildOrderByClause(orderBy) {
  if (!orderBy) return '';

  if (Array.isArray(orderBy)) {
    const clauses = orderBy.map(o => {
      const [[key, direction]] = Object.entries(o);
      const snakeKey = toSnakeCase(key);
      return `${snakeKey} ${direction.toUpperCase()} NULLS LAST`;
    });
    return `ORDER BY ${clauses.join(', ')}`;
  }

  const [[key, direction]] = Object.entries(orderBy);
  const snakeKey = toSnakeCase(key);
  return `ORDER BY ${snakeKey} ${direction.toUpperCase()} NULLS LAST`;
}

function toSnakeCase(str) {
  return str
    .replace(/USD/g, 'Usd')
    .replace(/TVL/g, 'Tvl')
    .replace(/URI/g, 'Uri')
    .replace(/([a-zA-Z])(\d)/g, '$1_$2')  // FIXED: underscore before number (any letter)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();
}

async function test() {
  try {
    console.log('Testing PonderDB token.findMany with array orderBy...');

    const orderBy = [
      { volumeUSD24h: 'desc' },
      { priceUSD: 'desc' }
    ];

    const orderByClause = buildOrderByClause(orderBy);
    console.log('Order BY clause:', orderByClause);

    const query = `
      SELECT *
      FROM token
      ${orderByClause}
      LIMIT 5
    `;

    console.log('Full query:', query);

    const result = await sql.unsafe(query, []);
    console.log('Result count:', result.length);
    console.log('Results:', result.map(r => ({
      address: r.address,
      symbol: r.symbol,
      volume_usd_24h: r.volume_usd_24h,
      price_usd: r.price_usd
    })));

    await sql.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

test();
