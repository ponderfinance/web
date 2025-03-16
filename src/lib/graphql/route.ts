// app/api/graphql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQL } from '@/src/lib/graphql/server'
import { initBackgroundTasks } from '@/src/lib/backgroundTasks'
import { getRedisClient } from '@/src/lib/redis/client'

// Initialize Redis connection on server start
const redis = getRedisClient()

if (process.env.NODE_ENV === 'production') {
  initBackgroundTasks()
}

export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV !== 'production') {
      initBackgroundTasks()
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
      contextValue: { req: request },
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
