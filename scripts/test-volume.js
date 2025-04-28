const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

// Define token addresses we want to test
const KKUB_ADDRESS = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'.toLowerCase();
const KOI_ADDRESS = '0xe0432224871917fb5a137f4a153a51ecf9f74f57'.toLowerCase();

const prisma = new PrismaClient();

// Mock the Token Price Service
const TokenPriceService = {
  getTokenPriceUSD: async (tokenId) => {
    console.log(`Mocked price service call for ${tokenId}`);
    return 1.0; // Return a fixed price for testing
  },
  getTokenPricesUSDBulk: async (tokenIds) => {
    console.log(`Mocked bulk price service call for ${tokenIds.length} tokens`);
    const result = {};
    tokenIds.forEach(id => {
      result[id] = '1.0'; // Return fixed prices for testing
    });
    return result;
  }
};

// Create proper dataloader-like interface
const createMockLoaders = (prismaClient) => {
  return {
    tokenLoader: {
      load: async (id) => {
        console.log(`Mock loader: Loading token with id ${id}`);
        return prismaClient.token.findUnique({
          where: { id },
          select: { 
            symbol: true, 
            decimals: true, 
            priceUSD: true, 
            address: true,
            pairsAsToken0: true,
            pairsAsToken1: true
          }
        });
      }
    },
    swap: {
      loadMany: async (filters) => {
        console.log(`Mock loader: Loading swaps with filters`);
        return prismaClient.swap.findMany(filters);
      }
    },
    pair: {
      loadMany: async (filters) => {
        console.log(`Mock loader: Loading pairs with filters`);
        return prismaClient.pair.findMany(filters);
      }
    }
  };
};

const verifyTokenPairAssociations = async (prismaClient) => {
  console.log('[VERIFICATION] Checking token-pair associations...');
  
  // Get all tokens
  const tokens = await prismaClient.token.findMany({
    include: {
      pairsAsToken0: true,
      pairsAsToken1: true
    }
  });
  console.log(`Found ${tokens.length} tokens`);

  // Check each token's pair associations
  for (const token of tokens) {
    console.log(`\n[VERIFICATION] Checking token: ${token.symbol} (${token.address})`);
    
    // Get pairs where token is token0
    const pairsAsToken0 = await prismaClient.pair.findMany({
      where: { token0Id: token.id },
      include: {
        token0: { select: { symbol: true, address: true } },
        token1: { select: { symbol: true, address: true } }
      }
    });
    
    // Get pairs where token is token1
    const pairsAsToken1 = await prismaClient.pair.findMany({
      where: { token1Id: token.id },
      include: {
        token0: { select: { symbol: true, address: true } },
        token1: { select: { symbol: true, address: true } }
      }
    });
    
    // Check if the token's relationship count matches the actual pairs
    const token0Diff = pairsAsToken0.length - token.pairsAsToken0.length;
    const token1Diff = pairsAsToken1.length - token.pairsAsToken1.length;
    
    if (token0Diff !== 0 || token1Diff !== 0) {
      console.log(`[WARNING] Token relationships mismatch!`);
      console.log(`Token has ${token.pairsAsToken0.length} pairs as token0, but should have ${pairsAsToken0.length}`);
      console.log(`Token has ${token.pairsAsToken1.length} pairs as token1, but should have ${pairsAsToken1.length}`);
    } else {
      console.log(`Token ${token.symbol} has ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1 (correctly associated)`);
    }
    
    // Log details about each pair
    if (pairsAsToken0.length > 0) {
      console.log(`\nPairs as token0:`);
      pairsAsToken0.forEach(pair => {
        console.log(`  Pair ${pair.id}: ${pair.token0.symbol} <-> ${pair.token1.symbol}`);
        console.log(`  Reserves: ${formatUnits(BigInt(pair.reserve0 || '0'), 18)} ${pair.token0.symbol} / ${formatUnits(BigInt(pair.reserve1 || '0'), 18)} ${pair.token1.symbol}`);
      });
    }
    
    if (pairsAsToken1.length > 0) {
      console.log(`\nPairs as token1:`);
      pairsAsToken1.forEach(pair => {
        console.log(`  Pair ${pair.id}: ${pair.token0.symbol} <-> ${pair.token1.symbol}`);
        console.log(`  Reserves: ${formatUnits(BigInt(pair.reserve0 || '0'), 18)} ${pair.token0.symbol} / ${formatUnits(BigInt(pair.reserve1 || '0'), 18)} ${pair.token1.symbol}`);
      });
    }
  }
};

