/**
 * Task Queue System
 * 
 * Provides a background job processing system with:
 * - Job scheduling with priorities
 * - Automatic retries with exponential backoff
 * - Concurrency control
 * - Job persistence using Redis
 */

import Redis from 'ioredis';
import { getRedisClient } from '../redis/client';
import { withRetry } from '../errors';
import { recordMetric, startSpan } from '../monitoring';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

// Task priority levels
export enum TaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

// Task status
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Task definition
export interface Task<TPayload = any, TResult = any> {
  id: string;
  type: string;
  payload: TPayload;
  priority: TaskPriority;
  status: TaskStatus;
  result?: TResult;
  error?: string;
  retries: number;
  maxRetries: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string;
  startedAt?: string;
  completedAt?: string;
}

// Task handler function type
export type TaskHandler<TPayload = any, TResult = any> = (
  payload: TPayload,
  taskId: string
) => Promise<TResult>;

// Redis key prefixes
const QUEUE_KEY_PREFIX = 'taskqueue:queue:';
const TASK_KEY_PREFIX = 'taskqueue:task:';
const PROCESSING_SET_KEY = 'taskqueue:processing';
const REGISTRY_KEY = 'taskqueue:registry';

/**
 * Task Queue Manager
 * Handles task scheduling, persistence, and execution
 */
export class TaskQueue {
  private redis: Redis;
  private handlers: Map<string, TaskHandler> = new Map();
  private isRunning: boolean = false;
  private concurrency: number = 5;
  private processingTasks: Set<string> = new Set();
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor(redisClient?: Redis, options: { concurrency?: number } = {}) {
    this.redis = redisClient || getRedisClient();
    this.concurrency = options.concurrency || 5;
  }
  
  /**
   * Register a task handler
   */
  registerTaskHandler<TPayload, TResult>(
    taskType: string,
    handler: TaskHandler<TPayload, TResult>
  ): void {
    this.handlers.set(taskType, handler as TaskHandler);
    
    // Register the task type in Redis for discovery
    this.redis.sadd(REGISTRY_KEY, taskType).catch(err => {
      console.error(`Failed to register task type ${taskType}:`, err);
    });
    
    console.log(`Registered handler for task type: ${taskType}`);
  }
  
  /**
   * Enqueue a task for background processing
   */
  async enqueueTask<TPayload>(
    taskType: string,
    payload: TPayload,
    options: {
      priority?: TaskPriority;
      maxRetries?: number;
      scheduledAt?: Date;
    } = {}
  ): Promise<string> {
    const taskId = uuidv4();
    const now = new Date().toISOString();
    const priority = options.priority || TaskPriority.MEDIUM;
    const maxRetries = options.maxRetries || 3;
    const scheduledAt = options.scheduledAt?.toISOString();
    
    // Create task object
    const task: Task<TPayload> = {
      id: taskId,
      type: taskType,
      payload,
      priority,
      status: TaskStatus.PENDING,
      retries: 0,
      maxRetries,
      createdAt: now,
      updatedAt: now,
      scheduledAt,
    };
    
    // Store the task in Redis
    const taskKey = `${TASK_KEY_PREFIX}${taskId}`;
    const queueKey = `${QUEUE_KEY_PREFIX}${priority}`;
    
    // Store task and add to appropriate queue
    const pipeline = this.redis.pipeline();
    pipeline.set(taskKey, JSON.stringify(task));
    
    // If scheduled for the future, use sorted set with score as timestamp
    if (scheduledAt) {
      const scheduledTime = new Date(scheduledAt).getTime();
      pipeline.zadd(`${queueKey}:scheduled`, scheduledTime, taskId);
    } else {
      // Otherwise, add to regular queue
      pipeline.lpush(queueKey, taskId);
    }
    
    try {
      await pipeline.exec();
      recordMetric('taskQueue.enqueuedTasks', 1, { type: taskType, priority });
      return taskId;
    } catch (error) {
      console.error(`Failed to enqueue task ${taskId}:`, error);
      throw error;
    }
  }
  
