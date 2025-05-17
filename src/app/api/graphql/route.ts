import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQL } from '@/src/lib/graphql/server'
import { getRedisClient } from '@/src/lib/redis'
import prisma from '@/src/lib/db/prisma'

// Initialize Redis connection on server start
const redis = getRedisClient()

export async function POST(request: NextRequest) {
  const startTime = performance.now()
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

    const endTime = performance.now()
    const duration = endTime - startTime
    
    // Log query times over 500ms
    if (duration > 500) {
      console.log(`Slow GraphQL query (${Math.round(duration)}ms): ${query.substring(0, 100)}...`)
    }

    // Return the result
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('GraphQL error:', error)
    
    const endTime = performance.now()
    console.error(`Failed GraphQL query (${Math.round(endTime - startTime)}ms)`)
    
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
