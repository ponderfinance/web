import { prisma } from '@/src/lib/db/prisma'
import { createPublicClient, formatUnits, parseUnits, PublicClient, http } from 'viem'
import { calculateReservesUSD } from '@/src/lib/graphql/oracleUtils'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { KKUB_ADDRESS } from '@/src/constants/addresses'
import { calculatePairTVL } from '@/src/lib/graphql/priceUtils'
import type { Context, Empty, PrismaToken, PrismaPair, PrismaTokenSupply, PrismaLaunch } from './types'
import {
  cachePairReserveUSDBulk,
  getCachedPairReserveUSD,
  getCachedPairReserveUSDBulk
} from '@/src/lib/redis/pairCache'
import { getRedisClient } from '@/src/lib/redis/client'
import { TokenPriceService } from '@/src/lib/services/tokenPriceService'
import { createCursorPagination, decodeCursor } from './utils'
import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'
import { PrismaClient } from '@prisma/client'
import { GraphQLResolveInfo } from 'graphql'
import { MongoClient } from 'mongodb'

// Define constants for USDT and Oracle addresses
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'
const ORACLE_ADDRESS = '0x1B5C4c1D5b0BbBcEc97fa477b3d5F2FEBA5b481f'

// Create DataLoader for token prices to optimize multiple price lookups
const createTokenPriceLoader = () => {
  return new DataLoader<string, string>(async (tokenIds: readonly string[]) => {
    try {
      // Get all prices in bulk
      const pricesMap = await TokenPriceService.getTokenPricesUSDBulk(
        tokenIds as string[]
      );
      
      // Return prices in the same order as requested
      return tokenIds.map(id => pricesMap[id] || '0');
    } catch (error) {
      console.error('Error in token price loader:', error);
      return tokenIds.map(() => '0');
    }
  });
};

// Oracle ABI for the functions we need
const ORACLE_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'pair', type: 'address' },
      { internalType: 'address', name: 'tokenIn', type: 'address' },
      { internalType: 'uint256', name: 'amountIn', type: 'uint256' },
      { internalType: 'uint32', name: 'period', type: 'uint32' },
    ],
    name: 'consult',
    outputs: [{ internalType: 'uint256', name: 'amountOut', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
]

// Create viem public client for contract calls
export const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
})

// Create mock DataLoader for testing
const createMockDataLoader = <K, V>(defaultValue: V): DataLoader<K, V> => {
  const loader = new DataLoader<K, V>(async (keys: readonly K[]) => {
    return keys.map(() => defaultValue)
  })
  loader.loadMany = async (keys: readonly K[]) => keys.map(() => defaultValue)
  loader.clear = () => loader
  loader.clearAll = () => loader
  loader.prime = (key: K, value: V) => loader
  loader.name = 'mockLoader'
  return loader
}

// Update the createMockDataLoader calls with proper mock objects
const createMockTokenDataLoader = (): DataLoader<string, PrismaToken> => {
  const mockToken: PrismaToken = {
    id: '',
    address: '',
    name: null,
    symbol: null,
    decimals: null,
    imageURI: null,
    priceUSD: null,
    priceChange24h: null,
    volumeUSD24h: null,
    lastPriceUpdate: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  return createMockDataLoader<string, PrismaToken>(mockToken);
};

// Fix the recursive call in calculateTokenVolume24h
const calculateTokenVolume24h = async (
  tokenId: string,
  prismaClient: typeof prisma,
  loaders: Context['loaders']
): Promise<Record<string, string>> => {
  try {
    console.log(`[VOLUME] Calculating 24h volume for token ID: ${tokenId}`);
    
    // Get the token to check decimals and price - use loaders if available
    let token;
    if (loaders && loaders.tokenLoader) {
      token = await loaders.tokenLoader.load(tokenId);
      console.log(`[VOLUME] Used loader to fetch token: ${tokenId}`);
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
      console.log(`[VOLUME] Used direct query to fetch token: ${tokenId}`);
    }

    if (!token) {
      console.error(`[VOLUME] Token not found with ID: ${tokenId}`);
      return { [tokenId]: '0' };
    }
    
    console.log(`[VOLUME] Found token ${token.symbol} (${token.address}) with decimals: ${token.decimals}, price: ${token.priceUSD}`);

    // Check if the token has any pairs
    const pairsAsToken0 = token.pairsAsToken0 || [];
    const pairsAsToken1 = token.pairsAsToken1 || [];
    console.log(`[VOLUME] Token has ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1`);

    // If the token has no pairs, return 0 volume
    if (pairsAsToken0.length === 0 && pairsAsToken1.length === 0) {
      console.log(`[VOLUME] Token ${token.symbol} has no pairs, skipping volume calculation`);
      return { [tokenId]: '0' };
    }

    // Get current price if not available in token object
    let tokenPrice = token.priceUSD ? parseFloat(token.priceUSD) : 0;
    if (tokenPrice <= 0) {
      try {
        // Use the TokenPriceService directly instead of a potential recursive call
        const priceFromService = await TokenPriceService.getTokenPriceUSD(tokenId);
        tokenPrice = priceFromService;
        console.log(`[VOLUME] Fetched price from service for ${token.symbol}: ${tokenPrice}`);
      } catch (error) {
        console.error(`[VOLUME] Error fetching price for ${token.symbol}:`, error);
      }
    }

    // Get 24h swap data for this token
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const timeThreshold = Math.floor(oneDayAgo.getTime() / 1000);
    
    console.log(`[VOLUME] Getting swaps since: ${new Date(timeThreshold * 1000).toISOString()}`);
    
    // Use direct query for swaps since there's no swap loader in the context
    const swaps = await prismaClient.swap.findMany({
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
    });
    
    console.log(`[VOLUME] Found ${swaps.length} swaps for ${token.symbol} in the last 24h`);

    // Calculate volume in both token units and USD
    let volumeTokenUnits = 0;
    let volumeUSD = 0;
    
    for (const swap of swaps) {
      // Determine if our token is token0 or token1 in the pair
      const isToken0 = swap.pair.token0Id === tokenId;
      const swapToken = isToken0 ? swap.pair.token0 : swap.pair.token1;
      const tokenDecimals = swapToken.decimals || token.decimals || 18;
      
      console.log(`[VOLUME] Processing swap: ${swap.id}, isToken0: ${isToken0}, token: ${swapToken.symbol}`);
      
      // Get token amounts involved in the swap
      let tokenAmount: number;
      if (isToken0) {
        // If our token is token0, add both amountIn0 and amountOut0
        const amountIn = parseFloat(formatUnits(BigInt(swap.amountIn0 || '0'), tokenDecimals));
        const amountOut = parseFloat(formatUnits(BigInt(swap.amountOut0 || '0'), tokenDecimals));
        tokenAmount = amountIn + amountOut;
        console.log(`[VOLUME] token0 amounts - amountIn: ${amountIn}, amountOut: ${amountOut}, total: ${tokenAmount}`);
      } else {
        // If our token is token1, add both amountIn1 and amountOut1
        const amountIn = parseFloat(formatUnits(BigInt(swap.amountIn1 || '0'), tokenDecimals));
        const amountOut = parseFloat(formatUnits(BigInt(swap.amountOut1 || '0'), tokenDecimals));
        tokenAmount = amountIn + amountOut;
        console.log(`[VOLUME] token1 amounts - amountIn: ${amountIn}, amountOut: ${amountOut}, total: ${tokenAmount}`);
      }
      
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
        volumeUSD += swapVolumeUSD;
        console.log(`[VOLUME] Swap USD value: ${swapVolumeUSD.toFixed(2)} (price: ${effectivePrice})`);
      } else {
        console.log(`[VOLUME] No price available to calculate USD value`);
      }
    }
    
    console.log(`[VOLUME] ✅ Token ${token.symbol} 24h volume: ${volumeTokenUnits} tokens, $${volumeUSD.toFixed(2)} USD`);
    
    // Return USD volume if available, otherwise return token units
    if (volumeUSD > 0) {
      return { [tokenId]: volumeUSD.toString() };
    } else {
      return { [tokenId]: volumeTokenUnits.toString() };
    }
  } catch (error) {
    console.error(`[VOLUME] Error calculating volume for token ${tokenId}:`, error);
    return { [tokenId]: '0' };
  }
};

interface ChartDataPoint {
  time: string | number;  // Modified to accept both string and number
  value: number;
}

interface TokenPriceChartArgs {
  tokenAddress: string
  timeframe?: string
  limit?: number
}

interface VolumeChartData extends ChartDataPoint {
  volume0?: number
  volume1?: number
  count?: number
}

interface TokenWhereInput {
  address?: string;
  symbol?: string;
  name?: string;
}

// Define interfaces for type safety
interface TokenPair extends PrismaPair {
  token0: {
    symbol: string | null;
    address: string;
    name: string | null;
    id: string;
    decimals: number | null;
    imageURI: string | null;
    priceUSD: string | null;
    priceChange24h: number | null;
    volumeUSD24h: string | null;
    lastPriceUpdate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    stablePair: string | null;
  };
  token1: {
    symbol: string | null;
    address: string;
    name: string | null;
    id: string;
    decimals: number | null;
    imageURI: string | null;
    priceUSD: string | null;
    priceChange24h: number | null;
    volumeUSD24h: string | null;
    lastPriceUpdate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    stablePair: string | null;
  };
  lastBlockUpdate: number;
}

interface PriceSnapshot {
  id: string;
  createdAt: Date;
  pairId: string;
  timestamp: number;
  blockNumber: number;
  price0: number;  // This is Float in Prisma schema
  price1: number;  // This is Float in Prisma schema
}

interface ChartPoint {
  time: number;
  value: number;
}

interface PairReserveSnapshot {
  pairId: string;
  reserveUSD: string;
  timestamp: Date;
}

// Constants for major tokens
const majorTokenAddresses: string[] = [
  KKUB_ADDRESS[CURRENT_CHAIN.id],
  // Add other major token addresses if needed
].map((addr) => addr.toLowerCase())

