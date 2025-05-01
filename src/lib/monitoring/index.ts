/**
 * Monitoring System
 * 
 * Provides basic monitoring and error tracking functionality.
 * This can be expanded to use external monitoring services in the future.
 */

import { getRedisClient } from '@/src/lib/redis/client';
import prisma from '@/src/lib/db/prisma';

// Track metrics in memory for basic monitoring
const metrics: {
  counters: Record<string, number>;
  gauges: Record<string, number>;
  histograms: Record<string, number[]>;
  lastReportTime: number;
} = {
  counters: {},
  gauges: {},
  histograms: {},
  lastReportTime: Date.now(),
};

/**
 * Capture an exception for monitoring
 */
export function captureException(error: Error | any, context: Record<string, any> = {}): void {
  // In production, this could send to Sentry, DataDog, etc.
  console.error('[MONITORING] Exception captured:', {
    error: error instanceof Error ? {
      message: error.message,
      name: error.name,
      stack: error.stack,
    } : error,
    context,
    timestamp: new Date().toISOString(),
  });
  
  // Increment error count metric
  incrementCounter('errors.total', 1);
  
  // Increment specific error type
  if (error instanceof Error) {
    incrementCounter(`errors.byType.${error.name}`, 1);
  }
}

/**
 * Record a metric for monitoring
 */
export function recordMetric(
  name: string, 
  value: number, 
  tags: Record<string, string> = {}
): void {
  // In production, this could send to Prometheus, StatsD, etc.
  console.debug('[MONITORING] Metric recorded:', {
    name,
    value,
    tags,
    timestamp: new Date().toISOString(),
  });
  
  // Store the metric in memory for basic reporting
  if (name.endsWith('.histogram')) {
    if (!metrics.histograms[name]) {
      metrics.histograms[name] = [];
    }
    metrics.histograms[name].push(value);
    
    // Prevent unbounded growth
    if (metrics.histograms[name].length > 1000) {
      metrics.histograms[name] = metrics.histograms[name].slice(-1000);
    }
  } else {
    metrics.gauges[name] = value;
  }
  
  // Periodically report metrics (every 60 seconds)
  const now = Date.now();
  if (now - metrics.lastReportTime > 60000) {
    reportMetrics();
    metrics.lastReportTime = now;
  }
}

/**
 * Increment a counter metric
 */
export function incrementCounter(name: string, incrementBy: number = 1): void {
  if (!metrics.counters[name]) {
    metrics.counters[name] = 0;
  }
  metrics.counters[name] += incrementBy;
  
  // Also record as a gauge for time-series reporting
  metrics.gauges[`${name}.rate`] = incrementBy;
}

/**
 * Report current metrics to console
 */
function reportMetrics(): void {
  console.info('[MONITORING] Current metrics:', {
    counters: metrics.counters,
    gauges: metrics.gauges,
    histogramStats: Object.entries(metrics.histograms).reduce((acc, [key, values]) => {
      if (values.length === 0) return acc;
      
      // Calculate simple stats
      const sorted = [...values].sort((a, b) => a - b);
      acc[key] = {
        count: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: values.reduce((sum, v) => sum + v, 0) / values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
      };
      return acc;
    }, {} as Record<string, any>),
    timestamp: new Date().toISOString(),
  });
}

/**
 * Start timing a span for performance tracking
 */
export function startSpan(name: string, tags: Record<string, string> = {}): () => void {
  const startTime = performance.now();
  
  return () => {
    const duration = performance.now() - startTime;
    recordMetric(`${name}.duration.histogram`, duration, tags);
  };
}

/**
 * Check database connection health
 */
async function checkDatabaseHealth(): Promise<{
  status: 'ok' | 'error';
  responseTime: number;
  error?: string;
}> {
  const startTime = performance.now();
  
  try {
    // Simple query to check if database is responsive
    await prisma.$queryRaw`SELECT 1`;
    
    return {
      status: 'ok',
      responseTime: performance.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'error',
      responseTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check Redis connection health
 */
async function checkRedisHealth(): Promise<{
  status: 'ok' | 'error';
  responseTime: number;
  error?: string;
}> {
  const startTime = performance.now();
  
  try {
    const redis = getRedisClient();
    const pong = await redis.ping();
    
    return {
      status: 'ok',
      responseTime: performance.now() - startTime,
    };
  } catch (error) {
    return {
      status: 'error',
      responseTime: performance.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a health check result
 */
export async function createHealthCheck() {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const allHealthy = dbHealth.status === 'ok' && redisHealth.status === 'ok';
  
  return {
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || 'unknown',
    services: {
      database: dbHealth,
      redis: redisHealth,
    },
    metrics: {
      errorCount: metrics.counters['errors.total'] || 0,
      currentLoad: metrics.gauges['system.load'] || 0,
      memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
    }
  };
}

/**
 * Creates a middleware function for health checks
 */
export function healthCheckMiddleware(req: Request, res: any) {
  return createHealthCheck()
    .then(health => {
      const status = health.status === 'ok' ? 200 : 503;
      res.status(status).json(health);
    })
    .catch(error => {
      res.status(500).json({
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
    });
}

// Initialize monitoring
incrementCounter('app.starts', 1);
recordMetric('system.load', 0);

// Update system metrics periodically
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  recordMetric('system.memory.heap', memoryUsage.heapUsed / 1024 / 1024); // MB
  recordMetric('system.memory.rss', memoryUsage.rss / 1024 / 1024); // MB
  
  // In a real app, we would collect CPU and other system metrics
  // This is just a simple placeholder
  recordMetric('system.load', Math.random() * 2); // Simulated load
}, 5000); 