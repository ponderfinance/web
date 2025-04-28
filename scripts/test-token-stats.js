const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

const KKUB_ADDRESS = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'.toLowerCase();

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

// Mock Context
const context = {
  prisma,
  loaders: {}
};

// Simplified resolvers for testing
const resolvers = {
  marketCap: async (parent, _args) => {
    try {
      console.log(`Calculating market cap for ${parent.symbol || 'unknown'} (${parent.address})`);
      
      // Get token price
      const tokenPrice = parseFloat(parent.priceUSD || '1.0'); // Use mocked price
      console.log(`Token price: ${tokenPrice}`);
      
      if (tokenPrice <= 0) {
        console.log('Token price is zero or invalid, returning 0 market cap');
        return '0';
      }
      
      // Get token ID
      const tokenId = parent.id;
      if (!tokenId) {
        console.error('Token ID is missing');
        return '0';
      }
      
      try {
        // Try to get supply from the supply model
        const supply = await prisma.tokenSupply.findUnique({
          where: { tokenId }
        });
        
        console.log(`Supply data:`, supply);
        
        // If we have supply data, use it for accurate calculation
        if (supply && supply.circulating) {
          const tokenDecimals = parent.decimals || 18;
          
          // CRITICAL FIX: The supply is stored without accounting for decimals
          // directly use the value as is without format conversion
          const circulatingSupply = parseFloat(supply.circulating);
          
          console.log(`Raw circulating supply: ${supply.circulating}`);
          console.log(`Using circulating supply: ${circulatingSupply}`);
          
          // Calculate and return market cap
          const marketCap = tokenPrice * circulatingSupply;
          console.log(`Final market cap: ${marketCap}`);
          return marketCap.toString();
        }
        
        // If we have total supply but no circulating, estimate
        if (supply && supply.total) {
          const tokenDecimals = parent.decimals || 18;
          const totalSupply = Number(
            formatUnits(BigInt(supply.total), tokenDecimals)
          );
          
          console.log(`Using total supply: ${totalSupply}`);
          const estimatedCirculating = totalSupply * 0.5; // Assume 50% is circulating
          const marketCap = tokenPrice * estimatedCirculating;
          console.log(`Estimated market cap from total supply: ${marketCap}`);
          return marketCap.toString();
        }
        
        // No supply data, estimate from reserves
        console.log(`No supply data, estimating from reserves`);
        
        // Get pairs
        const pairsAsToken0 = await prisma.pair.findMany({
          where: { token0Id: tokenId },
          select: { 
            id: true, 
            reserve0: true,
            token0: {
              select: {
                symbol: true, 
                decimals: true
              }
            }
          }
        });
        
        const pairsAsToken1 = await prisma.pair.findMany({
          where: { token1Id: tokenId },
          select: { 
            id: true, 
            reserve1: true,
            token1: {
              select: {
                symbol: true, 
                decimals: true
              }
            }
          }
        });
        
        console.log(`Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1`);
        
        // Sum up all reserves
        let totalInLiquidity = BigInt(0);
        const tokenDecimals = parent.decimals || 18;
        
        for (const pair of pairsAsToken0) {
          if (pair.reserve0) {
            console.log(`Pair ${pair.id} reserve0: ${pair.reserve0}`);
            totalInLiquidity += BigInt(pair.reserve0);
          }
        }
        
        for (const pair of pairsAsToken1) {
          if (pair.reserve1) {
            console.log(`Pair ${pair.id} reserve1: ${pair.reserve1}`);
            totalInLiquidity += BigInt(pair.reserve1);
          }
        }
        
        // Calculate from reserves
        if (totalInLiquidity > BigInt(0)) {
          const formattedLiquidity = formatUnits(totalInLiquidity, tokenDecimals);
          console.log(`Total in liquidity: ${formattedLiquidity}`);
          
          // Assume liquidity is 10% of circulating supply
          const estimatedCirculating = Number(formatUnits(totalInLiquidity * BigInt(10), tokenDecimals));
          const marketCap = tokenPrice * estimatedCirculating;
          console.log(`Estimated market cap from reserves: ${marketCap}`);
          return marketCap.toString();
        }
        
        // Fallback
        console.log(`No reserves found, using fallback`);
        const fallbackMC = tokenPrice * 1000000; // Assume 1M token supply
        console.log(`Fallback market cap: ${fallbackMC}`);
        return fallbackMC.toString();
      } catch (error) {
        console.error('Error calculating market cap:', error);
        return '0';
      }
    } catch (error) {
      console.error('Error resolving token market cap:', error);
      return '0';
    }
  },
  
  fdv: async (parent, _args) => {
    try {
      console.log(`Calculating FDV for ${parent.symbol || 'unknown'} (${parent.address})`);
      
      // Get token price
      const tokenPrice = parseFloat(parent.priceUSD || '1.0'); // Use mocked price
      console.log(`Token price: ${tokenPrice}`);
      
      if (tokenPrice <= 0) {
        console.log('Token price is zero or invalid, returning 0 FDV');
        return '0';
      }
      
      // Get token ID
      const tokenId = parent.id;
      if (!tokenId) {
        console.error('Token ID is missing');
        return '0';
      }
      
      try {
        // Try to get supply from the supply model
        const supply = await prisma.tokenSupply.findUnique({
          where: { tokenId }
        });
        
        console.log(`Supply data:`, supply);
        
        // If we have total supply, use it
        if (supply && supply.total) {
          const tokenDecimals = parent.decimals || 18;
          
          // CRITICAL FIX: The supply is stored without accounting for decimals
          const totalSupply = parseFloat(supply.total);
          
          console.log(`Raw total supply: ${supply.total}`);
          console.log(`Using total supply: ${totalSupply}`);
          
          // Calculate and return FDV
          const fdv = tokenPrice * totalSupply;
          console.log(`Final FDV: ${fdv}`);
          return fdv.toString();
        }
        
        // No total supply, estimate from reserves
        console.log(`No total supply data, estimating from reserves`);
        
        // Get pairs
        const pairsAsToken0 = await prisma.pair.findMany({
          where: { token0Id: tokenId },
          select: { id: true, reserve0: true }
        });
        
        const pairsAsToken1 = await prisma.pair.findMany({
          where: { token1Id: tokenId },
          select: { id: true, reserve1: true }
        });
        
        console.log(`Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1`);
        
        // Sum up all reserves
        let totalInLiquidity = BigInt(0);
        const tokenDecimals = parent.decimals || 18;
        
        for (const pair of pairsAsToken0) {
          if (pair.reserve0) {
            console.log(`Pair ${pair.id} reserve0: ${pair.reserve0}`);
            totalInLiquidity += BigInt(pair.reserve0);
          }
        }
        
        for (const pair of pairsAsToken1) {
          if (pair.reserve1) {
            console.log(`Pair ${pair.id} reserve1: ${pair.reserve1}`);
            totalInLiquidity += BigInt(pair.reserve1);
          }
        }
        
        // Calculate from reserves
        if (totalInLiquidity > BigInt(0)) {
          const formattedLiquidity = formatUnits(totalInLiquidity, tokenDecimals);
          console.log(`Total in liquidity: ${formattedLiquidity}`);
          
          // For FDV, estimate total supply as 20x liquidity
          const estimatedTotal = Number(formatUnits(totalInLiquidity * BigInt(20), tokenDecimals));
          const fdv = tokenPrice * estimatedTotal;
          console.log(`Estimated FDV from reserves: ${fdv}`);
          return fdv.toString();
        }
        
        // Fallback to market cap * 2.5
        console.log(`No reserves found, using market cap estimate`);
        const marketCap = await resolvers.marketCap(parent);
        const marketCapValue = parseFloat(marketCap);
        const fdv = marketCapValue * 2.5;
        console.log(`Estimated FDV from market cap: ${fdv}`);
        return fdv.toString();
      } catch (error) {
        console.error('Error calculating FDV:', error);
        return '0';
      }
    } catch (error) {
      console.error('Error resolving token FDV:', error);
      return '0';
    }
  }
};

