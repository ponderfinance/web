const { MongoClient } = require('mongodb');

async function main() {
  try {
    console.log('Starting price field check...');
    
    // Get MongoDB connection string from environment
    const mongoUrl = process.env.MONGO_URI;
    if (!mongoUrl) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    // Connect to MongoDB
    const mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    console.log('Connected to MongoDB');

    // Get the database and collections
    const db = mongoClient.db();
    const priceSnapshots = db.collection('PriceSnapshot');
    const pairs = db.collection('Pair');

    // Get total count of snapshots
    const totalSnapshots = await priceSnapshots.countDocuments();
    console.log(`Total snapshots: ${totalSnapshots}`);

    // Check for snapshots with missing price fields
    const missingPriceFields = await priceSnapshots.countDocuments({
      $or: [
        { token0Price: null },
        { token1Price: null }
      ]
    });
    console.log(`Snapshots with missing price fields: ${missingPriceFields}`);

    // Get a sample of snapshots with missing prices to analyze
    const sampleSnapshots = await priceSnapshots.find({
      $or: [
        { token0Price: null },
        { token1Price: null }
      ]
    }).limit(5).toArray();

    if (sampleSnapshots.length > 0) {
      console.log('\nSample snapshots with missing prices:');
      for (const snapshot of sampleSnapshots) {
        const pair = await pairs.findOne({ _id: snapshot.pairId });
        console.log(`\nSnapshot ID: ${snapshot._id}`);
        console.log(`Pair ID: ${snapshot.pairId}`);
        console.log(`Timestamp: ${snapshot.timestamp}`);
        if (pair) {
          console.log(`Pair reserves: ${pair.reserve0}, ${pair.reserve1}`);
        } else {
          console.log('Pair not found');
        }
      }
    }

    // Close connection
    await mongoClient.close();
    console.log('\nPrice field check completed.');
  } catch (error) {
    console.error('Price field check failed:', error);
    process.exit(1);
  }
}

main(); 