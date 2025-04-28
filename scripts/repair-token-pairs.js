const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

const prisma = new PrismaClient();

/**
 * This script fixes token-pair relationships for tokens that have missing associations.
 * It identifies pairs that should be associated with tokens and updates them.
 */

async function main() {
  try {
    console.log('Starting token-pair relationship repair...');
    
    // Get all tokens with their current associations
    const tokens = await prisma.token.findMany({
      include: {
        pairsAsToken0: true,
        pairsAsToken1: true
      }
    });
    
    console.log(`Found ${tokens.length} tokens to check`);
    
    // Get all pairs with their token details
    const allPairs = await prisma.pair.findMany({
      include: {
        token0: { select: { id: true, symbol: true, address: true } },
        token1: { select: { id: true, symbol: true, address: true } }
      }
    });
    
    console.log(`Found ${allPairs.length} total pairs in the database`);
    
    // Track any updates we need to make
    const updates = [];
    
    // Check each token for missing pair associations
    for (const token of tokens) {
      console.log(`\n[TOKEN] ${token.symbol || 'Unknown'} (${token.address})`);
      
      // Find pairs where this token should be token0
      const shouldBeToken0 = allPairs.filter(pair => pair.token0Id === token.id);
      
      // Find pairs where this token should be token1
      const shouldBeToken1 = allPairs.filter(pair => pair.token1Id === token.id);
      
      // Get the IDs of pairs that are currently associated
      const currentToken0Ids = token.pairsAsToken0.map(pair => pair.id);
      const currentToken1Ids = token.pairsAsToken1.map(pair => pair.id);
      
      // Find missing pair IDs for token0
      const missingToken0Ids = shouldBeToken0
        .filter(pair => !currentToken0Ids.includes(pair.id))
        .map(pair => pair.id);
      
      // Find missing pair IDs for token1
      const missingToken1Ids = shouldBeToken1
        .filter(pair => !currentToken1Ids.includes(pair.id))
        .map(pair => pair.id);
      
      // Report on issues found
      if (missingToken0Ids.length > 0) {
        console.log(`[ISSUE] Found ${missingToken0Ids.length} missing pairs as token0: ${missingToken0Ids.join(', ')}`);
        updates.push({
          tokenId: token.id,
          tokenSymbol: token.symbol,
          missingPairIds: missingToken0Ids,
          isToken0: true
        });
      }
      
      if (missingToken1Ids.length > 0) {
        console.log(`[ISSUE] Found ${missingToken1Ids.length} missing pairs as token1: ${missingToken1Ids.join(', ')}`);
        updates.push({
          tokenId: token.id,
          tokenSymbol: token.symbol,
          missingPairIds: missingToken1Ids,
          isToken0: false
        });
      }
    }
    
    // If we have updates to make, process them
    if (updates.length > 0) {
      console.log(`\n[REPAIR] Need to fix ${updates.length} token-pair relationships`);
      
      for (const update of updates) {
        console.log(`\nFixing ${update.tokenSymbol} token (${update.tokenId}) for ${update.missingPairIds.length} pairs as token${update.isToken0 ? '0' : '1'}`);
        
        for (const pairId of update.missingPairIds) {
          console.log(`Processing pair ${pairId}`);
          
          try {
            // First, verify the pair exists with the expected token relationship
            const pairToFix = await prisma.pair.findUnique({
              where: { id: pairId },
              include: {
                token0: { select: { id: true, symbol: true } },
                token1: { select: { id: true, symbol: true } }
              }
            });
            
            if (!pairToFix) {
              console.log(`  [ERROR] Pair ${pairId} not found in database`);
              continue;
            }
            
            // Verify the token is actually part of this pair
            const isToken0 = pairToFix.token0Id === update.tokenId;
            const isToken1 = pairToFix.token1Id === update.tokenId;
            
            if (update.isToken0 && !isToken0) {
              console.log(`  [ERROR] Expected ${update.tokenSymbol} to be token0 but it's not`);
              continue;
            }
            
            if (!update.isToken0 && !isToken1) {
              console.log(`  [ERROR] Expected ${update.tokenSymbol} to be token1 but it's not`);
              continue;
            }
            
            // Looks good, let's force a refresh of both token relationships for this pair
            console.log(`  Updating pair ${pairId} (${pairToFix.token0.symbol}-${pairToFix.token1.symbol})`);
            
            // Update the pair
            await prisma.pair.update({
              where: { id: pairId },
              data: {
                // Update the timestamp to trigger a refresh
                updatedAt: new Date()
              }
            });
            
            // Now, let's also update the token to explicitly connect the pair
            if (update.isToken0) {
              await prisma.token.update({
                where: { id: update.tokenId },
                data: {
                  pairsAsToken0: {
                    connect: { id: pairId }
                  }
                }
              });
              console.log(`  Connected pair ${pairId} to ${update.tokenSymbol} as token0`);
            } else {
              await prisma.token.update({
                where: { id: update.tokenId },
                data: {
                  pairsAsToken1: {
                    connect: { id: pairId }
                  }
                }
              });
              console.log(`  Connected pair ${pairId} to ${update.tokenSymbol} as token1`);
            }
            
            console.log(`  ✅ Successfully updated relationship for pair ${pairId}`);
          } catch (error) {
            console.error(`  [ERROR] Failed to update pair ${pairId}:`, error);
          }
        }
      }
      
      // Final verification
      console.log('\n[VERIFICATION] Checking if issues were resolved...');
      
      const verifiedTokens = await prisma.token.findMany({
        where: {
          id: { in: updates.map(u => u.tokenId) }
        },
        include: {
          pairsAsToken0: true,
          pairsAsToken1: true
        }
      });
      
      for (const token of verifiedTokens) {
        console.log(`\nVerifying ${token.symbol} token (${token.id})`);
        console.log(`Current associations: ${token.pairsAsToken0.length} pairs as token0, ${token.pairsAsToken1.length} pairs as token1`);
        
        // Find the updates for this token
        const tokenUpdates = updates.filter(u => u.tokenId === token.id);
        let allFixed = true;
        
        for (const update of tokenUpdates) {
          const pairCollection = update.isToken0 ? token.pairsAsToken0 : token.pairsAsToken1;
          const currentPairIds = pairCollection.map(p => p.id);
          
          const stillMissing = update.missingPairIds.filter(id => !currentPairIds.includes(id));
          
          if (stillMissing.length > 0) {
            console.log(`  ❌ Still missing ${stillMissing.length} pairs as token${update.isToken0 ? '0' : '1'}: ${stillMissing.join(', ')}`);
            allFixed = false;
            
            // Try one more time with direct database operation if Prisma relationships failed
            for (const pairId of stillMissing) {
              try {
                if (update.isToken0) {
                  console.log(`  Attempting manual fix for token0 relationship with pair ${pairId}`);
                  // Double-check the pair's token0Id is correct
                  const checkPair = await prisma.pair.findUnique({
                    where: { id: pairId },
                    select: { token0Id: true }
                  });
                  
                  if (checkPair.token0Id !== token.id) {
                    console.log(`  [ERROR] Pair ${pairId} token0Id (${checkPair.token0Id}) does not match token ${token.id}`);
                    continue;
                  }
                } else {
                  console.log(`  Attempting manual fix for token1 relationship with pair ${pairId}`);
                  // Double-check the pair's token1Id is correct
                  const checkPair = await prisma.pair.findUnique({
                    where: { id: pairId },
                    select: { token1Id: true }
                  });
                  
                  if (checkPair.token1Id !== token.id) {
                    console.log(`  [ERROR] Pair ${pairId} token1Id (${checkPair.token1Id}) does not match token ${token.id}`);
                    continue;
                  }
                }
              } catch (error) {
                console.error(`  [ERROR] Manual fix attempt failed for pair ${pairId}:`, error);
              }
            }
          } else {
            console.log(`  ✅ All pairs as token${update.isToken0 ? '0' : '1'} successfully associated`);
          }
        }
        
        if (allFixed) {
          console.log(`  ✅ All issues for ${token.symbol} token have been fixed!`);
        } else {
          console.log(`  ⚠️ Some issues for ${token.symbol} token could not be resolved.`);
        }
      }
    } else {
      console.log('\n[INFO] No token-pair relationship issues found!');
    }
    
    // Run a final check specifically for KOI token + the KKUB-KOI pair
    const koiToken = await prisma.token.findFirst({
      where: { symbol: 'KOI' },
      include: {
        pairsAsToken0: true,
        pairsAsToken1: true
      }
    });
    
    if (koiToken) {
      console.log(`\n[SPECIAL CHECK] KOI token (${koiToken.id})`);
      console.log(`Has ${koiToken.pairsAsToken0.length} pairs as token0 and ${koiToken.pairsAsToken1.length} pairs as token1`);
      
      // Look for the specific KKUB-KOI pair
      const kkubKoiPair = await prisma.pair.findFirst({
        where: {
          OR: [
            {
              token0: { symbol: 'KOI' },
              token1: { symbol: 'KKUB' }
            },
            {
              token0: { symbol: 'KKUB' },
              token1: { symbol: 'KOI' }
            }
          ]
        },
        include: {
          token0: { select: { id: true, symbol: true } },
          token1: { select: { id: true, symbol: true } }
        }
      });
      
      if (kkubKoiPair) {
        console.log(`Found KKUB-KOI pair: ${kkubKoiPair.id} (${kkubKoiPair.token0.symbol}-${kkubKoiPair.token1.symbol})`);
        
        // Check if this pair is properly connected to the KOI token
        const isKoiToken0 = kkubKoiPair.token0.symbol === 'KOI';
        const isKoiToken1 = kkubKoiPair.token1.symbol === 'KOI';
        const relationField = isKoiToken0 ? 'pairsAsToken0' : 'pairsAsToken1';
        
        const hasRelation = koiToken[relationField].some(p => p.id === kkubKoiPair.id);
        
        if (!hasRelation) {
          console.log(`[CRITICAL] KOI token is ${isKoiToken0 ? 'token0' : 'token1'} in pair ${kkubKoiPair.id} but relation is missing!`);
          
          try {
            // Try one last time with a more direct approach
            console.log(`Attempting final direct fix for KOI and pair ${kkubKoiPair.id}...`);
            
            if (isKoiToken0) {
              await prisma.token.update({
                where: { id: koiToken.id },
                data: {
                  pairsAsToken0: {
                    connect: { id: kkubKoiPair.id }
                  }
                }
              });
            } else {
              await prisma.token.update({
                where: { id: koiToken.id },
                data: {
                  pairsAsToken1: {
                    connect: { id: kkubKoiPair.id }
                  }
                }
              });
            }
            
            console.log(`✅ Final fix applied successfully!`);
          } catch (error) {
            console.error(`[ERROR] Final fix attempt failed:`, error);
          }
        } else {
          console.log(`✅ KOI token is properly related to the KKUB-KOI pair as ${isKoiToken0 ? 'token0' : 'token1'}`);
        }
      } else {
        console.log(`[ERROR] Could not find KKUB-KOI pair!`);
      }
    }
    
    console.log('\nToken-pair relationship repair complete!');
    
  } catch (error) {
    console.error('Error in repair script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error); 