const fs = require("fs");
const { MongoClient } = require("mongodb");
const envPath = "../.env";
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking price fields in snapshots...");
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
    const totalCount = await priceSnapshots.countDocuments({});
    const missingPricesCount = await priceSnapshots.countDocuments({
      $or: [
        { price0: { $exists: false } },
        { price1: { $exists: false } },
        { price0: null },
        { price1: null }
      ]
    });
    console.log(`Total snapshots: ${totalCount}`);
    console.log(`Snapshots with missing price fields: ${missingPricesCount}`);
    if (missingPricesCount === 0) {
      console.log("All snapshots have price fields!");
    }
    // Get a sample of snapshots to verify the price values are unique
    const sample = await priceSnapshots.find().limit(5).toArray();
    console.log("\nSample of snapshots with prices:");
    sample.forEach((snapshot, index) => {
      console.log(`Sample ${index + 1}:`);
      console.log(` - price0: ${snapshot.price0}`);
      console.log(` - price1: ${snapshot.price1}`);
    });
    console.log("Price field check completed");
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
