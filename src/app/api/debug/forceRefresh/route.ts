import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/src/lib/redis/client'
import { TokenPriceService } from '@/src/lib/services/tokenPriceService'
import prisma from '@/src/lib/db/prisma'
import { createPublicClient, http } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'

// Minimal ABI for the getReserves function
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
  }
] as const

// Create a public client for blockchain interactions
const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0])
})

// Stablecoin addresses (lowercase)
const STABLECOINS = {
  USDT: '0x7d984c24d2499d840eb3b7016077164e15e5faa6', // USDT
  USDC: '0x5088f7d0404d35f83b4d6c112d906cc818c78665'  // USDC
}

// KKUB address (the native wrapped token)
const KKUB_ADDRESS = '0x67ebd850304c70d983b2d1b93ea79c7cd6c3f6b5'

export async function GET(request: NextRequest) {
  try {
    // 1. Clear all Redis cache
    const redis = getRedisClient()
    const tokenKeys = await redis.keys('token:*')
    const pairKeys = await redis.keys('pair:*')
    const allKeys = [...tokenKeys, ...pairKeys]
    
    if (allKeys.length > 0) {
      await redis.del(...allKeys)
    }
    
    // 2. Get all pairs and update their reserves from blockchain
    const pairs = await prisma.pair.findMany({
      select: {
        id: true,
        address: true,
        token0Id: true,
        token1Id: true
      }
    })
    
    const updatedPairs = []
    
    for (const pair of pairs) {
      try {
        // Get on-chain reserves
        const reserves = await publicClient.readContract({
          address: pair.address as `0x${string}`,
          abi: PAIR_ABI,
          functionName: 'getReserves'
        })
        
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
        console.error(`Error updating reserves for pair ${pair.id}:`, error)
      }
    }
    
    // 3. Reset token prices in database to prepare for recalculation
    await prisma.token.updateMany({
      data: {
        priceUSD: null,
        lastPriceUpdate: null
      }
    })
    
    // 4. Calculate stablecoin prices based on actual reserves instead of fixing to $1
    const usdt = await prisma.token.findUnique({
      where: { address: STABLECOINS.USDT.toLowerCase() }
    });
    
    // Also get USDC if it exists
    const usdcToken = await prisma.token.findUnique({
      where: { address: STABLECOINS.USDC.toLowerCase() }
    });
    
    // 5. Calculate KKUB price next (if present), as it's often used as a reference
    const kkubToken = await prisma.token.findUnique({
      where: { address: KKUB_ADDRESS.toLowerCase() }
    });
    
    if (kkubToken) {
      try {
        // Force calculation using stablecoins as reference
        const kkubPrice = await TokenPriceService.getReliableTokenUsdPrice({
          id: kkubToken.id,
          address: kkubToken.address,
          decimals: kkubToken.decimals || 18,
          symbol: kkubToken.symbol || 'KKUB'
        }, prisma);
        
        if (kkubPrice > 0) {
          await prisma.token.update({
            where: { id: kkubToken.id },
            data: {
              priceUSD: kkubPrice.toString(),
              lastPriceUpdate: new Date()
            }
          });
          
          console.log(`Set KKUB price to $${kkubPrice}`);
          
          // Also cache KKUB price
          await redis.set(`token:${kkubToken.id}:priceUSD`, kkubPrice.toString(), 'EX', 300);
        }
      } catch (error) {
        console.error(`Error calculating KKUB price:`, error);
      }
    }
    
    // Now calculate the stablecoin prices based on reserves with KKUB
    if (usdt) {
      try {
        const usdtPrice = await TokenPriceService.getTokenPriceUSD(usdt.id);
        if (usdtPrice > 0) {
          await prisma.token.update({
            where: { id: usdt.id },
            data: {
              priceUSD: usdtPrice.toString(),
              lastPriceUpdate: new Date()
            }
          });
          
          console.log(`Set USDT price to $${usdtPrice} (actual value)`);
          await redis.set(`token:${usdt.id}:priceUSD`, usdtPrice.toString(), 'EX', 300);
        }
      } catch (error) {
        console.error(`Error calculating USDT price:`, error);
      }
    }
    
    if (usdcToken) {
      try {
        const usdcPrice = await TokenPriceService.getTokenPriceUSD(usdcToken.id);
        if (usdcPrice > 0) {
          await prisma.token.update({
            where: { id: usdcToken.id },
            data: {
              priceUSD: usdcPrice.toString(),
              lastPriceUpdate: new Date()
            }
          });
          
          console.log(`Set USDC price to $${usdcPrice} (actual value)`);
          await redis.set(`token:${usdcToken.id}:priceUSD`, usdcPrice.toString(), 'EX', 300);
        }
      } catch (error) {
        console.error(`Error calculating USDC price:`, error);
      }
    }
    
    // 6. Get all remaining tokens and recalculate their prices
    const tokens = await prisma.token.findMany({
      where: {
        address: {
          notIn: [
            STABLECOINS.USDT.toLowerCase(),
            STABLECOINS.USDC.toLowerCase(),
            KKUB_ADDRESS.toLowerCase()
          ]
        }
      },
      select: {
        id: true,
        address: true, 
        decimals: true,
        symbol: true
      }
    })
    
    const updatedTokenPrices = []
    
    for (const token of tokens) {
      try {
        // Force recalculation of token price
        const price = await TokenPriceService.getReliableTokenUsdPrice({
          id: token.id,
          address: token.address,
          decimals: token.decimals || 18,
          symbol: token.symbol || undefined
        }, prisma)
        
        if (price > 0) {
          updatedTokenPrices.push({
            id: token.id,
            symbol: token.symbol,
            price
          })
          
          // Update in database
          await prisma.token.update({
            where: { id: token.id },
            data: {
              priceUSD: price.toString(),
              lastPriceUpdate: new Date()
            }
          })
          
          // Also cache the price
          await redis.set(`token:${token.id}:priceUSD`, price.toString(), 'EX', 300)
        }
      } catch (error) {
        console.error(`Error recalculating price for token ${token.id}:`, error)
      }
    }
    
    // 7. Trigger reserve snapshot update to recalculate TVL
    try {
      // Update pair reserve snapshots to recalculate TVL
      const { updatePairReserveSnapshots } = await import('@/src/services/reserveSnapshotService')
      await updatePairReserveSnapshots(prisma)
    } catch (error) {
      console.error(`Error updating pair reserve snapshots:`, error)
    }
    
    return NextResponse.json({
      success: true,
      message: 'Completed force refresh of all token prices',
      details: {
        clearedCacheEntries: allKeys.length,
        updatedPairs: updatedPairs.length,
        updatedTokenPrices: updatedTokenPrices.length,
        baseTokens: {
          USDT: usdt ? await redis.get(`token:${usdt.id}:priceUSD`) : 'not found',
          USDC: usdcToken ? await redis.get(`token:${usdcToken.id}:priceUSD`) : 'not found',
          KKUB: kkubToken ? await redis.get(`token:${kkubToken.id}:priceUSD`) : 'not found'
        },
        tokens: updatedTokenPrices.map(t => `${t.symbol || t.id}: ${t.price}`)
      }
    })
  } catch (error) {
    console.error('Error in force refresh:', error)
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 })
  }
} 