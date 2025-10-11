require('dotenv').config();
// Using dynamic import for node-fetch
// const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:3001/api/graphql';

// Main function to run all tests
async function testAPI() {
  // Dynamically import fetch
  const { default: fetch } = await import('node-fetch');
  
  // Store fetch in global scope for helper functions
  global.fetch = fetch;
  
  console.log('=== Starting API Tests ===\n');
  console.log('Note: Make sure the Next.js dev server is running on port 3001\n');

  // 1. Test token prices
  await testTokenPrices();

  // 2. Test token price charts
  await testTokenPriceCharts();

  // 3. Test metrics (TVL, 24h volume)
  await testMetrics();

  console.log('\n=== API Tests Completed ===');
}

// Test 1: Verify token prices
async function testTokenPrices() {
  console.log('--- Testing Token Prices ---');
  const query = `
    query {
      tokens(first: 10) {
        edges {
          node {
            id
            symbol
            name
            address
            priceUsd
            priceChange24h
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        totalCount
      }
    }
  `;

  try {
    const response = await executeQuery(query);
    console.log('Raw token response:', JSON.stringify(response, null, 2));
    
    if (response.data && response.data.tokens && response.data.tokens.edges) {
      const tokens = response.data.tokens.edges.map(edge => edge.node);
      console.log(`Found ${tokens.length} tokens (total: ${response.data.tokens.totalCount || 'unknown'})`);
      
      // Log each token's price
      for (const token of tokens) {
        console.log(`${token.symbol}: $${token.priceUsd || 'No price'} (24h change: ${token.priceChange24h || 'N/A'}%)`);
      }
      
      // Verify if prices look valid
      const pricesValid = tokens.some(token => parseFloat(token.priceUsd || '0') > 0);
      console.log(`Token prices valid: ${pricesValid ? 'YES' : 'NO'}`);
    } else {
      console.log('No tokens found or invalid response format');
      if (response.errors) {
        console.log('Errors:', response.errors);
      }
    }
  } catch (error) {
    console.error('Error testing token prices:', error);
  }
}

// Test 2: Verify token price charts
async function testTokenPriceCharts() {
  console.log('\n--- Testing Token Price Charts ---');
  
  try {
    // Using hardcoded token address for testing since we know it exists
    // This is the KKUB token which should have price data
    const testToken = {
      symbol: 'KKUB',
      address: '0xE0432224871917FB5A137F4A153A51ECF9F74F57'
    };
    
    console.log(`Testing price chart for token: ${testToken.symbol} (${testToken.address})`);
    
    // Query the price chart
    const chartQuery = `
      query {
        tokenPriceChart(
          tokenAddress: "${testToken.address}"
          timeframe: "1d"
          limit: 24
        ) {
          time
          value
        }
      }
    `;
    
    const chartResponse = await executeQuery(chartQuery);
    console.log('Raw chart response:', JSON.stringify(chartResponse, null, 2));
    
    if (chartResponse.data && chartResponse.data.tokenPriceChart) {
      const chartData = chartResponse.data.tokenPriceChart;
      console.log(`Chart data points: ${chartData.length}`);
      
      if (chartData.length > 0) {
        console.log('Sample data points:');
        chartData.slice(0, 3).forEach(point => {
          const date = new Date(parseInt(point.time) * 1000).toISOString();
          console.log(`  ${date}: $${point.value}`);
        });
        
        // Verify if chart data looks valid
        const chartValid = chartData.length > 0 && chartData.some(point => parseFloat(point.value) > 0);
        console.log(`Chart data valid: ${chartValid ? 'YES' : 'NO'}`);
      } else {
        console.log('No chart data points found');
      }
    } else {
      console.log('Invalid chart response format or no chart data');
      if (chartResponse.errors) {
        console.log('Errors:', chartResponse.errors);
      }
    }
  } catch (error) {
    console.error('Error testing token price charts:', error);
  }
}

// Test 3: Verify metrics (TVL, 24h volume)
async function testMetrics() {
  console.log('\n--- Testing Metrics (TVL, 24h Volume) ---');
  
  try {
    // Use a simpler query to get token metrics directly since protocolMetrics seems unsupported
    const tokenMetricsQuery = `
      query {
        tokens(first: 5) {
          edges {
            node {
              id
              symbol
              address
              priceUsd
              volumeUsd24h
              tvl
            }
          }
          totalCount
        }
      }
    `;
    
    const tokenMetricsResponse = await executeQuery(tokenMetricsQuery);
    console.log('Raw token metrics response:', JSON.stringify(tokenMetricsResponse, null, 2));
    
    if (tokenMetricsResponse.data && tokenMetricsResponse.data.tokens && tokenMetricsResponse.data.tokens.edges) {
      const tokens = tokenMetricsResponse.data.tokens.edges.map(edge => edge.node);
      
      // Calculate total metrics from all tokens
      let totalVolume = 0;
      let volume24h = 0;
      let totalLiquidity = 0;
      
      for (const token of tokens) {
        console.log(`\n${token.symbol} Metrics:`);
        console.log(`Price: $${parseFloat(token.priceUsd || 0).toLocaleString()}`);
        console.log(`24h Volume: $${parseFloat(token.volumeUsd24h || 0).toLocaleString()}`);
        console.log(`TVL: $${parseFloat(token.tvl || 0).toLocaleString()}`);
        
        volume24h += parseFloat(token.volumeUsd24h || 0);
        totalLiquidity += parseFloat(token.tvl || 0);
      }
      
      console.log('\nAggregated Metrics:');
      console.log(`24h Volume (all tokens): $${volume24h.toLocaleString()}`);
      console.log(`Total Liquidity (all tokens): $${totalLiquidity.toLocaleString()}`);
      
      // Verify if token metrics look valid
      const tokenMetricsValid = totalLiquidity > 0 || volume24h > 0;
      console.log(`Token metrics data valid: ${tokenMetricsValid ? 'YES' : 'NO'}`);
    } else {
      console.log('Invalid token metrics response format or no token metrics data');
      if (tokenMetricsResponse.errors) {
        console.log('Errors:', tokenMetricsResponse.errors);
      }
    }
    
  } catch (error) {
    console.error('Error testing metrics:', error);
  }
}

// Helper function to execute GraphQL queries
async function executeQuery(query, variables = {}) {
  try {
    const response = await global.fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error executing GraphQL query:', error);
    throw error;
  }
}

// Run the tests
testAPI().catch(console.error); 