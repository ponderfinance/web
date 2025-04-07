// Using the built-in fetch API in Node.js 18+
async function runQuery() {
  // Define a complex GraphQL query that would be used in the frontend
  const query = `
    query RecentTxs {
      recentTransactions(first: 10) {
        edges {
          node {
            id
            txHash
            userAddress
            amountIn0
            amountIn1
            amountOut0
            amountOut1
            timestamp
            token0 {
              id
              symbol
              address
            }
            token1 {
              id
              symbol
              address
            }
            valueUSD
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `;

  try {
    console.log('Sending GraphQL query...');
    
    // Send the request
    const response = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    // Parse and display the response
    const result = await response.json();
    console.log('Response received:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.recentTransactions) {
      const txs = result.data.recentTransactions;
      console.log(`Total transaction count: ${txs.totalCount}`);
      console.log(`Returned transactions: ${txs.edges.length}`);
    }
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
    }
  } catch (error) {
    console.error('Error making GraphQL request:', error);
  }
}

// Run the test
console.log('Starting GraphQL API test...');
runQuery(); 