const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
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
    // Get a sample pair to inspect schema
    const samplePairId = "67d201199580ce6325b892ed"; // From the PriceSnapshot sample
    const samplePair = await db.collection("Pair").findOne({ _id: new ObjectId(samplePairId) });
    console.log("Pair schema:");
    console.log(JSON.stringify(Object.keys(samplePair || {}), null, 2));
    // Show complete sample with focus on reserve fields
    console.log("\nPair reserve data:");
    if (samplePair) {
      const { reserve0, reserve1, _id, address, token0Id, token1Id } = samplePair;
      console.log(JSON.stringify({ _id, address, token0Id, token1Id, reserve0, reserve1 }, null, 2));
    }
    // Check if there are any reserve snapshots
    console.log("\nChecking for PairReserveSnapshot collection...");
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    console.log("Available collections:", collectionNames);
    if (collectionNames.includes("PairReserveSnapshot")) {
      const reserveSnapshots = db.collection("PairReserveSnapshot");
      const count = await reserveSnapshots.countDocuments({ pairId: samplePairId });
      console.log(`Found ${count} reserve snapshots for the sample pair`);
      if (count > 0) {
        const sample = await reserveSnapshots.findOne({ pairId: samplePairId });
        console.log("Sample reserve snapshot:", JSON.stringify(sample, null, 2));
      }
    } else {
      console.log("No PairReserveSnapshot collection found");
    }
  } catch (error) {
    console.error("Schema check failed:", error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}
main();
