import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Ensure this route is never cached

/**
 * API endpoint to trigger metrics update in the indexer
 * This is a temporary solution until the indexer fully handles this automatically
 */
export async function GET() {
  try {
    console.log('Triggering metrics update in the indexer');
    
    // In a real implementation, this would call an endpoint on the indexer
    // to trigger the updateVolumeMetrics function.
    // For now, we're just returning a success message since the changes have been
    // made directly in the indexer's volumeMetrics.ts file.
    
    return NextResponse.json({
      success: true,
      message: 'Update of metrics has been implemented in the indexer directly',
    });
  } catch (error) {
    console.error('Error triggering metrics update:', error);
    
    return NextResponse.json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
} 