  /**
   * Start the task queue worker
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log(`Starting task queue worker with concurrency ${this.concurrency}`);
    
    // Start polling for tasks
    this.pollingInterval = setInterval(() => {
      this.pollTasks();
    }, 1000);
    
    // Start polling for delayed tasks
    setInterval(() => {
      this.pollScheduledTasks();
    }, 10000);
    
    // Process any tasks that were left in processing state
    this.recoverStalledTasks();
  }
  
  /**
   * Stop the task queue worker
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    console.log('Stopping task queue worker');
    
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
  
  /**
   * Get information about a task
   */
  async getTaskInfo<TPayload = any, TResult = any>(taskId: string): Promise<Task<TPayload, TResult> | null> {
    try {
      const taskKey = `${TASK_KEY_PREFIX}${taskId}`;
      const taskData = await this.redis.get(taskKey);
      
      if (!taskData) return null;
      
      return JSON.parse(taskData) as Task<TPayload, TResult>;
    } catch (error) {
      console.error(`Failed to get task info for ${taskId}:`, error);
      return null;
    }
  }
  
  /**
   * Poll for new tasks to process
   */
  private async pollTasks(): Promise<void> {
    if (!this.isRunning) return;
    
    // Check if we have capacity to process more tasks
    const availableSlots = this.concurrency - this.processingTasks.size;
    if (availableSlots <= 0) return;
    
    // Try to get tasks from queues in priority order
    const priorities = [
      TaskPriority.HIGH,
      TaskPriority.MEDIUM,
      TaskPriority.LOW,
    ];
    
    for (const priority of priorities) {
      const queueKey = `${QUEUE_KEY_PREFIX}${priority}`;
      
      for (let i = 0; i < availableSlots; i++) {
        // Try to pop a task from the queue
        const taskId = await this.redis.rpop(queueKey);
        
        if (!taskId) break; // No more tasks in this queue
        
        // Process the task
        this.processTask(taskId).catch(err => {
          console.error(`Failed to process task ${taskId}:`, err);
        });
      }
    }
  }
  
  /**
   * Poll for scheduled tasks that are now due
   */
  private async pollScheduledTasks(): Promise<void> {
    if (!this.isRunning) return;
    
    const now = Date.now();
    const priorities = [
      TaskPriority.HIGH,
      TaskPriority.MEDIUM,
      TaskPriority.LOW,
    ];
    
    for (const priority of priorities) {
      const scheduledQueueKey = `${QUEUE_KEY_PREFIX}${priority}:scheduled`;
      const queueKey = `${QUEUE_KEY_PREFIX}${priority}`;
      
      // Get tasks scheduled before now
      const dueTasks = await this.redis.zrangebyscore(
        scheduledQueueKey,
        0,
        now
      );
      
      if (dueTasks.length === 0) continue;
      
      // Move due tasks to the regular queue
      const pipeline = this.redis.pipeline();
      
      for (const taskId of dueTasks) {
        // Add to regular queue
        pipeline.lpush(queueKey, taskId);
        
        // Remove from scheduled queue
        pipeline.zrem(scheduledQueueKey, taskId);
      }
      
      await pipeline.exec();
      
      console.log(`Moved ${dueTasks.length} scheduled tasks to ${priority} queue`);
      recordMetric('taskQueue.scheduledTasksProcessed', dueTasks.length, { priority });
    }
  }
  
