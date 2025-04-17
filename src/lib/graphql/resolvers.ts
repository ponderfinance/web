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
  time: number
  value: number
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
  price0: string;
  price1: string;
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
  };
}

export const resolvers = {
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

      // Fetch tokens in a single query with minimal fields
      let tokens = await prisma.token.findMany({
        take: first + 1,
        where: {
          ...(where?.address && { address: where.address }),
          ...(where?.symbol && { symbol: where.symbol }),
          ...(where?.name && { name: where.name }),
        },
        orderBy: { [orderBy]: orderDirection.toLowerCase() },
        select: selectFields,
      });

      // Handle cursor-based pagination
      const hasNextPage = tokens.length > first;
      if (hasNextPage) {
        tokens = tokens.slice(0, -1);
      }

      // Efficiently fetch all token prices in bulk
      const tokenIds = tokens.map((token: PrismaToken) => token.id);
      const pricesMap = await TokenPriceService.getTokenPricesUSDBulk(tokenIds);
      
      // Attach prices to tokens - create minimal objects
      tokens = tokens.map((token: PrismaToken) => ({
        ...token,
        symbol: token.symbol ?? null,
        name: token.name ?? null,
        decimals: token.decimals ?? null,
        imageURI: token.imageURI ?? null,
        stablePair: token.stablePair ?? null,
        priceUSD: (pricesMap[token.id] || token.priceUSD) ?? null,
        priceChange24h: token.priceChange24h ?? null,
        volumeUSD24h: token.volumeUSD24h ?? null,
        lastPriceUpdate: token.lastPriceUpdate ?? null,
      }));

      // Add type for edges map
      const edges = tokens.map((token: PrismaToken) => ({
        node: token,
        cursor: token.id,
      }));

      // Get count separately - only when needed
      const totalCount = await prisma.token.count({
        where: {
          ...(where?.address && { address: where.address }),
          ...(where?.symbol && { symbol: where.symbol }),
          ...(where?.name && { name: where.name }),
        },
      });

      const result = {
        edges,
        pageInfo: {
          hasNextPage,
          hasPreviousPage: false,
          startCursor: edges[0]?.cursor,
          endCursor: edges[edges.length - 1]?.cursor,
        },
        totalCount,
      };

      // Cache the result
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'EX', 30); // Cache for 30 seconds
      } catch (error) {
        console.error('Redis cache set error:', error);
      }

      return result;
    },
    tokenByAddress: async (
      _parent: Empty,
      { address }: { address: string },
      { prisma }: Context
    ) => {
      return prisma.token.findFirst({
        where: { address: address.toLowerCase() },
      })
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
        // Check Redis cache first
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
        const pairs = await prisma.pair.findMany({
          take: isOrderByReserveUSD ? first * 3 : first + 1,
          ...paginationFilter,
          select: {
            id: true,
            address: true,
            reserve0: true,
            reserve1: true,
            totalSupply: true,
            feesPending0: true,
            feesPending1: true,
            feesCollected0: true,
            feesCollected1: true,
            token0Id: true,
            token1Id: true,
            createdAt: true,
            updatedAt: true,
            token0: {
              select: { 
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
                stablePair: true
              },
            },
            token1: {
              select: { 
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
                stablePair: true
              },
            },
          },
        });

        // Get all pair IDs and token IDs
        const pairIds = pairs.map((pair: Record<string, any>) => pair.id)
        const tokenIds = new Set<string>()
        pairs.forEach((pair: Record<string, any>) => {
          if (pair.token0?.id) tokenIds.add(pair.token0.id)
          if (pair.token1?.id) tokenIds.add(pair.token1.id)
        })

        // Get cached token prices using DataLoader or TokenPriceService
        const tokenPricesPromise = loaders?.tokenPriceLoader 
          ? Promise.all(Array.from(tokenIds).map(id => loaders.tokenPriceLoader.load(id)))
            .then(prices => {
              // Convert array back to map
              const priceMap: Record<string, string> = {};
              Array.from(tokenIds).forEach((id, index) => {
                priceMap[id] = prices[index];
              });
              return priceMap;
            })
          : TokenPriceService.getTokenPricesUSDBulk(Array.from(tokenIds));

        // Get reserveUSD values from Redis cache in a single batch operation
        const cachedValuesPromise = getCachedPairReserveUSDBulk(pairIds).catch(() => ({}));

        // Wait for both promises to resolve
        const [tokenPrices, cachedValues] = await Promise.all([
          tokenPricesPromise,
          cachedValuesPromise
        ])

        // Calculate reserves and prepare pairs
        const pairsWithReserves = await Promise.all(
          pairs.map(async (pair: any) => {
            // Check if we already have the reserve from cache
            if (cachedValues && typeof cachedValues === 'object' && pair.id in cachedValues) {
              const reserveUSD = cachedValues[pair.id as keyof typeof cachedValues] as string;
              return {
                ...pair,
                reserveUSD,
                tvl: parseFloat(reserveUSD)
              }
            }

            // Calculate from token prices
            try {
              // Get the token prices
              const token0Price = parseFloat(tokenPrices[pair.token0?.id || ''] || '0')
              const token1Price = parseFloat(tokenPrices[pair.token1?.id || ''] || '0')
              
              // Only calculate if we have token prices and valid reserves
              if ((token0Price > 0 || token1Price > 0) && 
                  pair.token0 && pair.token1 && 
                  pair.reserve0 && pair.reserve1) {
                  
                // Convert reserves to floats with appropriate decimal adjustment
                const reserve0 = parseFloat(formatUnits(
                  BigInt(pair.reserve0), 
                  pair.token0.decimals || 18
                ))
                const reserve1 = parseFloat(formatUnits(
                  BigInt(pair.reserve1), 
                  pair.token1.decimals || 18
                ))
                
                // Calculate the total value 
                let reserveUSD = '0'
                if (token0Price > 0) {
                  reserveUSD = (reserve0 * token0Price * 2).toFixed(2) // multiply by 2 for both sides
                } else if (token1Price > 0) {
                  reserveUSD = (reserve1 * token1Price * 2).toFixed(2) // multiply by 2 for both sides
                }

                // Background cache update without waiting
                cachePairReserveUSDBulk([{ id: pair.id, reserveUSD }]).catch(() => {});
                
                return {
                  ...pair,
                  reserveUSD,
                  tvl: parseFloat(reserveUSD)
                }
              }
            } catch (error) {
              // Silent fail and continue
            }
            
            // Fallback to 0 if calculation fails
            return {
              ...pair,
              reserveUSD: '0',
              tvl: 0
            }
          })
        )

        // Get totalCount using Redis cache if possible
        let totalCount: number;
        try {
          const cachedCount = await redis.get('pairs:count');
          if (cachedCount) {
            totalCount = parseInt(cachedCount, 10);
          } else {
            totalCount = await prisma.pair.count();
            // Cache for 5 minutes
            await redis.set('pairs:count', totalCount.toString(), 'EX', 300);
          }
        } catch (error) {
          totalCount = await prisma.pair.count();
        }

        let result;
        
        // If ordering by reserveUSD, sort results 
        if (isOrderByReserveUSD) {
          // Sort by TVL
          const sortedPairs = pairsWithReserves.sort(
            (a: Record<string, any>, b: Record<string, any>) => {
              return orderDirection === 'desc' ? b.tvl - a.tvl : a.tvl - b.tvl
            }
          );
          
          // Take the requested number
          const page = sortedPairs.slice(0, first + 1)
          
          // Handle pagination
          const hasNextPage = page.length > first
          const displayPairs = hasNextPage ? page.slice(0, first) : page
          
          result = {
            edges: displayPairs.map((pair: Record<string, any>) => ({
              node: pair,
              cursor: pair.id
            })),
            pageInfo: {
              hasNextPage,
              hasPreviousPage: !!after,
              startCursor: displayPairs[0]?.id || null,
              endCursor: displayPairs[displayPairs.length - 1]?.id || null,
            },
            totalCount,
          }
        } else {
          // For other orderBy fields, apply standard pagination
          const hasNextPage = pairs.length > first
          const displayPairs = hasNextPage ? pairs.slice(0, first) : pairs
          
          result = {
            edges: displayPairs.map((pair: Record<string, any>) => ({
              node: pair,
              cursor: pair.id
            })),
            pageInfo: {
              hasNextPage,
              hasPreviousPage: !!after,
              startCursor: displayPairs[0]?.id || null,
              endCursor: displayPairs[displayPairs.length - 1]?.id || null,
            },
            totalCount,
          }
        }
        
        // Cache the result
        try {
          await redis.set(cacheKey, JSON.stringify(result), 'EX', 30); // 30 seconds cache
        } catch (error) {
          console.error('Redis cache set error:', error);
        }
        
        return result;
      } catch (error) {
        console.error('Error fetching pairs:', error)
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
        const now = Math.floor(Date.now() / 1000)
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
            price0: { gt: "" },
            price1: { gt: "" }
          },
          orderBy: { timestamp: 'asc' },
          distinct: ['timestamp'],
        })

        console.log(`Found ${priceSnapshots.length} price snapshots for pair ${pairAddress}`)
        
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
            const rawPrice = snapshot.price0
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
            const rawPrice = snapshot.price1
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
              const rawPrice = snapshot.price0
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
                // Fallback to traditional calculation
                try {
                  const price = parseFloat(rawPrice)
                  const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals)
                  const basePrice = price * decimalAdjustment
                  
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
                  const usdPrice = basePrice * token1PriceUSD
                  
                  return {
                    time: snapshot.timestamp,
                    value: usdPrice,
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
          )
        }

        // Final pass to check for and fix any abnormal values
        const values = chartData.map((point) => point.value)
        const needsNormalization =
          TokenPriceService.detectNeedsDecimalNormalization(values)

        if (needsNormalization) {
          console.log('Values need normalization, applying...')
          // Use the normalizePrice utility for each value
          chartData = chartData.map((point) => ({
            ...point,
            value: TokenPriceService.normalizePrice(point.value, isToken0Stablecoin ? token1Decimals : token0Decimals),
          }))
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
          const bucketTime = Math.floor(swap.timestamp / interval) * interval

          // Calculate properly formatted volumes using token decimals
          let volume0: number
          let volume1: number

          try {
            // Use viem to properly format the volumes
            const amountIn0 = formatUnits(BigInt(swap.amount0In || '0'), token0Decimals)
            const amountOut0 = formatUnits(BigInt(swap.amount0Out || '0'), token0Decimals)
            volume0 = parseFloat(amountIn0) + parseFloat(amountOut0)

            const amountIn1 = formatUnits(BigInt(swap.amount1In || '0'), token1Decimals)
            const amountOut1 = formatUnits(BigInt(swap.amount1Out || '0'), token1Decimals)
            volume1 = parseFloat(amountIn1) + parseFloat(amountOut1)
          } catch (error) {
            // Fallback if viem formatting fails
            volume0 =
              (parseFloat(swap.amount0In || '0') + parseFloat(swap.amount0Out || '0')) /
              Math.pow(10, token0Decimals)
            volume1 =
              (parseFloat(swap.amount1In || '0') + parseFloat(swap.amount1Out || '0')) /
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
        return chartData.sort((a, b) => a.time - b.time)
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
        
        // Find the token with minimal data load
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
        })

        if (!token) {
          console.error(`Token not found: ${tokenAddress}`)
          return []
        }

        // Get all pairs for this token with proper typing
        const pairs: PairWithTokenInfo[] = [
          ...token.pairsAsToken0.map((p: any) => ({ 
            id: p.id, 
            isToken0: true,
            counterpartToken: p.token1
          })),
          ...token.pairsAsToken1.map((p: any) => ({ 
            id: p.id, 
            isToken0: false,
            counterpartToken: p.token0
          }))
        ]

        if (pairs.length === 0) {
          console.error(`No pairs found for token: ${tokenAddress}`)
          return []
        }

        // Determine time window based on timeframe
        const now = Math.floor(Date.now() / 1000)
        const timeWindows = {
          '1h': 60 * 60,
          '4h': 4 * 60 * 60,
          '1d': 24 * 60 * 60,
          '1w': 7 * 24 * 60 * 60,
          '1m': 30 * 24 * 60 * 60
        }
        const timeWindow = timeWindows[timeframe as keyof typeof timeWindows] || timeWindows['1d']
        const startTime = now - (timeWindow * limit)
        
        // Get stablecoin addresses
        const stablecoinAddresses = TokenPriceService.getStablecoinAddresses()

        // Get price snapshots for all pairs in parallel with optimized query
        const snapshotPromises = pairs.map(pair => 
          prisma.priceSnapshot.findMany({
            where: {
              pairId: pair.id,
              timestamp: { gte: startTime },
              price0: { gt: "" },
              price1: { gt: "" }
            },
            select: {
              timestamp: true,
              price0: true,
              price1: true
            },
            orderBy: { timestamp: 'asc' }
          })
        )

        const allSnapshots = await Promise.all(snapshotPromises)
        
        // Process snapshots efficiently
        const priceSeries = new Map<number, number>()
        
        // First try stablecoin pairs - these provide direct USD pricing
        const stablecoinPairs = pairs.filter(pair => 
          stablecoinAddresses.includes(pair.counterpartToken.address.toLowerCase())
        )

        if (stablecoinPairs.length > 0) {
          for (let i = 0; i < stablecoinPairs.length; i++) {
            const pair = stablecoinPairs[i]
            const snapshots = allSnapshots[pairs.indexOf(pair)]
            if (!snapshots?.length) {
              continue;
            }

            const tokenDecimals = token.decimals || 18
            const counterpartDecimals = pair.counterpartToken.decimals || 18

            snapshots.forEach((snapshot: any) => {
              try {
                let price: number;
                
                // If our token is token0, use price0 (price of token0 in terms of token1)
                // If our token is token1, use price1 (price of token1 in terms of token0)
                if (pair.isToken0) {
                  // We're token0, so price0 is the price of our token in terms of the stablecoin
                  const rawPrice = snapshot.price0;
                  // The value is already in USD since the counterpart is a stablecoin
                  price = parseFloat(rawPrice);
                } else {
                  // We're token1, so price1 is the price of our token in terms of the stablecoin
                  const rawPrice = snapshot.price1;
                  // The value is already in USD since the counterpart is a stablecoin
                  price = parseFloat(rawPrice);
                }
                
                if (price <= 0 || isNaN(price)) {
                  return; // Early return instead of continue
                }

                // Store the price in our series
                if (!priceSeries.has(snapshot.timestamp) || price > priceSeries.get(snapshot.timestamp)!) {
                  priceSeries.set(snapshot.timestamp, price);
                }
              } catch (error) {
                console.error('Error processing stablecoin snapshot:', error);
              }
            });
          }
        }

        // If we don't have stablecoin data, try other pairs
        if (priceSeries.size === 0) {
          console.log('No stablecoin data found, trying non-stablecoin pairs');
          const nonStablecoinPairs = pairs.filter(pair => 
            !stablecoinAddresses.includes(pair.counterpartToken.address.toLowerCase())
          )

          for (let i = 0; i < nonStablecoinPairs.length; i++) {
            const pair = nonStablecoinPairs[i]
            const snapshots = allSnapshots[pairs.indexOf(pair)]
            if (!snapshots?.length) {
              continue;
            }

            // Get counterpart token price
            const priceData = await TokenPriceService.getTokenPricesUSDBulk([pair.counterpartToken.id])
            const counterpartPriceUSD = parseFloat(priceData[pair.counterpartToken.id] || '0')

            if (counterpartPriceUSD <= 0) {
              continue;
            }

            const tokenDecimals = token.decimals || 18
            const counterpartDecimals = pair.counterpartToken.decimals || 18

            snapshots.forEach((snapshot: any) => {
              try {
                let exchangeRate: number;
                let usdPrice: number;
                
                if (pair.isToken0) {
                  // We are token0, so we need price0 (how much of token1 you get for 1 token0)
                  exchangeRate = parseFloat(snapshot.price0);
                  
                  // Price0 represents how many of token1 you get for 1 token0
                  // To get the USD value, multiply by token1's USD price
                  usdPrice = exchangeRate * counterpartPriceUSD;
                } else {
                  // We are token1, so we need price1 (how much of token0 you get for 1 token1)
                  exchangeRate = parseFloat(snapshot.price1);
                  
                  // Price1 represents how many of token0 you get for 1 token1
                  // To get the USD value, multiply by token0's USD price
                  usdPrice = exchangeRate * counterpartPriceUSD;
                }
                
                if (usdPrice <= 0 || isNaN(usdPrice)) {
                  return; // Early return instead of continue
                }

                // Store the USD price
                if (!priceSeries.has(snapshot.timestamp) || usdPrice > priceSeries.get(snapshot.timestamp)!) {
                  priceSeries.set(snapshot.timestamp, usdPrice);
                }
              } catch (error) {
                console.error('Error processing non-stablecoin snapshot:', error);
              }
            });
          }
        }

        // Convert to array and sort
        const result = Array.from(priceSeries.entries())
          .map(([time, value]) => ({ time, value }))
          .sort((a, b) => a.time - b.time)
          
        // Check if we need to normalize the values
        const values = result.map(point => point.value)
        const needsNormalization = TokenPriceService.detectNeedsDecimalNormalization(values, token.decimals ? token.decimals : undefined)
        
        if (needsNormalization) {
          console.log('Values need normalization, applying...')
          // Use the normalizePrice utility for each value
          return result.map(point => ({
            time: point.time,
            value: TokenPriceService.normalizePrice(point.value, token.decimals ? token.decimals : undefined)
          }))
        }
        
        return result
      } catch (error) {
        console.error('Error fetching token price chart data:', error)
        return []
      }
    },

    // Inside the Query object in your resolvers
    recentTransactions: async (
      _parent: Empty,
      { first = 20, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Check Redis cache first
        const cacheKey = `recentTransactions:${first}:${after || ''}`;
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
        
        // If a cursor is provided, decode it (it's base64-encoded)
        let decodedCursor = null;
        if (after) {
          try {
            decodedCursor = Buffer.from(after, 'base64').toString('utf-8');
          } catch (error) {
            console.error('Failed to decode cursor:', error);
            // Continue without a cursor if decoding fails
          }
        }
        
        // Use a raw query to bypass Prisma's schema validation
        const rawQuery: any = {
          find: "Swap", 
          sort: { timestamp: -1 },
          limit: first + 1
        };
        
        // Add cursor to query if available
        if (decodedCursor) {
          rawQuery.filter = { _id: { $lt: { $oid: decodedCursor } } };
        }
        
        const result = await prisma.$runCommandRaw(rawQuery);
        
        // Extract swaps and handle null values
        const swaps = ((result as any)?.cursor?.firstBatch || []) as any[];
        
        // Determine if there are more results
        const hasNextPage = swaps.length > first;
        const limitedSwaps = swaps.slice(0, first);
        
        // Collect all unique token pairs and token IDs for batched lookups
        const tokenPairIds = new Set<string>();
        limitedSwaps.forEach(swap => {
          if (swap.pairId && swap.pairId.$oid) {
            tokenPairIds.add(swap.pairId.$oid);
          }
        });
        
        // Fetch all pairs data in a single batch query with detailed token information
        const pairs = tokenPairIds.size > 0 ? await prisma.pair.findMany({
          where: { id: { in: Array.from(tokenPairIds) } },
          select: {
            id: true,
            token0: {
              select: { 
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
                stablePair: true
              }
            },
            token1: {
              select: { 
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
                stablePair: true
              }
            }
          }
        }) : [];
        
        // Create a map for fast pair lookup
        const pairMap = pairs.reduce((map: Record<string, any>, pair: any) => {
          if (pair) map[pair.id] = pair;
          return map;
        }, {} as Record<string, any>);
        
        // Collect token IDs for price lookup
        const tokenIds = new Set<string>();
        pairs.forEach((pair: any) => {
          if (pair?.token0?.id) tokenIds.add(pair.token0.id);
          if (pair?.token1?.id) tokenIds.add(pair.token1.id);
        });
        
        // Fetch all token prices in a single batch
        const pricesMap = tokenIds.size > 0 ? 
          await TokenPriceService.getTokenPricesUSDBulk(Array.from(tokenIds)) : 
          {};
        
        // Map the raw swaps to the GraphQL schema format
        const edges = limitedSwaps.map(swap => {
          const pairId = swap.pairId?.$oid;
          const pair = pairMap[pairId];
          
          // Ensure non-nullable fields are never null
          const txHash = swap.txHash || '';
          const userAddress = swap.userAddress || '';
          const amountIn0 = swap.amountIn0 || '0';
          const amountIn1 = swap.amountIn1 || '0';
          const amountOut0 = swap.amountOut0 || '0';
          const amountOut1 = swap.amountOut1 || '0';
          const blockNumber = swap.blockNumber || 0;
          const timestamp = swap.timestamp || 0;
          
          // Calculate USD value if possible
          let valueUSD = '0';
          try {
            if (pair) {
              const token0Price = pricesMap[pair.token0.id] || '0';
              const token1Price = pricesMap[pair.token1.id] || '0';
              
              if (parseFloat(token0Price) > 0) {
                // Calculate based on token0
                const token0Decimals = pair.token0?.decimals || 18;
                const amount0 = parseFloat(formatUnits(BigInt(amountIn0), token0Decimals));
                valueUSD = (amount0 * parseFloat(token0Price)).toFixed(2);
              } else if (parseFloat(token1Price) > 0) {
                // Calculate based on token1
                const token1Decimals = pair.token1?.decimals || 18;
                const amount1 = parseFloat(formatUnits(BigInt(amountIn1), token1Decimals));
                valueUSD = (amount1 * parseFloat(token1Price)).toFixed(2);
              }
            }
          } catch (error) {
            // Silently continue with default value
            valueUSD = '0';
          }
          
          // Create cursor from the MongoDB ID
          const cursor = Buffer.from(swap._id.$oid).toString('base64');
          
          return {
            cursor,
            node: {
              id: swap._id.$oid,
              pairId: pairId || '',
              pair: pairId ? { id: pairId } : null,
              txHash,
              userAddress,
              amountIn0,
              amountIn1,
              amountOut0,
              amountOut1,
              blockNumber,
              timestamp,
              token0: pair?.token0 || null,
              token1: pair?.token1 || null,
              valueUSD
            }
          };
        });
        
        // Get the last cursor for pagination
        const endCursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;
        
        // Get total count - don't await this with every request to save time
        // Use cached count when possible, only update periodically
        let totalCount: number;
        try {
          const cachedCount = await redis.get('recentTransactions:count');
          if (cachedCount) {
            totalCount = parseInt(cachedCount, 10);
          } else {
            totalCount = await prisma.swap.count();
            // Cache the count for 5 minutes
            await redis.set('recentTransactions:count', totalCount.toString(), 'EX', 300);
          }
        } catch (error) {
          // If Redis fails, get the count directly
          totalCount = await prisma.swap.count();
        }
        
        const response = {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: false,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor
          },
          totalCount
        };
        
        // Cache the result
        try {
          await redis.set(cacheKey, JSON.stringify(response), 'EX', 15); // 15 seconds cache
        } catch (error) {
          console.error('Redis cache set error:', error);
        }
        
        return response;
      } catch (error) {
        console.error('Error in recentTransactions resolver:', error);
        
        // Return empty result in case of error
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
    },

    // User resolvers
    user: async (_parent: Empty, { id }: { id: string }, { prisma }: Context) => {
      const user = await prisma.userStat.findUnique({
        where: { userAddress: id },
      })
      return user
        ? {
            id: user.id,
            address: user.userAddress,
            totalSwapCount: user.totalSwapCount,
            totalLpCount: user.totalLpCount,
            swapVolumeUSD: user.swapVolumeUSD,
            liquidityProvidedUSD: user.liquidityProvidedUSD,
          }
        : null
    },
    userPositions: async (
      _parent: Empty,
      { userAddress }: { userAddress: string },
      { prisma }: Context
    ) => {
      // Get liquidity positions - only include positions with non-zero tokens
      const liquidityPositions = await prisma.liquidityPosition.findMany({
        where: {
          userAddress,
          // liquidityTokens: { not: '0' },
        },
        include: {
          pair: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      })

      // Get farming positions
      const farmingPositions = await prisma.farmingPosition.findMany({
        where: { userAddress: userAddress },
        include: {
          pool: true,
        },
      })

      // Get staking position
      const stakingPosition = await prisma.stakingPosition.findUnique({
        where: { userAddress: userAddress },
      })

      return {
        liquidityPositions,
        farmingPositions,
        stakingPosition,
      }
    },

    // Protocol metrics
    protocolMetrics: async (_parent: Empty, {}: {}, { prisma }: Context) => {
      // Get the latest protocol metrics
      const metrics = await prisma.protocolMetric.findFirst({
        orderBy: { timestamp: 'desc' },
      })

      return (
        metrics || {
          id: '0',
          timestamp: Math.floor(Date.now() / 1000),
          totalValueLockedUSD: '0',
          liquidityPoolsTVL: '0',
          stakingTVL: '0',
          farmingTVL: '0',
          dailyVolumeUSD: '0',
          weeklyVolumeUSD: '0',
          monthlyVolumeUSD: '0',
          totalVolumeUSD: '0',
          dailyFeesUSD: '0',
          weeklyFeesUSD: '0',
          monthlyFeesUSD: '0',
          totalFeesUSD: '0',
          totalUsers: 0,
          dailyActiveUsers: 0,
          weeklyActiveUsers: 0,
          monthlyActiveUsers: 0,
        }
      )
    },

    // Farm pool resolvers
    farmingPools: async (
      _parent: Empty,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Check Redis cache first
        const cacheKey = `farmingPools:${first}:${after || ''}`;
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
        
        // Set up query params
        const queryParams: any = {
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { pid: 'asc' },
          // Only select fields we need
          select: {
            id: true,
            pid: true,
            name: true,
            pairAddress: true,
            token0Address: true,
            token1Address: true,
            allocPoint: true,
            lastRewardBlock: true,
            accRewardPerShare: true,
            rewardsPerBlock: true,
            totalStaked: true,
            createdAt: true,
            updatedAt: true
          }
        };

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after);
          queryParams.cursor = { id: cursorId };
          queryParams.skip = 1; // Skip the cursor itself
        }

        // Fetch farming pools with pagination
        const pools = await prisma.farmingPool.findMany(queryParams);

        // Determine if there are more results
        const hasNextPage = pools.length > first;
        const limitedPools = hasNextPage ? pools.slice(0, first) : pools;
        
        // Create edges
        const edges = limitedPools.map((pool: any) => ({
          node: pool,
          cursor: pool.id
        }));

        // Get cached count when possible
        let totalCount: number;
        try {
          const cachedCount = await redis.get('farmingPools:count');
          if (cachedCount) {
            totalCount = parseInt(cachedCount, 10);
          } else {
            totalCount = await prisma.farmingPool.count();
            // Cache the count for 5 minutes
            await redis.set('farmingPools:count', totalCount.toString(), 'EX', 300);
          }
        } catch (error) {
          // If Redis fails, get the count directly
          totalCount = await prisma.farmingPool.count();
        }
        
        // Create the response
        const response = {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: !!after,
            startCursor: edges[0]?.cursor || null,
            endCursor: edges[edges.length - 1]?.cursor || null
          },
          totalCount
        };
        
        // Cache the result
        try {
          await redis.set(cacheKey, JSON.stringify(response), 'EX', 60); // 60 seconds cache
        } catch (error) {
          console.error('Redis cache set error:', error);
        }
        
        return response;
      } catch (error) {
        console.error('Error fetching farming pools:', error);
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        };
      }
    },
    farmingPool: async (_parent: Empty, { pid }: { pid: number }, { prisma }: Context) => {
      return prisma.farmingPool.findUnique({
        where: { pid },
      })
    },

    // Staking metrics
    stakingMetrics: async (_parent: Empty, {}: {}, { prisma }: Context) => {
      // Get the latest staking metrics
      const metrics = await prisma.stakingMetric.findFirst({
        orderBy: { timestamp: 'desc' },
      })

      return (
        metrics || {
          id: '0',
          timestamp: Math.floor(Date.now() / 1000),
          totalPonderStaked: '0',
          totalXPonderBalance: '0',
          totalRewardsClaimed: '0',
          totalStakers: 0,
          totalRebases: 0,
          currentAPR: null,
        }
      )
    },

    // Launch resolvers
    activeLaunches: async (
      _parent: Empty,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { status: 'ACTIVE' },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { createdAt: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          try {
            const cursorId = decodeCursor(after)
            queryParams.cursor = { id: cursorId }
            queryParams.skip = 1 // Skip the cursor itself
          } catch (error) {
            console.error('Invalid cursor:', error)
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
        }

        // Fetch active launches with pagination
        const launches = await prisma.launch.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.launch.count({
          where: { status: 'ACTIVE' },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          launches,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching active launches:', error)
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
    completedLaunches: async (
      _parent: Empty,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { status: 'COMPLETED' },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { completedAt: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch completed launches with pagination
        const launches = await prisma.launch.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.launch.count({
          where: { status: 'COMPLETED' },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          launches,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching completed launches:', error)
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
    launch: async (_parent: Empty, { launchId }: { launchId: number }, { prisma }: Context) => {
      return prisma.launch.findUnique({
        where: { launchId },
      })
    },

    myLaunches: async (_parent: Empty, _args: Empty, context: Context) => {
      const userAddress = context.req?.headers.get('x-user-address');
      if (!userAddress || !context.prisma) return [];
      return await context.prisma.launch.findMany({
        where: {
          creatorAddress: userAddress.toLowerCase(),
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    },

    launchProgress: async (_parent: Empty, { launchId }: { launchId: number }, { prisma }: Context) => {
      const launch = await prisma.launch.findUnique({
        where: { launchId },
      })
      if (!launch) return 0

      const totalRaised = BigInt(launch.kubRaised) + BigInt(launch.ponderRaised)
      const targetRaise = BigInt(5555) * BigInt(10) ** BigInt(18) // 5,555 KUB
      const progress = Number((totalRaised * BigInt(100)) / targetRaise)
      return Math.min(progress, 100)
    },

    launchTimeRemaining: async (_parent: Empty, { launchId }: { launchId: number }, { prisma }: Context) => {
      const launch = await prisma.launch.findUnique({
        where: { launchId }
      });
      
      if (!launch) return null;
      
      // If launch is completed or cancelled, no time remaining
      if (launch.status === 'COMPLETED' || launch.status === 'CANCELLED') {
        return 0;
      }
      
      // For active launches, calculate time based on creation + 7 days
      const creationTime = Math.floor(launch.createdAt.getTime() / 1000);
      const deadline = creationTime + (7 * 24 * 60 * 60); // 7 days in seconds
      const now = Math.floor(Date.now() / 1000);
      
      return Math.max(0, deadline - now);
    },
  },

  Contribution: {
    // Get contribution amounts
    kubAmount: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.kubAmount
    },

    ponderAmount: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.ponderAmount
    },

    ponderValue: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.ponderValue
    },

    tokensReceived: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.tokensReceived
    },

    // Get refund information
    refunded: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.refunded || false
    },

    refundedKubAmount: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.refundedKubAmount
    },

    refundedPonderAmount: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.refundedPonderAmount
    },

    refundedTokenAmount: async (parent: Contribution, _unused: Empty, { prisma }: Context) => {
      return parent.refundedTokenAmount
    },

    vestingAmount: async (parent: Contribution) => {
      if (!parent.vestingAmount) return null;
      return parent.vestingAmount;
    },

    vestingReleased: async (parent: Contribution) => {
      if (!parent.vestingReleased) return null;
      return parent.vestingReleased;
    },

    vestingRemaining: async (parent: Contribution) => {
      if (!parent.vestingRemaining) return null;
      return parent.vestingRemaining;
    },

    vestingLastClaim: async (parent: Contribution) => {
      if (!parent.vestingLastClaim) return null;
      return parent.vestingLastClaim;
    },

    vestingNextClaim: async (parent: Contribution) => {
      if (!parent.vestingNextClaim) return null;
      return parent.vestingNextClaim;
    },
  },

  User: {
    liquidityPositions: async (
      parent: UserStats,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: {
          where: {
            userAddress: string;
            liquidityTokens: { not: string };
          };
          take: number;
          include: {
            pair: {
              include: {
                token0: boolean;
                token1: boolean;
              };
            };
          };
          cursor?: { id: string };
          skip?: number;
        } = {
          where: {
            userAddress: parent.address,
            // Only return positions with non-zero liquidity tokens
            liquidityTokens: { not: '0' },
          },
          take: first + 1, // Take one extra to check if there's a next page
          include: {
            pair: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
        };

        // Add cursor if provided
        if (after) {
          queryParams.cursor = { id: decodeCursor(after) };
          queryParams.skip = 1; // Skip the cursor itself
        }

        // Fetch liquidity positions with pagination
        const positions = await prisma.liquidityPosition.findMany(queryParams);

        // Get total count - only count non-zero positions
        const totalCount = await prisma.liquidityPosition.count({
          where: {
            userAddress: parent.address,
            liquidityTokens: { not: '0' },
          },
        });

        // Create pagination response
        const paginationResult = createCursorPagination(
          positions,
          first,
          after ? decodeCursor(after) : undefined
        );

        return {
          ...paginationResult,
          totalCount,
        };
      } catch (error) {
        console.error('Error fetching user liquidity positions:', error)
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
          totalCount: 0,
        };
      }
    },
    swaps: async (
      parent: UserStats,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { userAddress: parent.address },
          take: first + 1, // Take one extra to check if there's a next page
          orderBy: { timestamp: 'desc' },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch swaps with pagination
        const swaps = await prisma.swap.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.swap.count({
          where: { sender: parent.address },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          swaps,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching user swaps:', error)
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
    farmingPositions: async (
      parent: UserStats,
      { first = 10, after }: { first?: number; after?: string },
      { prisma }: Context
    ) => {
      try {
        // Set up query params
        const queryParams: any = {
          where: { userAddress: parent.address },
          take: first + 1, // Take one extra to check if there's a next page
          include: { pool: true },
        }

        // Add cursor if provided
        if (after) {
          const cursorId = decodeCursor(after)
          queryParams.cursor = { id: cursorId }
          queryParams.skip = 1 // Skip the cursor itself
        }

        // Fetch farming positions with pagination
        const positions = await prisma.farmingPosition.findMany(queryParams)

        // Get total count
        const totalCount = await prisma.farmingPosition.count({
          where: { userAddress: parent.address },
        })

        // Create pagination response
        const paginationResult = createCursorPagination(
          positions,
          first,
          after ? decodeCursor(after) : undefined
        )

        return {
          ...paginationResult,
          totalCount,
        }
      } catch (error) {
        console.error('Error fetching user farming positions:', error)
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
    stakingPosition: async (parent: UserStats, _unused: Empty, { prisma }: Context) => {
      return prisma.stakingPosition.findUnique({
        where: { userAddress: parent.address },
      })
    },
  },

  Token: {
    id: async (parent: PrismaToken) => parent.id,
    address: async (parent: PrismaToken) => parent.address,
    name: async (parent: PrismaToken) => parent.name,
    symbol: async (parent: PrismaToken) => parent.symbol,
    decimals: async (parent: PrismaToken) => parent.decimals,
    imageURI: async (parent: PrismaToken) => parent.imageURI,
    priceUSD: async (parent: PrismaToken, _unused: Empty, { prisma }: Context) => {
      try {
        // Import viem utilities
        const { formatUnits } = await import('viem');

        // Helper function to detect and scale large blockchain-style numbers
        const formatBlockchainValue = (value: number | string, decimals: number = 18): string => {
          if (typeof value === 'string') {
            value = parseFloat(value);
          }
          
          // Skip empty or zero values
          if (!value || value === 0) return "0";
          
          // Detect if this is likely a raw blockchain value (very large number)
          const magnitude = Math.floor(Math.log10(Math.abs(value)));
          
          // If the number is very large, it's likely in wei or token base units
          if (magnitude >= 6) {
            try {
              // We need to round to an integer to use BigInt
              const bigValue = BigInt(Math.round(value));
              return formatUnits(bigValue, decimals);
            } catch (error) {
              // Fallback to regular division if BigInt conversion fails
              return (value / Math.pow(10, decimals)).toString();
            }
          }
          
          // For normal-sized numbers, return as is
          return value.toString();
        };
        
        // Check if we already have the price from the bulk fetch
        if (parent.priceUSD) {
          const price = parseFloat(parent.priceUSD);
          if (price > 0.000001) {
            // Format in case it's a blockchain value
            return formatBlockchainValue(price, parent.decimals || 18);
          }
        }
        
        // If we don't have a price yet, fetch it now
        const price = await TokenPriceService.getTokenPriceUSD(parent.id);
        if (price > 0.000001) {
          // Format in case it's a blockchain value
          return formatBlockchainValue(price, parent.decimals || 18);
        }
        
        // If we still don't have a valid price, return 0
        return "0";
      } catch (error) {
        console.error(`Error getting price for token ${parent.id}:`, error);
        return "0";
      }
    },
    priceChange24h: async (parent: PrismaToken) => parent.priceChange24h || 0,
    volumeUSD24h: async (parent: PrismaToken, _unused: Empty, { prisma, loaders }: Context) => {
      try {
        const now = Math.floor(Date.now() / 1000)
        const oneDayAgo = now - 24 * 60 * 60

        // Get all pairs for this token with minimal data load
        const pairs = await prisma.pair.findMany({
          where: {
            OR: [
              { token0Id: parent.id },
              { token1Id: parent.id }
            ]
          },
          select: {
            id: true,
            token0Id: true,
            token1Id: true,
            token0: {
              select: {
                decimals: true
              }
            },
            token1: {
              select: {
                decimals: true
              }
            }
          }
        })

        if (pairs.length === 0) return '0'

        // Fetch all swaps in parallel for better performance
        const swapsPromises = pairs.map((pair: any) => 
          prisma.swap.findMany({
            where: {
              pairId: pair.id,
              timestamp: { gte: oneDayAgo }
            },
            select: {
              amount0In: true,
              amount0Out: true,
              amount1In: true,
              amount1Out: true
            }
          })
        )

        const allSwaps = await Promise.all(swapsPromises)

        // Get token prices in bulk for better performance
        const tokenIds = new Set(pairs.flatMap((pair: any) => [pair.token0Id, pair.token1Id]))
        const pricesMap = await TokenPriceService.getTokenPricesUSDBulk(Array.from(tokenIds) as string[])

        let totalVolumeUSD = 0

        // Process each pair's swaps
        pairs.forEach((pair: any, index: number) => {
          const swaps = allSwaps[index]
          const isToken0 = pair.token0Id === parent.id
          const tokenDecimals = isToken0 ? pair.token0.decimals : pair.token1.decimals

          // Get prices for both tokens in the pair
          const token0Price = parseFloat(pricesMap[pair.token0Id] || '0')
          const token1Price = parseFloat(pricesMap[pair.token1Id] || '0')

          // Skip if we can't determine prices
          if ((isToken0 && token0Price <= 0) || (!isToken0 && token1Price <= 0)) return

          for (const swap of swaps) {
            try {
              // Calculate volume based on which token we're measuring
              if (isToken0) {
                const amountIn = formatUnits(BigInt(swap.amount0In || '0'), tokenDecimals || 18)
                const amountOut = formatUnits(BigInt(swap.amount0Out || '0'), tokenDecimals || 18)
                const volume = (parseFloat(amountIn) + parseFloat(amountOut)) * token0Price
                totalVolumeUSD += volume
              } else {
                const amountIn = formatUnits(BigInt(swap.amount1In || '0'), tokenDecimals || 18)
                const amountOut = formatUnits(BigInt(swap.amount1Out || '0'), tokenDecimals || 18)
                const volume = (parseFloat(amountIn) + parseFloat(amountOut)) * token1Price
                totalVolumeUSD += volume
              }
            } catch (error) {
              console.error('Error calculating swap volume:', error)
              // Continue processing other swaps
            }
          }
        })

        return totalVolumeUSD.toString()
      } catch (error) {
        console.error(`Error calculating volume for token ${parent.id}:`, error)
        return '0'
      }
    },
    lastPriceUpdate: async (parent: PrismaToken) => parent.lastPriceUpdate,
    createdAt: async (parent: PrismaToken) => parent.createdAt,
    updatedAt: async (parent: PrismaToken) => parent.updatedAt,
    tvl: async (parent: PrismaToken, _unused: Empty, ctx: Context): Promise<string> => {
      try {
        // Get all pairs where this token is either token0 or token1
        const pairs = await ctx.prisma.pair.findMany({
          where: {
            OR: [
              { token0Id: parent.id },
              { token1Id: parent.id }
            ]
          },
          include: {
            token0: true,
            token1: true
          }
        })

        // If no pairs found, return 0
        if (pairs.length === 0) {
          return '0';
        }

        let totalTVL = 0;

        for (const pair of pairs) {
          try {
            // Get token prices with appropriate decimal handling
            const token0Price = pair.token0.priceUSD ? parseFloat(pair.token0.priceUSD) : 0;
            const token1Price = pair.token1.priceUSD ? parseFloat(pair.token1.priceUSD) : 0;

            // Get decimals (defaults to 18 if not available)
            const token0Decimals = pair.token0.decimals ?? 18;
            const token1Decimals = pair.token1.decimals ?? 18;

            // Parse reserves exactly once with viem
            let reserve0 = 0, reserve1 = 0;
            
            // Safely handle blockchain values
            if (pair.reserve0 && pair.reserve0.length > 0) {
              try {
                // Properly convert blockchain values to numbers
                if (pair.reserve0.length > 10) {
                  // This is likely a raw blockchain value - parse it properly with decimals
                  reserve0 = Number(formatUnits(BigInt(pair.reserve0), token0Decimals));
                } else {
                  // This is already formatted, just parse as float
                  reserve0 = parseFloat(pair.reserve0);
                }
              } catch (error) {
                console.warn(`Error parsing reserve0 for pair ${pair.id}:`, error);
                reserve0 = Number(pair.reserve0) / Math.pow(10, token0Decimals);
              }
            }
            
            if (pair.reserve1 && pair.reserve1.length > 0) {
              try {
                // Properly convert blockchain values to numbers
                if (pair.reserve1.length > 10) {
                  // This is likely a raw blockchain value - parse it properly with decimals
                  reserve1 = Number(formatUnits(BigInt(pair.reserve1), token1Decimals));
                } else {
                  // This is already formatted, just parse as float
                  reserve1 = parseFloat(pair.reserve1);
                }
              } catch (error) {
                console.warn(`Error parsing reserve1 for pair ${pair.id}:`, error);
                reserve1 = Number(pair.reserve1) / Math.pow(10, token1Decimals);
              }
            }
            
            // Log the individual components for debugging
            console.log(`Pair ${pair.id}: reserve0=${reserve0}, price0=${token0Price}, reserve1=${reserve1}, price1=${token1Price}`);

            // Calculate token TVL based on which side the token is on
            let tokenTVL = 0;
            if (pair.token0Id === parent.id) {
              tokenTVL = reserve0 * token0Price;
            } else {
              tokenTVL = reserve1 * token1Price;
            }
            
            // Only add values that are reasonable
            if (tokenTVL > 0 && tokenTVL < 1e15) { // Reject unreasonably large values
              totalTVL += tokenTVL;
            } else if (tokenTVL >= 1e15) {
              console.warn(`Unreasonably large TVL for token in pair ${pair.id}: ${tokenTVL}. Skipping.`);
            }
          } catch (error) {
            console.error(`Error calculating TVL for pair ${pair.id}:`, error);
            // Continue with other pairs
          }
        }

        // Final sanity check
        if (totalTVL < 0 || totalTVL > 1e15) {
          console.error(`Invalid total TVL for token ${parent.id}: ${totalTVL}. Returning 0.`);
          return '0';
        }

        return totalTVL.toString();
      } catch (error) {
        console.error('Error calculating token TVL:', error);
        return '0';
      }
    },
    marketCap: async (parent: PrismaToken, _unused: Empty, ctx: Context): Promise<string> => {
      try {
        // Get the latest supply using MongoDB query
        const latestSupply = await ctx.prisma.tokenSupply.findFirst({
          where: {
            tokenId: parent.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        if (!latestSupply) {
          return '0'
        }

        const circulatingSupply = parseFloat(latestSupply.circulating)
        const priceUSD = parent.priceUSD ? parseFloat(parent.priceUSD) : 0

        return (circulatingSupply * priceUSD).toString()
      } catch (error) {
        console.error('Error calculating market cap:', error)
        return '0'
      }
    },
    fdv: async (parent: PrismaToken, _unused: Empty, ctx: Context): Promise<string> => {
      try {
        const maxSupply = await ctx.prisma.tokenSupply.findFirst({
          where: {
            tokenId: parent.id
          },
          orderBy: {
            createdAt: 'desc'
          }
        })

        if (!maxSupply) {
          return '0'
        }

        const totalSupply = parseFloat(maxSupply.total)
        const priceUSD = parent.priceUSD ? parseFloat(parent.priceUSD) : 0

        return (totalSupply * priceUSD).toString()
      } catch (error) {
        console.error('Error calculating FDV:', error)
        return '0'
      }
    }
  }
}
