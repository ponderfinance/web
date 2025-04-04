import { Redis } from 'ioredis'

export function getRedisClient(): Redis
export function closeRedisConnection(): Promise<void> 