import fetch from 'node-fetch';

const GRAPHQL_ENDPOINT = 'http://localhost:3000/api/graphql';

async function testSpecificTokenPriceChart() {
  try {
    // Test specific tokens we know should have price data
    const tokens = [
      { symbol: 'USDT', address: '0x7d984c24d2499d840eb3b7016077164e15e5faa6' },
      { symbol: 'USDC', address: '0x77071ad51ca93fc90e77bcdece5aa6f1b40fcb21' },
      { symbol: 'KKUB', address: '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5' }
    ];
    
    for (const token of tokens) {
      console.log(`\nTesting token: ${token.symbol} (${token.address})`);
      
      // Fetch price chart data
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
      
      console.log(`Fetching price chart for ${token.symbol}...`);
      const priceChartResponse = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: priceChartQuery }),
      });
      
      const priceChartData = await priceChartResponse.json();
      
      if (priceChartData.errors) {
        console.error(`GraphQL errors for ${token.symbol}:`, priceChartData.errors);
        continue;
      }
      
      const chartData = priceChartData.data?.tokenPriceChart || [];
      console.log(`${token.symbol} price chart data points: ${chartData.length}`);
      
      if (chartData.length > 0) {
        console.log(`Sample data points:`);
        chartData.slice(0, 3).forEach((point, i) => {
          console.log(`  ${i + 1}. time: ${point.time} (${new Date(point.time * 1000).toISOString()}), value: ${point.value}`);
        });
      } else {
        console.log(`No price chart data found for ${token.symbol}`);
        
        // Check pair info for this token to debug
        const pairInfoQuery = `
          query {
            tokenByAddress(address: "${token.address}") {
              id
              symbol
              address
              pairsAsToken0 {
                id
                address
                token0 { symbol }
                token1 { symbol }
              }
              pairsAsToken1 {
                id
                address
                token0 { symbol }
                token1 { symbol }
              }
            }
          }
        `;
        
        console.log(`Fetching pair info for ${token.symbol}...`);
        const pairInfoResponse = await fetch(GRAPHQL_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query: pairInfoQuery }),
        });
        
        const pairInfoData = await pairInfoResponse.json();
        
        if (pairInfoData.errors) {
          console.error(`GraphQL errors for pair info:`, pairInfoData.errors);
          continue;
        }
        
        const tokenInfo = pairInfoData.data?.tokenByAddress;
        if (!tokenInfo) {
          console.log(`Token info not found for ${token.symbol}`);
          continue;
        }
        
        console.log(`Pairs as token0: ${tokenInfo.pairsAsToken0.length}`);
        tokenInfo.pairsAsToken0.forEach(pair => {
          console.log(`  ${pair.token0.symbol}-${pair.token1.symbol} (${pair.address})`);
        });
        
        console.log(`Pairs as token1: ${tokenInfo.pairsAsToken1.length}`);
        tokenInfo.pairsAsToken1.forEach(pair => {
          console.log(`  ${pair.token0.symbol}-${pair.token1.symbol} (${pair.address})`);
        });
      }
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testSpecificTokenPriceChart().catch(console.error); 