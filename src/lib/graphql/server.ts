import { execute, parse } from 'graphql'
import { schema } from './schema'
import prisma from '../db/prisma'

type ExecuteGraphQLParams = {
  query: string
  variables?: Record<string, any>
  contextValue?: Record<string, any>
}

export async function executeGraphQL({
  query,
  variables = {},
  contextValue = {},
}: ExecuteGraphQLParams) {
  try {
    // Parse the query string into a GraphQL document
    const document = parse(query)

    // Execute the query against our schema
    const result = await execute({
      schema,
      document,
      variableValues: variables,
      contextValue: { ...contextValue, prisma },
    })

    return result
  } catch (error) {
    console.error('GraphQL execution error:', error)

    return {
      errors: [
        {
          message: error instanceof Error ? error.message : 'An unknown error occurred',
        },
      ],
    }
  }
}