async function main() {
  try {
    // Get the token
    const token = await prisma.token.findFirst({
      where: { 
        address: KKUB_ADDRESS 
      },
      include: {
        pairsAsToken0: {
          include: {
            token0: true,
            token1: true,
          }
        },
        pairsAsToken1: {
          include: {
            token0: true,
            token1: true,
          }
        }
      }
    });
    
    if (!token) {
      console.log(`Token not found: ${KKUB_ADDRESS}`);
      return;
    }
    
    console.log(`Found token: ${token.symbol} (${token.address})`);
    console.log(`Token price: ${token.priceUSD || 'unknown'}`);
    console.log(`Token decimals: ${token.decimals || 'unknown'}`);
    
    // Test our resolvers
    const marketCap = await resolvers.marketCap(token);
    console.log(`\n🔹 Calculated market cap: $${marketCap}`);
    
    const fdv = await resolvers.fdv(token);
    console.log(`\n🔹 Calculated FDV: $${fdv}`);
    
    // Get pairs to examine
    console.log(`\n🔹 Examining pairs:`);
    if (token.pairsAsToken0) {
      console.log(`  - Token0 pairs: ${token.pairsAsToken0.length}`);
      for (const pair of token.pairsAsToken0) {
        console.log(`    - Pair: ${pair.address}`);
        console.log(`      - Reserve0: ${pair.reserve0}`);
        console.log(`      - Reserve1: ${pair.reserve1}`);
      }
    }
    
    if (token.pairsAsToken1) {
      console.log(`  - Token1 pairs: ${token.pairsAsToken1.length}`);
      for (const pair of token.pairsAsToken1) {
        console.log(`    - Pair: ${pair.address}`);
        console.log(`      - Reserve0: ${pair.reserve0}`);
        console.log(`      - Reserve1: ${pair.reserve1}`);
      }
    }
    
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 