import {
  getRedisClient, 
  CACHE_PREFIXES,
  safeRedisGet,
  safeRedisSet,
  safeRedisDelete
} from '@/src/lib/redis'

import { createCursorPagination, decodeCursor } from './utils'
import DataLoader from 'dataloader'
import { ObjectId } from 'mongodb'
import { PrismaClient, Prisma } from '@prisma/client'
import { GraphQLResolveInfo } from 'graphql'
import { MongoClient } from 'mongodb'
import { PriceChartService } from '@/src/lib/services/priceChartService'
import { formatCurrency } from '@/src/lib/utils/tokenPriceUtils'
import { TokenPriceService } from '@/src/lib/services/tokenPriceService'
import Redis from 'ioredis'
import { EventEmitter } from 'events'
import { createPublicClient, http, formatUnits } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'

// Add these lines after the import statements and before any other code
// Type declarations for missing types to fix TS errors
type PrismaToken = any;
type PrismaPair = any;
type PrismaLaunch = any;
type Context = any;
type Empty = any;

// Define the KKUB_ADDRESS constant if it's missing
const KKUB_ADDRESS = '0x6F1CdA3b4b13B0B1F3E89C5d09F7EeF36e7530f4';

// Define constants for USDT and Oracle addresses
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'
const ORACLE_ADDRESS = '0x1B5C4c1D5b0BbBcEc97fa477b3d5F2FEBA5b481f'

// Define enums that were previously imported from Prisma
const BuySellType = {
  BUY: 'BUY',
  SELL: 'SELL'
};

const MintBurnType = {
  MINT: 'MINT',
  BURN: 'BURN'
};

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
    
    let swaps = [];
    try {
      // Get 24h swap data for this token - direct query is most reliable for this data
      console.log(`[VOLUME] Using direct query to fetch swaps (specialized loaders not available)`);
      swaps = await prismaClient.swap.findMany({
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
    } catch (error) {
      console.error(`[VOLUME] Error fetching swaps:`, error);
      // Continue with empty swaps array
    }
    
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
  price0: string;  // Updated to String in Prisma schema
  price1: string;  // Updated to String in Prisma schema
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
].map((addr) => addr?.toLowerCase?.() || addr || '')

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
  price0: string | null;
  price1: string | null;
  blockNumber: number;
}

interface MongoResponse {
  cursor: {
    firstBatch: MongoSnapshot[]
  }
}

// Add MongoDB connection setup
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/ponder";
if (!mongoUri) {
  console.error('MongoDB URI is not defined. Please check your environment variables.');
}
const mongoClient = new MongoClient(mongoUri);
let db: any;

// Initialize MongoDB connection
async function initMongoDB() {
  if (!db) {
    try {
      await mongoClient.connect();
      db = mongoClient.db();
      console.log('Connected to MongoDB for direct queries');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      // Don't throw here, just return null and let the caller handle it
    }
  }
  return db;
}

