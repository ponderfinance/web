const { PrismaClient } = require('@prisma/client')
const { MongoClient } = require('mongodb')

const prisma = new PrismaClient()

async function migratePriceFields() {
  console.log('Starting price field migration...')
  
  try {
    // Get MongoDB connection string from Prisma
    const mongoUrl = process.env.MONGO_URI
    if (!mongoUrl) {
      throw new Error('MONGO_URI environment variable is not set')
    }

    // Connect to MongoDB
    const mongoClient = new MongoClient(mongoUrl)
    await mongoClient.connect()
    console.log('Connected to MongoDB')

    // Get the database and collection
    const db = mongoClient.db()
    const collection = db.collection('PriceSnapshot')

    // Find snapshots that need migration
    const snapshots = await collection.find({
      $or: [
        { price0: null },
        { price1: null },
        { token0Price: { $exists: true } },
        { token1Price: { $exists: true } }
      ]
    }).toArray()

    console.log(`Found ${snapshots.length} price snapshots to migrate`)

    // Update each snapshot
    let migratedCount = 0
    for (const snapshot of snapshots) {
      try {
        const updateResult = await collection.updateOne(
          { _id: snapshot._id },
          {
            $set: {
              price0: snapshot.token0Price || '0',
              price1: snapshot.token1Price || '0'
            },
            $unset: {
              token0Price: "",
              token1Price: ""
            }
          }
        )
        
        if (updateResult.modifiedCount > 0) {
          migratedCount++
        }
      } catch (error) {
        console.error(`Error updating snapshot ${snapshot._id}:`, error)
      }
    }

    console.log(`Successfully migrated ${migratedCount} price snapshots`)

    // Close connections
    await mongoClient.close()
    await prisma.$disconnect()
  } catch (error) {
    console.error('Error during migration:', error)
    throw error
  }
}

// Run the migration
migratePriceFields()
  .then(() => {
    console.log('Migration completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  }) 