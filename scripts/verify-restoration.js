const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Verifying restored data...");
    const envPath = path.resolve(process.cwd(), "../.env");
    const envContent = fs.readFileSync(envPath, "utf8");
    const mongoLine = envContent.split("\n").find(line => line.startsWith("MONGO_URI="));
    if (!mongoLine) throw new Error("MONGO_URI not found");
    let uri = mongoLine.substring(10);
    if (uri.startsWith("\"") && uri.endsWith("\"")) {
      uri = uri.substring(1, uri.length - 1);
    }
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    console.log("Connected to MongoDB");
    const db = mongoClient.db();
    
    // Get a sample price snapshot
    const priceSnapshots = db.collection("PriceSnapshot");
    const sample = await priceSnapshots.findOne({});
    
    if (!sample) {
      console.log("No price snapshots found.");
      return;
    }
    
    // Check if sample has all expected fields
    console.log("Sample price snapshot:");
    console.log(JSON.stringify({
      _id: sample._id,
      pairId: sample.pairId,
      timestamp: sample.timestamp,
      price0: sample.price0,
      price1: sample.price1,
      token0Price: sample.token0Price,
      token1Price: sample.token1Price
    }, null, 2));
    
    // Check for field presence across all snapshots
    const totalCount = await priceSnapshots.countDocuments({});
    const withPrice0 = await priceSnapshots.countDocuments({ price0: { $exists: true } });
    const withPrice1 = await priceSnapshots.countDocuments({ price1: { $exists: true } });
    const withToken0Price = await priceSnapshots.countDocuments({ token0Price: { $exists: true } });
    const withToken1Price = await priceSnapshots.countDocuments({ token1Price: { $exists: true } });
    
    console.log("\nField presence check:");
    console.log(`Total snapshots: ${totalCount}`);
    console.log(`With price0: ${withPrice0}`);
    console.log(`With price1: ${withPrice1}`);
    console.log(`With token0Price: ${withToken0Price}`);
    console.log(`With token1Price: ${withToken1Price}`);
    
    // Check for price variation within a single pair
    const paircounts = await priceSnapshots.aggregate([
      { $group: { _id: "$pairId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]).toArray();
    
    if (paircounts.length > 0) {
      const pairId = paircounts[0]._id;
      const pairSnapshots = await priceSnapshots.find({ pairId }).sort({ timestamp: 1 }).toArray();
      const uniquePrice0Values = new Set(pairSnapshots.map(s => s.price0));
      const uniquePrice1Values = new Set(pairSnapshots.map(s => s.price1));
      
      console.log("\nPrice variation check for most frequent pair:");
      console.log(`Pair ID: ${pairId}`);
      console.log(`Snapshot count: ${pairSnapshots.length}`);
      console.log(`Unique price0 values: ${uniquePrice0Values.size}`);
      console.log(`Unique price1 values: ${uniquePrice1Values.size}`);
      
      // Show earliest and latest snapshots
      if (pairSnapshots.length >= 2) {
        const earliest = pairSnapshots[0];
        const latest = pairSnapshots[pairSnapshots.length - 1];
        
        console.log("\nEarliest snapshot:");
        console.log(`Timestamp: ${new Date(earliest.timestamp * 1000).toISOString()}`);
        console.log(`price0: ${earliest.price0}`);
        console.log(`price1: ${earliest.price1}`);
        console.log(`token0Price: ${earliest.token0Price}`);
        console.log(`token1Price: ${earliest.token1Price}`);
        
        console.log("\nLatest snapshot:");
        console.log(`Timestamp: ${new Date(latest.timestamp * 1000).toISOString()}`);
        console.log(`price0: ${latest.price0}`);
        console.log(`price1: ${latest.price1}`);
        console.log(`token0Price: ${latest.token0Price}`);
        console.log(`token1Price: ${latest.token1Price}`);
      }
    }
  } catch (error) {
    console.error("Verification failed:", error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}

main();
