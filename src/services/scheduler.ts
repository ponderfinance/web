import { updatePairReserveSnapshots, cleanupOldSnapshots } from './reserveSnapshotService'
import prisma from '@/src/lib/db/prisma'

// Time intervals in milliseconds
const UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour

export function startScheduler(): void {
  console.log('Starting scheduler...')

  // Immediately run the first update
  updatePairReserveSnapshots(prisma)

  // Schedule regular updates
  setInterval(() => {
    updatePairReserveSnapshots(prisma)
  }, UPDATE_INTERVAL)

  // Clean up old snapshots periodically
  setInterval(() => {
    cleanupOldSnapshots(prisma)
  }, CLEANUP_INTERVAL)

  console.log('Scheduler started')
}
