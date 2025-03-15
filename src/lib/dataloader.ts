import DataLoader from 'dataloader'
import { PrismaClient, Token, Pair } from '@prisma/client'

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
    reserveUSDLoader: new DataLoader<string, string>(
      async (pairIds: readonly string[]) => {
        // For MongoDB, we need a different approach to get the latest snapshots
        // We'll query the most recent snapshot for each pair ID
        const latestSnapshots = await Promise.all(
          [...pairIds].map(async (pairId) => {
            return prisma.pairReserveSnapshot.findFirst({
              where: { pairId },
              orderBy: { timestamp: 'desc' },
            })
          })
        )

        // Map the results back to the original pairIds order
        return pairIds.map((id) => {
          const snapshot = latestSnapshots.find((s) => s?.pairId === id)
          return snapshot ? snapshot.reserveUSD : '0'
        })
      }
    ),
  }
}

// Define the type for our loaders
export type Loaders = ReturnType<typeof createLoaders>
