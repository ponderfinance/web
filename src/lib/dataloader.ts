import DataLoader from 'dataloader'
import { PrismaClient, Token, Pair } from '@prisma/client'
import { getCachedPairReserveUSDBulk } from '@/src/lib/redis/pairCache'

export function createLoaders(prisma: PrismaClient) {
  return {
    // Loader for tokens by ID
    tokenLoader: new DataLoader<string, Token | null>(async (ids: readonly string[]) => {
      const tokens = await prisma.token.findMany({
        where: { id: { in: [...ids] } },
      })

      return ids.map((id) => tokens.find((token) => token.id === id) || null)
    }),

    // Loader for tokens by address (lowercase for consistency)
    tokenByAddressLoader: new DataLoader<string, Token | null>(
      async (addresses: readonly string[]) => {
        const lowerCaseAddresses = addresses.map((a) => a.toLowerCase())
        const tokens = await prisma.token.findMany({
          where: { address: { in: lowerCaseAddresses } },
        })

        return addresses.map(
          (address) =>
            tokens.find((token) => token.address === address.toLowerCase()) || null
        )
      }
    ),

    // Loader for pairs by ID
    pairLoader: new DataLoader<string, Pair | null>(async (ids: readonly string[]) => {
      const pairs = await prisma.pair.findMany({
        where: { id: { in: [...ids] } },
      })

      return ids.map((id) => pairs.find((pair) => pair.id === id) || null)
    }),

    // Loader for pairs by address (lowercase for consistency)
    pairByAddressLoader: new DataLoader<string, Pair | null>(
      async (addresses: readonly string[]) => {
        const lowerCaseAddresses = addresses.map((a) => a.toLowerCase())
        const pairs = await prisma.pair.findMany({
          where: { address: { in: lowerCaseAddresses } },
        })

        return addresses.map(
          (address) =>
            pairs.find((pair) => pair.address === address.toLowerCase()) || null
        )
      }
    ),

    // Loader for latest reserve snapshots by pair ID
    // In dataloader.ts, optimize the reserveUSDLoader
    reserveUSDLoader: new DataLoader<string, string>(
      async (pairIds: readonly string[]) => {
        // First try to get from cache in batch
        const cachedValues = await getCachedPairReserveUSDBulk([...pairIds])

        // Identify which IDs need to be fetched from DB
        const missingIds = pairIds.filter((id) => !cachedValues[id])

        if (missingIds.length === 0) {
          // All values were in cache
          return pairIds.map((id) => cachedValues[id] || '0')
        }

        // Get snapshots for missing IDs in one query
        const snapshots = await prisma.pairReserveSnapshot.findMany({
          where: { pairId: { in: [...missingIds] } },
          orderBy: { timestamp: 'desc' },
          distinct: ['pairId'],
        })

        // Create a map of snapshotted values
        const snapshotValues = snapshots.reduce(
          (acc, snapshot) => {
            acc[snapshot.pairId] = snapshot.reserveUSD
            return acc
          },
          {} as Record<string, string>
        )

        // Return results in correct order
        return pairIds.map((id) => cachedValues[id] || snapshotValues[id] || '0')
      },
      {
        // Cache for 30 seconds in memory
        maxBatchSize: 100,
        cache: true,
        cacheMap: new Map(),
        cacheKeyFn: (key) => key,
      }
    ),
  }
}

// Define the type for our loaders
export type Loaders = ReturnType<typeof createLoaders>
