import fetch from 'node-fetch';

const GRAPHQL_ENDPOINT = 'http://localhost:3000/api/graphql';

async function testTokenPriceChart() {
  try {
    // Get tokens from the API first
    const tokensQuery = `
      query {
        tokens(first: 5) {
          edges {
            node {
              id
              symbol
              address
            }
          }
        }
      }
    `;

    console.log('Fetching tokens...');
    const tokensResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: tokensQuery }),
    });

    const tokensData = await tokensResponse.json();
    
    if (tokensData.errors) {
      console.error('GraphQL errors:', tokensData.errors);
      return;
    }

    console.log('Tokens response:', JSON.stringify(tokensData, null, 2));
    
    if (!tokensData.data?.tokens?.edges?.length) {
      console.log('No tokens found');
      return;
    }

    // Get the first token
    const token = tokensData.data.tokens.edges[0].node;
    console.log(`Testing with token: ${token.symbol} (${token.address})`);

    // Now fetch the price chart data for this token
    const priceChartQuery = `
      query {
        tokenPriceChart(
          tokenAddress: "${token.address}"
          timeframe: "1d"
          limit: 50
        ) {
          time
          value
        }
      }
    `;

    console.log('Fetching token price chart...');
    const priceChartResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: priceChartQuery }),
    });

    const priceChartData = await priceChartResponse.json();
    
    if (priceChartData.errors) {
      console.error('GraphQL errors:', priceChartData.errors);
      return;
    }

    console.log('Price chart response:', JSON.stringify(priceChartData, null, 2));
    
    if (!priceChartData.data?.tokenPriceChart?.length) {
      console.log('No price chart data found');
      
      // Try with USDT token
      console.log('\nTrying with USDT token...');
      // Find USDT token
      const usdt = tokensData.data.tokens.edges.find(edge => 
        edge.node.symbol === 'USDT' || edge.node.symbol === 'USDC'
      );
      
      if (!usdt) {
        console.log('No USDT/USDC token found');
        return;
      }
      
      console.log(`Testing with stablecoin: ${usdt.node.symbol} (${usdt.node.address})`);
      
      // Now fetch the price chart data for USDT
      const usdtChartQuery = `
        query {
          tokenPriceChart(
            tokenAddress: "${usdt.node.address}"
            timeframe: "1d"
            limit: 50
          ) {
            time
            value
          }
        }
      `;
      
      console.log('Fetching stablecoin price chart...');
      const usdtChartResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: usdtChartQuery }),
      });
      
      const usdtChartData = await usdtChartResponse.json();
      
      if (usdtChartData.errors) {
        console.error('GraphQL errors:', usdtChartData.errors);
        return;
      }
      
      console.log('Stablecoin price chart response:', JSON.stringify(usdtChartData, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testTokenPriceChart().catch(console.error); 