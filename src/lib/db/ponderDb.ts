/**
 * PonderDB - Prisma-compatible adapter for Ponder's PostgreSQL database
 *
 * This adapter provides a Prisma-like API to query Ponder's PostgreSQL,
 * allowing zero changes to existing resolver code.
 */

import postgres from 'postgres';

// Use Ponder's database URL from env
const DATABASE_URL = process.env.PONDER_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('PONDER_DATABASE_URL or DATABASE_URL must be set');
}

const DATABASE_SCHEMA = process.env.DATABASE_SCHEMA || 'ponder';

const sql = postgres(DATABASE_URL, {
  ssl: 'require',
  max: 10,
  // Set search_path to schema so all queries use Ponder's tables
  connection: {
    search_path: DATABASE_SCHEMA
  }
});

/**
 * Map camelCase field names to snake_case column names
 * Matches Ponder's snake_case conversion exactly
 */
function toSnakeCase(str: string): string {
  return str
    // First normalize acronyms BEFORE any other transformations
    .replace(/USD/g, 'Usd')   // volumeUSD24h → volumeUsd24h
    .replace(/TVL/g, 'Tvl')   // totalTVL → totalTvl
    .replace(/URI/g, 'Uri')   // imageURI → imageUri
    .replace(/API/g, 'Api')   // apiKey → apiKey
    // Add underscore after acronyms before digits (Usd24 → Usd_24)
    .replace(/(Usd|Tvl|Uri|Api)(\d)/g, '$1_$2')
    // Add underscore before digit after capital (D24 → D_24)
    .replace(/([A-Z])(\d)/g, '$1_$2')
    // Add underscore before capital after digit (0A → 0_A)
    .replace(/(\d)([A-Z])/g, '$1_$2')
    // Add underscore before capital after lowercase (aB → a_B)
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    // Convert to lowercase
    .toLowerCase();
}

/**
 * Map snake_case column names to camelCase field names
 * Handles underscores before letters AND numbers
 */
function toCamelCase(str: string): string {
  return str.replace(/_(.)/g, (_, char) => char.toUpperCase());
}

/**
 * Transform row from snake_case to camelCase
 */
function transformRow(row: any): any {
  if (!row) return null;

  const transformed: any = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = toCamelCase(key);
    transformed[camelKey] = value;
  }
  return transformed;
}

/**
 * Build WHERE clause from Prisma-style where object
 */
function buildWhereClause(where: any): { sql: string; values: any[] } {
  if (!where || Object.keys(where).length === 0) {
    return { sql: '', values: [] };
  }

  const conditions: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(where)) {
    // Handle OR operator
    if (key === 'OR' && Array.isArray(value)) {
      console.log('[buildWhereClause] Processing OR with', value.length, 'conditions');
      const orConditions: string[] = [];
      value.forEach(orWhere => {
        console.log('[buildWhereClause] OR condition:', orWhere);
        for (const [orKey, orValue] of Object.entries(orWhere)) {
          const snakeKey = toSnakeCase(orKey);
          console.log(`[buildWhereClause] Field ${orKey} -> ${snakeKey}, value: ${orValue}`);
          // Special case: address fields should be case-insensitive
          if (snakeKey === 'address' || snakeKey.endsWith('_address')) {
            orConditions.push(`LOWER(${snakeKey}) = LOWER($${paramIndex})`);
            console.log(`[buildWhereClause] Added address condition: LOWER(${snakeKey}) = LOWER($${paramIndex})`);
          } else {
            orConditions.push(`${snakeKey} = $${paramIndex}`);
          }
          values.push(orValue);
          paramIndex++;
        }
      });
      if (orConditions.length > 0) {
        const finalCondition = `(${orConditions.join(' OR ')})`;
        conditions.push(finalCondition);
        console.log('[buildWhereClause] Final OR clause:', finalCondition);
        console.log('[buildWhereClause] Values:', values);
      }
      continue;
    }

    const snakeKey = toSnakeCase(key);

    // Handle Prisma operators (contains, gte, lte, gt, lt, in, etc.)
    if (typeof value === 'object' && value !== null) {
      // Handle range operators
      if (value.gte !== undefined) {
        conditions.push(`${snakeKey} >= $${paramIndex}`);
        values.push(value.gte);
        paramIndex++;
      }
      if (value.lte !== undefined) {
        conditions.push(`${snakeKey} <= $${paramIndex}`);
        values.push(value.lte);
        paramIndex++;
      }
      if (value.gt !== undefined) {
        conditions.push(`${snakeKey} > $${paramIndex}`);
        values.push(value.gt);
        paramIndex++;
      }
      if (value.lt !== undefined) {
        conditions.push(`${snakeKey} < $${paramIndex}`);
        values.push(value.lt);
        paramIndex++;
      }
      // Handle IN operator
      if (value.in !== undefined && Array.isArray(value.in)) {
        const placeholders = value.in.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`${snakeKey} IN (${placeholders})`);
        values.push(...value.in);
        paramIndex += value.in.length;
      }
      // Handle NOT IN operator
      if (value.notIn !== undefined && Array.isArray(value.notIn)) {
        const placeholders = value.notIn.map((_, i) => `$${paramIndex + i}`).join(', ');
        conditions.push(`${snakeKey} NOT IN (${placeholders})`);
        values.push(...value.notIn);
        paramIndex += value.notIn.length;
      }
      // Handle contains
      if (value.contains !== undefined) {
        // Case-insensitive LIKE for contains
        if (value.mode === 'insensitive') {
          conditions.push(`LOWER(${snakeKey}) LIKE LOWER($${paramIndex})`);
        } else {
          conditions.push(`${snakeKey} LIKE $${paramIndex}`);
        }
        values.push(`%${value.contains}%`);
        paramIndex++;
      }
    } else {
      // Simple equality
      // Special case: address fields should be case-insensitive
      if (snakeKey === 'address' || snakeKey.endsWith('_address')) {
        conditions.push(`LOWER(${snakeKey}) = LOWER($${paramIndex})`);
      } else {
        conditions.push(`${snakeKey} = $${paramIndex}`);
      }
      values.push(value);
      paramIndex++;
    }
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    values
  };
}

