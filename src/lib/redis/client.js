// Add more debug logs to track Redis connections
let redisClient = null;

export function getRedisClient() {
  if (!redisClient) {
    try {
      console.log('Creating new Redis client instance');
      const Redis = require('ioredis');
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        console.error('No Redis URL provided in environment variable REDIS_URL');
        throw new Error('Redis URL not configured');
      }
      
      console.log(`Connecting to Redis at: ${redisUrl.includes('@') ? redisUrl.split('@').pop() : 'redis-server'}`); 
      redisClient = new Redis(redisUrl);
      
      // Add event listeners to debug connection issues
      redisClient.on('connect', () => {
        console.log('Successfully connected to Redis');
      });
      
      redisClient.on('error', (error) => {
        console.error('Redis connection error:', error);
      });
    } catch (error) {
      console.error('Error creating Redis client:', error);
      throw error;
    }
  }
  return redisClient;
} 