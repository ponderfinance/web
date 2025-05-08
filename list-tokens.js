#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');

// Configure environment variables
dotenv.config();

// Create Prisma client
const prisma = new PrismaClient();

/**
 * Function to list all tokens in the database
 */
async function listTokens() {
  console.log('\n=== Tokens in Database ===');
  
  try {
    const tokens = await prisma.token.findMany({
      select: {
        id: true,
        name: true,
        symbol: true,
        address: true,
        decimals: true,
        priceUSD: true
      },
      orderBy: {
        symbol: 'asc'
      }
    });
    
    console.log(`Found ${tokens.length} tokens in the database`);
    
    // Look for KOI specifically
    const koiTokens = tokens.filter(token => 
      token.symbol?.toLowerCase().includes('koi') || 
      token.name?.toLowerCase().includes('koi')
    );
    
    if (koiTokens.length > 0) {
      console.log('\nFound KOI-like tokens:');
      koiTokens.forEach(token => {
        console.log(`- ${token.name} (${token.symbol}) - Address: ${token.address}`);
        console.log(`  ID: ${token.id}, Decimals: ${token.decimals}, Price: $${token.priceUSD}`);
      });
    } else {
      console.log('\nNo KOI-like tokens found by name or symbol.');
      
      // List all tokens to check manually
      console.log('\nAll tokens in the database:');
      tokens.forEach(token => {
        console.log(`- ${token.name || 'Unknown'} (${token.symbol || 'No Symbol'}) - ${token.address}`);
      });
    }
  } catch (error) {
    console.error('Error listing tokens:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
listTokens()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  }); 