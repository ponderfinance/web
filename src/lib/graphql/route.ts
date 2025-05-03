// app/api/graphql/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQL } from '@/src/lib/graphql/server'
import { getRedisClient } from '@/src/lib/redis/client'

// Initialize Redis connection on server start
const redis = getRedisClient()

// Background tasks have been removed - all background processing happens in ponder-indexer

export async function POST(request: NextRequest) {
  try {
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
  } catch (error: any) {
    console.error('GraphQL error:', error)
    
    // Return a JSON response with error details
    return NextResponse.json(
      { 
        errors: [
          { 
            message: error.message || 'Internal Server Error',
            ...(error.locations ? { locations: error.locations } : {}),
            ...(error.path ? { path: error.path } : {})
          }
        ] 
      },
      { status: error.statusCode || 500 }
    )
  }
}
