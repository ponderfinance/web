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

// Define token type
type Token = {
  id: string;
  address: string;
  symbol?: string | null;
  decimals?: number | null;
  priceUSD?: string | null;
}

export async function GET(request: NextRequest) {
  try {
    // Check if we're in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({
        success: false,
        message: 'This endpoint is only available in development mode'
      }, { status: 403 })
    }

    console.log('Starting token price refresh...')
    
    // Clear the token price cache first
    await TokenPriceService.clearTokenPriceCache()
    console.log('Token price cache cleared')
    
    // Get all tokens
    const tokens = await prisma.token.findMany({
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    })
    
    console.log(`Found ${tokens.length} tokens to refresh`)
    
    // Process each token
    const results = await Promise.all(tokens.map(async (token: Token) => {
      try {
        // Force a new price calculation
        const price = await TokenPriceService.getReliableTokenUsdPrice({
          id: token.id,
          address: token.address,
          decimals: token.decimals || 18,
          symbol: token.symbol || undefined
        }, prisma)
        
        // Update the database directly
        if (price > 0) {
          await prisma.token.update({
            where: { id: token.id },
            data: { priceUSD: price.toString() }
          })
          
          return {
            token: token.symbol || token.address,
            oldPrice: token.priceUSD || '0',
            newPrice: price.toString(),
            success: true
          }
        } else {
          return {
            token: token.symbol || token.address,
            oldPrice: token.priceUSD || '0',
            newPrice: '0',
            success: false,
            reason: 'No valid price found'
          }
        }
      } catch (error) {
        return {
          token: token.symbol || token.address,
          oldPrice: token.priceUSD || '0',
          success: false,
          reason: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }))
    
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    
    return NextResponse.json({
      success: true,
      chain: CURRENT_CHAIN.name,
      totalTokens: tokens.length,
      refreshed: successful,
      failed: failed,
      details: results
    })
  } catch (error) {
    console.error('Error refreshing token prices:', error)
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 })
  }
} 