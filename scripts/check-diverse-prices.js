const fs = require("fs");
const { MongoClient } = require("mongodb");
const envPath = "../.env";
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking price diversity across pairs...");
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
    // Get distinct pair IDs from snapshots
    const distinctPairs = await priceSnapshots.distinct("pairId");
    console.log(`Found ${distinctPairs.length} distinct pairs in snapshots`);
    // Sample snapshots from different pairs
    const pricesMap = {};
    for (let i = 0; i < Math.min(5, distinctPairs.length); i++) {
      const pairId = distinctPairs[i];
      const pairSnapshots = await priceSnapshots.find({ pairId }).limit(1).toArray();
      if (pairSnapshots.length > 0) {
        const pairInfo = await pairs.findOne({ _id: pairId });
        console.log(`\nPair ${i + 1} (${pairInfo ? pairInfo.address : "unknown address"}):`);
        console.log(` - price0: ${pairSnapshots[0].price0}`);
        console.log(` - price1: ${pairSnapshots[0].price1}`);
        // Store prices for analysis
        pricesMap[pairId] = {
          price0: pairSnapshots[0].price0,
          price1: pairSnapshots[0].price1
        };
      }
    }
    // Check if all prices are unique
    const uniquePrice0Values = new Set(Object.values(pricesMap).map(p => p.price0));
    const uniquePrice1Values = new Set(Object.values(pricesMap).map(p => p.price1));
    console.log(`\nUnique price0 values: ${uniquePrice0Values.size} out of ${Object.keys(pricesMap).length}`);
    console.log(`Unique price1 values: ${uniquePrice1Values.size} out of ${Object.keys(pricesMap).length}`);
    console.log("Price diversity check completed");
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
