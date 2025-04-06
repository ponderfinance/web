const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking price snapshots after March 29...");
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
    // March 29, 2025 timestamp (Unix)
    const march29Timestamp = 1743312000; // Approx
    console.log(`Examining price snapshots after March 29, 2025 for pair: ${pairAddress}`);
    // Get price snapshots after March 29
    const priceSnapshots = db.collection("PriceSnapshot");
    const laterSnapshots = await priceSnapshots.find({
      pairId,
      timestamp: { $gte: march29Timestamp }
    }).sort({ timestamp: 1 }).toArray();
    console.log(`Found ${laterSnapshots.length} price snapshots after March 29`);
    // Check if prices vary
    const uniquePrice0Values = new Set(laterSnapshots.map(s => s.price0));
    const uniquePrice1Values = new Set(laterSnapshots.map(s => s.price1));
    console.log(`Unique price0 values: ${uniquePrice0Values.size} out of ${laterSnapshots.length}`);
    console.log(`Unique price1 values: ${uniquePrice1Values.size} out of ${laterSnapshots.length}`);
    // Sample some snapshots to show price changes
    if (laterSnapshots.length > 0) {
      if (uniquePrice0Values.size === 1 && uniquePrice1Values.size === 1) {
        console.log("\nWARNING: All later snapshots still have identical prices.");
      } else {
        console.log("\nGood news! Later snapshots have varying prices.");
        // Display samples of different price points
        console.log("\nSamples of different price points:");
        let seenPrices = new Set();
        let count = 0;
        for (const snapshot of laterSnapshots) {
          const key = `${snapshot.price0}-${snapshot.price1}`;
          if (!seenPrices.has(key)) {
            seenPrices.add(key);
            console.log(`Snapshot ${++count} (${new Date(snapshot.timestamp * 1000).toISOString()}):`);
            console.log(` - price0: ${snapshot.price0}`);
            console.log(` - price1: ${snapshot.price1}`);
            if (count >= 5) break;
          }
        }
      }
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