  /**
   * Process a task
   */
  private async processTask(taskId: string): Promise<void> {
    // Mark task as processing
    this.processingTasks.add(taskId);
    const taskKey = `${TASK_KEY_PREFIX}${taskId}`;
    const finishSpan = startSpan('taskQueue.processTask');
    
    try {
      // Get task data
      const taskData = await this.redis.get(taskKey);
      
      if (!taskData) {
        console.error(`Task ${taskId} not found`);
        this.processingTasks.delete(taskId);
        finishSpan();
        return;
      }
      
      const task = JSON.parse(taskData) as Task;
      
      // Update task status
      task.status = TaskStatus.PROCESSING;
      task.startedAt = new Date().toISOString();
      task.updatedAt = task.startedAt;
      await this.redis.set(taskKey, JSON.stringify(task));
      
      // Add to processing set
      await this.redis.zadd(PROCESSING_SET_KEY, Date.now(), taskId);
      
      // Get the handler
      const handler = this.handlers.get(task.type);
      
      if (!handler) {
        throw new Error(`No handler registered for task type ${task.type}`);
      }
      
      // Execute the task with retry logic
      const result = await withRetry(
        () => handler(task.payload, taskId),
        {
          maxRetries: task.maxRetries,
          initialDelayMs: 100,
          maxDelayMs: 5000,
          onRetry: (error, attempt) => {
            console.warn(`Retry ${attempt} for task ${taskId} due to error: ${error.message}`);
            task.retries = attempt;
            task.updatedAt = new Date().toISOString();
            this.redis.set(taskKey, JSON.stringify(task)).catch(err => {
              console.error(`Failed to update retry count for task ${taskId}:`, err);
            });
            recordMetric('taskQueue.taskRetries', 1, { type: task.type });
          },
        }
      );
      
      // Update task as completed
      task.status = TaskStatus.COMPLETED;
      task.result = result;
      task.completedAt = new Date().toISOString();
      task.updatedAt = task.completedAt;
      await this.redis.set(taskKey, JSON.stringify(task));
      
      // Remove from processing set
      await this.redis.zrem(PROCESSING_SET_KEY, taskId);
      
      console.log(`Task ${taskId} completed successfully`);
      recordMetric('taskQueue.tasksCompleted', 1, { type: task.type });
    } catch (error) {
      console.error(`Task ${taskId} failed:`, error);
      
      try {
        // Update task as failed
        const taskData = await this.redis.get(taskKey);
        
        if (taskData) {
          const task = JSON.parse(taskData) as Task;
          task.status = TaskStatus.FAILED;
          task.error = error instanceof Error ? error.message : String(error);
          task.updatedAt = new Date().toISOString();
          
          await this.redis.set(taskKey, JSON.stringify(task));
          
          // Record metric inside the if block where task is defined
          recordMetric('taskQueue.tasksFailed', 1, { type: task.type || 'unknown' });
        }
        
        // Remove from processing set
        await this.redis.zrem(PROCESSING_SET_KEY, taskId);
      } catch (err) {
        console.error(`Failed to update failed task ${taskId}:`, err);
      }
    } finally {
      // Remove from local processing set
      this.processingTasks.delete(taskId);
      finishSpan();
    }
  }
  
  /**
   * Recover tasks that were left in processing state
   */
  private async recoverStalledTasks(): Promise<void> {
    try {
      // Get all tasks in processing state
      const stalledTasks = await this.redis.zrange(PROCESSING_SET_KEY, 0, -1);
      
      if (stalledTasks.length === 0) return;
      
      console.log(`Found ${stalledTasks.length} stalled tasks to recover`);
      
      const pipeline = this.redis.pipeline();
      
      for (const taskId of stalledTasks) {
        try {
          // Get task data
          const taskKey = `${TASK_KEY_PREFIX}${taskId}`;
          const taskData = await this.redis.get(taskKey);
          
          if (!taskData) {
            // Remove from processing set if task doesn't exist
            pipeline.zrem(PROCESSING_SET_KEY, taskId);
            continue;
          }
          
          const task = JSON.parse(taskData) as Task;
          
          // Check if task has exceeded max retries
          if (task.retries >= task.maxRetries) {
            // Mark as failed
            task.status = TaskStatus.FAILED;
            task.error = 'Task recovery failed: exceeded maximum retries';
            task.updatedAt = new Date().toISOString();
            pipeline.set(taskKey, JSON.stringify(task));
            pipeline.zrem(PROCESSING_SET_KEY, taskId);
          } else {
            // Put back in appropriate queue
            const queueKey = `${QUEUE_KEY_PREFIX}${task.priority}`;
            pipeline.lpush(queueKey, taskId);
            pipeline.zrem(PROCESSING_SET_KEY, taskId);
            
            // Update status back to pending
            task.status = TaskStatus.PENDING;
            task.retries += 1;
            task.updatedAt = new Date().toISOString();
            pipeline.set(taskKey, JSON.stringify(task));
          }
        } catch (err) {
          console.error(`Failed to recover task ${taskId}:`, err);
        }
      }
      
      await pipeline.exec();
      recordMetric('taskQueue.stalledTasksRecovered', stalledTasks.length);
    } catch (error) {
      console.error('Failed to recover stalled tasks:', error);
    }
  }
  
