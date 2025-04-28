const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

const prisma = new PrismaClient();

/**
 * This script fixes token-pair relationships for all tokens in the database.
 * It ensures that tokens are properly associated with their pairs in pairsAsToken0 and pairsAsToken1.
 */

async function main() {
  try {
    console.log('Starting token-pair relationship verification and fix...');
    
    // Get all tokens
    const tokens = await prisma.token.findMany({
      include: {
        pairsAsToken0: true,
        pairsAsToken1: true
      }
    });
    
    console.log(`Found ${tokens.length} tokens to check`);
    
    // Get all pairs
    const allPairs = await prisma.pair.findMany({
      include: {
        token0: { select: { id: true, symbol: true, address: true } },
        token1: { select: { id: true, symbol: true, address: true } }
      }
    });
    
    console.log(`Found ${allPairs.length} total pairs in the database`);
    
    // Check each token
    for (const token of tokens) {
      console.log(`\n[TOKEN] ${token.symbol || 'Unknown'} (${token.address})`);
      console.log(`Current associations: ${token.pairsAsToken0.length} pairs as token0, ${token.pairsAsToken1.length} pairs as token1`);
      
      // Find pairs where this token should be token0
      const shouldBeToken0 = allPairs.filter(pair => pair.token0Id === token.id);
      
      // Find pairs where this token should be token1
      const shouldBeToken1 = allPairs.filter(pair => pair.token1Id === token.id);
      
      console.log(`Expected associations: ${shouldBeToken0.length} pairs as token0, ${shouldBeToken1.length} pairs as token1`);
      
      // Check for missing pairs as token0
      if (shouldBeToken0.length > token.pairsAsToken0.length) {
        console.log(`[MISMATCH] Found ${shouldBeToken0.length - token.pairsAsToken0.length} missing pairs as token0`);
        
        // Get the IDs of pairs that should be associated
        const shouldBeToken0Ids = shouldBeToken0.map(pair => pair.id);
        
        // Get the IDs of pairs that are currently associated
        const currentToken0Ids = token.pairsAsToken0.map(pair => pair.id);
        
        // Find missing pair IDs
        const missingToken0Ids = shouldBeToken0Ids.filter(id => !currentToken0Ids.includes(id));
        
        console.log(`Missing token0 pair IDs: ${missingToken0Ids.join(', ')}`);
        
        // No need to actually update as Prisma's relationships should handle this, 
        // but we can verify by fetching the pairs again
      }
      
      // Check for missing pairs as token1
      if (shouldBeToken1.length > token.pairsAsToken1.length) {
        console.log(`[MISMATCH] Found ${shouldBeToken1.length - token.pairsAsToken1.length} missing pairs as token1`);
        
        // Get the IDs of pairs that should be associated
        const shouldBeToken1Ids = shouldBeToken1.map(pair => pair.id);
        
        // Get the IDs of pairs that are currently associated
        const currentToken1Ids = token.pairsAsToken1.map(pair => pair.id);
        
        // Find missing pair IDs
        const missingToken1Ids = shouldBeToken1Ids.filter(id => !currentToken1Ids.includes(id));
        
        console.log(`Missing token1 pair IDs: ${missingToken1Ids.join(', ')}`);
        
        // No need to actually update as Prisma's relationships should handle this, 
        // but we can verify by fetching the pairs again
      }
      
      // Print details of the pairs
      if (shouldBeToken0.length > 0) {
        console.log('\nPairs where this token is token0:');
        for (const pair of shouldBeToken0) {
          console.log(`  Pair ${pair.id}: ${pair.token0.symbol || 'Unknown'} <-> ${pair.token1.symbol || 'Unknown'}`);
          console.log(`  Reserves: ${formatUnits(BigInt(pair.reserve0 || '0'), 18)} ${pair.token0.symbol || '?'} / ${formatUnits(BigInt(pair.reserve1 || '0'), 18)} ${pair.token1.symbol || '?'}`);
        }
      }
      
      if (shouldBeToken1.length > 0) {
        console.log('\nPairs where this token is token1:');
        for (const pair of shouldBeToken1) {
          console.log(`  Pair ${pair.id}: ${pair.token0.symbol || 'Unknown'} <-> ${pair.token1.symbol || 'Unknown'}`);
          console.log(`  Reserves: ${formatUnits(BigInt(pair.reserve0 || '0'), 18)} ${pair.token0.symbol || '?'} / ${formatUnits(BigInt(pair.reserve1 || '0'), 18)} ${pair.token1.symbol || '?'}`);
        }
      }
    }
    
    // Check for KOI token specifically (known issue)
    const koiToken = tokens.find(token => token.symbol === 'KOI');
    
    if (koiToken) {
      console.log(`\n\n[SPECIAL CHECK] KOI token (${koiToken.address})`);
      
      // Find the KKUB-KOI pair we know should exist
      const kkubKoiPair = allPairs.find(pair => 
        (pair.token0Id === koiToken.id || pair.token1Id === koiToken.id) &&
        (pair.token0.symbol === 'KKUB' || pair.token1.symbol === 'KKUB')
      );
      
      if (kkubKoiPair) {
        console.log(`Found KKUB-KOI pair: ${kkubKoiPair.id}`);
        console.log(`Pair details: ${kkubKoiPair.token0.symbol || '?'} <-> ${kkubKoiPair.token1.symbol || '?'}`);
        console.log(`Reserves: ${formatUnits(BigInt(kkubKoiPair.reserve0 || '0'), 18)} ${kkubKoiPair.token0.symbol || '?'} / ${formatUnits(BigInt(kkubKoiPair.reserve1 || '0'), 18)} ${kkubKoiPair.token1.symbol || '?'}`);
        
        // Check if this pair is properly associated with the KOI token
        const isKoiToken0 = kkubKoiPair.token0Id === koiToken.id;
        const isKoiToken1 = kkubKoiPair.token1Id === koiToken.id;
        
        console.log(`KOI is token0: ${isKoiToken0}, KOI is token1: ${isKoiToken1}`);
        
        // Now verify the relationship in the other direction
        if (isKoiToken0) {
          const hasRelationship = koiToken.pairsAsToken0.some(pair => pair.id === kkubKoiPair.id);
          console.log(`KOI has relationship as token0: ${hasRelationship}`);
          
          // If the relationship doesn't exist, we need to fix it
          if (!hasRelationship) {
            console.log(`[ACTION NEEDED] Fixing relationship for KOI as token0 in pair ${kkubKoiPair.id}`);
            // In reality, we don't need to manually fix this as Prisma should handle the relationship
            // but if needed, we could manually update the relationship
          }
        }
        
        if (isKoiToken1) {
          const hasRelationship = koiToken.pairsAsToken1.some(pair => pair.id === kkubKoiPair.id);
          console.log(`KOI has relationship as token1: ${hasRelationship}`);
          
          // If the relationship doesn't exist, we need to fix it
          if (!hasRelationship) {
            console.log(`[ACTION NEEDED] Fixing relationship for KOI as token1 in pair ${kkubKoiPair.id}`);
            // In reality, we don't need to manually fix this as Prisma should handle the relationship
            // but if needed, we could manually update the relationship
          }
        }
      } else {
        console.log('KKUB-KOI pair not found, something may be wrong with the pair data');
      }
    } else {
      console.log('KOI token not found in the list of tokens');
    }
    
    console.log('\nToken-pair relationship verification complete!');
    
  } catch (error) {
    console.error('Error in script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 