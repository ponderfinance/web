// Test GraphQL API directly
const fetch = require('node-fetch');

async function testAPI() {
  const tokenQuery = `
    query {
      token(id: "0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5") {
        address
        symbol
        priceUsd
        fdv
      }
    }
  `;

  const protocolQuery = `
    query {
      protocolMetrics {
        dailyVolumeUsd
        volume24hChange
      }
    }
  `;

  try {
    console.log('Testing Token Query...\n');
    const tokenRes = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: tokenQuery })
    });
    const tokenData = await tokenRes.json();
    console.log('Token Response:', JSON.stringify(tokenData, null, 2));

    console.log('\n\nTesting Protocol Metrics Query...\n');
    const protocolRes = await fetch('http://localhost:3000/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: protocolQuery })
    });
    const protocolData = await protocolRes.json();
    console.log('Protocol Response:', JSON.stringify(protocolData, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testAPI();