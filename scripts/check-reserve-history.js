const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking reserve snapshots history...");
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
    // Focus on the same pair we checked before
    const pairAddress = "0x12c4a2759bfe2f7963fc22a7168e8e5c7bdbef74";
    const pair = await db.collection("Pair").findOne({ address: pairAddress });
    if (!pair) {
      console.log(`Pair not found: ${pairAddress}`);
      return;
    }
    const pairId = pair._id.toString();
    console.log(`Examining reserve snapshots for pair: ${pairAddress} (ID: ${pairId})`);
    // Count total reserve snapshots for this pair
    const reserveSnapshots = db.collection("PairReserveSnapshot");
    const count = await reserveSnapshots.countDocuments({ pairId });
    console.log(`Found ${count} reserve snapshots for this pair`);
    // Check if reserve values vary
    const allReserveSnapshots = await reserveSnapshots.find({ pairId }).sort({ timestamp: 1 }).toArray();
    const uniqueReserve0Values = new Set(allReserveSnapshots.map(s => s.reserve0));
    const uniqueReserve1Values = new Set(allReserveSnapshots.map(s => s.reserve1));
    console.log(`Unique reserve0 values: ${uniqueReserve0Values.size} out of ${allReserveSnapshots.length}`);
    console.log(`Unique reserve1 values: ${uniqueReserve1Values.size} out of ${allReserveSnapshots.length}`);
    // Display earliest and latest snapshots
    if (allReserveSnapshots.length > 0) {
      const first = allReserveSnapshots[0];
      const last = allReserveSnapshots[allReserveSnapshots.length - 1];
      console.log(`\nEarliest reserve snapshot (${new Date(first.timestamp * 1000).toISOString()}):`);
      console.log(` - reserve0: ${first.reserve0}`);
      console.log(` - reserve1: ${first.reserve1}`);
      console.log(`\nLatest reserve snapshot (${new Date(last.timestamp * 1000).toISOString()}):`);
      console.log(` - reserve0: ${last.reserve0}`);
      console.log(` - reserve1: ${last.reserve1}`);
      // If there are more than 10 distinct values, show first 5
      if (uniqueReserve0Values.size > 10 || uniqueReserve1Values.size > 10) {
        console.log("\nFirst 5 different reserve snapshots:");
        let seenValues = new Set();
        let count = 0;
        for (const snapshot of allReserveSnapshots) {
          const key = `${snapshot.reserve0}-${snapshot.reserve1}`;
          if (!seenValues.has(key)) {
            seenValues.add(key);
            console.log(`Snapshot ${++count} (${new Date(snapshot.timestamp * 1000).toISOString()}):`);
            console.log(` - reserve0: ${snapshot.reserve0}`);
            console.log(` - reserve1: ${snapshot.reserve1}`);
            if (count >= 5) break;
          }
        }
      } else if (uniqueReserve0Values.size === 1 && uniqueReserve1Values.size === 1) {
        console.log("\nWARNING: All reserve snapshots have identical values!");
        console.log("This explains why all price snapshots have identical values too.");
      }
    }
    // Check if timestamp ranges match between price snapshots and reserve snapshots
    const priceSnapshots = db.collection("PriceSnapshot");
    const earliestPrice = await priceSnapshots.find({ pairId }).sort({ timestamp: 1 }).limit(1).toArray();
    const latestPrice = await priceSnapshots.find({ pairId }).sort({ timestamp: -1 }).limit(1).toArray();
    if (earliestPrice.length > 0 && latestPrice.length > 0) {
      const earliestPriceTime = new Date(earliestPrice[0].timestamp * 1000);
      const latestPriceTime = new Date(latestPrice[0].timestamp * 1000);
      console.log(`\nPrice snapshot time range: ${earliestPriceTime.toISOString()} to ${latestPriceTime.toISOString()}`);
    }
    if (allReserveSnapshots.length > 0) {
      const earliestReserveTime = new Date(allReserveSnapshots[0].timestamp * 1000);
      const latestReserveTime = new Date(allReserveSnapshots[allReserveSnapshots.length - 1].timestamp * 1000);
      console.log(`Reserve snapshot time range: ${earliestReserveTime.toISOString()} to ${latestReserveTime.toISOString()}`);
    }
  } catch (error) {
    console.error("Check failed:", error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}
main();
