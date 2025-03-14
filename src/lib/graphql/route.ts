import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQL } from '@/src/lib/graphql/server'
import { PrismaClient } from '@prisma/client'

// Create a singleton Prisma client instance
const prisma = new PrismaClient()

export async function POST(request: NextRequest) {
  try {
    // Parse the request body
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
