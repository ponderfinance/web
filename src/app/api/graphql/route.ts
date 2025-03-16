import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQL } from '@/src/lib/graphql/server'
import { initBackgroundTasks } from '@/src/lib/backgroundTasks'
import { getRedisClient } from '@/src/lib/redis/client'
import { preloadCacheFromSnapshots } from '@/src/lib/redis/pairCache'
import prisma from '@/src/lib/db/prisma'

// Initialize Redis connection on server start
const redis = getRedisClient()

// Preload cache when server starts
if (process.env.NODE_ENV === 'production') {
  initBackgroundTasks()
  preloadCacheFromSnapshots(prisma).catch((err) => {
    console.error('Failed to preload cache on startup:', err)
  })
}

// In development, track if we've preloaded cache
let hasPreloaded = false

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      initBackgroundTasks()

      // Preload cache on first request in development
      if (!hasPreloaded) {
        hasPreloaded = true
        preloadCacheFromSnapshots(prisma).catch((err) => {
          console.error('Failed to preload cache on first request:', err)
        })
      }
    }

    const body = await request.json()
    const { query, variables } = body

    if (!query) {
      return NextResponse.json(
        { errors: [{ message: 'Query is required' }] },
        { status: 400 }
      )
    }

    // Execute the GraphQL query
    const result = await executeGraphQL({
      query,
      variables,
      contextValue: { prisma, req: request },
    })

    // Return the result
    return NextResponse.json(result)
  } catch (error) {
    console.error('API route error:', error)

    return NextResponse.json(
      {
        errors: [
          {
            message:
              error instanceof Error ? error.message : 'An internal error occurred',
          },
        ],
      },
      { status: 500 }
    )
  }
}