  /**
   * Clean up completed and failed tasks older than a certain age
   */
  async cleanupOldTasks(olderThanDays: number = 7): Promise<number> {
    try {
      const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
      let deletedCount = 0;
      
      // Scan through all task keys
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${TASK_KEY_PREFIX}*`,
          'COUNT',
          1000
        );
        
        cursor = nextCursor;
        
        if (keys.length === 0) continue;
        
        // Check each task
        for (const key of keys) {
          const taskData = await this.redis.get(key);
          
          if (!taskData) continue;
          
          const task = JSON.parse(taskData) as Task;
          
          // Only delete completed or failed tasks
          if (
            (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
            task.updatedAt
          ) {
            const updatedAt = new Date(task.updatedAt).getTime();
            
            if (updatedAt < cutoffTime) {
              await this.redis.del(key);
              deletedCount++;
            }
          }
        }
      } while (cursor !== '0');
      
      console.log(`Cleaned up ${deletedCount} old tasks`);
      recordMetric('taskQueue.tasksCleanedUp', deletedCount);
      
      return deletedCount;
    } catch (error) {
      console.error('Failed to clean up old tasks:', error);
      return 0;
    }
  }
}

// Singleton instance
let taskQueueInstance: TaskQueue | null = null;

/**
 * Get or create the task queue instance
 */
export function getTaskQueue(options?: { concurrency?: number }): TaskQueue {
  if (!taskQueueInstance) {
    taskQueueInstance = new TaskQueue(undefined, options);
  }
  return taskQueueInstance;
}

/**
 * Initialize background task processing
 */
export function initTaskQueue(options?: { concurrency?: number }): void {
  const taskQueue = getTaskQueue(options);
  
  // Register common task types
  taskQueue.registerTaskHandler('updateTokenPrices', async () => {
    const { tokenPriceOracle } = require('./tokenPriceOracle');
    return await tokenPriceOracle.updateAllTokenPrices();
  });
  
  taskQueue.registerTaskHandler('cleanupOldTasks', async (payload: { olderThanDays: number }) => {
    return await taskQueue.cleanupOldTasks(payload.olderThanDays);
  });
  
  taskQueue.registerTaskHandler('cleanupOldSnapshots', async () => {
    const { cleanupOldSnapshots } = require('../services/reserveSnapshotService');
    const { prisma } = require('../db/prisma');
    return await cleanupOldSnapshots(prisma);
  });
  
  // Start the queue
  taskQueue.start();
  
  // Schedule recurring tasks
  scheduleRecurringTasks();
}

/**
 * Schedule recurring tasks
 */
function scheduleRecurringTasks(): void {
  const taskQueue = getTaskQueue();
  
  // Update token prices every 5 minutes
  setInterval(() => {
    taskQueue.enqueueTask('updateTokenPrices', {}, {
      priority: TaskPriority.HIGH,
    }).catch(err => {
      console.error('Failed to schedule token price update:', err);
    });
  }, 5 * 60 * 1000);
  
  // Clean up old tasks once a day
  setInterval(() => {
    taskQueue.enqueueTask('cleanupOldTasks', { olderThanDays: 7 }, {
      priority: TaskPriority.LOW,
    }).catch(err => {
      console.error('Failed to schedule task cleanup:', err);
    });
  }, 24 * 60 * 60 * 1000);
  
  // Clean up old snapshots once a day
  setInterval(() => {
    taskQueue.enqueueTask('cleanupOldSnapshots', {}, {
      priority: TaskPriority.LOW,
    }).catch(err => {
      console.error('Failed to schedule snapshot cleanup:', err);
    });
  }, 24 * 60 * 60 * 1000);
  
  console.log('Scheduled recurring tasks');
} 