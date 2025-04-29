import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/src/lib/redis/client'
import { TokenPriceService } from '@/src/lib/services/tokenPriceService'
import prisma from '@/src/lib/db/prisma'
import { calculateReservesUSD } from '@/src/lib/graphql/oracleUtils'
import { updatePairReserveSnapshots } from '@/src/services/reserveSnapshotService'
import { createPublicClient, http, getAddress } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'

// Define token type
type Token = {
  id: string;
  address: string;
  symbol?: string | null;
  decimals?: number | null;
  priceUSD?: string | null;
  lastPriceUpdate?: Date | null;
}

// Define pair type to fix type errors
type Pair = {
  id: string;
  address: string;
  reserve0: string;
  reserve1: string;
  token0: Token;
  token1: Token;
}

// Minimal ABI for getReserves, token0, token1
const PAIR_ABI = [
  {
    type: 'function',
    name: 'getReserves',
    inputs: [],
    outputs: [
      { name: '_reserve0', type: 'uint112' },
      { name: '_reserve1', type: 'uint112' },
      { name: '_blockTimestampLast', type: 'uint32' }
    ],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'token0',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'token1',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  }
] as const

// Create a public client for blockchain interactions
const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0])
})

// Addresses of key tokens - using lowercase for consistency
const USDT_ADDRESS = '0x7d984c24d2499d840eb3b7016077164e15e5faa6'.toLowerCase()
const USDC_ADDRESS = '0x77071ad51ca93fc90e77bcdece5aa6f1b40fcb21'.toLowerCase()
const KKUB_ADDRESS = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'.toLowerCase()

// Set stablecoin prices - these are pegged to USD
const STABLECOIN_PRICE = '1.0'

