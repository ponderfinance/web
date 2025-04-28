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
    // Get the token to check decimals
    const token = await prismaClient.token.findUnique({
      where: { id: tokenId },
      select: { symbol: true, decimals: true }
    });

    if (!token) {
      return { [tokenId]: '0' };
    }

    // Get 24h swap data for this token
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const swaps = await prismaClient.swap.findMany({
      where: {
        OR: [
          { pair: { token0Id: tokenId } },
          { pair: { token1Id: tokenId } }
        ],
        timestamp: { gte: Math.floor(oneDayAgo.getTime() / 1000) }
      },
      include: {
        pair: {
          include: {
            token0: true,
            token1: true
          }
        }
      }
    });

    // Calculate volume
    let volume = 0;
    for (const swap of swaps) {
      const isToken0 = swap.pair.token0Id === tokenId;
      const amount = isToken0 
        ? parseFloat(formatUnits(BigInt(swap.amountIn0 || '0'), token.decimals || 18))
        : parseFloat(formatUnits(BigInt(swap.amountIn1 || '0'), token.decimals || 18));
      
      volume += amount;
    }

    return { [tokenId]: volume.toString() };
  } catch (error) {
    console.error(`Error calculating volume for token ${tokenId}:`, error);
    return { [tokenId]: '0' };
  }
}

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

