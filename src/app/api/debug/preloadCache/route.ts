import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/src/lib/db/prisma'
import { preloadCacheFromSnapshots } from '@/src/lib/redis/pairCache'

export async function GET(request: NextRequest) {
  try {
    await preloadCacheFromSnapshots(prisma)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error preloading cache:', error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
