import { Redis } from 'ioredis'

// Environment-aware Redis client creation
let redisClient: Redis | null = null

export function getRedisClient(): Redis {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
    console.log(`Connecting to Redis at ${redisUrl.split('@').pop()}`) // Safe logging without credentials

    redisClient = new Redis(redisUrl, {
      retryStrategy: (times) => {
        // Retry connection with exponential backoff
        return Math.min(times * 50, 2000)
      },
      maxRetriesPerRequest: 3,
    })

    redisClient.on('error', (err) => {
      console.error('Redis connection error:', err)
    })

    redisClient.on('connect', () => {
      console.log('Successfully connected to Redis')
    })

    // Verify connection with a ping
    redisClient
      .ping()
      .then((response) => {
        console.log(`Redis ping response: ${response}`)
      })
      .catch((err) => {
        console.error('Redis ping failed:', err)
      })
  }

  return redisClient
}

// For testing and development - close the connection
export function closeRedisConnection() {
  if (redisClient) {
    redisClient.disconnect()
    redisClient = null
  }
}
