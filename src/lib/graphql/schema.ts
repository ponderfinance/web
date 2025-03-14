import { makeExecutableSchema } from '@graphql-tools/schema'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolvers } from './resolvers'

// Read the schema from the file
const typeDefs = readFileSync(resolve(process.cwd(), 'schema.graphql'), 'utf-8')

// Create the executable schema
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
})
