const { PrismaClient } = require('@prisma/client')

// Create a singleton Prisma client that can be reused across requests
const globalForPrisma = global as unknown as { prisma: any }

// Get the MongoDB URI based on environment
const mongoUri = process.env.MONGO_URI
if (!mongoUri) {
  throw new Error('MONGO_URI environment variable is not defined')
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: mongoUri,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