export async function GET(request: NextRequest) {
  try {
    // 1. Clear cache first
    const redis = getRedisClient()
    const tokenKeys = await redis.keys('token:*')
    const pairKeys = await redis.keys('pair:*')
    const allKeys = [...tokenKeys, ...pairKeys]
    
    if (allKeys.length > 0) {
      await redis.del(...allKeys)
    }
    
    // 2. Get all pairs and update their reserves directly from blockchain
    const pairs = await prisma.pair.findMany({
      include: {
        token0: true,
        token1: true
      }
    })
    
    const updatedPairs = []
    const pairReserveDebug = []
    
    for (const pair of pairs) {
      try {
        // Get on-chain reserves
        const reserves = await publicClient.readContract({
          address: pair.address as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'getReserves'
        })
        
        // Verify token addresses match on-chain data
        const onChainToken0 = await publicClient.readContract({
          address: pair.address as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'token0'
        })
        
        const onChainToken1 = await publicClient.readContract({
          address: pair.address as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'token1'
        })
        
        // Double check token addresses match
        const token0AddressMatches = getAddress(onChainToken0) === getAddress(pair.token0.address)
        const token1AddressMatches = getAddress(onChainToken1) === getAddress(pair.token1.address)
        
        if (!token0AddressMatches || !token1AddressMatches) {
          console.error(`Token address mismatch for pair ${pair.address}:
            DB Token0: ${pair.token0.address}, On-Chain Token0: ${onChainToken0}
            DB Token1: ${pair.token1.address}, On-Chain Token1: ${onChainToken1}
          `)
        }
        
        // Update pair reserves in database
        await prisma.pair.update({
          where: { id: pair.id },
          data: {
            reserve0: reserves[0].toString(),
            reserve1: reserves[1].toString(),
            lastBlockUpdate: Math.floor(Date.now() / 1000)
          }
        })
        
        updatedPairs.push(pair.id)
      } catch (error) {
        console.error(`Error updating reserves for pair ${pair.address}:`, error)
      }
    }
    
    // 3. Get tokens
    const tokens = await prisma.token.findMany()
    const tokenDebug = []
    const updatedTokens = []

    // 4. Find stablecoin/stablecoin pairs to derive their relative values
    const stablecoinPair = pairs.find((pair: Pair) => {
      const token0Address = pair.token0.address.toLowerCase()
      const token1Address = pair.token1.address.toLowerCase()
      return (
        ((token0Address === USDT_ADDRESS && token1Address === USDC_ADDRESS) ||
         (token0Address === USDC_ADDRESS && token1Address === USDT_ADDRESS))
      )
    })

    // Calculate stablecoin prices based on their relative values
    if (stablecoinPair) {
      const token0Address = stablecoinPair.token0.address.toLowerCase()
      const token1Address = stablecoinPair.token1.address.toLowerCase()
      
      // Get reserves with proper decimals
      const token0Decimals = stablecoinPair.token0.decimals || 18
      const token1Decimals = stablecoinPair.token1.decimals || 18
      
      const reserve0 = Number(BigInt(stablecoinPair.reserve0)) / 10 ** token0Decimals
      const reserve1 = Number(BigInt(stablecoinPair.reserve1)) / 10 ** token1Decimals
      
      // Calculate price ratios - use USDT as reference if available
      // If the price is close to 1 (within 5%), use 1 for simplicity
      let usdtPrice, usdcPrice;

      if (token0Address === USDT_ADDRESS) {
        const ratio = reserve1 / reserve0;
        usdtPrice = 1; // Reference price
        usdcPrice = ratio > 0.95 && ratio < 1.05 ? 1 : ratio;
      } else {
        const ratio = reserve0 / reserve1;
        usdcPrice = 1; // Reference price 
        usdtPrice = ratio > 0.95 && ratio < 1.05 ? 1 : ratio;
      }

      // Update USDT price
      const usdtToken = tokens.find((t: Token) => t.address.toLowerCase() === USDT_ADDRESS)
      if (usdtToken) {
        await prisma.token.update({
          where: { id: usdtToken.id },
          data: {
            priceUSD: usdtPrice.toString(),
            lastPriceUpdate: new Date()
          }
        })
        
        await redis.set(`token:${usdtToken.id}:priceUSD`, usdtPrice.toString(), 'EX', 300)
        
        updatedTokens.push(usdtToken.id)
        tokenDebug.push({
          symbol: usdtToken.symbol || usdtToken.address.substring(0, 8),
          address: usdtToken.address,
          oldPrice: usdtToken.priceUSD,
          newPrice: usdtPrice.toString(),
          method: 'stablecoin-market'
        })
      }
      
      // Update USDC price
      const usdcToken = tokens.find((t: Token) => t.address.toLowerCase() === USDC_ADDRESS)
      if (usdcToken) {
        await prisma.token.update({
          where: { id: usdcToken.id },
          data: {
            priceUSD: usdcPrice.toString(),
            lastPriceUpdate: new Date()
          }
        })
        
        await redis.set(`token:${usdcToken.id}:priceUSD`, usdcPrice.toString(), 'EX', 300)
        
        updatedTokens.push(usdcToken.id)
        tokenDebug.push({
          symbol: usdcToken.symbol || usdcToken.address.substring(0, 8),
          address: usdcToken.address,
          oldPrice: usdcToken.priceUSD,
          newPrice: usdcPrice.toString(),
          method: 'stablecoin-market'
        })
      }
    } else {
      // Fallback to using TWAP from KKUB pairs if no direct stablecoin pairing
      const stablecoins = [
        { address: USDT_ADDRESS, symbol: 'USDT' },
        { address: USDC_ADDRESS, symbol: 'USDC' }
      ];
      
      for (const stablecoin of stablecoins) {
        const stablecoinToken = tokens.find((t: Token) => t.address.toLowerCase() === stablecoin.address)
        if (!stablecoinToken) continue;
        
        // Find pair with KKUB
        const kkubPair = pairs.find((pair: Pair) => {
          const token0Address = pair.token0.address.toLowerCase()
          const token1Address = pair.token1.address.toLowerCase()
          return (
            (token0Address === stablecoin.address && token1Address === KKUB_ADDRESS) ||
            (token0Address === KKUB_ADDRESS && token1Address === stablecoin.address)
          )
        })
        
        if (kkubPair) {
          // If we have KKUB-stablecoin pair, we can estimate price
          // Typical stablecoin price would be around 1 USD, so we'll use
          // an adaptive approach based on the pair reserves
          
          const isToken0 = kkubPair.token0.address.toLowerCase() === stablecoin.address
          const token0Decimals = kkubPair.token0.decimals || 18
          const token1Decimals = kkubPair.token1.decimals || 18
          
          const reserve0 = Number(BigInt(kkubPair.reserve0)) / 10 ** token0Decimals
          const reserve1 = Number(BigInt(kkubPair.reserve1)) / 10 ** token1Decimals
          
          // Try to get the real stablecoin price instead of using a hardcoded value
          const stablecoinPrice = await TokenPriceService.getReliableTokenUsdPrice({
            id: stablecoinToken.id,
            address: stablecoinToken.address,
            decimals: stablecoinToken.decimals || 18,
            symbol: stablecoinToken.symbol || undefined
          }, prisma);
          
          if (stablecoinPrice > 0) {
            await prisma.token.update({
              where: { id: stablecoinToken.id },
              data: {
                priceUSD: stablecoinPrice.toString(),
                lastPriceUpdate: new Date()
              }
            });
            
            await redis.set(`token:${stablecoinToken.id}:priceUSD`, stablecoinPrice.toString(), 'EX', 300);
            
            updatedTokens.push(stablecoinToken.id);
            tokenDebug.push({
              symbol: stablecoinToken.symbol || stablecoinToken.address.substring(0, 8),
              address: stablecoinToken.address,
              oldPrice: stablecoinToken.priceUSD,
              newPrice: stablecoinPrice.toString(),
              method: 'calculated'
            });
          } else {
            console.warn(`Failed to calculate price for stablecoin ${stablecoinToken.symbol || stablecoinToken.address}`);
            
            tokenDebug.push({
              symbol: stablecoinToken.symbol || stablecoinToken.address.substring(0, 8),
              address: stablecoinToken.address,
              oldPrice: stablecoinToken.priceUSD,
              newPrice: 'Failed to calculate',
              method: 'failed'
            });
          }
        } else {
          // In absence of any market data, try other pricing methods
          // Try to get the real stablecoin price instead of using a hardcoded value
          const stablecoinPrice = await TokenPriceService.getReliableTokenUsdPrice({
            id: stablecoinToken.id,
            address: stablecoinToken.address,
            decimals: stablecoinToken.decimals || 18,
            symbol: stablecoinToken.symbol || undefined
          }, prisma);
          
          if (stablecoinPrice > 0) {
            await prisma.token.update({
              where: { id: stablecoinToken.id },
              data: {
                priceUSD: stablecoinPrice.toString(),
                lastPriceUpdate: new Date()
              }
            });
            
            await redis.set(`token:${stablecoinToken.id}:priceUSD`, stablecoinPrice.toString(), 'EX', 300);
            
            updatedTokens.push(stablecoinToken.id);
            tokenDebug.push({
              symbol: stablecoinToken.symbol || stablecoinToken.address.substring(0, 8),
              address: stablecoinToken.address,
              oldPrice: stablecoinToken.priceUSD,
              newPrice: stablecoinPrice.toString(),
              method: 'calculated'
            });
          } else {
            console.warn(`Failed to calculate price for stablecoin ${stablecoinToken.symbol || stablecoinToken.address}`);
            
            tokenDebug.push({
              symbol: stablecoinToken.symbol || stablecoinToken.address.substring(0, 8),
              address: stablecoinToken.address,
              oldPrice: stablecoinToken.priceUSD,
              newPrice: 'Failed to calculate',
              method: 'failed'
            });
          }
        }
      }
    }
    
    // 5. Calculate KKUB price specifically since it's used as a base token
    const kkubToken = tokens.find((t: Token) => t.address.toLowerCase() === KKUB_ADDRESS)
    if (kkubToken) {
      try {
        const price = await TokenPriceService.getReliableTokenUsdPrice({
          id: kkubToken.id,
          address: kkubToken.address,
          decimals: kkubToken.decimals || 18,
          symbol: kkubToken.symbol || 'KKUB'
        }, prisma)
        
        if (price > 0) {
          await prisma.token.update({
            where: { id: kkubToken.id },
            data: {
              priceUSD: price.toString(),
              lastPriceUpdate: new Date()
            }
          })
          
          // Cache the price
          await redis.set(`token:${kkubToken.id}:priceUSD`, price.toString(), 'EX', 300)
          
          updatedTokens.push(kkubToken.id)
          tokenDebug.push({
            symbol: kkubToken.symbol || kkubToken.address.substring(0, 8),
            address: kkubToken.address,
            oldPrice: kkubToken.priceUSD,
            newPrice: price.toString(),
            method: 'calculated'
          })
        }
      } catch (error) {
        console.error(`Error calculating KKUB price:`, error)
      }
    }
    
    // 6. Calculate prices for remaining tokens now that stablecoin prices are set
    for (const token of tokens) {
      // Skip tokens we've already processed
      const tokenAddress = token.address.toLowerCase()
      if (tokenAddress === USDT_ADDRESS || tokenAddress === USDC_ADDRESS || tokenAddress === KKUB_ADDRESS) {
        continue
      }
      
      try {
        const symbol = token.symbol || token.address.substring(0, 8)
        
        // Try to calculate price using TokenPriceService
        const price = await TokenPriceService.getReliableTokenUsdPrice({
          id: token.id,
          address: token.address,
          decimals: token.decimals || 18,
          symbol
        }, prisma)
        
        // If price was calculated, update database
        if (price > 0) {
          await prisma.token.update({
            where: { id: token.id },
            data: {
              priceUSD: price.toString(),
              lastPriceUpdate: new Date()
            }
          })
          
          // Cache the price
          await redis.set(`token:${token.id}:priceUSD`, price.toString(), 'EX', 300)
          
          updatedTokens.push(token.id)
          tokenDebug.push({
            symbol,
            address: token.address,
            oldPrice: token.priceUSD,
            newPrice: price.toString(),
            method: 'calculated'
          })
        } else {
          console.log(`Failed to calculate price for ${symbol}`)
          
          // Try direct pricing via stablecoin pair as fallback
          const priceViaStablecoin = await calculatePriceViaStablecoinPair(token, tokens, pairs, prisma)
          
          if (priceViaStablecoin > 0) {
            await prisma.token.update({
              where: { id: token.id },
              data: {
                priceUSD: priceViaStablecoin.toString(),
                lastPriceUpdate: new Date()
              }
            })
            
            // Cache the price
            await redis.set(`token:${token.id}:priceUSD`, priceViaStablecoin.toString(), 'EX', 300)
            
            updatedTokens.push(token.id)
            tokenDebug.push({
              symbol,
              address: token.address,
              oldPrice: token.priceUSD,
              newPrice: priceViaStablecoin.toString(),
              method: 'stablecoin-pair'
            })
          } else {
            // For debugging
            tokenDebug.push({
              symbol,
              address: token.address,
              oldPrice: token.priceUSD,
              newPrice: 'Failed to calculate',
              method: 'failed'
            })
          }
        }
      } catch (error) {
        console.error(`Error calculating price for token ${token.id}:`, error)
      }
    }
    
    // 7. Update pair reserve USD now that token prices are set
    for (const pair of pairs) {
      try {
        const reserveUSD = await calculateReservesUSD(pair, prisma)
        pairReserveDebug.push({
          pairAddress: pair.address,
          token0: pair.token0.symbol || pair.token0.address,
          token1: pair.token1.symbol || pair.token1.address,
          reserve0: pair.reserve0,
          reserve1: pair.reserve1,
          reserveUSD
        })
      } catch (error) {
        console.error(`Error calculating reserveUSD for pair ${pair.address}:`, error)
      }
    }
    
    // 8. Update pair reserve snapshots
    try {
      await updatePairReserveSnapshots(prisma)
    } catch (error) {
      console.error(`Error updating pair reserve snapshots:`, error)
    }
    
    // 9. Return information about the update
    return NextResponse.json({
      success: true,
      message: 'Restored token prices from on-chain data',
      details: {
        clearedCacheEntries: allKeys.length,
        updatedPairs: updatedPairs.length,
        updatedTokens: updatedTokens.length,
        tokenPrices: tokenDebug,
        pairReserves: pairReserveDebug
      }
    })
  } catch (error) {
    console.error('Error restoring prices:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
}

// Helper function to calculate token price via direct stablecoin pair
async function calculatePriceViaStablecoinPair(
  token: Token, 
  allTokens: Token[], 
  allPairs: any[], 
  prismaClient: any
): Promise<number> {
  try {
    // Find direct pairs with stablecoins
    const tokenAddress = token.address.toLowerCase()
    const stablecoinPairs = allPairs.filter(pair => {
      const token0Address = pair.token0.address.toLowerCase()
      const token1Address = pair.token1.address.toLowerCase()
      
      return (
        // Token is in the pair
        (tokenAddress === token0Address || tokenAddress === token1Address) && 
        // Other token is a stablecoin
        ((token0Address === USDT_ADDRESS || token0Address === USDC_ADDRESS || 
          token1Address === USDT_ADDRESS || token1Address === USDC_ADDRESS))
      )
    })
    
    if (stablecoinPairs.length === 0) {
      // Try pairs with KKUB as an alternative
      const kkubPairs = allPairs.filter(pair => {
        const token0Address = pair.token0.address.toLowerCase()
        const token1Address = pair.token1.address.toLowerCase()
        
        return (
          // Token is in the pair
          (tokenAddress === token0Address || tokenAddress === token1Address) && 
          // Other token is KKUB
          (token0Address === KKUB_ADDRESS || token1Address === KKUB_ADDRESS)
        )
      })
      
      if (kkubPairs.length === 0) {
        return 0
      }
      
      // Use KKUB price to calculate
      const kkubToken = allTokens.find((t: Token) => t.address.toLowerCase() === KKUB_ADDRESS)
      if (!kkubToken || !kkubToken.priceUSD) {
        return 0
      }
      
      const kkubPrice = parseFloat(kkubToken.priceUSD)
      const kkubPair = kkubPairs[0]
      
      const isToken0 = tokenAddress === kkubPair.token0.address.toLowerCase()
      const token0Decimals = kkubPair.token0.decimals || 18
      const token1Decimals = kkubPair.token1.decimals || 18
      
      const reserve0 = BigInt(kkubPair.reserve0)
      const reserve1 = BigInt(kkubPair.reserve1)
      
      if (isToken0) {
        // Token is token0, KKUB is token1
        const tokenAmount = Number(reserve0) / 10 ** token0Decimals
        const kkubAmount = Number(reserve1) / 10 ** token1Decimals
        return (kkubAmount * kkubPrice) / tokenAmount
      } else {
        // Token is token1, KKUB is token0
        const tokenAmount = Number(reserve1) / 10 ** token1Decimals
        const kkubAmount = Number(reserve0) / 10 ** token0Decimals
        return (kkubAmount * kkubPrice) / tokenAmount
      }
    }
    
    // If we have a direct stablecoin pair, use it for pricing
    const stablecoinPair = stablecoinPairs[0]
    const stablecoinAddress = stablecoinPair.token0.address.toLowerCase() === tokenAddress 
      ? stablecoinPair.token1.address.toLowerCase() 
      : stablecoinPair.token0.address.toLowerCase()
    
    const isToken0 = tokenAddress === stablecoinPair.token0.address.toLowerCase()
    const token0Decimals = stablecoinPair.token0.decimals || 18
    const token1Decimals = stablecoinPair.token1.decimals || 18
    
    const reserve0 = BigInt(stablecoinPair.reserve0)
    const reserve1 = BigInt(stablecoinPair.reserve1)
    
    if (isToken0) {
      // Token is token0, stablecoin is token1
      const tokenAmount = Number(reserve0) / 10 ** token0Decimals
      const stablecoinAmount = Number(reserve1) / 10 ** token1Decimals
      return stablecoinAmount / tokenAmount
    } else {
      // Token is token1, stablecoin is token0
      const tokenAmount = Number(reserve1) / 10 ** token1Decimals
      const stablecoinAmount = Number(reserve0) / 10 ** token0Decimals
      return stablecoinAmount / tokenAmount
    }
  } catch (error) {
    console.error(`Error in calculatePriceViaStablecoinPair for ${token.symbol || token.address}:`, error)
    return 0
  }
} 