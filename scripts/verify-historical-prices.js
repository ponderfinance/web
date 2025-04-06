const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Verifying historical price changes...");
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
    // Find a pair with multiple snapshots
    const paircounts = await db.collection("PriceSnapshot").aggregate([
      { $group: { _id: "$pairId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]).toArray();
    if (paircounts.length === 0) {
      console.log("No pairs found with snapshots");
      return;
    }
    const pairId = paircounts[0]._id;
    const pairInfo = await db.collection("Pair").findOne({ _id: new ObjectId(pairId) });
    console.log(`Examining pair: ${pairInfo ? pairInfo.address : "unknown"} with ${paircounts[0].count} snapshots`);
    // Get snapshots for this pair
    const pairSnapshots = await db.collection("PriceSnapshot").find({ pairId }).sort({ timestamp: 1 }).toArray();
    console.log(`Total snapshots for pair: ${pairSnapshots.length}`);
    // Check if all prices are the same
    const uniquePrice0Values = new Set(pairSnapshots.map(s => s.price0));
    const uniquePrice1Values = new Set(pairSnapshots.map(s => s.price1));
    console.log(`Unique price0 values: ${uniquePrice0Values.size} out of ${pairSnapshots.length}`);
    console.log(`Unique price1 values: ${uniquePrice1Values.size} out of ${pairSnapshots.length}`);
    // Sample price values from the beginning, middle, and end
    const first = pairSnapshots[0];
    const middle = pairSnapshots[Math.floor(pairSnapshots.length / 2)];
    const last = pairSnapshots[pairSnapshots.length - 1];
    console.log(`\nFirst snapshot (${new Date(first.timestamp * 1000).toISOString()}):`);
    console.log(` - price0: ${first.price0}`);
    console.log(` - price1: ${first.price1}`);
    console.log(`\nMiddle snapshot (${new Date(middle.timestamp * 1000).toISOString()}):`);
    console.log(` - price0: ${middle.price0}`);
    console.log(` - price1: ${middle.price1}`);
    console.log(`\nLast snapshot (${new Date(last.timestamp * 1000).toISOString()}):`);
    console.log(` - price0: ${last.price0}`);
    console.log(` - price1: ${last.price1}`);
    // Check reserve snapshots corresponding to these price snapshots
    console.log("\nConfirming reserve snapshots used for these prices...");
    const checkReserveSnapshot = async (timestamp) => {
      const reserveSnapshot = await db.collection("PairReserveSnapshot").findOne({
        pairId,
        timestamp: { $lte: timestamp + 60, $gte: timestamp - 60 }
      });
      if (!reserveSnapshot) {
        console.log(`No matching reserve snapshot for timestamp ${timestamp}`);
        return null;
      }
      return {
        timestamp: reserveSnapshot.timestamp,
        reserve0: reserveSnapshot.reserve0,
        reserve1: reserveSnapshot.reserve1
      };
    };
    const firstReserve = await checkReserveSnapshot(first.timestamp);
    const middleReserve = await checkReserveSnapshot(middle.timestamp);
    const lastReserve = await checkReserveSnapshot(last.timestamp);
    if (firstReserve) {
      console.log(`\nFirst reserve snapshot (${new Date(firstReserve.timestamp * 1000).toISOString()}):`);
      console.log(` - reserve0: ${firstReserve.reserve0}`);
      console.log(` - reserve1: ${firstReserve.reserve1}`);
    }
    if (middleReserve) {
      console.log(`\nMiddle reserve snapshot (${new Date(middleReserve.timestamp * 1000).toISOString()}):`);
      console.log(` - reserve0: ${middleReserve.reserve0}`);
      console.log(` - reserve1: ${middleReserve.reserve1}`);
    }
    if (lastReserve) {
      console.log(`\nLast reserve snapshot (${new Date(lastReserve.timestamp * 1000).toISOString()}):`);
      console.log(` - reserve0: ${lastReserve.reserve0}`);
      console.log(` - reserve1: ${lastReserve.reserve1}`);
    }
    if (uniquePrice0Values.size === 1 && uniquePrice1Values.size === 1) {
      console.log("\nWARNING: All snapshots still have the same prices.");
      console.log("This should not happen after our update unless the reserve values are identical.");
    } else {
      console.log("\nGOOD NEWS! Prices vary over time, which means our update was successful.");
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