// Create a service to dynamically find token pairs
const TokenPairService = {
  async findTokenPairs(tokenId: string, prismaClient: PrismaClient): Promise<PairWithTokenInfo[]> {
    // Find all pairs where this token appears as either token0 or token1
    const [pairsAsToken0, pairsAsToken1] = await Promise.all([
      prismaClient.pair.findMany({
        where: { token0Id: tokenId },
        select: {
          id: true,
          token1: {
            select: {
              id: true,
              address: true,
              decimals: true,
              symbol: true
            }
          }
        }
      }),
      prismaClient.pair.findMany({
        where: { token1Id: tokenId },
        select: {
          id: true,
          token0: {
            select: {
              id: true,
              address: true,
              decimals: true,
              symbol: true
            }
          }
        }
      })
    ]);
    
    // Format pairs as token0
    const token0Pairs: PairWithTokenInfo[] = pairsAsToken0.map(pair => ({
      id: pair.id,
      isToken0: true,
      counterpartToken: pair.token1
    }));
    
    // Format pairs as token1
    const token1Pairs: PairWithTokenInfo[] = pairsAsToken1.map(pair => ({
      id: pair.id,
      isToken0: false,
      counterpartToken: pair.token0
    }));
    
    // Combine and return all pairs
    return [...token0Pairs, ...token1Pairs];
  },
  
  // Find the best pair to use for price data
  async findBestPriceDataPair(
    tokenId: string, 
    tokenAddress: string,
    prismaClient: PrismaClient
  ): Promise<{pairId: string, isToken0: boolean} | null> {
    try {
      // Get all pairs for this token
      const allPairs = await this.findTokenPairs(tokenId, prismaClient);
      
      if (allPairs.length === 0) {
        console.log(`No pairs found for token ID ${tokenId} (${tokenAddress})`);
        return null;
      }
      
      console.log(`Found ${allPairs.length} pairs for token ID ${tokenId} (${tokenAddress})`);
      
      // Look for pairs with stablecoins first - they're best for price data
      const stablecoinAddresses = TokenPriceService.getStablecoinAddresses();
      const stablePairs = allPairs.filter((pair: PairWithTokenInfo) => 
        stablecoinAddresses.includes(pair.counterpartToken.address.toLowerCase())
      );
      
      if (stablePairs.length > 0) {
        // Prefer pairs with stablecoins
        console.log(`Found ${stablePairs.length} stablecoin pairs for token ${tokenAddress}`);
        return {
          pairId: stablePairs[0].id,
          isToken0: stablePairs[0].isToken0
        };
      }
      
      // Next preference is for major tokens (like KKUB)
      const majorTokens = [
        KKUB_ADDRESS[CURRENT_CHAIN.id].toLowerCase()
      ];
      
      const majorTokenPairs = allPairs.filter((pair: PairWithTokenInfo) => 
        majorTokens.includes(pair.counterpartToken.address.toLowerCase())
      );
      
      if (majorTokenPairs.length > 0) {
        console.log(`Found ${majorTokenPairs.length} major token pairs for token ${tokenAddress}`);
        return {
          pairId: majorTokenPairs[0].id,
          isToken0: majorTokenPairs[0].isToken0
        };
      }
      
      // Last resort: use the newest pair (assuming it's most active)
      console.log(`Using default pair for token ${tokenAddress}`);
      return {
        pairId: allPairs[0].id,
        isToken0: allPairs[0].isToken0
      };
    } catch (error) {
      console.error(`Error finding best price data pair for token ${tokenAddress}:`, error);
      return null;
    }
  }
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


// Helper function to get protocol metrics from Redis
async function getProtocolMetricsFromRedis(): Promise<any | null> {
  try {
    const redis = getRedisClient();
    if (!redis) return null;
    
    const [
      tvl,
      volume24h,
      volume7d,
      volume1h,
      volume24hChange,
      volume1hChange,
      timestamp
    ] = await redis.mget([
      `${CACHE_PREFIXES.PROTOCOL}tvl`,
      `${CACHE_PREFIXES.PROTOCOL}volume24h`,
      `${CACHE_PREFIXES.PROTOCOL}volume7d`,
      `${CACHE_PREFIXES.PROTOCOL}volume1h`,
      `${CACHE_PREFIXES.PROTOCOL}volume24hChange`,
      `${CACHE_PREFIXES.PROTOCOL}volume1hChange`,
      `${CACHE_PREFIXES.PROTOCOL}timestamp`
    ]);
    
    if (!tvl && !volume24h) {
      return null;
    }
    
    return {
      id: 'redis-metrics',
      timestamp: timestamp ? parseInt(timestamp, 10) : Math.floor(Date.now() / 1000),
      totalValueLockedUSD: tvl || '0',
      dailyVolumeUSD: volume24h || '0',
      weeklyVolumeUSD: volume7d || '0',
      monthlyVolumeUSD: '0',
      volume1h: volume1h || '0',
      volume1hChange: volume1hChange ? parseFloat(volume1hChange) : 0,
      volume24hChange: volume24hChange ? parseFloat(volume24hChange) : 0
    };
  } catch (error) {
    console.error('Error reading protocol metrics from Redis:', error);
    return null;
  }
}

// Helper function to get cached pair reserve USD values in bulk
async function getCachedPairReserveUSDBulk(pairIds: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  
  if (pairIds.length === 0) return result;
  
  try {
    const redis = getRedisClient();
    if (!redis) return result;
    
    const cacheKeys = pairIds.map(id => `pair:${id}:reserveUSD`);
    const values = await redis.mget(cacheKeys);
    
    pairIds.forEach((id, index) => {
      const value = values[index];
      if (value) result[id] = value;
    });
  } catch (error) {
    console.error('Error fetching cached reserveUSD values:', error);
  }
  
  return result;
}

// Helper to safely handle toLowerCase operations on potentially undefined values
function safeToLowerCase(value: string | null | undefined): string {
  if (!value) return '';
  return value.toLowerCase();
}
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
    },
    
    // Update price change resolvers to use EntityMetrics data first
    priceChange1h: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        // Check if we already have the value from parent
        if (parent.priceChange1h !== undefined && parent.priceChange1h !== null) {
          return parent.priceChange1h;
        }
        
        // Try to get from EntityMetrics
        // Need to use type assertion since prisma might not have EntityMetrics in type definition
        const prismaWithMetrics = prisma as PrismaClient & {
          entityMetrics: {
            findUnique: (args: any) => Promise<any>;
          };
        };
        
        const metrics = await prismaWithMetrics.entityMetrics.findUnique({
          where: {
            entity_entityId: {
              entity: 'token',
              entityId: parent.id
            }
          },
          select: {
            priceChange1h: true
          }
        });
        
        if (metrics && metrics.priceChange1h !== null && metrics.priceChange1h !== undefined) {
          return metrics.priceChange1h;
        }
        
        // If not found in either, return zero as default
        return 0;
      } catch (error) {
        console.error(`Error getting priceChange1h for ${parent.symbol || parent.id}:`, error);
        return 0;
      }
    },
    
    priceChange24h: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        // Check if we already have the value from parent
        if (parent.priceChange24h !== undefined && parent.priceChange24h !== null) {
          return parent.priceChange24h;
        }
        
        // Try to get from EntityMetrics
        const prismaWithMetrics = prisma as PrismaClient & {
          entityMetrics: {
            findUnique: (args: any) => Promise<any>;
          };
        };
        
        const metrics = await prismaWithMetrics.entityMetrics.findUnique({
          where: {
            entity_entityId: {
              entity: 'token',
              entityId: parent.id
            }
          },
          select: {
            priceChange24h: true
          }
        });
        
        if (metrics && metrics.priceChange24h !== null && metrics.priceChange24h !== undefined) {
          return metrics.priceChange24h;
        }
        
        // If not found in either, return zero as default
        return 0;
      } catch (error) {
        console.error(`Error getting priceChange24h for ${parent.symbol || parent.id}:`, error);
        return 0;
      }
    },
    
    priceChange7d: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        // Check if we already have the value from parent
        if (parent.priceChange7d !== undefined && parent.priceChange7d !== null) {
          return parent.priceChange7d;
        }
        
        // Try to get from EntityMetrics
        const prismaWithMetrics = prisma as PrismaClient & {
          entityMetrics: {
            findUnique: (args: any) => Promise<any>;
          };
        };
        
        const metrics = await prismaWithMetrics.entityMetrics.findUnique({
          where: {
            entity_entityId: {
              entity: 'token',
              entityId: parent.id
            }
          },
          select: {
            priceChange7d: true
          }
        });
        
        if (metrics && metrics.priceChange7d !== null && metrics.priceChange7d !== undefined) {
          return metrics.priceChange7d;
        }
        
        // If not found in either, return zero as default
        return 0;
      } catch (error) {
        console.error(`Error getting priceChange7d for ${parent.symbol || parent.id}:`, error);
        return 0;
      }
    },
    
    // New volume-related resolvers
    volume1h: async (parent: any, _args: any, { prisma }: Context) => {
      return parent.volume1h || '0'
    },
    
    volume7d: async (parent: any, _args: any, { prisma }: Context) => {
      console.log(`volume7d for pair ${parent.address}: ${parent.volume7d}`);
      
      try {
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.volume7d) {
              console.log(`Using Redis volume7d for pair ${parent.address}: ${metrics.volume7d}`);
              return metrics.volume7d;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching volume7d for ${parent.address}:`, redisError);
        }
        
        // If Redis fails, directly query MongoDB instead of relying on parent object
        try {
          console.log(`Querying MongoDB directly for pair ${parent.address}`);
          const pairData = await prisma.pair.findUnique({
            where: { address: parent.address.toLowerCase() },
            select: { volume7d: true }
          });
          
          if (pairData && pairData.volume7d !== null) {
            console.log(`Found volume7d in MongoDB for pair ${parent.address}: ${pairData.volume7d}`);
            return pairData.volume7d;
          }
        } catch (dbError) {
          console.error(`MongoDB error fetching volume7d for ${parent.address}:`, dbError);
        }
        
        // Last resort: fallback to parent data if everything else fails
        console.log(`Falling back to parent volume7d for pair ${parent.address}: ${parent.volume7d}`);
        return parent.volume7d || "0";
      } catch (error) {
        console.error(`Error resolving volume7d for ${parent.address}:`, error);
        return "0";
      }
    },
    
    volume30d: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        console.log(`Resolving volume30d for pair ${parent.address}`);
        
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.volume30d != null) {
              console.log(`Using Redis volume30d for pair ${parent.address}: ${metrics.volume30d}`);
              return metrics.volume30d;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching volume30d for ${parent.address}:`, redisError);
        }
        
        // If Redis fails, directly query MongoDB instead of relying on parent object
        try {
          console.log(`Querying MongoDB directly for pair ${parent.address}`);
          const pairData = await prisma.pair.findUnique({
            where: { address: parent.address.toLowerCase() },
            select: { volume30d: true }
          });
          
          if (pairData && pairData.volume30d !== null) {
            console.log(`Found volume30d in MongoDB for pair ${parent.address}: ${pairData.volume30d}`);
            return pairData.volume30d;
          }
        } catch (dbError) {
          console.error(`MongoDB error fetching volume30d for ${parent.address}:`, dbError);
        }
        
        // Last resort: fallback to parent data if everything else fails
        console.log(`Falling back to parent volume30d for pair ${parent.address}: ${parent.volume30d}`);
        return parent.volume30d || "0";
      } catch (error) {
        console.error(`Error resolving volume30d for ${parent.address}:`, error);
        return "0";
      }
    },
    
    volumeChange24h: async (parent: any, _args: any, { prisma }: Context) => {
      return parent.volumeChange24h || 0
    },
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
    },
    
    // Add the swaps resolver
    swaps: async (
      parent: any,
      {
        first = 10,
        after,
      }: {
        first?: number
        after?: string
      },
      { prisma }: Context
    ) => {
      console.log(`[SWAPS] Fetching swaps for pair: ${parent.id}, first: ${first}`);
      
      try {
        // Handle cursor-based pagination
        let paginationFilter = {};
        if (after) {
          const cursorId = Buffer.from(after, 'base64').toString('ascii');
          paginationFilter = {
            cursor: { id: cursorId },
            skip: 1, // Skip the cursor itself
          };
        }
        
        // Query swaps
        const swaps = await prisma.swap.findMany({
          where: { pairId: parent.id },
          orderBy: { timestamp: 'desc' }, // Most recent first
          take: first + 1, // +1 to check if there's more
          ...paginationFilter,
        });
        
        // Determine if there are more results
        const hasNextPage = swaps.length > first;
        const edges = swaps.slice(0, first).map(swap => ({
          node: swap,
          cursor: Buffer.from(swap.id).toString('base64'),
        }));
        
        // Count total swaps (without pagination)
        const totalCount = await prisma.swap.count({ where: { pairId: parent.id } });
        
        console.log(`[SWAPS] Found ${edges.length} swaps for pair ${parent.id}, total: ${totalCount}`);
        
        return {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: !!after,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
          },
          totalCount,
        };
      } catch (error) {
        console.error(`[SWAPS] Error fetching swaps for pair ${parent.id}:`, error);
        // Return empty results
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
    
    // Add the reserveUSD resolver 
    reserveUSD: async (parent: any, _args: any, { prisma, loaders }: Context) => {
      try {
        // If there's already a value, use it
        if (parent._reserveUSD) {
          return parent._reserveUSD;
        }
        
        // Try to get from cache loader if available
        if (loaders && loaders.reserveUSDLoader) {
          const reserveUSD = await loaders.reserveUSDLoader.load(parent.id);
          return reserveUSD || '0';
        }
        
        // Calculate if not available
        // Get token prices
        const token0Price = parent.token0?.priceUSD ? parseFloat(parent.token0.priceUSD) : 0;
        const token1Price = parent.token1?.priceUSD ? parseFloat(parent.token1.priceUSD) : 0;
        
        if (token0Price === 0 && token1Price === 0) {
          return '0';
        }
        
        // Calculate based on available price
        const token0Decimals = parent.token0?.decimals || 18;
        const token1Decimals = parent.token1?.decimals || 18;
        
        const reserve0Value = token0Price > 0 
          ? Number(formatUnits(BigInt(parent.reserve0), token0Decimals)) * token0Price
          : 0;
          
        const reserve1Value = token1Price > 0
          ? Number(formatUnits(BigInt(parent.reserve1), token1Decimals)) * token1Price
          : 0;
        
        const reserveUSD = reserve0Value + reserve1Value;
        return reserveUSD.toString();
      } catch (error) {
        console.error(`Error calculating reserveUSD for pair ${parent.id}:`, error);
        return '0';
      }
    },
    
    // New volume-related resolvers
    poolAPR: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        console.log(`Resolving poolAPR for pair ${parent.address}`);
        
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.poolAPR != null && !isNaN(metrics.poolAPR)) {
              console.log(`Using Redis poolAPR for pair ${parent.address}: ${metrics.poolAPR}`);
              return metrics.poolAPR;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching poolAPR for ${parent.address}:`, redisError);
        }
        
        // If Redis fails, directly query MongoDB instead of relying on parent object
        try {
          console.log(`Querying MongoDB directly for pair ${parent.address}`);
          const pairData = await prisma.pair.findUnique({
            where: { address: parent.address.toLowerCase() },
            select: { poolAPR: true }
          });
          
          if (pairData && pairData.poolAPR !== null && pairData.poolAPR !== undefined) {
            console.log(`Found poolAPR in MongoDB for pair ${parent.address}: ${pairData.poolAPR}`);
            return pairData.poolAPR;
          }
        } catch (dbError) {
          console.error(`MongoDB error fetching poolAPR for ${parent.address}:`, dbError);
        }
        
        // Last resort: fallback to parent data if everything else fails
        console.log(`Falling back to parent poolAPR for pair ${parent.address}: ${parent.poolAPR}`);
        return parent.poolAPR || 0;
      } catch (error) {
        console.error(`Error resolving poolAPR for ${parent.address}:`, error);
        return 0;
      }
    },
    
    rewardAPR: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        console.log(`Resolving rewardAPR for pair ${parent.address}`);
        
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.rewardAPR != null && !isNaN(metrics.rewardAPR)) {
              console.log(`Using Redis rewardAPR for pair ${parent.address}: ${metrics.rewardAPR}`);
              return metrics.rewardAPR;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching rewardAPR for ${parent.address}:`, redisError);
        }
        
        // Find if this pair has a farming pool in the MasterChef contract
        const farmingPool = await prisma.farmingPool.findFirst({
          where: {
            lpTokenAddress: parent.address.toLowerCase()
          }
        });
        
        if (!farmingPool) {
          console.log(`No farming pool found for pair ${parent.address}`);
          return 0;
        }
        
        // For an active pool, we would calculate the reward APR here
        // For now, return 0 as farming is not active
        console.log(`Farming pool found but returning 0 APR as farming is not active`);
        return 0;
      } catch (error) {
        console.error(`Error resolving rewardAPR for ${parent.address}:`, error);
        return 0;
      }
    },
    
    volume1h: async (parent: any, _args: any, { prisma }: Context) => {
      return parent.volume1h || '0'
    },
    
    volume24h: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        console.log(`Resolving volume24h for pair ${parent.address}`);
        
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.volume24h != null) {
              console.log(`Using Redis volume24h for pair ${parent.address}: ${metrics.volume24h}`);
              return metrics.volume24h;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching volume24h for ${parent.address}:`, redisError);
        }
        
        // If Redis fails, directly query MongoDB instead of relying on parent object
        try {
          console.log(`Querying MongoDB directly for pair ${parent.address}`);
          const pairData = await prisma.pair.findUnique({
            where: { address: parent.address.toLowerCase() },
            select: { volume24h: true }
          });
          
          if (pairData && pairData.volume24h !== null) {
            console.log(`Found volume24h in MongoDB for pair ${parent.address}: ${pairData.volume24h}`);
            return pairData.volume24h;
          }
        } catch (dbError) {
          console.error(`MongoDB error fetching volume24h for ${parent.address}:`, dbError);
        }
        
        // Last resort: fallback to parent data if everything else fails
        console.log(`Falling back to parent volume24h for pair ${parent.address}: ${parent.volume24h}`);
        return parent.volume24h || "0";
      } catch (error) {
        console.error(`Error resolving volume24h for ${parent.address}:`, error);
        return "0";
      }
    },
    
    volume7d: async (parent: any, _args: any, { prisma }: Context) => {
      console.log(`volume7d for pair ${parent.address}: ${parent.volume7d}`);
      
      try {
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.volume7d) {
              console.log(`Using Redis volume7d for pair ${parent.address}: ${metrics.volume7d}`);
              return metrics.volume7d;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching volume7d for ${parent.address}:`, redisError);
        }
        
        // If Redis fails, directly query MongoDB instead of relying on parent object
        try {
          console.log(`Querying MongoDB directly for pair ${parent.address}`);
          const pairData = await prisma.pair.findUnique({
            where: { address: parent.address.toLowerCase() },
            select: { volume7d: true }
          });
          
          if (pairData && pairData.volume7d !== null) {
            console.log(`Found volume7d in MongoDB for pair ${parent.address}: ${pairData.volume7d}`);
            return pairData.volume7d;
          }
        } catch (dbError) {
          console.error(`MongoDB error fetching volume7d for ${parent.address}:`, dbError);
        }
        
        // Last resort: fallback to parent data if everything else fails
        console.log(`Falling back to parent volume7d for pair ${parent.address}: ${parent.volume7d}`);
        return parent.volume7d || "0";
      } catch (error) {
        console.error(`Error resolving volume7d for ${parent.address}:`, error);
        return "0";
      }
    },
    
    volume30d: async (parent: any, _args: any, { prisma }: Context) => {
      try {
        console.log(`Resolving volume30d for pair ${parent.address}`);
        
        // Try to get from Redis first (highest priority)
        const redis = getRedisClient();
        const cacheKey = `${CACHE_PREFIXES.PAIR_METRICS}${parent.address.toLowerCase()}`;
        
        try {
          const cachedData = await safeRedisGet(cacheKey);
          if (cachedData) {
            const metrics = JSON.parse(cachedData);
            if (metrics.volume30d != null) {
              console.log(`Using Redis volume30d for pair ${parent.address}: ${metrics.volume30d}`);
              return metrics.volume30d;
            }
          }
        } catch (redisError) {
          console.error(`Redis error fetching volume30d for ${parent.address}:`, redisError);
        }
        
        // If Redis fails, directly query MongoDB instead of relying on parent object
        try {
          console.log(`Querying MongoDB directly for pair ${parent.address}`);
          const pairData = await prisma.pair.findUnique({
            where: { address: parent.address.toLowerCase() },
            select: { volume30d: true }
          });
          
          if (pairData && pairData.volume30d !== null) {
            console.log(`Found volume30d in MongoDB for pair ${parent.address}: ${pairData.volume30d}`);
            return pairData.volume30d;
          }
        } catch (dbError) {
          console.error(`MongoDB error fetching volume30d for ${parent.address}:`, dbError);
        }
        
        // Last resort: fallback to parent data if everything else fails
        console.log(`Falling back to parent volume30d for pair ${parent.address}: ${parent.volume30d}`);
        return parent.volume30d || "0";
      } catch (error) {
        console.error(`Error resolving volume30d for ${parent.address}:`, error);
        return "0";
      }
    },
    
    volumeChange24h: async (parent: any, _args: any, { prisma }: Context) => {
      return parent.volumeChange24h || 0
    },
    
    volumeTVLRatio: async (parent: any, _args: any, { prisma }: Context) => {
      return parent.volumeTVLRatio || 0
    },
  },
  Query: {
    // Token resolvers
    token: async (_parent: unknown, { id, address }: { id?: string, address?: string }, ctx: Context) => {
      console.log(`[TOKEN] Looking up token by ${id ? 'id: ' + id : 'address: ' + address}`);
      
      if (!id && !address) {
        console.error('[TOKEN] Neither id nor address provided for token lookup');
        return null;
      }
      
      // Clear any cached data for this token in Redis if address is provided
      if (address) {
        try {
          const redis = getRedisClient();
          const normalizedAddress = address.toLowerCase();
          const cacheKey = `token:${normalizedAddress}`;
          if (redis) {
      await safeRedisDelete(cacheKey);
    }
          console.log(`[TOKEN] Cleared Redis cache for token address: ${normalizedAddress}`);
        } catch (error) {
          console.error('[TOKEN] Error clearing Redis cache:', error);
          // Continue even if Redis clearing fails
        }
      }
      
      // Query by ID or address
      const token = await ctx.prisma.token.findUnique({
        where: id ? { id } : { address: address!.toLowerCase() },
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
        console.error(`[TOKEN] Token not found: ${id || address}`);
        return null;
      }
      
      console.log(`[TOKEN] Found token: ${token.symbol} (${token.address}), id: ${token.id}`);

      // Calculate 24h volume
      const volumeData = await calculateTokenVolume24h(token.id, ctx.prisma, ctx.loaders);
      const calculatedVolume24h = volumeData[token.id] || '0';
      
      // Use stored volume if available and non-zero, otherwise use calculated volume
      const volume24h = (token.volumeUSD24h && parseFloat(token.volumeUSD24h) > 0) 
        ? token.volumeUSD24h 
        : calculatedVolume24h;
        
      console.log(`[TOKEN] Calculated volume24h: ${calculatedVolume24h}, stored: ${token.volumeUSD24h}, using: ${volume24h} for ${token.symbol}`);

      // Update volume in database if calculated value is different
      if (calculatedVolume24h !== '0' && calculatedVolume24h !== token.volumeUSD24h) {
        try {
          await ctx.prisma.token.update({
            where: { id: token.id },
            data: { volumeUSD24h: calculatedVolume24h }
          });
          console.log(`[TOKEN] Updated volume24h in database to ${calculatedVolume24h} for ${token.symbol}`);
        } catch (error) {
          console.error(`[TOKEN] Error updating volume24h in database for ${token.symbol}:`, error);
        }
      }

      // Always calculate TVL fresh using our utility function
      const tvl = await calculateTokenTVL(token, ctx.prisma);
      console.log(`[TOKEN] Final calculated TVL: ${tvl} for ${token.symbol}`);

      // Get the latest price data from the price service
      // This ensures both token list and token detail pages use the same price data source
      const priceData = await TokenPriceService.getTokenPricesUSDBulk([token.id]);
      const currentPrice = priceData[token.id] || token.priceUSD || '0';
      console.log(`[TOKEN] Final price from service: ${currentPrice} for ${token.symbol}`);

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
    // Keep tokenByAddress for backward compatibility but have it call the same resolver as token
    tokenByAddress: async (_parent: unknown, { address }: { address: string }, ctx: Context) => {
      // Just forward to the main token resolver
      return await resolvers.Query.token(_parent, { address }, ctx);
    },
    
    // Add tokens resolver for pagination and filtering
    tokens: async (
      _parent: Empty,
      {
        first = 20,
        after,
        where,
        orderBy = 'volumeUSD24h',
        orderDirection = 'desc',
      }: {
        first?: number
        after?: string
        where?: TokenWhereInput
        orderBy?: string
        orderDirection?: 'asc' | 'desc'
      },
      { prisma }: Context
    ) => {
      console.log(`[TOKENS] Fetching tokens with params: first=${first}, orderBy=${orderBy}, orderDirection=${orderDirection}`);
      
      try {
        // Build filter based on where input
        let filter: any = {};
        if (where) {
          if (where.address) filter.address = { equals: where.address.toLowerCase() };
          if (where.symbol) filter.symbol = { equals: where.symbol };
          if (where.name) filter.name = { contains: where.name };
        }
        
        // Handle cursor-based pagination
        let paginationFilter = {};
        if (after) {
          const cursorId = Buffer.from(after, 'base64').toString('ascii');
          paginationFilter = {
            cursor: { id: cursorId },
            skip: 1, // Skip the cursor itself
          };
        }
        
        // Handle ordering - special case for volumeUSD24h since it might be null
        const orderingField = orderBy === 'volumeUSD24h' ? 'volumeUSD24h' : orderBy;
        
        // Execute query with appropriate sorting and pagination
        const tokens = await prisma.token.findMany({
          where: filter,
          take: first + 1, // +1 to check if there's more
          ...paginationFilter,
          orderBy: {
            [orderingField]: orderDirection,
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
        
        // Special handling for volume ordering
        let orderedTokens = [...tokens];
        if (orderBy === 'volumeUSD24h') {
          // Custom sorting for tokens with null volumeUSD24h (put them at the end)
          orderedTokens.sort((a, b) => {
            const volumeA = a.volumeUSD24h ? parseFloat(a.volumeUSD24h) : -1;
            const volumeB = b.volumeUSD24h ? parseFloat(b.volumeUSD24h) : -1;
            
            // Handle the direction
            return orderDirection === 'desc' 
              ? volumeB - volumeA // descending
              : volumeA - volumeB; // ascending
          });
        }
        
        // Determine if there are more results
        const hasNextPage = orderedTokens.length > first;
        const edges = orderedTokens.slice(0, first).map(token => ({
          node: token,
          cursor: Buffer.from(token.id).toString('base64'),
        }));
        
        // Process stablecoins to ensure they show correct prices
        for (const edge of edges) {
          const token = edge.node;
          // No longer force stablecoin prices to $1 - use actual on-chain values
          // Instead, ensure they have a price if missing
          const stablecoinSymbols = ['USDC', 'USDT'];
          if (token.symbol && stablecoinSymbols.includes(token.symbol.toUpperCase())) {
            if (!token.priceUSD) {
              console.log(`[TOKENS] Getting actual price for stablecoin ${token.symbol} in list view`);
              
              // Fetch the price from TokenPriceService if needed
              TokenPriceService.getTokenPriceUSD(token.id)
                .then(price => {
                  // Only update if needed and the price exists
                  if (price > 0) {
                    console.log(`[TOKENS] Updated ${token.symbol} with actual price $${price}`);
                  }
                })
                .catch(err => {
                  console.error(`[TOKENS] Error updating stablecoin price:`, err);
                });
            }
          }
        }
        
        // Ensure all tokens have the latest price data - including in list view
        const tokenIds = edges.map(edge => edge.node.id);
        if (tokenIds.length > 0) {
          console.log(`[TOKENS] Getting latest prices for ${tokenIds.length} tokens in list view`);
          
          // Get prices in bulk for better performance
          const priceData = await TokenPriceService.getTokenPricesUSDBulk(tokenIds);
          
          // Update tokens with latest prices
          for (const edge of edges) {
            const token = edge.node;
            const latestPrice = priceData[token.id];
            
            if (latestPrice && (!token.priceUSD || latestPrice !== token.priceUSD)) {
              console.log(`[TOKENS] Updated ${token.symbol || token.id} price from ${token.priceUSD} to ${latestPrice}`);
              token.priceUSD = latestPrice;
            }
          }
        }
        
        // Removed hardcoded stablecoin price handling - prices derived from pairs
        
        // Count total tokens matching filter (without pagination)
        const totalCount = await prisma.token.count({ where: filter });
        
        console.log(`[TOKENS] Fetched ${edges.length} tokens, hasNextPage: ${hasNextPage}, totalCount: ${totalCount}`);
        
        return {
          edges,
          pageInfo: {
            hasNextPage,
            hasPreviousPage: !!after,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
          },
          totalCount,
        };
      } catch (error) {
        console.error('[TOKENS] Error fetching tokens:', error);
        // Return empty results instead of null to satisfy non-nullable field requirement
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
          const cachedResult = await safeRedisGet(cacheKey);
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
        
        pairs.forEach((pair: any) => {
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
              
              // No longer need to cache in the frontend - the indexer handles this
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
          processedPairs.sort((a: any, b: any) => {
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
        const totalCountResult = await prisma.pair.count()
        
        const result = {
          edges,
          pageInfo: {
            hasNextPage,
            endCursor: hasNextPage ? edges[edges.length - 1].cursor : null,
          },
          totalCount: totalCountResult
        }
        
        // Cache the result
        try {
          // Serialize the result to handle BigInt values
          const serializable = JSON.parse(JSON.stringify(result, (_, value) =>
            typeof value === 'bigint' ? value.toString() : value
          ));
          await safeRedisSet(cacheKey, JSON.stringify(serializable), 60 * 5); // Cache for 5 minutes
        } catch (error) {
          console.error('Redis cache set error:', error);
          // Continue without caching
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
      { pairAddress, timeframe = '1d', limit = 100 }: { pairAddress: string; timeframe?: string; limit?: number },
      { prisma }: Context
    ): Promise<ChartDataPoint[]> => {
      try {
        // Calculate time period
        const now = Date.now();
        let startTimeMs: number;
        
        switch (timeframe) {
          case '1h':
            startTimeMs = now - 60 * 60 * 1000;
            break;
          case '4h':
            startTimeMs = now - 4 * 60 * 60 * 1000;
            break;
          case '12h':
            startTimeMs = now - 12 * 60 * 60 * 1000;
            break;
          case '1d':
            startTimeMs = now - 24 * 60 * 60 * 1000;
            break;
          case '1w':
            startTimeMs = now - 7 * 24 * 60 * 60 * 1000;
            break;
          case '1m':
            startTimeMs = now - 30 * 24 * 60 * 60 * 1000;
            break;
          case 'all':
          default:
            startTimeMs = 0; // Get all data
        }
        
        // Convert to seconds for database query
        const startTimeSecs = Math.floor(startTimeMs / 1000);
        
        // Get price snapshots for this pair
        const snapshots = await prisma.priceSnapshot.findMany({
          where: {
            pairId: pairAddress.toLowerCase(),
            timestamp: { gte: startTimeSecs }, // Use number instead of string
          },
          orderBy: { timestamp: 'asc' },
          distinct: ['timestamp'],
          take: limit,
        });
        
        if (snapshots.length === 0) {
          return [];
        }
        
        // Determine which price to use based on ordering of tokens
        const pair = await prisma.pair.findUnique({
          where: { address: pairAddress.toLowerCase() },
          include: {
            token0: true,
            token1: true,
          },
        });
        
        if (!pair) {
          throw new Error(`Pair with address ${pairAddress} not found`);
        }
        
        // Prioritize the base token price - usually against stable or major tokens
        const isToken0 = isBaseToken(pair.token0, pair.token1);
        
        // Map snapshots to chart data points
        const data = snapshots.map((snapshot: any) => ({
          time: ensureNumberTimestamp(snapshot.timestamp),
          value: isToken0 
            ? parseFloat(snapshot.price0 || '0') 
            : parseFloat(snapshot.price1 || '0'),
        }));
        
        return data;
      } catch (error) {
        console.error('Error fetching price chart data:', error);
        return [];
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

        // Replace hardcoded stablecoin prices - use TokenPriceService for all tokens
        // Get token0 price from the price service
        token0PriceUSD = await TokenPriceService.getTokenPriceUSD(
          pair.token0.id,
          token0Decimals
        )

        // Get token1 price from the price service
        token1PriceUSD = await TokenPriceService.getTokenPriceUSD(
          pair.token1.id,
          token1Decimals
        )

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
            time: Math.floor(Number(parseInt(timeStr, 10))),
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
        console.log(`[CHART] Fetching price chart for token: ${tokenAddress}, timeframe: ${timeframe}, limit: ${limit}`);
        
        // Normalize address to lowercase for consistent lookups
        const normalizedAddress = tokenAddress.toLowerCase();
        
        // Find the token by address
        const token = await prisma.token.findFirst({
          where: { address: normalizedAddress },
          select: {
            id: true,
            symbol: true,
            decimals: true,
            priceUSD: true
          }
        });

        if (!token) {
          console.error(`[CHART] Token not found: ${tokenAddress}`);
          return [];
        }
        
        console.log(`[CHART] Processing chart for ${token.symbol} (id: ${token.id}), current price: $${token.priceUSD || 'unknown'}`);
        
        // Check if token is a stablecoin for debug purposes
        const isStablecoin = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'].includes(token.symbol?.toUpperCase() || '');
        if (isStablecoin) {
          console.log(`[CHART] ${token.symbol} is a stablecoin`);
        }
        
        // Use PriceChartService to get the chart data
        // The service now properly handles historical data and returns correct prices
        const chartData = await PriceChartService.getTokenPriceChartData(
          normalizedAddress,
          token.id,
          timeframe,
          limit,
          prisma
        );
        
        console.log(`[CHART] Retrieved ${chartData.length} price chart data points for ${token.symbol}`);
        
        // No data case
        if (chartData.length === 0) {
          console.log(`[CHART] No chart data returned for ${token.symbol}`);
          return [];
        }
        
        // Debug information about data range
        if (chartData.length > 0) {
          const firstPoint = chartData[0];
          const lastPoint = chartData[chartData.length - 1];
          console.log(`[CHART] Data range: ${new Date(firstPoint.time * 1000).toISOString()} to ${new Date(lastPoint.time * 1000).toISOString()}`);
          
          // Value statistics
          const values = chartData.map(p => Number(p.value));
          const min = Math.min(...values);
          const max = Math.max(...values);
          const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
          console.log(`[CHART] ${token.symbol} value range: min=${min}, max=${max}, avg=${avg}`);
        }
        
        // Sort data by timestamp numerically before returning to the client
        // This ensures data is always ordered correctly regardless of data type conversion
        const sortedData = chartData.sort((a, b) => {
          // Explicitly convert both times to numbers for consistent comparison
          return Number(a.time) - Number(b.time);
        });
        
        console.log(`[CHART] Sorted chart data, first timestamp: ${new Date(Number(sortedData[0].time) * 1000).toISOString()}, last timestamp: ${new Date(Number(sortedData[sortedData.length-1].time) * 1000).toISOString()}`);
        
        // Ensure all values are proper numbers before returning to client
        return sortedData.map(point => ({
          time: typeof point.time === 'string' ? parseInt(point.time, 10) : Number(point.time),
          value: typeof point.value === 'string' ? parseFloat(point.value) : Number(point.value)
        }));
      } catch (error) {
        console.error('[CHART] Error in tokenPriceChart:', error);
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
      { prisma }: Context
    ) => {
      try {
        // Query swaps ordered by timestamp (newest first)
        const swaps = await prisma.swap.findMany({
          take: first + 1, // Take one extra to check for next page
          ...(after && { cursor: { id: after }, skip: 1 }),
          orderBy: { timestamp: 'desc' },
          include: {
            pair: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
        });

        // Process the swaps into the format expected by GraphQL
        const edges = swaps.slice(0, first).map((swapObj: any) => {
          // Ensure we handle timestamp as a number here
          return {
            cursor: swapObj.id,
            node: {
              id: swapObj.id,
              txHash: swapObj.txHash,
              pair: swapObj.pair,
              userAddress: swapObj.userAddress,
              timestamp: ensureNumberTimestamp(swapObj.timestamp),
              amountIn0: swapObj.amountIn0,
              amountIn1: swapObj.amountIn1,
              amountOut0: swapObj.amountOut0,
              amountOut1: swapObj.amountOut1,
              valueUSD: calculateSwapValueUSD(swapObj),
              token0: swapObj.pair.token0,
              token1: swapObj.pair.token1,
            },
          };
        });

        return {
          edges,
          pageInfo: {
            hasNextPage: swaps.length > first,
            hasPreviousPage: !!after,
            startCursor: edges.length > 0 ? edges[0].cursor : null,
            endCursor: edges.length > 0 ? edges[edges.length - 1].cursor : null,
          },
          totalCount: await prisma.swap.count(),
        };
      } catch (error) {
        console.error('Error fetching recent transactions:', error);
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

    // Add this to the Query object
    async protocolMetrics(_parent: any, _args: any, { prisma }: Context) {
      try {
        // Always try to get metrics from Redis first for better performance
        try {
          console.log('Attempting to get protocol metrics from Redis');
          // Add a timestamp to the logs to track when this is called
          console.log(`Query timestamp: ${new Date().toISOString()}`);
          const metricsFromRedis = await getProtocolMetricsFromRedis();
          
          if (metricsFromRedis) {
            console.log(`Found Redis metrics - volume24h: ${metricsFromRedis.dailyVolumeUSD}, tvl: ${metricsFromRedis.totalValueLockedUSD}, volume24hChange: ${metricsFromRedis.volume24hChange}%`);
            return metricsFromRedis;
          }
        } catch (redisError) {
          console.error('Error reading protocol metrics from Redis:', redisError);
          // Continue to database fallbacks
        }
        
        console.log('Redis metrics not available, falling back to database');
        
        // Fall back to database if Redis metrics are not available
        // Try to get metrics from the EntityMetrics table if it exists
        let protocolMetrics = null;
        try {
          // Use type assertion to handle EntityMetrics model
          const prismaExtended = prisma as any;
          protocolMetrics = await prismaExtended.entityMetrics?.findFirst({
            where: {
              entity: 'protocol',
              entityId: 'protocol'
            },
            orderBy: { lastUpdated: 'desc' }
          });
          
          // If not found with 'protocol', try with 'global'
          if (!protocolMetrics) {
            protocolMetrics = await prismaExtended.entityMetrics?.findFirst({
              where: {
                entity: 'protocol',
                entityId: 'global'
              },
              orderBy: { lastUpdated: 'desc' }
            });
          }
        } catch (error) {
          console.log('EntityMetrics table likely not available yet:', error);
        }
        
        if (protocolMetrics) {
          console.log(`Found EntityMetrics - volume24h: ${protocolMetrics.volume24h}`);
          // Convert metrics to the expected format
          return {
            id: protocolMetrics.id,
            timestamp: ensureNumberTimestamp(protocolMetrics.lastUpdated),
            totalValueLockedUSD: protocolMetrics.tvl || '0',
            dailyVolumeUSD: protocolMetrics.volume24h || '0',
            weeklyVolumeUSD: protocolMetrics.volume7d || '0',
            monthlyVolumeUSD: protocolMetrics.volume30d || '0',
            volume1hChange: protocolMetrics.volumeChange1h ? parseFloat(protocolMetrics.volumeChange1h.toString()) : 0,
            volume24hChange: protocolMetrics.volumeChange24h ? parseFloat(protocolMetrics.volumeChange24h.toString()) : 0
          };
        }
        
        // If we reach here, get from ProtocolMetric table as last resort
        const metric = await prisma.protocolMetric.findFirst({
          orderBy: { timestamp: 'desc' }
        });
        
        if (metric) {
          console.log(`Found ProtocolMetric - volume24h: ${metric.dailyVolumeUSD}`);
          return {
            id: metric.id,
            timestamp: ensureNumberTimestamp(metric.timestamp),
            totalValueLockedUSD: metric.totalValueLockedUSD || '0',
            dailyVolumeUSD: metric.dailyVolumeUSD || '0',
            weeklyVolumeUSD: metric.weeklyVolumeUSD || '0',
            monthlyVolumeUSD: metric.monthlyVolumeUSD || '0',
            volume1hChange: metric.volume1hChange || 0,
            // Use optional chaining and type assertion to safely access property
            volume24hChange: (metric as any).volume24hChange || 0
          };
        }
        
        // If we reach here, return default values
        console.log('No protocol metrics found in any source, using default values');
        return {
          id: 'default',
          timestamp: Math.floor(Date.now() / 1000),
          totalValueLockedUSD: '0',
          dailyVolumeUSD: '0',
          weeklyVolumeUSD: '0',
          monthlyVolumeUSD: '0',
          volume1hChange: 0,
          volume24hChange: 0
        };
      } catch (error) {
        console.error('Error retrieving protocol metrics:', error);
        // Return default values if there was an error
        return {
          id: 'default',
          timestamp: Math.floor(Date.now() / 1000),
          totalValueLockedUSD: '0',
          dailyVolumeUSD: '0',
          weeklyVolumeUSD: '0',
          monthlyVolumeUSD: '0',
          volume1hChange: 0,
          volume24hChange: 0
        };
      }
    },
  },
  
  // Add this at the end
  Swap: {
    timestamp: (parent: any) => ensureNumberTimestamp(parent.timestamp),
    blockNumber: (parent: any) => Number(parent.blockNumber)
  },

  // Add Subscription resolvers
  Subscription: {
    // Protocol metrics subscription resolver
    protocolMetricsUpdated: {
      subscribe: (_parent: any, _args: any, { prisma }: Context) => {
        console.log('Setting up protocolMetricsUpdated subscription');
        
        // Create an AsyncIterator that the GraphQL server can use
        return {
          [Symbol.asyncIterator]: () => {
            // Create a channel for this subscription
            const channel = new EventEmitter();
            
            // Set up the event listener that will push updates to this subscription
            const listener = async () => {
              try {
                console.log('Received protocol metrics update event');
                // Get the latest protocol metrics
                let protocolMetrics;
                
                try {
                  // Try EntityMetrics first
                  const prismaExtended = prisma as any;
                  protocolMetrics = await prismaExtended.entityMetrics?.findFirst({
                    where: {
                      entity: 'protocol',
                      entityId: 'protocol'
                    },
                    orderBy: { lastUpdated: 'desc' }
                  });
                  
                  // If not found with 'protocol', try with 'global'
                  if (!protocolMetrics) {
                    protocolMetrics = await prismaExtended.entityMetrics?.findFirst({
                      where: {
                        entity: 'protocol',
                        entityId: 'global'
                      },
                      orderBy: { lastUpdated: 'desc' }
                    });
                  }
                } catch (error) {
                  console.log('EntityMetrics not available:', error);
                }
                
                // If no EntityMetrics, try ProtocolMetric table
                if (!protocolMetrics) {
                  protocolMetrics = await prisma.protocolMetric.findFirst({
                    orderBy: { timestamp: 'desc' }
                  });
                }
                
                if (protocolMetrics) {
                  console.log('Publishing updated metrics to subscription:', protocolMetrics);
                  
                  // Format data based on which table it came from
                  let formattedMetrics;
                  if ('volume24h' in protocolMetrics) {
                    // EntityMetrics format
                    formattedMetrics = {
                      id: protocolMetrics.id,
                      timestamp: typeof protocolMetrics.lastUpdated === 'number' ? protocolMetrics.lastUpdated : Math.floor(new Date(protocolMetrics.lastUpdated).getTime() / 1000),
                      totalValueLockedUSD: protocolMetrics.tvl || '0',
                      dailyVolumeUSD: protocolMetrics.volume24h || '0',
                      weeklyVolumeUSD: protocolMetrics.volume7d || '0',
                      monthlyVolumeUSD: protocolMetrics.volume30d || '0',
                      volume1hChange: protocolMetrics.volumeChange1h !== undefined ? parseFloat(protocolMetrics.volumeChange1h.toString()) : 0,
                      volume24hChange: protocolMetrics.volumeChange24h !== undefined ? parseFloat(protocolMetrics.volumeChange24h.toString()) : 0
                    };
                  } else {
                    // ProtocolMetric format
                    formattedMetrics = {
                      id: protocolMetrics.id,
                      timestamp: protocolMetrics.timestamp,
                      totalValueLockedUSD: protocolMetrics.totalValueLockedUSD || '0',
                      dailyVolumeUSD: protocolMetrics.dailyVolumeUSD || '0',
                      weeklyVolumeUSD: protocolMetrics.weeklyVolumeUSD || '0',
                      monthlyVolumeUSD: protocolMetrics.monthlyVolumeUSD || '0',
                      volume1hChange: protocolMetrics.volume1hChange || 0,
                      volume24hChange: protocolMetrics.volume24hChange || 0
                    };
                  }
                  
                  // Emit the event with the latest metrics data
                  channel.emit('metrics', { protocolMetricsUpdated: formattedMetrics });
                }
              } catch (error) {
                console.error('Error processing protocol metrics update:', error);
              }
            };
            
            // Register the listener with the global subscription handler
            const { subscribeToProtocolMetrics } = require('../subscriptions/subscription-server');
            const unsubscribe = subscribeToProtocolMetrics(listener);
            
            // Set up async iterator handlers
            return {
              next: () => {
                return new Promise((resolve) => {
                  channel.once('metrics', (payload) => {
                    resolve({ value: payload, done: false });
                  });
                });
              },
              return: () => {
                // Clean up when subscription is cancelled
                unsubscribe();
                channel.removeAllListeners();
                return Promise.resolve({ value: undefined, done: true });
              },
              throw: (error: Error) => {
                return Promise.reject(error);
              },
              [Symbol.asyncIterator]() {
                return this;
              }
            };
          }
        };
      }
    },
    
    // Pair updates subscription resolver
    pairUpdated: {
      subscribe: (_parent: any, { pairId }: { pairId: string }, { prisma }: Context) => {
        console.log(`Setting up pairUpdated subscription for pair: ${pairId}`);
        
        // Create an AsyncIterator that the GraphQL server can use
        return {
          [Symbol.asyncIterator]: () => {
            // Create a channel for this subscription
            const channel = new EventEmitter();
            
            // Set up the event listener that will push updates to this subscription
            const listener = async () => {
              try {
                console.log(`Received pair update event for ${pairId}`);
                // Get the latest pair data
                const pair = await prisma.pair.findUnique({
                  where: { id: pairId },
                  include: {
                    token0: true,
                    token1: true
                  }
                });
                
                if (pair) {
                  // Emit the event with the latest pair data
                  channel.emit('pair', { pairUpdated: pair });
                }
              } catch (error) {
                console.error(`Error processing pair update for ${pairId}:`, error);
              }
            };
            
            // Register the listener with the global subscription handler
            const { subscribeToPairUpdates } = require('../subscriptions/subscription-server');
            const unsubscribe = subscribeToPairUpdates(pairId, listener);
            
            // Set up async iterator handlers
            return {
              next: () => {
                return new Promise((resolve) => {
                  channel.once('pair', (payload) => {
                    resolve({ value: payload, done: false });
                  });
                });
              },
              return: () => {
                // Clean up when subscription is cancelled
                unsubscribe();
                channel.removeAllListeners();
                return Promise.resolve({ value: undefined, done: true });
              },
              throw: (error: Error) => {
                return Promise.reject(error);
              },
              [Symbol.asyncIterator]() {
                return this;
              }
            };
          }
        };
      }
    },
    
    // Token updates subscription resolver
    tokenUpdated: {
      subscribe: (_parent: any, { tokenId }: { tokenId: string }, { prisma }: Context) => {
        console.log(`Setting up tokenUpdated subscription for token: ${tokenId}`);
        
        // Create an AsyncIterator that the GraphQL server can use
        return {
          [Symbol.asyncIterator]: () => {
            // Create a channel for this subscription
            const channel = new EventEmitter();
            
            // Set up the event listener that will push updates to this subscription
            const listener = async () => {
              try {
                console.log(`Received token update event for ${tokenId}`);
                // Get the latest token data
                const token = await prisma.token.findUnique({
                  where: { id: tokenId }
                });
                
                if (token) {
                  // Emit the event with the latest token data
                  channel.emit('token', { tokenUpdated: token });
                }
              } catch (error) {
                console.error(`Error processing token update for ${tokenId}:`, error);
              }
            };
            
            // Register the listener with the global subscription handler
            const { subscribeToTokenUpdates } = require('../subscriptions/subscription-server');
            const unsubscribe = subscribeToTokenUpdates(tokenId, listener);
            
            // Set up async iterator handlers
            return {
              next: () => {
                return new Promise((resolve) => {
                  channel.once('token', (payload) => {
                    resolve({ value: payload, done: false });
                  });
                });
              },
              return: () => {
                // Clean up when subscription is cancelled
                unsubscribe();
                channel.removeAllListeners();
                return Promise.resolve({ value: undefined, done: true });
              },
              throw: (error: Error) => {
                return Promise.reject(error);
              },
              [Symbol.asyncIterator]() {
                return this;
              }
            };
          }
        };
      }
    }
  }
};

// Add this function to ensure timestamp conversion in consistent places
// This should be added near the top of the file in a utility section
function ensureNumberTimestamp(timestamp: string | number | bigint | null | undefined): number {
  if (timestamp === null || timestamp === undefined) {
    return 0;
  }
  
  if (typeof timestamp === 'number') {
    return timestamp;
  }
  
  if (typeof timestamp === 'bigint') {
    return Number(timestamp);
  }
  
  // Handle string timestamps
  if (typeof timestamp === 'string') {
    return parseInt(timestamp, 10);
  }
  
  return 0;
}

// Add this function above the resolvers object to calculate swap values
function calculateSwapValueUSD(swap: any): string {
  try {
    // Get token decimals with safe defaults
    const token0Decimals = swap.pair.token0.decimals || 18;
    const token1Decimals = swap.pair.token1.decimals || 18;
    
    // Get token prices from token objects if available
    let token0Price = swap.pair.token0.priceUSD ? parseFloat(swap.pair.token0.priceUSD) : 0;
    let token1Price = swap.pair.token1.priceUSD ? parseFloat(swap.pair.token1.priceUSD) : 0;
    
    // Format token amounts properly using viem's formatUnits
    const amount0In = Number(formatUnits(BigInt(swap.amountIn0 || '0'), token0Decimals));
    const amount0Out = Number(formatUnits(BigInt(swap.amountOut0 || '0'), token0Decimals));
    const amount1In = Number(formatUnits(BigInt(swap.amountIn1 || '0'), token1Decimals));
    const amount1Out = Number(formatUnits(BigInt(swap.amountOut1 || '0'), token1Decimals));
    
    // Calculate USD values for both token sides
    const value0USD = (amount0In + amount0Out) * token0Price;
    const value1USD = (amount1In + amount1Out) * token1Price;
    
    // Use the higher value for better accuracy (sometimes one token has better price info)
    const valueUSD = Math.max(value0USD, value1USD);
    
    // Handle cases where both prices might be zero
    if (valueUSD <= 0) {
      return '0';
    }
    
    return valueUSD.toString();
  } catch (error) {
    console.error('Error calculating swap value:', error);
    return '0';
  }
}

// Add the isBaseToken helper function near the top with other helper functions
function isBaseToken(token0: any, token1: any): boolean {
  // List of known stable tokens
  const stableTokens = ['USDT', 'USDC', 'DAI', 'BUSD'];
  
  // Check if either token is a stable token
  const isToken0Stable = token0.symbol && stableTokens.includes(token0.symbol.toUpperCase());
  const isToken1Stable = token1.symbol && stableTokens.includes(token1.symbol.toUpperCase());
  
  // If token1 is stable, then token0 is the base token
  if (isToken1Stable) {
    return true;
  }
  
  // If token0 is stable, then token1 is the base token
  if (isToken0Stable) {
    return false;
  }
  
  // If neither is stable, default to token0 as base
  return true;
}