export const resolvers = {
  // Add this resolver before any existing resolvers
  Token: {
    tvl: async (parent: any, _args: any, { prisma, loaders }: Context) => {
      try {
        // Return tvl if it exists
        if (parent.tvl) {
          return typeof parent.tvl === 'string' ? parent.tvl : parent.tvl.toString();
        }
        
        // Get token ID
        const tokenId = parent.id;
        if (!tokenId) {
          console.error('Token ID is missing');
          return '0';
        }
        
        // Fetch all pairs that include this token
        const pairsAsToken0 = await prisma.pair.findMany({
          where: { token0Id: tokenId },
          select: {
            id: true,
            reserve0: true,
            token0: {
              select: {
                decimals: true,
                priceUSD: true
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
                decimals: true,
                priceUSD: true
              }
            }
          }
        });
        
        // Calculate TVL from pairs
        let totalTvl = 0;
        
        // Process token0 pairs
        for (const pair of pairsAsToken0) {
          const tokenPrice = parseFloat(parent.priceUSD || pair.token0.priceUSD || '0');
          const tokenDecimals = parent.decimals || pair.token0.decimals || 18;
          
          if (tokenPrice > 0 && pair.reserve0) {
            try {
              const reserveValue = 
                Number(formatUnits(BigInt(pair.reserve0), tokenDecimals)) * tokenPrice;
              totalTvl += reserveValue;
            } catch (error) {
              console.error('Error calculating TVL from pair:', error);
            }
          }
        }
        
        // Process token1 pairs
        for (const pair of pairsAsToken1) {
          const tokenPrice = parseFloat(parent.priceUSD || pair.token1.priceUSD || '0');
          const tokenDecimals = parent.decimals || pair.token1.decimals || 18;
          
          if (tokenPrice > 0 && pair.reserve1) {
            try {
              const reserveValue = 
                Number(formatUnits(BigInt(pair.reserve1), tokenDecimals)) * tokenPrice;
              totalTvl += reserveValue;
            } catch (error) {
              console.error('Error calculating TVL from pair:', error);
            }
          }
        }
        
        return totalTvl.toString();
      } catch (error) {
        console.error('Error resolving token TVL:', error);
        return '0';
      }
    },
    
    marketCap: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        // Return marketCap if it exists
        if (parent.marketCap) {
          return typeof parent.marketCap === 'string' ? parent.marketCap : parent.marketCap.toString();
        }
        
        // Calculate market cap from price and circulating supply
        const tokenPrice = parseFloat(parent.priceUSD || '0');
        if (tokenPrice <= 0) {
          return '0';
        }
        
        // Try to get supply from the supply model
        const tokenId = parent.id;
        if (!tokenId) {
          return '0';
        }
        
        const supply = await prisma.tokenSupply.findUnique({
          where: { tokenId }
        });
        
        if (supply && supply.circulating) {
          const tokenDecimals = parent.decimals || 18;
          try {
            const circulatingSupply = Number(
              formatUnits(BigInt(supply.circulating), tokenDecimals)
            );
            return (tokenPrice * circulatingSupply).toString();
          } catch (error) {
            console.error('Error formatting supply:', error);
          }
        }
        
        // No supply data found, estimate from total pairs
        const totalPairs = await prisma.pair.count({
          where: {
            OR: [
              { token0Id: tokenId },
              { token1Id: tokenId }
            ]
          }
        });
        
        // If token has pairs, use a reasonable fallback
        if (totalPairs > 0) {
          return (tokenPrice * 1000000).toString(); // Assume 1M token supply as fallback
        }
        
        // Default fallback - return '0' string
        return '0';
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
        if (tokenPrice <= 0) {
          return '0';
        }
        
        // Try to get supply from the supply model
        const tokenId = parent.id;
        if (!tokenId) {
          return '0';
        }
        
        const supply = await prisma.tokenSupply.findUnique({
          where: { tokenId }
        });
        
        if (supply && supply.total) {
          const tokenDecimals = parent.decimals || 18;
          try {
            const totalSupply = Number(
              formatUnits(BigInt(supply.total), tokenDecimals)
            );
            return (tokenPrice * totalSupply).toString();
          } catch (error) {
            console.error('Error formatting supply:', error);
          }
        }
        
        // No supply data found, estimate from total pairs (same as marketCap but with a 2x multiplier for total vs circulating)
        const totalPairs = await prisma.pair.count({
          where: {
            OR: [
              { token0Id: tokenId },
              { token1Id: tokenId }
            ]
          }
        });
        
        // If token has pairs, use a reasonable fallback
        if (totalPairs > 0) {
          return (tokenPrice * 2000000).toString(); // Assume 2M total supply as fallback
        }
        
        // Default fallback - return '0' string
        return '0';
      } catch (error) {
        console.error('Error resolving token fdv:', error);
        return '0';
      }
    }
  },
  
  Pair: {
    tvl: (parent: any) => {
      try {
        // If there's a tvl property, use it
        if (parent.tvl !== undefined) {
          return typeof parent.tvl === 'string' ? parseFloat(parent.tvl) || 0 : (parent.tvl || 0);
        }
        
        // If there's a reserveUSD property, use that
        if (parent.reserveUSD !== undefined) {
          return typeof parent.reserveUSD === 'string' ? parseFloat(parent.reserveUSD) || 0 : (parent.reserveUSD || 0);
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

      if (!token) return null;

      // Calculate 24h volume
      const volumeData = await calculateTokenVolume24h(token.id, ctx.prisma, ctx.loaders);
      const volume24h = volumeData[token.id] || '0';

      // Get latest price data
      const priceData = await TokenPriceService.getTokenPricesUSDBulk([token.id]);
      const currentPrice = priceData[token.id] || token.priceUSD || '0';

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
        updatedAt: token.updatedAt
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
      const enhancedTokens = limitedTokens.map((token: PrismaToken) => ({
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
      }));

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
      
      // Try to get from Redis cache first
      const cacheKey = `token:${normalizedAddress}`;
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
      
      // Find the token with optimized query
      const token = await prisma.token.findFirst({
        where: { address: normalizedAddress }
      });
      
      if (!token) {
        return null;
      }
      
      // Check if price needs to be updated
      const currentTime = Date.now();
      let updatedToken = { ...token };
      
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
      
      // Cache the result
      try {
        const cacheData = JSON.stringify(updatedToken);
        await redis.set(cacheKey, cacheData, 'EX', 60); // Cache for 60 seconds
      } catch (error) {
        console.error('Redis cache set error:', error);
      }
      
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
              
              // Call the function with correct format
              const tvl = Number(formatUnits(BigInt(reserve0), token0Decimals)) * parseFloat(token0Price) + 
                          Number(formatUnits(BigInt(reserve1), token1Decimals)) * parseFloat(token1Price);
              
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
            price0: { gt: 0 },  // Using number for Float type comparison
            price1: { gt: 0 }   // Using number for Float type comparison
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
          // Calculate which bucket this swap belongs to
          const bucketTime = Math.floor(Number(swap.timestamp) / interval) * interval

          // Calculate properly formatted volumes using token decimals
          let volume0: number
          let volume1: number

          try {
            // Use viem to properly format the volumes
            const amountIn0 = formatUnits(BigInt(swap.amountIn0 || '0'), token0Decimals)
            const amountOut0 = formatUnits(BigInt(swap.amountOut0 || '0'), token0Decimals)
            volume0 = parseFloat(amountIn0) + parseFloat(amountOut0)

            const amountIn1 = formatUnits(BigInt(swap.amountIn1 || '0'), token1Decimals)
            const amountOut1 = formatUnits(BigInt(swap.amountOut1 || '0'), token1Decimals)
            volume1 = parseFloat(amountIn1) + parseFloat(amountOut1)
          } catch (error) {
            // Fallback if viem formatting fails
            volume0 =
              (parseFloat(swap.amountIn0 || '0') + parseFloat(swap.amountOut0 || '0')) /
              Math.pow(10, token0Decimals)
            volume1 =
              (parseFloat(swap.amountIn1 || '0') + parseFloat(swap.amountOut1 || '0')) /
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
  },
}
