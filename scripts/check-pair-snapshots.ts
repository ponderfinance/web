const { MongoClient, ObjectId } = require('mongodb');
type ObjectIdType = typeof ObjectId;

interface PriceSnapshot {
  _id: ObjectIdType;
  pairId: ObjectIdType;
  price0: string;
  price1: string;
  timestamp: number;
  blockNumber: number;
  createdAt: Date;
}

interface Pair {
  _id: ObjectIdType;
  address: string;
  token0Id: ObjectIdType;
  token1Id: ObjectIdType;
  reserve0: string;
  reserve1: string;
}

async function checkPairSnapshots() {
  console.log('Checking price snapshots for a specific pair...');
  
  try {
    const mongoUrl = process.env.MONGO_URI;
    if (!mongoUrl) {
      throw new Error('MONGO_URI environment variable is not set');
    }

    const client = new MongoClient(mongoUrl);
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    const priceSnapshots = db.collection('PriceSnapshot');
    const pairs = db.collection('Pair');

    // Get a specific pair (you can change this ID)
    const pairId = new ObjectId('67d201199580ce6325b892ed'); // This is the pair ID from your logs
    const pair = await pairs.findOne({ _id: pairId }) as Pair | null;
    
    if (!pair) {
      console.log(`Pair with ID ${pairId} not found`);
      await client.close();
      return;
    }
    
    console.log(`\nFound pair: ${pair.address}`);
    console.log(`Token0: ${pair.token0Id}`);
    console.log(`Token1: ${pair.token1Id}`);
    console.log(`Current reserves: ${pair.reserve0}, ${pair.reserve1}`);

    // Get all snapshots for this pair
    const snapshots = await priceSnapshots
      .find({ pairId })
      .sort({ timestamp: 1 })
      .toArray() as PriceSnapshot[];

    console.log(`\nFound ${snapshots.length} snapshots for this pair`);
    
    if (snapshots.length > 0) {
      console.log('\nFirst 5 snapshots:');
      snapshots.slice(0, 5).forEach((snapshot: PriceSnapshot, index: number) => {
        console.log(`\nSnapshot ${index + 1}:`);
        console.log(`Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
        console.log(`Price0: ${snapshot.price0}`);
        console.log(`Price1: ${snapshot.price1}`);
      });
      
      console.log('\nLast 5 snapshots:');
      snapshots.slice(-5).forEach((snapshot: PriceSnapshot, index: number) => {
        console.log(`\nSnapshot ${snapshots.length - 4 + index}:`);
        console.log(`Timestamp: ${new Date(snapshot.timestamp * 1000).toISOString()}`);
        console.log(`Price0: ${snapshot.price0}`);
        console.log(`Price1: ${snapshot.price1}`);
      });
    }

    await client.close();
    console.log('\nCheck completed successfully');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPairSnapshots(); 