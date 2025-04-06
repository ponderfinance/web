const fs = require("fs");
const { MongoClient } = require("mongodb");
const envPath = "../.env";
async function main() {
  try {
    const content = fs.readFileSync(envPath, "utf8");
    console.log("Found .env file!");
    const lines = content.split("\n");
    const mongoLine = lines.find(line => line.startsWith("MONGO_URI="));
    if (mongoLine) {
      let uri = mongoLine.substring(10);
      // Remove quotes if present
      if (uri.startsWith("\"") && uri.endsWith("\"")) {
        uri = uri.substring(1, uri.length - 1);
      }
      console.log("MONGO_URI: " + uri.substring(0, 15) + "...");
      const client = new MongoClient(uri);
      await client.connect();
      console.log("Connected to MongoDB!");
      const db = client.db();
      const priceSnapshots = db.collection("PriceSnapshot");
      const count = await priceSnapshots.countDocuments({});
      console.log(`Found ${count} price snapshots in the database`);
      await client.close();
      console.log("MongoDB connection closed");
    } else {
      console.log("MONGO_URI not found in .env");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}
main();
