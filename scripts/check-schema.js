const { MongoClient } = require("mongodb");
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
    const priceSnapshots = db.collection("PriceSnapshot");
    // Get a sample snapshot to inspect schema
    const sampleSnapshot = await priceSnapshots.findOne({});
    console.log("PriceSnapshot schema:");
    console.log(JSON.stringify(Object.keys(sampleSnapshot || {}), null, 2));
    // Show complete sample
    console.log("\nSample PriceSnapshot document:");
    console.log(JSON.stringify(sampleSnapshot, null, 2));
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
