// Script to clear Redis cache for the KKUB/KOI pool data
// This will force the frontend to fetch fresh data

const { PrismaClient } = require('@prisma/client');
const { getRedisClient } = require('./src/lib/redis/client');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
  console.log('Starting cache clear for KKUB/KOI pool...');
  
  const prisma = new PrismaClient();
  const redis = getRedisClient();
  
  try {
    // First, find the KKUB/KOI pair
    const pairs = await prisma.pair.findMany({
      where: {
        OR: [
          {
            token0: {
              symbol: 'KKUB'
            },
            token1: {
              symbol: 'KOI'
            }
          },
          {
            token0: {
              symbol: 'KOI'
            },
            token1: {
              symbol: 'KKUB'
            }
          }
        ]
      },
      include: {
        token0: {
          select: {
            id: true,
            symbol: true
          }
        },
        token1: {
          select: {
            id: true,
            symbol: true
          }
        }
      }
    });
    
    if (pairs.length === 0) {
      console.log('Could not find KKUB/KOI pair. Please check token symbols.');
      return;
    }
    
    // Clear cache for each pair
    for (const pair of pairs) {
      console.log(`Found pair: ${pair.token0.symbol}/${pair.token1.symbol} (${pair.id})`);
      
      // Clear pair TVL/reserveUSD cache
      const pairCacheKey = `pair:${pair.id}:reserveUSD`;
      await redis.del(pairCacheKey);
      console.log(`Deleted pair cache key: ${pairCacheKey}`);
      
      // Clear token price caches
      const token0CacheKey = `token:${pair.token0.id}:priceUSD`;
      await redis.del(token0CacheKey);
      console.log(`Deleted token cache key: ${token0CacheKey}`);
      
      const token1CacheKey = `token:${pair.token1.id}:priceUSD`;
      await redis.del(token1CacheKey);
      console.log(`Deleted token cache key: ${token1CacheKey}`);
      
      // Check if keys have been deleted
      const pairCacheExists = await redis.exists(pairCacheKey);
      const token0CacheExists = await redis.exists(token0CacheKey);
      const token1CacheExists = await redis.exists(token1CacheKey);
      
      console.log('Cache deletion status:', {
        pairCache: pairCacheExists ? 'still exists' : 'deleted',
        token0Cache: token0CacheExists ? 'still exists' : 'deleted',
        token1Cache: token1CacheExists ? 'still exists' : 'deleted'
      });
    }
    
    console.log('Cache clear completed');
  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    await redis.quit();
    await prisma.$disconnect();
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 