const { PrismaClient } = require('@prisma/client')

// Create a singleton Prisma client that can be reused across requests
const globalForPrisma = global as unknown as { prisma: any }

// Get the MongoDB URI based on environment
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/ponder"

// Only log an error in development, but don't throw since we have a fallback
if (!process.env.MONGO_URI && process.env.NODE_ENV !== 'production') {
  console.warn('Warning: MONGO_URI environment variable is not defined. Using default connection.')
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: mongoUri,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