// Fix the LaunchResolvers interface by removing duplicates
interface LaunchResolvers {
  id: (parent: PrismaLaunch) => string;
  launchId: (parent: PrismaLaunch) => number;
  tokenAddress: (parent: PrismaLaunch) => string;
  creatorAddress: (parent: PrismaLaunch) => string;
  imageURI: (parent: PrismaLaunch) => string;
  kubRaised: (parent: PrismaLaunch) => string;
  ponderRaised: (parent: PrismaLaunch) => string;
  status: (parent: PrismaLaunch) => string;
  kubPairAddress: (parent: PrismaLaunch) => string | null;
  ponderPairAddress: (parent: PrismaLaunch) => string | null;
  hasDualPools: (parent: PrismaLaunch) => boolean | null;
  ponderPoolSkipped: (parent: PrismaLaunch) => boolean | null;
  skippedPonderAmount: (parent: PrismaLaunch) => string | null;
  skippedPonderValue: (parent: PrismaLaunch) => string | null;
  kubLiquidity: (parent: PrismaLaunch) => string | null;
  ponderLiquidity: (parent: PrismaLaunch) => string | null;
  ponderBurned: (parent: PrismaLaunch) => string | null;
  lpWithdrawn: (parent: PrismaLaunch) => boolean | null;
  lpWithdrawnAt: (parent: PrismaLaunch) => Date | null;
  completedAt: (parent: PrismaLaunch) => Date | null;
  cancelledAt: (parent: PrismaLaunch) => Date | null;
  createdAt: (parent: PrismaLaunch) => Date;
  updatedAt: (parent: PrismaLaunch) => Date;
  contributions: (parent: PrismaLaunch, args: { first?: number; after?: string }, context: Context) => Promise<any>;
  myContribution: (parent: PrismaLaunch, _unused: Empty, context: Context) => Promise<any>;
}

// Add type annotations for pair parameters
const processPair = (pair: PrismaPair) => {
  return {
    id: pair.id,
    address: pair.address,
    token0Id: pair.token0Id,
    token1Id: pair.token1Id,
    reserve0: pair.reserve0,
    reserve1: pair.reserve1,
    totalSupply: pair.totalSupply,
    feesPending0: pair.feesPending0,
    feesPending1: pair.feesPending1,
    feesCollected0: pair.feesCollected0,
    feesCollected1: pair.feesCollected1,
    token0: pair.token0,
    token1: pair.token1,
    createdAt: pair.createdAt,
    updatedAt: pair.updatedAt
  }
}

// Add type annotations for snapshot parameters
const processSnapshot = (snapshot: PairReserveSnapshot) => ({
  pairId: snapshot.pairId,
  reserveUSD: snapshot.reserveUSD,
  timestamp: snapshot.timestamp
})

// Add this interface before the resolvers (after the other interfaces)
interface Contribution {
  id: string;
  kubAmount: string;
  ponderAmount: string;
  ponderValue: string;
  tokensReceived: string;
  refunded?: boolean;
  refundedKubAmount?: string;
  refundedPonderAmount?: string;
  refundedTokenAmount?: string;
  vestingAmount?: string;
  vestingReleased?: string;
  vestingRemaining?: string;
  vestingLastClaim?: Date | null;
  vestingNextClaim?: Date | null;
}

// Add this before the resolvers (after the other interfaces)
interface UserStats {
  id: string;
  address: string;
  totalSwapCount: number;
  totalLpCount: number;
  swapVolumeUSD: string;
  liquidityProvidedUSD: string;
}

interface PairWithTokenInfo {
  id: string;
  isToken0: boolean;
  counterpartToken: {
    id: string;
    address: string;
    decimals: number | null;
    symbol: string | null;  // Add missing symbol property
  };
}

// Add interface for MongoDB response types
interface MongoSnapshot {
  _id: string;
  pairId: string | ObjectId;
  timestamp: number;
  price0: number | null;
  price1: number | null;
  blockNumber: number;
}

interface MongoResponse {
  cursor: {
    firstBatch: MongoSnapshot[]
  }
}

// Add MongoDB connection setup
const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI_TESTNET;
if (!mongoUri) {
  console.error('MongoDB URI is not defined. Please check your environment variables.');
}
const mongoClient = new MongoClient(mongoUri || '');
let db: any;

// Initialize MongoDB connection
async function initMongoDB() {
  if (!db && mongoUri) {
    try {
      await mongoClient.connect();
      db = mongoClient.db('ponder_indexer');
      console.log('Connected to MongoDB for direct queries');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
    }
  }
  return db;
}

// Known mapping of tokens to pairs (workaround for broken relationships)
const knownTokenPairs: Record<string, {pairId: string, isToken0: boolean}> = {
  // KOI token
  "0xe0432224871917fb5a137f4a153a51ecf9f74f57": {
    pairId: "67d201199580ce6325b892ed",
    isToken0: false
  },
  // KKUB token
  "0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5": {
    pairId: "67d201199580ce6325b892ed",
    isToken0: true
  }
  // Add more tokens as needed
};

// Extract TVL calculation to a utility function that can be used by multiple resolvers
const calculateTokenTVL = async (
  token: any,
  prismaClient: typeof prisma,
) => {
  try {
    // Return tvl if it exists
    if (token.tvl && token.tvl !== '0') {
      console.log(`[TVL] Using existing TVL value for ${token.symbol || token.id}: ${token.tvl}`);
      return typeof token.tvl === 'string' ? token.tvl : token.tvl.toString();
    }
    
    // Get token ID
    const tokenId = token.id;
    if (!tokenId) {
      console.error('[TVL] Token ID is missing for TVL calculation');
      return '0';
    }

    console.log(`[TVL] Calculating TVL for token ${token.symbol || tokenId} (${token.address})`);

    // Use the token price from the parent object if available
    let tokenPrice = parseFloat(token.priceUSD || '0');
    console.log(`[TVL] Token price for ${token.symbol || tokenId}: $${tokenPrice}`);
    
    if (tokenPrice <= 0) {
      console.log(`[TVL] Token price is zero or invalid for ${token.symbol || tokenId}, trying to get from service`);
      try {
        const priceFromService = await TokenPriceService.getTokenPriceUSD(tokenId);
        tokenPrice = priceFromService;
        console.log(`[TVL] Price from service for ${token.symbol || tokenId}: $${tokenPrice}`);
      } catch (error) {
        console.error(`[TVL] Failed to get price from service:`, error);
      }
    }
    
    // If we already have pairs from token object, use them
    let pairsAsToken0 = token.pairsAsToken0 || [];
    let pairsAsToken1 = token.pairsAsToken1 || [];
    
    // If pairs are missing or empty, fetch them
    if (!pairsAsToken0.length && !pairsAsToken1.length) {
      console.log(`[TVL] No pairs found in token object, fetching from database`);
      // Fetch all pairs that include this token
      pairsAsToken0 = await prismaClient.pair.findMany({
        where: { token0Id: tokenId },
        select: {
          id: true,
          reserve0: true,
          token0: {
            select: {
              id: true,
              address: true,
              symbol: true,
              decimals: true,
              priceUSD: true
            }
          }
        }
      });
      
      pairsAsToken1 = await prismaClient.pair.findMany({
        where: { token1Id: tokenId },
        select: {
          id: true,
          reserve1: true,
          token1: {
            select: {
              id: true,
              address: true,
              symbol: true,
              decimals: true,
              priceUSD: true
            }
          }
        }
      });
    }
    
    console.log(`[TVL] Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1 for ${token.symbol || tokenId}`);
    
    // Detailed info about pairs
    pairsAsToken0.forEach((pair: { id: string; reserve0?: string }) => {
      console.log(`[TVL] Pair as token0: ${pair.id}, reserve0: ${pair.reserve0 || 'N/A'}`);
    });
    
    pairsAsToken1.forEach((pair: { id: string; reserve1?: string }) => {
      console.log(`[TVL] Pair as token1: ${pair.id}, reserve1: ${pair.reserve1 || 'N/A'}`);
    });
    
    // Calculate TVL from pairs
    let totalTvl = 0;
    
    // Process token0 pairs
    for (const pair of pairsAsToken0) {
      // Skip if no reserve0
      if (!pair.reserve0 || pair.reserve0 === '0') {
        console.log(`[TVL] Skipping pair ${pair.id} - no reserve0`);
        continue;
      }
      
      // Get price from token0 in pair or from token
      const pairToken = pair.token0 || {};
      const pairTokenPrice = parseFloat(pairToken.priceUSD || '0');
      const effectivePrice = tokenPrice > 0 ? tokenPrice : pairTokenPrice;
      
      // Get token decimals from either parent or pair
      const tokenDecimals = token.decimals || (pairToken.decimals || 18);
      
      console.log(`[TVL] Pair ${pair.id} - token price: $${effectivePrice}, decimals: ${tokenDecimals}, reserve0: ${pair.reserve0}`);
      
      // Only calculate if we have a price and reserves
      if (effectivePrice > 0 && pair.reserve0 && pair.reserve0 !== '0') {
        try {
          // Format reserves with proper decimal handling
          const formattedReserve = formatUnits(BigInt(pair.reserve0), tokenDecimals);
          const reserveValue = Number(formattedReserve) * effectivePrice;
          
          // Add to total TVL
          totalTvl += reserveValue;
          console.log(`[TVL] Added reserve value: ${formattedReserve} * $${effectivePrice} = $${reserveValue} for ${token.symbol || tokenId}`);
        } catch (error) {
          console.error(`[TVL] Error calculating TVL from pair ${pair.id}:`, error);
          // Continue with other pairs even if one fails
        }
      } else {
        console.log(`[TVL] Skipping pair ${pair.id} - price is 0 or no reserves`);
      }
    }
    
    // Process token1 pairs
    for (const pair of pairsAsToken1) {
      // Skip if no reserve1
      if (!pair.reserve1 || pair.reserve1 === '0') {
        console.log(`[TVL] Skipping pair ${pair.id} - no reserve1`);
        continue;
      }
      
      // Get price from token1 in pair or from token
      const pairToken = pair.token1 || {};
      const pairTokenPrice = parseFloat(pairToken.priceUSD || '0');
      const effectivePrice = tokenPrice > 0 ? tokenPrice : pairTokenPrice;
      
      // Get token decimals from either parent or pair
      const tokenDecimals = token.decimals || (pairToken.decimals || 18);
      
      console.log(`[TVL] Pair ${pair.id} - token price: $${effectivePrice}, decimals: ${tokenDecimals}, reserve1: ${pair.reserve1}`);
      
      // Only calculate if we have a price and reserves
      if (effectivePrice > 0 && pair.reserve1 && pair.reserve1 !== '0') {
        try {
          // Format reserves with proper decimal handling
          const formattedReserve = formatUnits(BigInt(pair.reserve1), tokenDecimals);
          const reserveValue = Number(formattedReserve) * effectivePrice;
          
          // Add to total TVL
          totalTvl += reserveValue;
          console.log(`[TVL] Added reserve value: ${formattedReserve} * $${effectivePrice} = $${reserveValue} for ${token.symbol || tokenId}`);
        } catch (error) {
          console.error(`[TVL] Error calculating TVL from pair ${pair.id}:`, error);
          // Continue with other pairs even if one fails
        }
      } else {
        console.log(`[TVL] Skipping pair ${pair.id} - price is 0 or no reserves`);
      }
    }
    
    console.log(`[TVL] ✅ Final TVL for token ${token.symbol || tokenId}: $${totalTvl}`);
    return totalTvl.toString();
  } catch (error) {
    console.error('[TVL] Error calculating token TVL:', error);
    return '0';
  }
};

