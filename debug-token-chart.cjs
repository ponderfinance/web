require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugTokenPriceChart() {
  try {
    console.log('Starting to debug tokenPriceChart...');
    
    // Try with a known token - KKUB
    const tokenAddress = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'; // KKUB
    
    // Find the token
    console.log(`Finding token with address: ${tokenAddress}`);
    const token = await prisma.token.findFirst({
      where: { address: tokenAddress.toLowerCase() },
      select: {
        id: true,
        decimals: true,
        address: true,
        symbol: true,
        pairsAsToken0: {
          select: {
            id: true,
            token1: {
              select: {
                id: true,
                address: true,
                decimals: true,
                symbol: true,
              }
            }
          }
        },
        pairsAsToken1: {
          select: {
            id: true,
            token0: {
              select: {
                id: true,
                address: true,
                decimals: true,
                symbol: true,
              }
            }
          }
        }
      }
    });

    if (!token) {
      console.error(`Token not found: ${tokenAddress}`);
      return;
    }

    console.log(`Found token: ${token.symbol}, id: ${token.id}, address: ${token.address}`);
    console.log(`Pairs as token0: ${token.pairsAsToken0.length}, pairs as token1: ${token.pairsAsToken1.length}`);

    // Get all pairs for this token
    const pairs = [
      ...token.pairsAsToken0.map(p => ({ 
        id: p.id, 
        isToken0: true,
        counterpartToken: p.token1
      })),
      ...token.pairsAsToken1.map(p => ({ 
        id: p.id, 
        isToken0: false,
        counterpartToken: p.token0
      }))
    ];

    if (pairs.length === 0) {
      console.error(`No pairs found for token: ${tokenAddress}`);
      return;
    }

    console.log(`Found ${pairs.length} total pairs for token ${token.symbol}`);
    pairs.forEach((pair, i) => {
      console.log(`Pair ${i+1}: ${pair.id}, isToken0: ${pair.isToken0}, counterpart: ${pair.counterpartToken.symbol}`);
    });

    // Fetch price snapshots
    console.log('\nFetching price snapshots for all pairs...');
    for (const pair of pairs) {
      console.log(`\nChecking snapshots for pair ${pair.id} with ${pair.counterpartToken.symbol}...`);
      
      const snapshots = await prisma.priceSnapshot.findMany({
        where: {
          pairId: pair.id
        },
        select: {
          id: true,
          timestamp: true,
          price0: true,
          price1: true,
          blockNumber: true,
          createdAt: true
        },
        orderBy: { timestamp: 'desc' },
        take: 10
      });
      
      console.log(`Found ${snapshots.length} snapshots`);
      
      if (snapshots.length > 0) {
        console.log('Sample snapshots:');
        snapshots.slice(0, 3).forEach((snapshot, i) => {
          console.log(`Snapshot ${i+1}:`);
          console.log(`  ID: ${snapshot.id}`);
          console.log(`  Timestamp: ${snapshot.timestamp} (${new Date(Number(snapshot.timestamp) * 1000).toISOString()})`);
          console.log(`  price0: ${snapshot.price0}, price1: ${snapshot.price1}`);
          console.log(`  BlockNumber: ${snapshot.blockNumber}`);
          console.log(`  CreatedAt: ${snapshot.createdAt}`);
        });
        
        // Process price from the snapshots
        console.log('\nProcessing prices for this pair:');
        const tokenDecimals = token.decimals || 18;
        const counterpartDecimals = pair.counterpartToken.decimals || 18;
        
        console.log(`Token decimals: ${tokenDecimals}, counterpart decimals: ${counterpartDecimals}`);
        
        snapshots.forEach((snapshot, i) => {
          try {
            let price;
            
            if (pair.isToken0) {
              // We're token0, using price0
              price = parseFloat(String(snapshot.price0));
              console.log(`Snapshot ${i+1}: Using price0=${price} (original: ${snapshot.price0})`);
            } else {
              // We're token1, using price1
              price = parseFloat(String(snapshot.price1));
              console.log(`Snapshot ${i+1}: Using price1=${price} (original: ${snapshot.price1})`);
            }
            
            console.log(`  Calculated price: ${price}`);
          } catch (error) {
            console.error(`  Error processing snapshot ${i+1}:`, error);
          }
        });
      } else {
        console.log('No snapshots found for this pair');
      }
    }
    
  } catch (error) {
    console.error('Error debugging token price chart:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\nDebug completed.');
  }
}

debugTokenPriceChart().catch(console.error); 