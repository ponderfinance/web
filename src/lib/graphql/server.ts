// src/lib/graphql/server.ts
import { execute, parse } from 'graphql'
import { schema } from './schema'
import prisma from '../db/prisma'
import { createLoaders } from '../dataloader'
import { Context } from './types'
import { publicClient } from './resolvers'

// Create the context for this request
function createContext(req?: Request): Context {
  return {
    prisma,
    req,
    loaders: createLoaders(prisma),
    publicClient,
  }
}

type ExecuteGraphQLParams = {
  query: string
  variables?: Record<string, any>
  contextValue?: Partial<Omit<Context, 'loaders'>>
}

export async function executeGraphQL({
  query,
  variables = {},
  contextValue = {},
}: ExecuteGraphQLParams) {
  try {
    // Parse the query string into a GraphQL document
    const document = parse(query)

    // Create context with loaders and merge with provided context values
    const context = createContext(contextValue.req)

    // Execute the query against our schema
    return await execute({
      schema,
      document,
      variableValues: variables,
      contextValue: context,
    })
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