export const resolvers = {
  // Add this resolver before any existing resolvers
  Token: {
    tvl: async (parent: any, _args: any, { prisma }: Context) => {
      return calculateTokenTVL(parent, prisma);
    },
    
    marketCap: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        // Return marketCap if it exists
        if (parent.marketCap) {
          return typeof parent.marketCap === 'string' ? parent.marketCap : parent.marketCap.toString();
        }
        
        // Get the token price - ensure we have a valid number
        const tokenPrice = parseFloat(parent.priceUSD || '0');
        
        // Log the price to debug
        console.log(`Calculating marketCap for token ${parent.symbol} (${parent.address}) with price: ${tokenPrice}`);
        
        // If token price is extremely low or zero, we can't calculate market cap
        if (tokenPrice <= 0) {
          console.log(`Token price is zero or invalid for ${parent.symbol}, returning 0 market cap`);
          return '0';
        }
        
        // Get token ID
        const tokenId = parent.id;
        if (!tokenId) {
          console.error('Token ID is missing for marketCap calculation');
          return '0';
        }
        
        try {
          // Try to get supply from the supply model
          const supply = await prisma.tokenSupply.findUnique({
            where: { tokenId }
          });
          
          console.log(`Supply data for ${parent.symbol}: `, supply ? JSON.stringify(supply) : 'No supply data');
          
          // If we have supply data, use it for accurate calculation
          if (supply && supply.circulating) {
            const tokenDecimals = parent.decimals || 18;
            
            // CRITICAL FIX: The supply is stored without accounting for decimals,
            // so we need to manually adjust it
            // Instead of formatUnits(BigInt(supply.circulating), tokenDecimals)
            // which incorrectly treats the raw number as already including decimals
            
            // Convert to proper value with decimals
            const circulatingSupply = parseFloat(supply.circulating);
            
            console.log(`Raw circulating supply for ${parent.symbol}: ${supply.circulating}`);
            console.log(`Using circulating supply for ${parent.symbol}: ${circulatingSupply}`);
            
            // Calculate and return market cap
            const marketCap = tokenPrice * circulatingSupply;
            console.log(`Final marketCap for ${parent.symbol}: ${marketCap}`);
            return marketCap.toString();
          }
          
          // If we don't have circulating supply but have total supply, use a reasonable ratio
          if (supply && supply.total) {
            const tokenDecimals = parent.decimals || 18;
            
            // CRITICAL FIX: The supply is stored without accounting for decimals
            // Convert to proper value with decimals
            const totalSupply = parseFloat(supply.total);
            
            console.log(`Raw total supply for ${parent.symbol}: ${supply.total}`);
            console.log(`Using total supply for ${parent.symbol}: ${totalSupply}`);
            
            // Assume circulating supply is approximately 50% of total supply as fallback
            const estimatedCirculating = totalSupply * 0.5;
            const marketCap = tokenPrice * estimatedCirculating;
            console.log(`Estimated marketCap from total supply for ${parent.symbol}: ${marketCap}`);
            return marketCap.toString();
          }
          
          // No supply data found, estimate from total pairs and token reserves
          console.log(`No supply data found for ${parent.symbol}, estimating from reserves`);
          
          // Get token decimals
          const tokenDecimals = parent.decimals || 18;
          
          // Get the reserves to estimate circulating supply
          const pairsAsToken0 = await prisma.pair.findMany({
            where: { token0Id: tokenId },
            select: { 
              id: true,
              reserve0: true,
              token0: {
                select: {
                  symbol: true
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
                  symbol: true
                }
              }
            }
          });
          
          console.log(`Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1 for ${parent.symbol}`);
          
          // Sum up all reserves
          let totalInLiquidity = BigInt(0);
          
          for (const pair of pairsAsToken0) {
            if (pair.reserve0) {
              totalInLiquidity += BigInt(pair.reserve0);
              console.log(`Added reserve0 from pair ${pair.id}: ${pair.reserve0}`);
            }
          }
          
          for (const pair of pairsAsToken1) {
            if (pair.reserve1) {
              totalInLiquidity += BigInt(pair.reserve1);
              console.log(`Added reserve1 from pair ${pair.id}: ${pair.reserve1}`);
            }
          }
          
          // If we found reserves, estimate based on typical liquidity percentage
          if (totalInLiquidity > BigInt(0)) {
            // Format the reserves with proper decimal handling
            const formattedLiquidity = formatUnits(totalInLiquidity, tokenDecimals);
            console.log(`Total in liquidity for ${parent.symbol}: ${formattedLiquidity}`);
            
            // Assume liquidity represents about 10% of circulating supply
            const estimatedCirculating = Number(formatUnits(totalInLiquidity * BigInt(10), tokenDecimals));
            const marketCap = tokenPrice * estimatedCirculating;
            console.log(`Estimated marketCap from reserves for ${parent.symbol}: ${marketCap}`);
            return marketCap.toString();
          }
          
          // Fallback to standard estimate if we couldn't calculate from reserves
          console.log(`No reserve data available for ${parent.symbol}, using fallback`);
          const fallbackMC = tokenPrice * 1000000; // Assume 1M token supply as fallback
          console.log(`Fallback marketCap for ${parent.symbol}: ${fallbackMC}`);
          return fallbackMC.toString();
        } catch (error) {
          console.error(`Error calculating marketCap for ${parent.symbol}:`, error);
          // Default fallback - use a standard estimate
          return (tokenPrice * 1000000).toString(); // Assume 1M token supply as absolute fallback
        }
      } catch (error) {
        console.error('Error resolving token marketCap:', error);
        return '0';
      }
    },
    
    fdv: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        // Return fdv if it exists
        if (parent.fdv) {
          return typeof parent.fdv === 'string' ? parent.fdv : parent.fdv.toString();
        }
        
        // Calculate FDV from price and total supply
        const tokenPrice = parseFloat(parent.priceUSD || '0');
        console.log(`Calculating FDV for token ${parent.symbol} (${parent.address}) with price: ${tokenPrice}`);
        
        if (tokenPrice <= 0) {
          console.log(`Token price is zero or invalid for ${parent.symbol}, returning 0 FDV`);
          return '0';
        }
        
        // Get token ID
        const tokenId = parent.id;
        if (!tokenId) {
          console.error('Token ID is missing for FDV calculation');
          return '0';
        }
        
        try {
          // Try to get supply from the supply model
          const supply = await prisma.tokenSupply.findUnique({
            where: { tokenId }
          });
          
          console.log(`Supply data for ${parent.symbol} FDV: `, supply ? JSON.stringify(supply) : 'No supply data');
          
          // If we have total supply data, use it for accurate calculation
          if (supply && supply.total) {
            const tokenDecimals = parent.decimals || 18;
            
            // CRITICAL FIX: The supply is stored without accounting for decimals
            // Convert to proper value with decimals
            const totalSupply = parseFloat(supply.total);
            
            console.log(`Raw total supply for ${parent.symbol} FDV: ${supply.total}`);
            console.log(`Using total supply for ${parent.symbol} FDV: ${totalSupply}`);
            
            // Calculate and return FDV
            const fdv = tokenPrice * totalSupply;
            console.log(`Final FDV for ${parent.symbol}: ${fdv}`);
            return fdv.toString();
          }
          
          // No total supply data, try to estimate
          console.log(`No total supply data for ${parent.symbol}, estimating FDV from reserves`);
          
          // Get token decimals
          const tokenDecimals = parent.decimals || 18;
          
          // Get the reserves to estimate total supply
          const pairsAsToken0 = await prisma.pair.findMany({
            where: { token0Id: tokenId },
            select: { 
              id: true,
              reserve0: true 
            }
          });
          
          const pairsAsToken1 = await prisma.pair.findMany({
            where: { token1Id: tokenId },
            select: { 
              id: true,
              reserve1: true 
            }
          });
          
          console.log(`Found ${pairsAsToken0.length} pairs as token0 and ${pairsAsToken1.length} pairs as token1 for ${parent.symbol} FDV`);
          
          // Sum up all reserves
          let totalInLiquidity = BigInt(0);
          
          for (const pair of pairsAsToken0) {
            if (pair.reserve0) {
              totalInLiquidity += BigInt(pair.reserve0);
            }
          }
          
          for (const pair of pairsAsToken1) {
            if (pair.reserve1) {
              totalInLiquidity += BigInt(pair.reserve1);
            }
          }
          
          // If we found reserves, estimate based on typical liquidity percentage
          if (totalInLiquidity > BigInt(0)) {
            // Format the reserves with proper decimal handling
            const formattedLiquidity = formatUnits(totalInLiquidity, tokenDecimals);
            console.log(`Total in liquidity for ${parent.symbol} FDV: ${formattedLiquidity}`);
            
            // For FDV, assume liquidity represents about 5% of total supply
            const estimatedTotal = Number(formatUnits(totalInLiquidity * BigInt(20), tokenDecimals));
            const fdv = tokenPrice * estimatedTotal;
            console.log(`Estimated FDV from reserves for ${parent.symbol}: ${fdv}`);
            return fdv.toString();
          }
          
          // No reserves found, use market cap as base for estimation
          console.log(`No reserves found for ${parent.symbol}, using marketCap for FDV estimation`);
          
          // Get marketCap to use as base for estimation
          let marketCap = '0';
          
          // Try to get marketCap from parent if exists
          if (parent.marketCap) {
            marketCap = parent.marketCap.toString();
            console.log(`Using existing marketCap for ${parent.symbol}: ${marketCap}`);
          } else {
            // Calculate market cap from circulating supply if available
            if (supply && supply.circulating) {
              // CRITICAL FIX: The supply is stored without accounting for decimals
              const circulatingSupply = parseFloat(supply.circulating);
              marketCap = (tokenPrice * circulatingSupply).toString();
              console.log(`Calculated marketCap for ${parent.symbol} from circulating supply: ${marketCap}`);
            } else {
              // Fallback to standard market cap estimate
              marketCap = (tokenPrice * 1000000).toString(); // Assume 1M circulating
              console.log(`Using fallback marketCap for ${parent.symbol}: ${marketCap}`);
            }
          }
          
          // Assume FDV is typically 2-3x the market cap for tokens with unlocking schedules
          const marketCapValue = parseFloat(marketCap);
          const fdv = marketCapValue * 2.5;
          console.log(`Final estimated FDV for ${parent.symbol}: ${fdv}`);
          return fdv.toString();
        } catch (error) {
          console.error(`Error calculating FDV for ${parent.symbol}:`, error);
          
          // Final fallback - use a standard estimate
          const fallbackFDV = tokenPrice * 2000000; // Assume 2M total supply as fallback
          console.log(`Fallback FDV for ${parent.symbol}: ${fallbackFDV}`);
          return fallbackFDV.toString();
        }
      } catch (error) {
        console.error('Error resolving token fdv:', error);
        return '0';
      }
    }
  },
  
  Pair: {
    tvl: (parent: any) => {
      try {
        // If there's a tvl property, use it (this should be pre-calculated correctly)
        if (parent.tvl !== undefined && parent.tvl !== null) {
          return typeof parent.tvl === 'string' ? parseFloat(parent.tvl) || 0 : (parent.tvl || 0);
        }
        
        // If there's a reserveUSD property, use that
        // This is likely the issue - reserveUSD may only represent one side of the pool
        if (parent.reserveUSD !== undefined && parent.reserveUSD !== null) {
          // Convert to consistent number format
          const reserveUSD = typeof parent.reserveUSD === 'string' ? parseFloat(parent.reserveUSD) : parent.reserveUSD;
          
          // IMPORTANT: Calculate from both token reserves for accurate TVL
          // Don't just use reserveUSD, instead recalculate from token reserves
          if (parent.reserve0 && parent.reserve1 && parent.token0?.priceUSD && parent.token1?.priceUSD) {
            try {
              const token0Decimals = parent.token0.decimals || 18;
              const token1Decimals = parent.token1.decimals || 18;
              const token0Price = parseFloat(parent.token0.priceUSD || '0');
              const token1Price = parseFloat(parent.token1.priceUSD || '0');
              
              const reserve0Value = Number(formatUnits(BigInt(parent.reserve0), token0Decimals)) * token0Price;
              const reserve1Value = Number(formatUnits(BigInt(parent.reserve1), token1Decimals)) * token1Price;
              
              // Sum both sides of the pool for true TVL
              return reserve0Value + reserve1Value;
            } catch (error) {
              // Fall back to reserveUSD if calculation fails
              console.error('Error calculating TVL from reserves:', error);
              return reserveUSD;
            }
          }
          
          return reserveUSD;
        }
        
        // Last resort - calculate from reserves and token prices if available
        if (parent.reserve0 && parent.reserve1 && parent.token0?.priceUSD && parent.token1?.priceUSD) {
          try {
            const token0Decimals = parent.token0.decimals || 18;
            const token1Decimals = parent.token1.decimals || 18;
            const token0Price = parseFloat(parent.token0.priceUSD || '0');
            const token1Price = parseFloat(parent.token1.priceUSD || '0');
            
            const reserve0Value = Number(formatUnits(BigInt(parent.reserve0), token0Decimals)) * token0Price;
            const reserve1Value = Number(formatUnits(BigInt(parent.reserve1), token1Decimals)) * token1Price;
            
            return reserve0Value + reserve1Value;
          } catch (error) {
            console.error('Error calculating TVL:', error);
          }
        }
      } catch (error) {
        console.error('Error calculating TVL:', error);
      }
      
      // Absolute fallback - never return null
      return 0;
    }
  },
  Query: {
    // Token resolvers
    token: async (_parent: unknown, { address }: { address: string }, ctx: Context) => {
      console.log(`[TOKEN] Looking up token by address: ${address}`);
      
      // Clear any cached data for this token in Redis
      try {
        const redis = getRedisClient();
        const normalizedAddress = address.toLowerCase();
        const cacheKey = `token:${normalizedAddress}`;
        await redis.del(cacheKey);
        console.log(`[TOKEN] Cleared Redis cache for token: ${normalizedAddress}`);
      } catch (error) {
        console.error('[TOKEN] Error clearing Redis cache:', error);
        // Continue even if Redis clearing fails
      }
      
      const token = await ctx.prisma.token.findUnique({
        where: { address: address.toLowerCase() },
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
        console.error(`[TOKEN] Token not found: ${address}`);
        return null;
      }
      
      console.log(`[TOKEN] Found token: ${token.symbol} (${token.address}), id: ${token.id}`);

      // Calculate 24h volume
      const volumeData = await calculateTokenVolume24h(token.id, ctx.prisma, ctx.loaders);
      const volume24h = volumeData[token.id] || '0';
      console.log(`[TOKEN] Calculated volume24h: ${volume24h} for ${token.symbol}`);

      // Get latest price data
      const priceData = await TokenPriceService.getTokenPricesUSDBulk([token.id]);
      const currentPrice = priceData[token.id] || token.priceUSD || '0';
      console.log(`[TOKEN] Current price: ${currentPrice} for ${token.symbol}`);
      
      // Always calculate TVL fresh using our utility function
      const tvl = await calculateTokenTVL(token, ctx.prisma);
      console.log(`[TOKEN] Final calculated TVL: ${tvl} for ${token.symbol}`);

      // Ensure all fields are explicitly returned, especially id, imageURI, and symbol
      return {
        id: token.id,
        address: token.address,
        symbol: token.symbol ?? null,
        name: token.name ?? null,
        decimals: token.decimals ?? null,
        imageURI: token.imageURI ?? null,
        stablePair: token.stablePair ?? null,
        priceUSD: currentPrice,
        priceChange24h: token.priceChange24h ?? null,
        volumeUSD24h: volume24h,
        lastPriceUpdate: token.lastPriceUpdate ?? null,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        tvl: tvl // Use calculated TVL value
      };
    },
    tokens: async (
      _parent: Empty,
      args: {
        first?: number;
        after?: string;
        where?: TokenWhereInput;
        orderBy?: string;
        orderDirection?: string;
      },
      { prisma, loaders }: Context
    ) => {
      const { first = 10, after, where, orderBy = 'createdAt', orderDirection = 'desc' } = args;

      // Try to get from Redis cache first
      const cacheKey = `tokens:${first}:${after || ''}:${JSON.stringify(where)}:${orderBy}:${orderDirection}`;
      const redis = getRedisClient();
      try {
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult) {
          return JSON.parse(cachedResult);
        }
      } catch (error) {
        console.error('Redis cache error:', error);
        // Continue without cache if Redis fails
      }

      // Only select fields we actually need
      const selectFields = {
        id: true,
        address: true,
        symbol: true,
        name: true,
        decimals: true,
        imageURI: true,
        priceUSD: true,
        priceChange24h: true,
        volumeUSD24h: true,
        lastPriceUpdate: true,
        createdAt: true,
        updatedAt: true,
        stablePair: true,
      };

      // Create optimized query conditions
      const whereConditions = {
        ...(where?.address && { address: where.address }),
        ...(where?.symbol && { symbol: where.symbol }),
        ...(where?.name && { name: where.name }),
      };

      // Fetch tokens and count
      const tokens = await prisma.token.findMany({
        take: first + 1,
        where: whereConditions,
        orderBy: { [orderBy]: orderDirection.toLowerCase() },
        select: selectFields,
      });
      
      const totalCountResult = await prisma.$runCommandRaw({
        count: "Token",
        query: whereConditions
      }) as any;

      // Handle cursor-based pagination
      const hasNextPage = tokens.length > first;
      const limitedTokens = hasNextPage ? tokens.slice(0, first) : tokens;

      // Efficiently fetch all token prices in bulk - only if needed
      // and only for tokens that don't have a recent price update
      const currentTime = Date.now();
      const tokenIdsNeedingPriceUpdate = limitedTokens
        .filter((token: PrismaToken) => {
          // Only fetch prices for tokens that are missing prices or if prices are older than 5 minutes
          return !token.priceUSD || !token.lastPriceUpdate || 
            (currentTime - token.lastPriceUpdate.getTime() > 5 * 60 * 1000);
        })
        .map((token: PrismaToken) => token.id);

      let pricesMap: Record<string, string> = {};
      if (tokenIdsNeedingPriceUpdate.length > 0) {
        pricesMap = await TokenPriceService.getTokenPricesUSDBulk(tokenIdsNeedingPriceUpdate);
      }
      
      // Attach prices to tokens - create minimal objects
      const enhancedTokens = limitedTokens.map((token: PrismaToken) => {
        // We'll calculate TVL on demand in the Token.tvl resolver
        return {
          ...token,
          symbol: token.symbol ?? null,
          name: token.name ?? null,
          decimals: token.decimals ?? null,
          imageURI: token.imageURI ?? null,
          stablePair: token.stablePair ?? null,
          priceUSD: (tokenIdsNeedingPriceUpdate.includes(token.id) && pricesMap[token.id]) ? pricesMap[token.id] : (token.priceUSD ?? null),
          priceChange24h: token.priceChange24h ?? null,
          volumeUSD24h: token.volumeUSD24h ?? null,
          lastPriceUpdate: token.lastPriceUpdate ?? null,
          tvl: '0' // Default value, will be calculated on-demand by the resolver
        };
      });

      // Add type for edges map
      const edges = enhancedTokens.map((token: PrismaToken) => ({
        node: token,
        cursor: token.id,
      }));

      // Extract the count from the MongoDB response
      const actualCount = totalCountResult?.n || 0;

      const result = {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: false,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount: actualCount,
      };

      // Cache the result with a longer TTL
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 60); // Cache for 60 seconds
      } catch (error) {
        console.error('Redis cache set error:', error);
      }

      return result;
    },
    tokenByAddress: async (
      _parent: Empty,
      { address }: { address: string },
      { prisma, loaders }: Context
    ) => {
      // Normalize address to lowercase for consistent lookups
      const normalizedAddress = address.toLowerCase();
      
      console.log(`[DEBUG] tokenByAddress called with address: ${normalizedAddress}`);
      
      // Try to get from Redis cache first
      const cacheKey = `token:${normalizedAddress}`;
      let useCache = false;
      const redis = getRedisClient();
      try {
        const cachedResult = await redis.get(cacheKey);
        if (cachedResult && useCache) {
          const parsedResult = JSON.parse(cachedResult);
          // If TVL is missing or '0', we should recalculate it
          if (!parsedResult.tvl || parsedResult.tvl === '0') {
            const calculatedTVL = await calculateTokenTVL(parsedResult, prisma);
            parsedResult.tvl = calculatedTVL;
            // Update cache with new TVL
            await redis.set(cacheKey, JSON.stringify(parsedResult), 'EX', 60);
          }
          return parsedResult;
        }
      } catch (error) {
        console.error('[DEBUG] Redis cache error:', error);
        // Continue without cache if Redis fails
      }
      
      // Find the token with optimized query
      const token = await prisma.token.findFirst({
        where: { address: normalizedAddress },
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
      
      console.log(`[DEBUG] Token found: ${token?.symbol}, pairs as token0: ${token?.pairsAsToken0?.length}, pairs as token1: ${token?.pairsAsToken1?.length}`);
      
      if (!token) {
        return null;
      }
      
      // Ensure pairsAsToken0 and pairsAsToken1 are never null
      if (!token.pairsAsToken0) {
        token.pairsAsToken0 = [];
      }
      
      if (!token.pairsAsToken1) {
        token.pairsAsToken1 = [];
      }
      
      // Check if price needs to be updated
      const currentTime = Date.now();
      // Calculate TVL using our utility function
      const calculatedTVL = await calculateTokenTVL(token, prisma);
      
      let updatedToken = { ...token, tvl: calculatedTVL };
      
      if (!token.priceUSD || !token.lastPriceUpdate || 
          (currentTime - token.lastPriceUpdate.getTime() > 5 * 60 * 1000)) {
        try {
          // Get fresh price if needed
          const price = await TokenPriceService.getTokenPriceUSD(token.id);
          if (price > 0) {  // Compare with number, not string
            updatedToken = {
              ...updatedToken,
              priceUSD: price.toString()  // Convert to string for priceUSD
            };
            
            // Update the database in the background without awaiting
            prisma.token.update({
              where: { id: token.id },
              data: { 
                priceUSD: price.toString(),  // Convert to string for DB update
                lastPriceUpdate: new Date()
              }
            }).catch(error => {
              console.error('Error updating token price:', error);
            });
          }
        } catch (error) {
          console.error('Error fetching token price:', error);
        }
      }
      
      // Don't cache as it seems to cause issues
      /*
      // Cache the result
      try {
        const cacheData = JSON.stringify(updatedToken);
        await redis.set(cacheKey, cacheData, 'EX', 60); // Cache for 60 seconds
      } catch (error) {
        console.error('Redis cache set error:', error);
      }
      */
      
      console.log(`[DEBUG] Returning token with TVL: ${updatedToken.tvl}`);
      return updatedToken;
    },
    pairByAddress: async (
      _parent: Empty,
      { address }: { address: string },
      { prisma }: Context
    ) => {
      return prisma.pair.findFirst({
        where: { address: address.toLowerCase() },
        include: {
          token0: true,
          token1: true,
        },
      })
    },

    // Pair resolvers
    pair: async (_parent: unknown, { address }: { address: string }, ctx: Context) => {
      return ctx.prisma.pair.findUnique({
        where: { address },
        include: {
          token0: true,
          token1: true
        }
      })
    },

    pairs: async (
      _parent: Empty,
      {
        first = 10,
        after,
        orderBy = 'createdAt',
        orderDirection = 'desc',
      }: {
        first?: number
        after?: string
        orderBy?: 'createdAt' | 'reserve0' | 'reserve1' | 'reserveUSD'
        orderDirection?: 'asc' | 'desc'
      },
      { prisma, loaders }: Context
    ) => {
      try {
        // Check Redis cache first with a more specific key
        const cacheKey = `pairs:${first}:${after || ''}:${orderBy}:${orderDirection}`;
        const redis = getRedisClient();
        
        try {
          const cachedResult = await redis.get(cacheKey);
          if (cachedResult) {
            return JSON.parse(cachedResult);
          }
        } catch (error) {
          console.error('Redis cache error:', error);
          // Continue without cache
        }
        
        // Handle orderBy for reserveUSD specially since it's not a DB field
        const isOrderByReserveUSD = orderBy === 'reserveUSD'

        // For pagination with cursor
        let paginationFilter = {}
        if (after) {
          const cursorId = decodeCursor(after)
          paginationFilter = {
            cursor: { id: cursorId },
            skip: 1, // Skip the cursor itself
          }
        }

        // Query all pairs at once with token data to reduce roundtrips
        // Use a more efficient query with only necessary fields
        const pairs = await prisma.pair.findMany({
          take: isOrderByReserveUSD ? first * 2 : first + 1, // More efficient multiplier
          ...paginationFilter,
          select: {
            id: true,
            address: true,
            reserve0: true,
            reserve1: true,
            token0Id: true,
            token1Id: true,
            token0: {
              select: {
                id: true,
                address: true,
                symbol: true,
                decimals: true,
                imageURI: true,
                priceUSD: true,
                stablePair: true,
              }
            },
            token1: {
              select: {
                id: true,
                address: true,
                symbol: true,
                decimals: true,
                imageURI: true,
                priceUSD: true,
                stablePair: true,
              }
            },
            lastBlockUpdate: true,
            createdAt: true,
          },
          orderBy: isOrderByReserveUSD
            ? { createdAt: 'desc' } // Default ordering for reserveUSD sorting
            : { [orderBy]: orderDirection },
        })

        // Fetch cached reserveUSD values in bulk to avoid recalculation
        let pairIds = pairs.map(pair => pair.id)
        let reserveUSDs: Record<string, string> = {}
        
        try {
          // Get all cached reserveUSD values at once
          reserveUSDs = await getCachedPairReserveUSDBulk(pairIds)
        } catch (error) {
          console.error('Error fetching cached reserveUSD values:', error)
          // Continue without cache
        }
        
        // Collect token IDs needing price updates
        const currentTime = Date.now();
        const tokenIdsNeedingPrice = new Set<string>();
        
        pairs.forEach(pair => {
          const token0 = pair.token0;
          const token1 = pair.token1;
          
          // Check if token prices need updating
          if (!token0.priceUSD || !reserveUSDs[pair.id]) {
            tokenIdsNeedingPrice.add(token0.id);
          }
          
          if (!token1.priceUSD || !reserveUSDs[pair.id]) {
            tokenIdsNeedingPrice.add(token1.id);
          }
        });
        
        // Fetch token prices in bulk only if needed
        let tokenPrices: Record<string, string> = {};
        if (tokenIdsNeedingPrice.size > 0) {
          tokenPrices = await TokenPriceService.getTokenPricesUSDBulk(Array.from(tokenIdsNeedingPrice));
        }
        
        // Process pairs and calculate reserveUSD if needed
        const processedPairs = pairs.map(pair => {
          const token0 = {
            ...pair.token0,
            priceUSD: tokenPrices[pair.token0.id] || pair.token0.priceUSD || null
          };
          
          const token1 = {
            ...pair.token1,
            priceUSD: tokenPrices[pair.token1.id] || pair.token1.priceUSD || null
          };
          
          // Calculate reserveUSD only if needed
          let reserveUSD = '0';
          if (reserveUSDs[pair.id]) {
            reserveUSD = reserveUSDs[pair.id];
          } else {
            try {
              // Calculate if not in cache - call function with correct arguments
              const reserve0 = pair.reserve0;
              const reserve1 = pair.reserve1;
              const token0Decimals = token0.decimals || 18;
              const token1Decimals = token1.decimals || 18;
              const token0Price = token0.priceUSD || '0';
              const token1Price = token1.priceUSD || '0';
              
              // Explicitly calculate the TVL from both sides of the pair
              // This ensures we account for both tokens in the pool
              const reserve0Value = Number(formatUnits(BigInt(reserve0), token0Decimals)) * parseFloat(token0Price);
              const reserve1Value = Number(formatUnits(BigInt(reserve1), token1Decimals)) * parseFloat(token1Price);
              
              // Sum both sides for total liquidity value
              const tvl = reserve0Value + reserve1Value;
              
              reserveUSD = tvl.toString();
              
              // Cache the newly calculated value
              if (parseFloat(reserveUSD) > 0) {
                try {
                  // Use the expected format for the caching function
                  cachePairReserveUSDBulk([{
                    id: pair.id,
                    reserveUSD
                  }]);
                } catch (error) {
                  console.error('Error caching reserveUSD:', error);
                }
              }
            } catch (error) {
              console.error('Error calculating reserveUSD:', error);
              reserveUSD = '0';
            }
          }
          
          // Calculate the TVL value as a float 
          const tvlValue = parseFloat(reserveUSD);
          
          return {
            ...pair,
            token0,
            token1,
            reserveUSD,
            tvl: tvlValue || 0  // Ensure tvl is always a number and never null
          };
        });
        
        // Sort by reserveUSD if needed
        if (isOrderByReserveUSD) {
          processedPairs.sort((a, b) => {
            const aValue = parseFloat(a.reserveUSD || '0')
            const bValue = parseFloat(b.reserveUSD || '0')
            return orderDirection === 'desc' ? bValue - aValue : aValue - bValue
          })
        }
        
        // Limit the results and determine if there are more
        const hasNextPage = processedPairs.length > first
        const limitedPairs = hasNextPage ? processedPairs.slice(0, first) : processedPairs
        
        // Create edges
        const edges = limitedPairs.map(pair => ({
          node: pair,
          cursor: pair.id,
        }))
        
        // Get pair count
        const totalCountResult = await prisma.$runCommandRaw({
          count: "Pair",
          query: {}
        }) as any;
        
        const result = {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: false,
            startCursor: edges[0]?.cursor,
            endCursor: edges[edges.length - 1]?.cursor,
          },
          totalCount: totalCountResult?.n || 0,
        }
        
        // Cache the result for longer
        try {
          await redis.set(cacheKey, JSON.stringify(result), 'EX', 60); // Cache for 60 seconds
        } catch (error) {
          console.error('Redis cache set error:', error);
        }
        
        return result
      } catch (error) {
        console.error('Error fetching pairs:', error)
        // Return empty result in case of error
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },

    topPairs: async (_parent: Empty, { first = 10 }: { first?: number }, { prisma }: Context) => {
      try {
        // Fetch pairs ordered by a metric that defines "top"
        // You might use volumeUSD, TVL, or another metric
        const pairs = await prisma.pair.findMany({
          take: first + 1,
          orderBy: { createdAt: 'desc' }, // Replace with your actual metric
        })

        // Get total count
        const totalCount = await prisma.pair.count()

        // Create pagination response
        const paginationResult = createCursorPagination(pairs, first)

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching top pairs:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        }
      }
    },

    pairPriceChart: async (
      _parent: Empty,
      {
        pairAddress,
        timeframe = '1d',
        limit = 100,
      }: {
        pairAddress: string
        timeframe?: string
        limit?: number
      },
      { prisma: db }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        // Find the pair
        const pair = await db.pair.findFirst({
          where: { address: pairAddress.toLowerCase() },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (!pair) {
          throw new Error(`Pair not found: ${pairAddress}`)
        }

        // Get token decimals
        const token0Decimals = pair.token0.decimals || 18
        const token1Decimals = pair.token1.decimals || 18

        // Check if either token is a stablecoin
        const stablecoinAddresses = TokenPriceService.getStablecoinAddresses()
        const isToken0Stablecoin = stablecoinAddresses.includes(
          pair.token0.address.toLowerCase()
        )
        const isToken1Stablecoin = stablecoinAddresses.includes(
          pair.token1.address.toLowerCase()
        )

        // Determine time window based on timeframe
        // Use a fixed reference time (April 2025) instead of the current system time
        // This ensures we can find snapshots with 2025 timestamps
        const referenceTime = 1744062332; // April 7, 2025, 21:45:32 UTC
        const now = referenceTime;
        let timeWindow: number

        switch (timeframe) {
          case '1h':
            timeWindow = 60 * 60 * limit // 1 hour × limit
            break
          case '4h':
            timeWindow = 4 * 60 * 60 * limit // 4 hours × limit
            break
          case '1w':
            timeWindow = 7 * 24 * 60 * 60 * limit // 1 week × limit
            break
          case '1m':
            timeWindow = 30 * 24 * 60 * 60 * limit // ~1 month × limit
            break
          case '1d':
          default:
            timeWindow = 24 * 60 * 60 * limit // 1 day × limit
            break
        }

        const startTime = now - timeWindow

        // Get price snapshots from the specified time range
        const priceSnapshots = await db.priceSnapshot.findMany({
          where: {
            pairId: pair.id,
            timestamp: { gte: startTime },
            price0: { gt: "0" },  // Fix: Use string for comparison instead of number
            price1: { gt: "0" }   // Fix: Use string for comparison instead of number
          },
          orderBy: { timestamp: 'asc' },
          distinct: ['timestamp'],
        })

        console.log(`Found ${priceSnapshots.length} price snapshots for pair ${pairAddress}`)
        console.log(`Time range: ${new Date(startTime * 1000).toISOString()} to ${new Date(now * 1000).toISOString()}`)
        
        // Log a sample of the snapshots to verify data
        if (priceSnapshots.length > 0) {
          console.log('Sample snapshots:')
          console.log(JSON.stringify(priceSnapshots.slice(0, 3), null, 2))
        }

        // Process the price snapshots to get properly formatted chart data
        let chartData: ChartDataPoint[] = []

        // Choose the correct display strategy based on the pair composition
        if (isToken1Stablecoin) {
          // If token1 is a stablecoin, we want to show token0's price in USD
          chartData = priceSnapshots.map((snapshot: Record<string, any>) => {
            const rawPrice = snapshot.price0  // Changed from token0Price
            try {
              // Use viem's formatUnits to properly handle the blockchain value
              const price = parseFloat(formatUnits(BigInt(Math.round(parseFloat(rawPrice) * Math.pow(10, token1Decimals))), token1Decimals))
              
              return {
                time: snapshot.timestamp,
                value: price,
              }
            } catch (error) {
              console.error('Error processing price:', error)
              // Fallback to traditional calculation
              try {
                const price = parseFloat(rawPrice)
                const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals)
                const adjustedPrice = price * decimalAdjustment
                
                return {
                  time: snapshot.timestamp,
                  value: adjustedPrice,
                }
              } catch (fallbackError) {
                console.error('Error in fallback calculation:', fallbackError)
                return {
                  time: snapshot.timestamp,
                  value: 0,
                }
              }
            }
          })
        } else if (isToken0Stablecoin) {
          // If token0 is a stablecoin, we want to show token1's price in USD
          chartData = priceSnapshots.map((snapshot: Record<string, any>) => {
            const rawPrice = snapshot.price1  // Changed from token1Price
            try {
              // Use viem's formatUnits to properly handle the blockchain value
              const price = parseFloat(formatUnits(BigInt(Math.round(parseFloat(rawPrice) * Math.pow(10, token0Decimals))), token0Decimals))
              
              return {
                time: snapshot.timestamp,
                value: price,
              }
            } catch (error) {
              console.error('Error processing price:', error)
              // Fallback to traditional calculation
              try {
                const price = parseFloat(rawPrice)
                const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals)
                const adjustedPrice = price * decimalAdjustment
                
                return {
                  time: snapshot.timestamp,
                  value: adjustedPrice,
                }
              } catch (fallbackError) {
                console.error('Error in fallback calculation:', fallbackError)
                return {
                  time: snapshot.timestamp,
                  value: 0,
                }
              }
            }
          })
        } else {
          // If neither token is a stablecoin, we need to handle differently
          // We'll use token0's price and try to get USD conversion
          chartData = await Promise.all(
            priceSnapshots.map(async (snapshot: Record<string, any>) => {
              const rawPrice = snapshot.token0Price
              try {
                // Use viem's formatUnits to properly handle the blockchain value
                const price = parseFloat(formatUnits(BigInt(Math.round(parseFloat(rawPrice) * Math.pow(10, token1Decimals))), token1Decimals))
                
                // Get token1's USD price from the database
                const token1PriceUSD = parseFloat(pair.token1.priceUSD || '0')
                if (token1PriceUSD <= 0) {
                  console.error(`Invalid USD price for token1: ${pair.token1.address}`)
                  return {
                    time: snapshot.timestamp,
                    value: 0,
                  }
                }

                // Calculate the USD price
                const usdPrice = price * token1PriceUSD

                return {
                  time: snapshot.timestamp,
                  value: usdPrice,
                }
              } catch (error) {
                console.error('Error processing price:', error)
                return {
                  time: snapshot.timestamp,
                  value: 0,
                }
              }
            })
          )
        }

        // Final pass to check for and fix any abnormal values
        const values = chartData.map((point) => point.value)
        const needsNormalization =
          TokenPriceService.detectNeedsDecimalNormalization(values)

        if (needsNormalization) {
          console.log('Normalizing decimal values');
          return chartData.map((point) => ({
            ...point,
            value: point.value / Math.pow(10, 18),  // Using Math.pow for type safety
          }));
        }

        // Log the final chart data to verify
        console.log(`Final chart data points: ${chartData.length}`)
        if (chartData.length > 0) {
          console.log('Sample chart data:')
          console.log(JSON.stringify(chartData.slice(0, 3), null, 2))
        }

        return chartData
      } catch (error) {
        console.error('Error in pairPriceChart:', error)
        return []
      }
    },

    // Get volume chart data for a pair
    pairVolumeChart: async (
      _parent: Empty,
      {
        pairAddress,
        timeframe = '1d',
        limit = 100,
      }: {
        pairAddress: string
        timeframe?: string
        limit?: number
      },
      { prisma }: Context
    ): Promise<VolumeChartData[]> => {
      try {
        // Find the pair
        const pair = await prisma.pair.findFirst({
          where: { address: pairAddress.toLowerCase() },
          include: {
            token0: true,
            token1: true,
          },
        })

        if (!pair) {
          throw new Error(`Pair not found: ${pairAddress}`)
        }

        // Get token decimals for proper conversion
        const token0Decimals = pair.token0.decimals || 18
        const token1Decimals = pair.token1.decimals || 18

        // Determine if either token is a stablecoin for easier USD conversion
        const stablecoinAddresses = TokenPriceService.getStablecoinAddresses()
        const isToken0Stablecoin = stablecoinAddresses.includes(
          pair.token0.address.toLowerCase()
        )
        const isToken1Stablecoin = stablecoinAddresses.includes(
          pair.token1.address.toLowerCase()
        )

        // Get token prices in USD - we'll cache these to avoid repeated lookups
        let token0PriceUSD: number = 0
        let token1PriceUSD: number = 0

        // If token0 is a stablecoin, its price is 1 USD
        if (isToken0Stablecoin) {
          token0PriceUSD = 1.0
        } else {
          // Get token0 price from the price service
          token0PriceUSD = await TokenPriceService.getTokenPriceUSD(
            pair.token0.id,
            token0Decimals
          )
        }

        // If token1 is a stablecoin, its price is 1 USD
        if (isToken1Stablecoin) {
          token1PriceUSD = 1.0
        } else {
          // Get token1 price from the price service
          token1PriceUSD = await TokenPriceService.getTokenPriceUSD(
            pair.token1.id,
            token1Decimals
          )
        }

        // Determine time window based on timeframe
        const now = Math.floor(Date.now() / 1000)
        let timeWindow: number
        let interval: number

        switch (timeframe) {
          case '1h':
            timeWindow = 60 * 60 * limit
            interval = 60 // 1 minute intervals for hourly view
            break
          case '4h':
            timeWindow = 4 * 60 * 60 * limit
            interval = 60 * 5 // 5 minute intervals for 4h view
            break
          case '1w':
            timeWindow = 7 * 24 * 60 * 60 * limit
            interval = 60 * 60 * 3 // 3 hour intervals for weekly view
            break
          case '1m':
            timeWindow = 30 * 24 * 60 * 60 * limit
            interval = 60 * 60 * 12 // 12 hour intervals for monthly view
            break
          case '1d':
          default:
            timeWindow = 24 * 60 * 60 * limit
            interval = 60 * 30 // 30 minute intervals for daily view
            break
        }

        const startTime = now - timeWindow

        // Get swaps from the specified time range
        const swaps = await prisma.swap.findMany({
          where: {
            pairId: pair.id,
            timestamp: { gte: startTime },
          },
          orderBy: { timestamp: 'asc' },
        })

        // Group swaps by time bucket
        interface VolumeBucket {
          volume0: number
          volume1: number
          volumeUSD: number
          count: number
        }

        const volumeBuckets: Record<number, VolumeBucket> = {}

        for (const swap of swaps) {
          // Use type assertion to help TypeScript
          const swapObj = swap as any;
          
          // Calculate which bucket this swap belongs to
          const bucketTime = Math.floor(Number(swapObj.timestamp) / interval) * interval

          // Calculate properly formatted volumes using token decimals
          let volume0: number
          let volume1: number

          try {
            // Use viem to properly format the volumes
            const amountIn0 = formatUnits(BigInt(swapObj.amountIn0 || '0'), token0Decimals)
            const amountOut0 = formatUnits(BigInt(swapObj.amountOut0 || '0'), token0Decimals)
            volume0 = parseFloat(amountIn0) + parseFloat(amountOut0)

            const amountIn1 = formatUnits(BigInt(swapObj.amountIn1 || '0'), token1Decimals)
            const amountOut1 = formatUnits(BigInt(swapObj.amountOut1 || '0'), token1Decimals)
            volume1 = parseFloat(amountIn1) + parseFloat(amountOut1)
          } catch (error) {
            // Fallback if viem formatting fails
            volume0 =
              (parseFloat(swapObj.amountIn0 || '0') + parseFloat(swapObj.amountOut0 || '0')) /
              Math.pow(10, token0Decimals)
            volume1 =
              (parseFloat(swapObj.amountIn1 || '0') + parseFloat(swapObj.amountOut1 || '0')) /
              Math.pow(10, token1Decimals)
          }

          // Calculate USD value by multiplying by token prices
          const volume0USD = volume0 * token0PriceUSD
          const volume1USD = volume1 * token1PriceUSD

          // Use the higher USD value to represent the swap's volume
          // This reduces issues with imbalanced prices
          const volumeUSD = Math.max(volume0USD, volume1USD)

          // Check if we have existing records for this bucket
          if (!volumeBuckets[bucketTime]) {
            volumeBuckets[bucketTime] = {
              volume0,
              volume1,
              volumeUSD,
              count: 1,
            }
          } else {
            // Update existing bucket
            volumeBuckets[bucketTime].volume0 += volume0
            volumeBuckets[bucketTime].volume1 += volume1
            volumeBuckets[bucketTime].volumeUSD += volumeUSD
            volumeBuckets[bucketTime].count += 1
          }
        }

        // Convert to array for the chart
        const chartData: VolumeChartData[] = Object.entries(volumeBuckets).map(
          ([timeStr, data]) => ({
            time: parseInt(timeStr, 10),
            value: data.volumeUSD, // Using proper USD volume as primary value
            volume0: data.volume0,
            volume1: data.volume1,
            count: data.count,
          })
        )

        // Sort by time
        return chartData.sort((a, b) => Number(a.time) - Number(b.time))
      } catch (error) {
        console.error('Error fetching pair volume chart data:', error)
        return []
      }
    },

    // Get price chart data for a token across all its pairs
    tokenPriceChart: async (
      _parent: Empty,
      { tokenAddress, timeframe = '1d', limit = 100 }: TokenPriceChartArgs,
      { prisma }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        console.log(`Fetching price chart for token: ${tokenAddress}, timeframe: ${timeframe}, limit: ${limit}`);
        
        // Normalize address to lowercase for consistent lookups
        const normalizedAddress = tokenAddress.toLowerCase();
        
        // Find the token by address
        const token = await prisma.token.findFirst({
          where: { address: normalizedAddress },
          select: {
            id: true,
            symbol: true,
            decimals: true
          }
        });

        if (!token) {
          console.error(`Token not found: ${tokenAddress}`);
          return [];
        }

        console.log(`Found token: ${token.symbol}, id: ${token.id}`);
        
        // Get MongoDB connection
        const mongodb = await initMongoDB();
        if (!mongodb) {
          console.error('Failed to initialize MongoDB connection');
          return [];
        }
        
        // Determine time window based on timeframe
        const now = Math.floor(Date.now() / 1000);
        let fromTimestamp: number;
        
        switch (timeframe.toLowerCase()) {
          case '1h':
            fromTimestamp = now - 3600; // 1 hour
            break;
          case '1d':
            fromTimestamp = now - 86400; // 1 day
            break;
          case '1w':
            fromTimestamp = now - 604800; // 1 week
            break;
          case '1m':
            fromTimestamp = now - 2592000; // 30 days
            break;
          case '1y':
            fromTimestamp = now - 31536000; // 365 days
            break;
          default:
            fromTimestamp = now - 86400; // Default to 1 day
        }
        
        console.log(`Using timeframe filter: from ${new Date(fromTimestamp * 1000).toISOString()}`);
        
        // Check if this token has a known pair mapping
        const pairInfo = knownTokenPairs[normalizedAddress];
        if (pairInfo) {
          console.log(`Using known pair ${pairInfo.pairId} for ${token.symbol}`);
          
          try {
            // Query snapshots directly with MongoDB - now with timeframe filtering
            const snapshotsCollection = mongodb.collection('PriceSnapshot');
            const snapshots = await snapshotsCollection.find({
              pairId: new ObjectId(pairInfo.pairId),
              timestamp: { $gte: fromTimestamp }  // Apply timeframe filter
            }).sort({ timestamp: -1 }).limit(limit).toArray();
            
            console.log(`Found ${snapshots.length} snapshots for ${token.symbol} within timeframe`);
            
            if (snapshots.length === 0) {
              console.log(`No snapshots found for known pair within timeframe, trying fallback`);
              // Don't return empty yet, let's try the fallback
            } else {
              // Process snapshots
              const priceSeries = new Map<number, number>();
              
              snapshots.forEach((snapshot: any) => {
                try {
                  const priceField = pairInfo.isToken0 ? snapshot.price0 : snapshot.price1;
                  
                  if (priceField === null) return;
                  
                  const price = parseFloat(String(priceField));
                  if (price <= 0 || isNaN(price) || !isFinite(price)) return;
                  
                  // Sanity check for unrealistically high prices
                  if (price > 100 && token.symbol === 'KKUB') {
                    console.log(`Skipping unrealistically high price for KKUB: ${price}`);
                    return;
                  }
                  
                  const timestamp = typeof snapshot.timestamp === 'string'
                    ? parseInt(snapshot.timestamp, 10)
                    : Number(snapshot.timestamp);
                  
                  if (!priceSeries.has(timestamp) || price > priceSeries.get(timestamp)!) {
                    priceSeries.set(timestamp, price);
                  }
                } catch (error) {
                  console.error('Error processing price:', error);
                }
              });
              
              if (priceSeries.size > 0) {
                // Convert to chart data with proper type handling
                const chartData = Array.from(priceSeries.entries())
                  .map(([time, value]) => ({ time, value }))
                  .sort((a, b) => Number(a.time) - Number(b.time));
                
                // Check if we need to normalize values
                const values = chartData.map((point) => point.value);
                const needsNormalization = TokenPriceService.detectNeedsDecimalNormalization(values);
                
                if (needsNormalization) {
                  console.log('Normalizing decimal values');
                  return chartData.map((point) => ({
                    ...point,
                    value: point.value / Math.pow(10, 18),  // Using Math.pow for type safety
                  }));
                }
                
                console.log(`Returning ${chartData.length} chart data points for ${token.symbol}`);
                return chartData;
              }
            }
          } catch (error) {
            console.error(`Error fetching direct snapshots for ${token.symbol}:`, error);
            // Continue to fallback
          }
        }
        
        // Fallback: Try to find pairs using database relationships
        console.log('Using database relationships to find price data');
        
        // Find all pairs for this token
        const pairsAsToken0 = await prisma.pair.findMany({
          where: { token0Id: token.id },
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
        });
        
        const pairsAsToken1 = await prisma.pair.findMany({
          where: { token1Id: token.id },
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
        });
        
        console.log(`Found pairs via relationships - token0: ${pairsAsToken0.length}, token1: ${pairsAsToken1.length}`);
        
        if (pairsAsToken0.length === 0 && pairsAsToken1.length === 0) {
          console.error(`No pairs found for ${token.symbol}, cannot provide price chart`);
          return [];
        }
        
        // Use the first pair we find for simplicity
        let selectedPairId: string | null = null;
        let isToken0 = false;
        
        if (pairsAsToken0.length > 0) {
          selectedPairId = pairsAsToken0[0].id;
          isToken0 = true;
        } else if (pairsAsToken1.length > 0) {
          selectedPairId = pairsAsToken1[0].id;
          isToken0 = false;
        }
        
        if (!selectedPairId) {
          console.error('Selected pair ID is null, cannot fetch snapshots');
          return [];
        }
        
        console.log(`Using pair ${selectedPairId} with token as token${isToken0 ? '0' : '1'}`);
        
        // Query snapshots for the selected pair - now with timeframe filtering
        const snapshotsCollection = mongodb.collection('PriceSnapshot');
        const snapshots = await snapshotsCollection.find({
          pairId: new ObjectId(selectedPairId),
          timestamp: { $gte: fromTimestamp }  // Apply timeframe filter
        }).sort({ timestamp: -1 }).limit(limit).toArray();
        
        console.log(`Found ${snapshots.length} snapshots for selected pair within timeframe`);
        
        if (snapshots.length === 0) {
          console.error('No snapshots found for selected pair within timeframe');
          return [];
        }
        
        // Process snapshots for this pair
        const priceSeries = new Map<number, number>();
        
        snapshots.forEach((snapshot: any) => {
          try {
            const priceField = isToken0 ? snapshot.price0 : snapshot.price1;
            
            if (priceField === null) return;
            
            const price = parseFloat(String(priceField));
            if (price <= 0 || isNaN(price) || !isFinite(price)) return;
            
            // Sanity check for unrealistically high prices
            if (price > 100 && token.symbol === 'KKUB') {
              console.log(`Skipping unrealistically high price for KKUB: ${price}`);
              return;
            }
            
            const timestamp = typeof snapshot.timestamp === 'string'
              ? parseInt(snapshot.timestamp, 10)
              : Number(snapshot.timestamp);
            
            if (!priceSeries.has(timestamp) || price > priceSeries.get(timestamp)!) {
              priceSeries.set(timestamp, price);
            }
          } catch (error) {
            console.error('Error processing price:', error);
          }
        });
        
        if (priceSeries.size === 0) {
          console.error('No valid price points extracted from snapshots');
          return [];
        }
        
        // Convert to chart data with proper type handling
        const chartData = Array.from(priceSeries.entries())
          .map(([time, value]) => ({ time, value }))
          .sort((a, b) => Number(a.time) - Number(b.time));
        
        // Check if we need to normalize values
        const values = chartData.map((point) => point.value);
        const needsNormalization = TokenPriceService.detectNeedsDecimalNormalization(values);
        
        if (needsNormalization) {
          console.log('Normalizing decimal values');
          return chartData.map((point) => ({
            ...point,
            value: point.value / Math.pow(10, 18),  // Using Math.pow for type safety
          }));
        }
        
        console.log(`Returning ${chartData.length} chart data points for ${token.symbol}`);
        return chartData;
      } catch (error) {
        console.error('Error in tokenPriceChart:', error);
        return [];
      }
    },

    // Get user positions (liquidity positions, farming positions, and staking position)
    userPositions: async (
      _parent: Empty,
      { userAddress }: { userAddress: string },
      { prisma }: Context
    ) => {
      try {
        // Normalize user address to lowercase
        const normalizedAddress = userAddress.toLowerCase();

        // Find liquidity positions for the user
        const liquidityPositions = await prisma.liquidityPosition.findMany({
          where: { userAddress: normalizedAddress },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
        });

        // Find farming positions for the user
        const farmingPositions = await prisma.farmingPosition.findMany({
          where: { userAddress: normalizedAddress },
          include: {
            pool: true,
          },
        });

        // Find staking position for the user
        const stakingPosition = await prisma.stakingPosition.findUnique({
          where: { userAddress: normalizedAddress },
        });

        // Return positions with proper data structure
        // Important: return empty arrays instead of null for non-nullable fields
        return {
          liquidityPositions: liquidityPositions || [],
          farmingPositions: farmingPositions || [],
          stakingPosition, // This is nullable in the schema
        };
      } catch (error) {
        console.error('Error fetching user positions:', error);
        // Return empty arrays instead of null to satisfy non-nullable field requirements
        return {
          liquidityPositions: [],
          farmingPositions: [],
          stakingPosition: null,
        };
      }
    },

    // Recent Transactions resolver
    recentTransactions: async (
      _parent: Empty,
      { first = 20, after }: { first?: number; after?: string },
      { prisma, loaders }: Context
    ) => {
      try {
        // Create a query object to avoid typing issues
        const query: any = {
          take: first + 1, // Take one more to check for next page
          orderBy: { timestamp: 'desc' }, // Most recent first
          include: {
            pair: {
              include: {
                token0: {
                  select: {
                    id: true,
                    address: true,
                    symbol: true,
                    name: true,
                    decimals: true,
                    imageURI: true
                  }
                },
                token1: {
                  select: {
                    id: true,
                    address: true,
                    symbol: true,
                    name: true,
                    decimals: true,
                    imageURI: true
                  }
                }
              }
            }
          }
        };
        
        // Add pagination if cursor is provided
        if (after) {
          query.cursor = { id: after };
          query.skip = 1; // Skip the cursor itself
        }

        // Query swaps ordered by timestamp (newest first)
        const swaps = await prisma.swap.findMany(query);

        // Determine if there are more results
        const hasNextPage = swaps.length > first;
        const limitedSwaps = hasNextPage ? swaps.slice(0, first) : swaps;

        // Process swaps to add valueUSD and extract token fields
        const processedSwaps = await Promise.all(limitedSwaps.map(async swap => {
          // Use type assertion to help TypeScript
          const swapObj = swap as any;
          
          // Calculate valueUSD if not already set
          let valueUSD = '0';
          
          try {
            // Get token prices at transaction time if possible
            const token0 = swapObj.pair.token0;
            const token1 = swapObj.pair.token1;
            const token0Decimals = token0.decimals || 18;
            const token1Decimals = token1.decimals || 18;
            
            // Get current token prices if historical not available
            let token0PriceUSD = '0';
            let token1PriceUSD = '0';
            
            try {
              // Use price service directly
              token0PriceUSD = (await TokenPriceService.getTokenPriceUSD(token0.id)).toString();
              token1PriceUSD = (await TokenPriceService.getTokenPriceUSD(token1.id)).toString();
            } catch (error) {
              console.error('Error loading token prices:', error);
            }
            
            // Calculate value based on the token with higher price accuracy
            // Format token amounts properly
            const amount0In = Number(formatUnits(BigInt(swapObj.amountIn0 || '0'), token0Decimals));
            const amount0Out = Number(formatUnits(BigInt(swapObj.amountOut0 || '0'), token0Decimals));
            const amount1In = Number(formatUnits(BigInt(swapObj.amountIn1 || '0'), token1Decimals));
            const amount1Out = Number(formatUnits(BigInt(swapObj.amountOut1 || '0'), token1Decimals));
            
            // Calculate USD values
            const value0USD = (amount0In + amount0Out) * parseFloat(token0PriceUSD);
            const value1USD = (amount1In + amount1Out) * parseFloat(token1PriceUSD);
            
            // Use the higher value for better accuracy
            valueUSD = Math.max(value0USD, value1USD).toString();
          } catch (error) {
            console.error('Error calculating swap valueUSD:', error);
          }
          
          // Return object with GraphQL schema properties
          return {
            id: swapObj.id,
            txHash: swapObj.txHash || 'unknown',
            userAddress: swapObj.userAddress || swapObj.sender || 'unknown',
            timestamp: Number(swapObj.timestamp),
            token0: swapObj.pair.token0,
            token1: swapObj.pair.token1,
            amountIn0: swapObj.amountIn0 || '0',
            amountIn1: swapObj.amountIn1 || '0',
            amountOut0: swapObj.amountOut0 || '0',
            amountOut1: swapObj.amountOut1 || '0',
            valueUSD
          };
        }));

        // Get total count
        const totalCountResult = await prisma.$runCommandRaw({
          count: "Swap",
          query: {}
        }) as any;
        
        return {
          edges: processedSwaps.map(swap => ({
            node: swap,
            cursor: swap.id
          })),
          pageInfo: {
            hasNextPage,
            hasPreviousPage: false,
            startCursor: processedSwaps[0]?.id,
            endCursor: processedSwaps[processedSwaps.length - 1]?.id
          },
          totalCount: totalCountResult?.n || 0
        };
      } catch (error) {
        console.error('Error fetching recent transactions:', error);
        // Return empty result rather than null
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null
          },
          totalCount: 0
        };
      }
    }
  },
}
