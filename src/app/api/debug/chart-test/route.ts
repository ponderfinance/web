import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { PriceChartService } from '@/src/lib/services/priceChartService';

// Initialize Prisma client
const prisma = new PrismaClient();

export async function GET() {
  try {
    // Test USDT address
    const tokenAddress = '0x7d984C24d2499D840eB3b7016077164e15E5faA6';
    
    // Find the token by address
    const token = await prisma.token.findFirst({
      where: { address: tokenAddress.toLowerCase() },
      select: {
        id: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    if (!token) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }
    
    // Get chart data
    const chartData = await PriceChartService.getTokenPriceChartData(
      tokenAddress.toLowerCase(),
      token.id,
      '1d',
      100,
      prisma
    );
    
    // Return the chart data and token info
    return NextResponse.json({
      token,
      chartDataCount: chartData.length,
      chartData: chartData.slice(0, 10), // Return only first 10 points to avoid bloating response
      firstPoint: chartData[0],
      lastPoint: chartData[chartData.length - 1]
    });
  } catch (error) {
    console.error('Error in chart-test API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 