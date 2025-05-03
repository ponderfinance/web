import { updatePairReserveSnapshots, cleanupOldSnapshots } from './reserveSnapshotService'
import prisma from '@/src/lib/db/prisma'
import { VolumeMetricsService } from '@/src/lib/services/volumeMetricsService'

// Time intervals in milliseconds
const UPDATE_INTERVAL = 5 * 60 * 1000 // 5 minutes
const CLEANUP_INTERVAL = 60 * 60 * 1000 // 1 hour
const METRICS_INTERVAL = 5 * 60 * 1000 // 5 minutes

export function startScheduler(): void {
  console.log('Starting scheduler...')

  // Immediately run the first update
  updatePairReserveSnapshots(prisma)
  VolumeMetricsService.updateAllMetrics()

  // Schedule regular updates
  setInterval(() => {
    updatePairReserveSnapshots(prisma)
  }, UPDATE_INTERVAL)

  // Clean up old snapshots periodically
  setInterval(() => {
    cleanupOldSnapshots(prisma)
  }, CLEANUP_INTERVAL)
  
  // Update all volume metrics
  setInterval(() => {
    VolumeMetricsService.updateAllMetrics()
  }, METRICS_INTERVAL)

  console.log('Scheduler started')
}
