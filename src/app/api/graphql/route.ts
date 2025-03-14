import { NextRequest, NextResponse } from 'next/server'
import { executeGraphQL } from '@/src/lib/graphql/server'
import prisma from '@/src/lib/db/prisma'

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

    const result = await executeGraphQL({
      query,
      variables,
      contextValue: { prisma, req: request },
    })

    return NextResponse.json(result)
  } catch (error) {
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
