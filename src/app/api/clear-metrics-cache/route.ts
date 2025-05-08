import { NextResponse } from 'next/server';
import { clearProtocolMetricsCache } from '@/src/lib/redis/exports';

export async function GET() {
  try {
    await clearProtocolMetricsCache();
    return NextResponse.json({ success: true, message: 'Protocol metrics cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing protocol metrics cache:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear protocol metrics cache' }, { status: 500 });
  }
}

export async function POST() {
  return GET();
} 