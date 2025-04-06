const fs = require("fs");
const { MongoClient } = require("mongodb");
const envPath = "../.env";
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking price changes over time for a pair...");
    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split("\n");
    const mongoLine = lines.find(line => line.startsWith("MONGO_URI="));
    if (!mongoLine) throw new Error("MONGO_URI not found in .env");
    let uri = mongoLine.substring(10);
    if (uri.startsWith("\"") && uri.endsWith("\"")) {
      uri = uri.substring(1, uri.length - 1);
    }
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    console.log("Connected to MongoDB");
    const db = mongoClient.db();
    const priceSnapshots = db.collection("PriceSnapshot");
    const pairs = db.collection("Pair");
    // Find a pair with multiple snapshots
    const paircounts = await priceSnapshots.aggregate([
      { $group: { _id: "$pairId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]).toArray();
    if (paircounts.length === 0) {
      console.log("No pairs found with snapshots");
      return;
    }
    const pairId = paircounts[0]._id;
    const pairInfo = await pairs.findOne({ _id: pairId });
    console.log(`Examining pair: ${pairInfo ? pairInfo.address : "unknown"} with ${paircounts[0].count} snapshots`);
    // Get snapshots for this pair
    const pairSnapshots = await priceSnapshots.find({ pairId }).sort({ timestamp: 1 }).toArray();
    console.log(`Total snapshots for pair: ${pairSnapshots.length}`);
    // Check if all prices are the same
    const uniquePrice0Values = new Set(pairSnapshots.map(s => s.price0));
    const uniquePrice1Values = new Set(pairSnapshots.map(s => s.price1));
    console.log(`Unique price0 values: ${uniquePrice0Values.size} out of ${pairSnapshots.length}`);
    console.log(`Unique price1 values: ${uniquePrice1Values.size} out of ${pairSnapshots.length}`);
    // Show some sample timestamps with prices
    console.log("\nSample snapshots (first 3):");
    pairSnapshots.slice(0, 3).forEach((snapshot, i) => {
      const date = new Date(snapshot.timestamp * 1000);
      console.log(`Snapshot ${i+1} (${date.toISOString()}):`);
      console.log(` - price0: ${snapshot.price0}`);
      console.log(` - price1: ${snapshot.price1}`);
    });
    if (uniquePrice0Values.size === 1 && uniquePrice1Values.size === 1) {
      console.log("\nWARNING: All snapshots have the same prices. This suggests that our price fix might not be working correctly.");
      console.log("The prices are calculated based on pair reserves, but if the reserves are constant, the prices will be constant too.");
    } else {
      console.log("\nGood news! Prices vary over time, which suggests our price fix is working correctly.");
    }
    console.log("Price time check completed");
  } catch (error) {
    console.error("Price check failed:", error);
    process.exitCode = 1;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}
main();
