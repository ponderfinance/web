// Using built-in fetch API
async function runTest() {
  // Define a simpler GraphQL query just to test the database connection
  const query = `
    query TestSwap {
      swapTest {
        count
        data
      }
    }
  `;

  try {
    console.log('Sending GraphQL test query...');
    
    // Send the request
    const response = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    // Parse and display the response
    const result = await response.json();
    console.log('Response received:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.swapTest) {
      const test = result.data.swapTest;
      console.log(`Swap count from test: ${test.count}`);
      
      if (test.count > 0) {
        console.log('First few swaps:');
        const swapData = JSON.parse(test.data);
        console.log(JSON.stringify(swapData, null, 2));
      }
    }
    
    if (result.errors) {
      console.error('GraphQL errors:', result.errors);
    }
  } catch (error) {
    console.error('Error making GraphQL request:', error);
  }
}

// Run the test
console.log('Starting GraphQL API test with new resolver...');
runTest(); 