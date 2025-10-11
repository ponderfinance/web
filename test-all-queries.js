#!/usr/bin/env node
/**
 * Comprehensive GraphQL Query Test Suite
 * Tests all 9 core queries and validates response structure
 */

const GRAPHQL_URL = process.env.GRAPHQL_URL || 'http://localhost:3000/api/graphql';

// Test definitions
const tests = [
  {
    name: '1. tokens (List)',
    query: `query { tokens(first: 10) { edges { node { address symbol name priceUSD volumeUSD24h } } totalCount } }`,
    validate: (data) => {
      if (!data.tokens) return 'Missing tokens field';
      if (!Array.isArray(data.tokens.edges)) return 'edges is not an array';
      if (typeof data.tokens.totalCount !== 'number') return 'totalCount is not a number';
      if (data.tokens.edges.length === 0) return 'No token edges returned';
      const node = data.tokens.edges[0].node;
      if (!node.address) return 'Missing address in first token';
      return null; // Success
    }
  },
  {
    name: '2. pairs (List)',
    query: `query { pairs(first: 10) { edges { node { address reserve0 reserve1 volume24h volumeChange24h } } totalCount } }`,
    validate: (data) => {
      if (!data.pairs) return 'Missing pairs field';
      if (!Array.isArray(data.pairs.edges)) return 'edges is not an array';
      if (typeof data.pairs.totalCount !== 'number') return 'totalCount is not a number';
      if (data.pairs.edges.length === 0) return 'No pair edges returned';
      const node = data.pairs.edges[0].node;
      if (!node.address) return 'Missing address in first pair';
      return null;
    }
  },
  {
    name: '3. recentTransactions (List)',
    query: `query { recentTransactions(first: 5) { edges { node { id timestamp txHash userAddress valueUSD } } } }`,
    validate: (data) => {
      if (!data.recentTransactions) return 'Missing recentTransactions field';
      if (!Array.isArray(data.recentTransactions.edges)) return 'edges is not an array';
      if (data.recentTransactions.edges.length === 0) return 'No transaction edges returned';
      const node = data.recentTransactions.edges[0].node;
      if (!node.id) return 'Missing id in first transaction';
      if (!node.txHash) return 'Missing txHash in first transaction';
      return null;
    }
  },
  {
    name: '4. tokenByAddress (Single)',
    query: `query { tokenByAddress(address: "0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5") { address symbol name priceUSD decimals } }`,
    validate: (data) => {
      if (!data.tokenByAddress) return 'Token not found';
      if (!data.tokenByAddress.address) return 'Missing address';
      if (!data.tokenByAddress.symbol) return 'Missing symbol (metadata not loaded)';
      if (data.tokenByAddress.address !== '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5') return 'Wrong token address returned';
      return null;
    }
  },
  {
    name: '5. protocolMetrics (Single)',
    query: `query { protocolMetrics { totalValueLockedUSD dailyVolumeUSD totalUsers } }`,
    validate: (data) => {
      if (!data.protocolMetrics) return 'Missing protocolMetrics field';
      if (typeof data.protocolMetrics.totalValueLockedUSD !== 'string') return 'totalValueLockedUSD is not a string';
      // Note: values may be "0" if table is empty - that's ok
      return null;
    }
  },
  {
    name: '6. pairByAddress (Single)',
    query: `query { pairByAddress(address: "0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74") { address reserve0 reserve1 token0 { address symbol } token1 { address symbol } } }`,
    validate: (data) => {
      if (!data.pairByAddress) return 'Pair not found';
      if (!data.pairByAddress.address) return 'Missing address';
      if (!data.pairByAddress.token0) return 'Missing token0';
      if (!data.pairByAddress.token1) return 'Missing token1';
      if (data.pairByAddress.address !== '0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74') return 'Wrong pair address returned';
      return null;
    }
  },
  {
    name: '7. tokenPriceChart (Chart)',
    query: `query { tokenPriceChart(tokenAddress: "0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5", timeframe: "1d") { time value } }`,
    validate: (data) => {
      if (!data.tokenPriceChart) return 'Missing tokenPriceChart field';
      if (!Array.isArray(data.tokenPriceChart)) return 'tokenPriceChart is not an array';
      if (data.tokenPriceChart.length === 0) return 'No chart data returned';
      const point = data.tokenPriceChart[0];
      if (typeof point.time !== 'number') return 'time is not a number';
      if (typeof point.value !== 'number') return 'value is not a number';
      return null;
    }
  },
  {
    name: '8. pairPriceChart (Chart)',
    query: `query { pairPriceChart(pairAddress: "0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74", timeframe: "1d") { time value } }`,
    validate: (data) => {
      if (!data.pairPriceChart) return 'Missing pairPriceChart field';
      if (!Array.isArray(data.pairPriceChart)) return 'pairPriceChart is not an array';
      if (data.pairPriceChart.length === 0) return 'No chart data returned';
      const point = data.pairPriceChart[0];
      if (typeof point.time !== 'number') return 'time is not a number';
      if (typeof point.value !== 'number') return 'value is not a number';
      return null;
    }
  },
  {
    name: '9. pairVolumeChart (Chart)',
    query: `query { pairVolumeChart(pairAddress: "0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74", timeframe: "1d") { time value volume0 volume1 count } }`,
    validate: (data) => {
      if (!data.pairVolumeChart) return 'Missing pairVolumeChart field';
      if (!Array.isArray(data.pairVolumeChart)) return 'pairVolumeChart is not an array';
      if (data.pairVolumeChart.length === 0) return 'No chart data returned';
      const point = data.pairVolumeChart[0];
      if (typeof point.time !== 'number') return 'time is not a number';
      if (typeof point.value !== 'number') return 'value is not a number';
      if (typeof point.count !== 'number') return 'count is not a number';
      return null;
    }
  }
];

async function runTest(test) {
  try {
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: test.query })
    });

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const result = await response.json();

    if (result.errors) {
      return { success: false, error: `GraphQL Error: ${result.errors[0].message}` };
    }

    if (!result.data) {
      return { success: false, error: 'No data in response' };
    }

    // Run validation
    const validationError = test.validate(result.data);
    if (validationError) {
      return { success: false, error: validationError, data: result.data };
    }

    return { success: true, data: result.data };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🧪 GraphQL Query Test Suite');
  console.log('━'.repeat(60));
  console.log(`Testing against: ${GRAPHQL_URL}\n`);

  let passed = 0;
  let failed = 0;
  const failures = [];

  for (const test of tests) {
    process.stdout.write(`Testing ${test.name}... `);

    const result = await runTest(test);

    if (result.success) {
      console.log('✅ PASS');
      passed++;
    } else {
      console.log('❌ FAIL');
      console.log(`  Error: ${result.error}`);
      if (result.data) {
        console.log(`  Data received:`, JSON.stringify(result.data, null, 2).split('\n').slice(0, 5).join('\n'));
      }
      failed++;
      failures.push({ name: test.name, error: result.error });
    }
  }

  console.log('\n' + '━'.repeat(60));
  console.log('📊 Test Summary\n');
  console.log(`Total Tests: ${tests.length}`);
  console.log(`Passed: ✅ ${passed}`);
  console.log(`Failed: ❌ ${failed}`);
  console.log(`Success Rate: ${((passed / tests.length) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\n⚠️  Failed Tests:');
    failures.forEach(f => {
      console.log(`  • ${f.name}: ${f.error}`);
    });
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
