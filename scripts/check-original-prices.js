const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking original price formats...");
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
    const priceSnapshots = db.collection("PriceSnapshot");
    // Sample snapshots to see original format
    console.log("Sampling snapshots to see token0Price and token1Price fields:");
    const sample = await priceSnapshots.findOne({});
    if (sample) {
      console.log(JSON.stringify({
        _id: sample._id,
        pairId: sample.pairId,
        timestamp: sample.timestamp,
        price0: sample.price0,
        price1: sample.price1,
        token0Price: sample.token0Price,
        token1Price: sample.token1Price
      }, null, 2));
    }
    console.log("Checking if all snapshots have these fields...");
    const totalCount = await priceSnapshots.countDocuments({});
    const withToken0Price = await priceSnapshots.countDocuments({ token0Price: { $exists: true } });
    const withToken1Price = await priceSnapshots.countDocuments({ token1Price: { $exists: true } });
    console.log(`Total snapshots: ${totalCount}`);
    console.log(`With token0Price: ${withToken0Price}`);
    console.log(`With token1Price: ${withToken1Price}`);
    // Sample different pairs
    console.log("\nSampling different pairs for format comparison:");
    const pairs = await db.collection("PriceSnapshot").aggregate([
      { $group: { _id: "$pairId" } },
      { $limit: 3 }
    ]).toArray();
    for (const pair of pairs) {
      const pairSample = await priceSnapshots.findOne({ pairId: pair._id });
      console.log(`\nPair ID: ${pair._id}`);
      console.log(JSON.stringify({
        price0: pairSample.price0,
        price1: pairSample.price1,
        token0Price: pairSample.token0Price,
        token1Price: pairSample.token1Price
      }, null, 2));
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
