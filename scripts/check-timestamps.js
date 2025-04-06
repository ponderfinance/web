const fs = require("fs");
const { MongoClient } = require("mongodb");
const envPath = "../.env";
async function main() {
  let mongoClient = null;
  try {
    console.log("Checking snapshot timestamps...");
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
    // Get earliest and latest timestamps
    const earliest = await priceSnapshots.find().sort({ timestamp: 1 }).limit(1).toArray();
    const latest = await priceSnapshots.find().sort({ timestamp: -1 }).limit(1).toArray();
    if (earliest.length && latest.length) {
      const earliestDate = new Date(earliest[0].timestamp * 1000);
      const latestDate = new Date(latest[0].timestamp * 1000);
      console.log(`Earliest snapshot: ${earliestDate.toISOString()}`);
      console.log(`Latest snapshot: ${latestDate.toISOString()}`);
      const diffMs = latestDate - earliestDate;
      const diffMinutes = Math.floor(diffMs / 60000);
      console.log(`Time span: ${diffMinutes} minutes`);
    }
    // Get count of distinct timestamps
    const distinctTimestamps = await priceSnapshots.distinct("timestamp");
    console.log(`Number of distinct timestamps: ${distinctTimestamps.length}`);
    // Count total snapshots
    const totalCount = await priceSnapshots.countDocuments();
    console.log(`Total number of snapshots: ${totalCount}`);
    // Group snapshots by timestamp
    const timestampGroups = await priceSnapshots.aggregate([
      { $group: { _id: "$timestamp", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]).toArray();
    console.log("\nTop 5 timestamps by number of snapshots:");
    for (const group of timestampGroups) {
      const date = new Date(group._id * 1000);
      console.log(`${date.toISOString()}: ${group.count} snapshots`);
    }
    console.log("\nTimestamp check completed");
  } catch (error) {
    console.error("Timestamp check failed:", error);
    process.exitCode = 1;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}
main();
