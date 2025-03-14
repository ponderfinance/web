import { PrismaClient } from '@prisma/client'

// Create a singleton Prisma client that can be reused across requests
const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // Connect to your existing database
    datasources: {
      db: {
        url: process.env.MONGO_URI,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