/**
 * Build SELECT clause from Prisma-style select object
 */
function buildSelectClause(select?: any): string {
  if (!select) return '*';

  const fields = Object.keys(select).map(toSnakeCase);
  return fields.join(', ');
}

/**
 * Build ORDER BY clause from Prisma-style orderBy
 */
function buildOrderByClause(orderBy?: any): string {
  if (!orderBy) return '';

  if (Array.isArray(orderBy)) {
    const clauses = orderBy.map(o => {
      const [[key, direction]] = Object.entries(o);
      const snakeKey = toSnakeCase(key);
      // Add NULLS LAST to handle null values properly
      return `${snakeKey} ${(direction as string).toUpperCase()} NULLS LAST`;
    });
    return `ORDER BY ${clauses.join(', ')}`;
  }

  const [[key, direction]] = Object.entries(orderBy);
  const snakeKey = toSnakeCase(key);
  return `ORDER BY ${snakeKey} ${(direction as string).toUpperCase()} NULLS LAST`;
}

/**
 * Token model adapter
 */
const token = {
  async findFirst(params: { where?: any; select?: any }) {
    const { where, select } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);

    const query = `
      SELECT ${selectClause}
      FROM token
      ${whereSql}
      LIMIT 1
    `;

    const result = await sql.unsafe(query, values);
    return result[0] ? transformRow(result[0]) : null;
  },

  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number; cursor?: any }) {
    const { where, select, orderBy, take, skip, cursor } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    let cursorClause = '';
    if (cursor && cursor.address) {
      const cursorIndex = values.length + 1;
      cursorClause = `AND address > $${cursorIndex}`;
      values.push(cursor.address);
    }

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM token
      ${whereSql}
      ${cursorClause}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    console.log('[PonderDB] token.findMany query:', query);
    console.log('[PonderDB] token.findMany values:', values);

    const result = await sql.unsafe(query, values);
    console.log('[PonderDB] token.findMany result count:', result.length);

    return result.map(transformRow);
  },

  async count(params?: { where?: any }) {
    const { sql: whereSql, values } = buildWhereClause(params?.where);

    const query = `
      SELECT COUNT(*)::int as count
      FROM token
      ${whereSql}
    `;

    const result = await sql.unsafe(query, values);
    return result[0].count;
  }
};

/**
 * Pair model adapter
 */
const pair = {
  async findFirst(params: { where?: any; select?: any; include?: any }) {
    const { where, select } = params;

    // Handle token0/token1 includes
    const selectClause = select ? buildSelectClause(select) : '*';
    const { sql: whereSql, values } = buildWhereClause(where);

    const query = `
      SELECT ${selectClause}
      FROM pair
      ${whereSql}
      LIMIT 1
    `;

    const result = await sql.unsafe(query, values);
    const pairRow = result[0] ? transformRow(result[0]) : null;

    // Fetch related tokens if needed
    if (pairRow && params.include) {
      if (params.include.token0) {
        pairRow.token0 = await token.findFirst({ where: { address: pairRow.token0Address } });
      }
      if (params.include.token1) {
        pairRow.token1 = await token.findFirst({ where: { address: pairRow.token1Address } });
      }
    }

    return pairRow;
  },

  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number; include?: any }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = select ? buildSelectClause(select) : '*';
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM pair
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    console.log('[PonderDB] pair.findMany query:', query);
    console.log('[PonderDB] pair.findMany values:', values);

    const result = await sql.unsafe(query, values);
    console.log('[PonderDB] pair.findMany result count:', result.length);
    const pairs = result.map(transformRow);

    // Fetch related tokens if needed
    if (params.include) {
      for (const pairRow of pairs) {
        if (params.include.token0) {
          pairRow.token0 = await token.findFirst({ where: { address: pairRow.token0Address } });
        }
        if (params.include.token1) {
          pairRow.token1 = await token.findFirst({ where: { address: pairRow.token1Address } });
        }
      }
    }

    return pairs;
  },

  async count(params?: { where?: any }) {
    const { sql: whereSql, values } = buildWhereClause(params?.where);

    const query = `
      SELECT COUNT(*)::int as count
      FROM pair
      ${whereSql}
    `;

    const result = await sql.unsafe(query, values);
    return result[0].count;
  }
};

