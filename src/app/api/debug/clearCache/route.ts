import { NextRequest, NextResponse } from 'next/server'
import { getRedisClient } from '@/src/lib/redis/client'
import { TokenPriceService } from '@/src/lib/services/tokenPriceService'

export async function GET(request: NextRequest) {
  try {
    // Get Redis client
    const redis = getRedisClient()
    
    // Get all keys in Redis
    const tokenKeys = await redis.keys('token:*')
    const pairKeys = await redis.keys('pair:*')
    const allKeys = [...tokenKeys, ...pairKeys]
    
    // If there are keys, delete them
    if (allKeys.length > 0) {
      await redis.del(...allKeys)
    }
    
    // Also call the token price cache clearing function
    await TokenPriceService.clearTokenPriceCache()
    
    return NextResponse.json({ 
      success: true, 
      message: `Successfully cleared ${allKeys.length} cache entries`,
      details: {
        tokenKeys: tokenKeys.length,
        pairKeys: pairKeys.length
      }
    })
  } catch (error) {
    console.error('Error clearing cache:', error)
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 })
  }
} 