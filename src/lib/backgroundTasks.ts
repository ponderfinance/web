import { startScheduler } from '../services/scheduler'

let isSchedulerStarted = false

export function initBackgroundTasks() {
  // Ensure scheduler only starts once
  if (!isSchedulerStarted) {
    startScheduler()
    isSchedulerStarted = true
    console.log('Background tasks initialized')
  }
}
