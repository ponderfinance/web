import { NextRequest, NextResponse } from 'next/server';
import { createHealthCheck } from '@/src/lib/monitoring';

export async function GET(request: NextRequest) {
  try {
    const healthCheck = await createHealthCheck();
    
    // Return 200 if healthy, 503 if degraded
    const status = healthCheck.status === 'ok' ? 200 : 503;
    
    return NextResponse.json(healthCheck, { status });
  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
} 