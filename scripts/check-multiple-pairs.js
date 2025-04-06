const fs = require("fs");
const { MongoClient } = require("mongodb");
const envPath = "../.env";
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking price changes across multiple pairs...");
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
    // Find the top 5 pairs with the most snapshots
    const paircounts = await priceSnapshots.aggregate([
      { $group: { _id: "$pairId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();
    let changesFound = false;
    // Examine each pair
    for (const pairCount of paircounts) {
      const pairId = pairCount._id;
      const pairInfo = await pairs.findOne({ _id: pairId });
      console.log(`\n== Pair: ${pairInfo ? pairInfo.address : "unknown"} with ${pairCount.count} snapshots ==`);
      const pairSnapshots = await priceSnapshots.find({ pairId }).sort({ timestamp: 1 }).toArray();
      const uniquePrice0Values = new Set(pairSnapshots.map(s => s.price0?.toString()));
      const uniquePrice1Values = new Set(pairSnapshots.map(s => s.price1?.toString()));
      console.log(`Unique price0 values: ${uniquePrice0Values.size} out of ${pairSnapshots.length}`);
      console.log(`Unique price1 values: ${uniquePrice1Values.size} out of ${pairSnapshots.length}`);
      if (uniquePrice0Values.size > 1 || uniquePrice1Values.size > 1) {
        changesFound = true;
        console.log("  Price changes detected in this pair!");
        const firstSnapshot = pairSnapshots[0];
        const lastSnapshot = pairSnapshots[pairSnapshots.length - 1];
        console.log(`  First snapshot: price0=${firstSnapshot.price0}, price1=${firstSnapshot.price1}`);
        console.log(`  Last snapshot: price0=${lastSnapshot.price0}, price1=${lastSnapshot.price1}`);
      }
      // Check the reserves too
      const uniqueReserve0Values = new Set(pairSnapshots.map(s => s.reserve0?.toString()));
      const uniqueReserve1Values = new Set(pairSnapshots.map(s => s.reserve1?.toString()));
      console.log(`Unique reserve0 values: ${uniqueReserve0Values.size} out of ${pairSnapshots.length}`);
      console.log(`Unique reserve1 values: ${uniqueReserve1Values.size} out of ${pairSnapshots.length}`);
    }
    if (!changesFound) {
      console.log("\nNOTE: None of the pairs examined showed changing prices over time.");
      console.log("This suggests one of three possibilities:");
      console.log("1. There were no actual trades/price changes during the period snapshots were taken");
      console.log("2. The reserves values are all the same for each pair (check above)");
      console.log("3. The price calculation logic needs to be revisited");
    } else {
      console.log("\nGood news! At least one pair showed price changes over time.");
    }
    console.log("\nMultiple pairs check completed");
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