/**
 * Swap model adapter
 */
const swap = {
  async findFirst(params: { where?: any; select?: any }) {
    const { where, select } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);

    const query = `
      SELECT ${selectClause}
      FROM swap
      ${whereSql}
      LIMIT 1
    `;

    const result = await sql.unsafe(query, values);
    return result[0] ? transformRow(result[0]) : null;
  },

  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number; cursor?: any; include?: any }) {
    const { where, select, orderBy, take, skip, cursor } = params;
    const selectClause = select ? buildSelectClause(select) : '*';
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    let cursorClause = '';
    if (cursor && cursor.id) {
      const cursorIndex = values.length + 1;
      cursorClause = `AND id > $${cursorIndex}`;
      values.push(cursor.id);
    }

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM swap
      ${whereSql}
      ${cursorClause}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    const swaps = result.map(transformRow);

    // Fetch related pair if needed
    if (params.include?.pair) {
      for (const swapRow of swaps) {
        swapRow.pair = await pair.findFirst({
          where: { address: swapRow.pairAddress },
          include: params.include.pair.include
        });
      }
    }

    return swaps;
  },

  async count(params?: { where?: any }) {
    const { sql: whereSql, values } = buildWhereClause(params?.where);

    const query = `
      SELECT COUNT(*)::int as count
      FROM swap
      ${whereSql}
    `;

    const result = await sql.unsafe(query, values);
    return result[0].count;
  }
};

/**
 * LiquidityPosition model adapter
 */
const liquidityPosition = {
  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM liquidity_position
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * PriceObservation model adapter (for charts)
 */
const priceObservation = {
  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM price_observation
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * HourlyPriceSnapshot model adapter (for OHLC chart data)
 */
const hourlyPriceSnapshot = {
  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM hourly_price_snapshot
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * ProtocolMetric model adapter
 */
const protocolMetric = {
  async findFirst(params?: { where?: any; orderBy?: any }) {
    const { where, orderBy } = params || {};
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = orderBy ? buildOrderByClause(orderBy) : 'ORDER BY timestamp DESC';

    const query = `
      SELECT *
      FROM protocol_metric
      ${whereSql}
      ${orderByClause}
      LIMIT 1
    `;

    console.log('[PonderDB] protocolMetric.findFirst query:', query);

    const result = await sql.unsafe(query, values);
    return result[0] ? transformRow(result[0]) : null;
  }
};

/**
 * FarmingPosition model adapter
 */
const farmingPosition = {
  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM farming_position
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * StakingPosition model adapter
 */
const stakingPosition = {
  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM staking_position
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * Launch model adapter
 */
const launch = {
  async findFirst(params: { where?: any; select?: any }) {
    const { where, select } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);

    const query = `
      SELECT ${selectClause}
      FROM launch
      ${whereSql}
      LIMIT 1
    `;

    const result = await sql.unsafe(query, values);
    return result[0] ? transformRow(result[0]) : null;
  },

  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM launch
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * LaunchContribution model adapter
 */
const launchContribution = {
  async findMany(params: { where?: any; select?: any; orderBy?: any; take?: number; skip?: number }) {
    const { where, select, orderBy, take, skip } = params;
    const selectClause = buildSelectClause(select);
    const { sql: whereSql, values } = buildWhereClause(where);
    const orderByClause = buildOrderByClause(orderBy);

    const limitClause = take ? `LIMIT ${take}` : '';
    const offsetClause = skip ? `OFFSET ${skip}` : '';

    const query = `
      SELECT ${selectClause}
      FROM launch_contribution
      ${whereSql}
      ${orderByClause}
      ${limitClause}
      ${offsetClause}
    `;

    const result = await sql.unsafe(query, values);
    return result.map(transformRow);
  }
};

/**
 * Export Prisma-compatible API
 */
export const ponderDb = {
  token,
  pair,
  swap,
  liquidityPosition,
  priceObservation,
  hourlyPriceSnapshot,
  protocolMetric,
  farmingPosition,
  stakingPosition,
  launch,
  launchContribution,

  // Allow raw SQL queries if needed
  $queryRaw: sql,

  // Disconnect method for compatibility
  $disconnect: async () => {
    await sql.end();
  }
};

export default ponderDb;