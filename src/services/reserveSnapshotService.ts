import { PrismaClient } from '@prisma/client'
import { calculateReservesUSD } from '@/src/lib/graphql/oracleUtils'

export async function updatePairReserveSnapshots(prisma: PrismaClient): Promise<void> {
  console.log('Starting pair reserve snapshot update...')

  try {
    // Get all active pairs
    const pairs = await prisma.pair.findMany()
    console.log(`Found ${pairs.length} pairs to update...`)

    // Process each pair and calculate reserveUSD
    for (const pair of pairs) {
      try {
        // Calculate reserveUSD
        const reserveUSD = await calculateReservesUSD(pair, prisma)

        // Save to snapshot table
        await prisma.pairReserveSnapshot.create({
          data: {
            pairId: pair.id,
            reserve0: pair.reserve0,
            reserve1: pair.reserve1,
            reserveUSD,
            timestamp: Math.floor(Date.now() / 1000),
          },
        })

        console.log(`Updated reserveUSD for pair ${pair.id}: ${reserveUSD}`)
      } catch (error) {
        console.error(`Error updating pair ${pair.id}:`, error)
      }
    }

    console.log('Pair reserve snapshot update completed')
  } catch (error) {
    console.error('Error in updatePairReserveSnapshots:', error)
  }
}

// Function to clean up old snapshots (keep only the N most recent for each pair)
export async function cleanupOldSnapshots(
  prisma: PrismaClient,
  keepCount = 24
): Promise<void> {
  console.log('Starting cleanup of old pair reserve snapshots...')

  try {
    // Get all unique pair IDs
    const pairIds = await prisma.pair.findMany({
      select: { id: true },
    })

    for (const { id } of pairIds) {
      // Get all snapshots for this pair, ordered by timestamp descending
      const snapshots = await prisma.pairReserveSnapshot.findMany({
        where: { pairId: id },
        orderBy: { timestamp: 'desc' },
      })

      // If we have more than keepCount snapshots, delete the oldest ones
      if (snapshots.length > keepCount) {
        const snapshotsToDelete = snapshots.slice(keepCount)

        // Delete old snapshots
        for (const snapshot of snapshotsToDelete) {
          await prisma.pairReserveSnapshot.delete({
            where: { id: snapshot.id },
          })
        }

        console.log(`Deleted ${snapshotsToDelete.length} old snapshots for pair ${id}`)
      }
    }

    console.log('Cleanup of old pair reserve snapshots completed')
  } catch (error) {
    console.error('Error in cleanupOldSnapshots:', error)
  }
}
