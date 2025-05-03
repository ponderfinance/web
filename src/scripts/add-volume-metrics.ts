const dotenv = require('dotenv')
const { MongoClient } = require('mongodb')

dotenv.config()

async function main() {
  console.log('Starting volume metrics fields migration...')
  
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI environment variable is not defined')
    process.exit(1)
  }
  
  try {
    // Connect directly to MongoDB
    const mongoClient = new MongoClient(process.env.MONGO_URI)
    await mongoClient.connect()
    console.log('Connected to MongoDB')
    
    const db = mongoClient.db('ponder_indexer')
    
    // 1. Create the VolumeMetric collection if it doesn't exist
    console.log('Creating VolumeMetric collection...')
    try {
      await db.createCollection('VolumeMetric')
      console.log('Created VolumeMetric collection')
    } catch (error) {
      // Collection might already exist
      console.log('VolumeMetric collection already exists or error occurred')
    }
    
    // 2. Add indexes to VolumeMetric collection
    console.log('Adding indexes to VolumeMetric collection...')
    await db.collection('VolumeMetric').createIndex({ entity: 1, entityId: 1 })
    await db.collection('VolumeMetric').createIndex({ timestamp: 1 })
    console.log('Added indexes to VolumeMetric collection')
    
    // 3. Update Token schema
    console.log('Updating Token schema to add volume fields...')
    await db.collection('Token').updateMany(
      {}, // Update all tokens
      {
        $set: {
          priceChange1h: 0,
          priceChange7d: 0,
          volume1h: '0',
          volume7d: '0',
          volume30d: '0',
          volumeChange24h: 0
        }
      }
    )
    console.log('Updated Token schema')
    
    // 4. Update Pair schema
    console.log('Updating Pair schema to add volume fields...')
    await db.collection('Pair').updateMany(
      {}, // Update all pairs
      {
        $set: {
          poolAPR: 0,
          volume1h: '0',
          volume24h: '0',
          volume7d: '0',
          volume30d: '0',
          volumeChange24h: 0,
          volumeTVLRatio: 0
        }
      }
    )
    console.log('Updated Pair schema')
    
    // 5. Check if we have a protocol metrics document
    console.log('Creating or updating ProtocolMetric document...')
    const totalPairs = await db.collection('Pair').countDocuments()
    
    const protocolMetric = await db.collection('ProtocolMetric').findOne({})
    
    if (!protocolMetric) {
      // Create a new protocol metric document
      await db.collection('ProtocolMetric').insertOne({
        timestamp: Math.floor(Date.now() / 1000),
        totalValueLockedUSD: '0',
        liquidityPoolsTVL: '0',
        stakingTVL: '0',
        farmingTVL: '0',
        dailyVolumeUSD: '0',
        weeklyVolumeUSD: '0',
        monthlyVolumeUSD: '0',
        totalVolumeUSD: '0',
        dailyFeesUSD: '0',
        weeklyFeesUSD: '0',
        monthlyFeesUSD: '0',
        totalFeesUSD: '0',
        totalUsers: 0,
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        volume1h: '0',
        volume1hChange: 0,
        totalPairs: totalPairs,
        activePoolsCount: 0,
        createdAt: new Date()
      })
      console.log('Created new ProtocolMetric document')
    } else {
      // Update the existing protocol metric document
      await db.collection('ProtocolMetric').updateOne(
        { _id: protocolMetric._id },
        {
          $set: {
            volume1h: '0',
            volume1hChange: 0,
            totalPairs: totalPairs,
            activePoolsCount: 0,
            updatedAt: new Date()
          }
        }
      )
      console.log('Updated existing ProtocolMetric document')
    }
    
    console.log('Migration completed successfully!')
    
    // Close MongoDB connection
    await mongoClient.close()
    
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => {
    console.log('Script execution completed')
  }) 