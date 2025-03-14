import {
  Environment,
  Network,
  RecordSource,
  Store,
  GraphQLResponse,
  PayloadError,
} from 'relay-runtime'
import { schema } from '../graphql/schema'
import { execute, parse } from 'graphql'
import prisma from '../db/prisma'

// Server-side network implementation
const network = Network.create(async (params, variables) => {
  const query = params.text || ''

  try {
    // Parse the query into a document
    const document = parse(query)

    // Execute the query against our schema
    const result = await execute({
      schema,
      document,
      variableValues: variables,
      contextValue: { prisma },
    })

    // Transform the GraphQL execution result to match Relay's expected format
    const relayResponse: GraphQLResponse = {
      data: result.data || {},
      errors: result.errors
        ? result.errors.map((err) => {
            const payloadError: PayloadError = {
              message: err.message,
              // Convert readonly locations to mutable array that matches Relay's expected format
              locations: err.locations
                ? err.locations.map((loc) => ({
                    line: loc.line,
                    column: loc.column,
                  }))
                : undefined,
              // Convert readonly path to mutable array
              path: err.path ? [...err.path] : undefined,
            }

            return payloadError
          })
        : undefined,
    }

    return relayResponse
  } catch (error) {
    console.error('Error executing query:', error)
    // Return a properly formatted error for Relay
    return {
      data: {},
      errors: [
        {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    }
  }
})

// Create a store for the server environment
const store = new Store(new RecordSource())

// Export the server environment
export function getServerEnvironment() {
  return new Environment({
    network,
    store,
    isServer: true,
  })
}