const calculateTokenVolume24h = async (
  tokenId,
  prismaClient,
  loaders = null
) => {
  try {
    console.log(`Calculating 24h volume for token ID: ${tokenId}`);
    
    // Get the token to check decimals and price using loader if available
    let token;
    if (loaders && loaders.tokenLoader) {
      token = await loaders.tokenLoader.load(tokenId);
      console.log(`Used loader to fetch token: ${tokenId}`);
    } else {
      token = await prismaClient.token.findUnique({
        where: { id: tokenId },
        select: { 
          symbol: true, 
          decimals: true, 
          priceUSD: true, 
          address: true,
          pairsAsToken0: true,
          pairsAsToken1: true
        }
      });
      console.log(`Used direct query to fetch token: ${tokenId}`);
    }

    if (!token) {
      console.error(`Token not found with ID: ${tokenId}`);
      return { [tokenId]: '0' };
    }
    
    console.log(`Found token ${token.symbol} (${token.address}) with decimals: ${token.decimals}, price: ${token.priceUSD}`);
    
    // Log pair information
    const pairsAsToken0 = token.pairsAsToken0 || [];
    const pairsAsToken1 = token.pairsAsToken1 || [];
    console.log(`Token has ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1`);

    // If the token has no pairs, return 0 volume
    if (pairsAsToken0.length === 0 && pairsAsToken1.length === 0) {
      console.log(`Token ${token.symbol} has no pairs, skipping volume calculation`);
      return { [tokenId]: '0' };
    }

    // Get current price if not available in token object
    let tokenPrice = token.priceUSD ? parseFloat(token.priceUSD) : 0;
    if (tokenPrice <= 0) {
      try {
        // Use TokenPriceService directly rather than recursive call
        const priceFromService = await TokenPriceService.getTokenPriceUSD(tokenId);
        tokenPrice = priceFromService;
        console.log(`Fetched price from service for ${token.symbol}: ${tokenPrice}`);
      } catch (error) {
        console.error(`Error fetching price for ${token.symbol}:`, error);
      }
    }

    // Get 24h swap data for this token
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const timeThreshold = Math.floor(oneDayAgo.getTime() / 1000);
    
    console.log(`Getting swaps since: ${new Date(timeThreshold * 1000).toISOString()}`);
    
    // Use loader if available, otherwise direct query
    let swaps;
    const queryParams = {
      where: {
        OR: [
          { pair: { token0Id: tokenId } },
          { pair: { token1Id: tokenId } }
        ],
        timestamp: { gte: timeThreshold }
      },
      include: {
        pair: {
          include: {
            token0: {
              select: {
                id: true,
                decimals: true,
                priceUSD: true,
                symbol: true
              }
            },
            token1: {
              select: {
                id: true,
                decimals: true,
                priceUSD: true,
                symbol: true
              }
            }
          }
        }
      }
    };
    
    if (loaders && loaders.swap && typeof loaders.swap.loadMany === 'function') {
      swaps = await loaders.swap.loadMany(queryParams);
      console.log(`Used loader to fetch swaps`);
    } else {
      swaps = await prismaClient.swap.findMany(queryParams);
      console.log(`Used direct query to fetch swaps`);
    }

    console.log(`Found ${swaps.length} swaps for ${token.symbol} in the last 24h`);

    // Calculate volume in both token units and USD
    let volumeTokenUnits = 0;
    let volumeUSD = 0;
    
    for (const swap of swaps) {
      // Determine if our token is token0 or token1 in the pair
      const isToken0 = swap.pair.token0Id === tokenId;
      const swapToken = isToken0 ? swap.pair.token0 : swap.pair.token1;
      const tokenDecimals = swapToken.decimals || token.decimals || 18;
      
      console.log(`Processing swap: ${swap.id}, isToken0: ${isToken0}, token: ${swapToken.symbol}`);
      
      // Get token amounts involved in the swap
      let tokenAmount = 0;
      if (isToken0) {
        // If our token is token0, add both amountIn0 and amountOut0
        if (swap.amountIn0) {
          const amountIn = parseFloat(formatUnits(BigInt(swap.amountIn0), tokenDecimals));
          console.log(`  amountIn0: ${swap.amountIn0} (${amountIn} tokens)`);
          tokenAmount += amountIn;
        }
        
        if (swap.amountOut0) {
          const amountOut = parseFloat(formatUnits(BigInt(swap.amountOut0), tokenDecimals));
          console.log(`  amountOut0: ${swap.amountOut0} (${amountOut} tokens)`);
          tokenAmount += amountOut;
        }
      } else {
        // If our token is token1, add both amountIn1 and amountOut1
        if (swap.amountIn1) {
          const amountIn = parseFloat(formatUnits(BigInt(swap.amountIn1), tokenDecimals));
          console.log(`  amountIn1: ${swap.amountIn1} (${amountIn} tokens)`);
          tokenAmount += amountIn;
        }
        
        if (swap.amountOut1) {
          const amountOut = parseFloat(formatUnits(BigInt(swap.amountOut1), tokenDecimals));
          console.log(`  amountOut1: ${swap.amountOut1} (${amountOut} tokens)`);
          tokenAmount += amountOut;
        }
      }
      
      console.log(`  Total token amount: ${tokenAmount}`);
      
      // Add to token units volume
      volumeTokenUnits += tokenAmount;
      
      // Calculate USD value - use token price or the one from the pair
      let effectivePrice = tokenPrice;
      if (effectivePrice <= 0) {
        // Try to get price from the pair
        effectivePrice = parseFloat(swapToken.priceUSD || '0');
      }
      
      if (effectivePrice > 0) {
        const swapVolumeUSD = tokenAmount * effectivePrice;
        console.log(`  Swap USD value: $${swapVolumeUSD.toFixed(2)} (price: $${effectivePrice})`);
        volumeUSD += swapVolumeUSD;
      } else {
        console.log(`  No price available to calculate USD value`);
      }
    }
    
    console.log(`Token ${token.symbol} 24h volume: ${volumeTokenUnits} tokens, $${volumeUSD.toFixed(2)} USD`);
    
    // Return USD volume if available, otherwise return token units
    if (volumeUSD > 0) {
      return { [tokenId]: volumeUSD.toString() };
    } else {
      return { [tokenId]: volumeTokenUnits.toString() };
    }
  } catch (error) {
    console.error(`Error calculating volume for token ${tokenId}:`, error);
    return { [tokenId]: '0' };
  }
};

async function main() {
  try {
    console.log("===== VERIFYING TOKEN PAIR ASSOCIATIONS =====");
    await verifyTokenPairAssociations(prisma);
    
    // Get all tokens to test
    const tokens = await prisma.token.findMany();
    
    // Create mock loaders
    const mockLoaders = createMockLoaders(prisma);
    
    console.log("\n\n===== TESTING ALL TOKENS VOLUME =====");
    
    // Test each token
    for (const token of tokens) {
      console.log(`\n----- Testing ${token.symbol} (${token.address}) -----`);
      console.log(`Token price: ${token.priceUSD || 'unknown'}`);
      console.log(`Token decimals: ${token.decimals || 'unknown'}`);
      
      // Calculate volume with loaders
      const volumeData = await calculateTokenVolume24h(token.id, prisma, mockLoaders);
      console.log(`🔹 Calculated ${token.symbol} volume: $${volumeData[token.id]}`);
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 