const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Restoring from backup collection...");
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
    
    // Ensure we have a backup
    const collections = await db.listCollections().toArray();
    const hasBackup = collections.some(c => c.name === "PriceSnapshot_Backup");
    
    if (!hasBackup) {
      console.error("No backup collection found. Cannot restore.");
      return;
    }
    
    // Get collections
    const backupCollection = db.collection("PriceSnapshot_Backup");
    const priceSnapshots = db.collection("PriceSnapshot");
    const pairCollection = db.collection("Pair");
    const tokenCollection = db.collection("Token");
    
    // Get all documents from backup
    const backupDocs = await backupCollection.find({}).toArray();
    console.log(`Found ${backupDocs.length} documents in backup`);
    
    if (backupDocs.length === 0) {
      console.log("Backup is empty. Aborting.");
      return;
    }
    
    // Clear current collection
    await priceSnapshots.deleteMany({});
    console.log("Cleared current PriceSnapshot collection");
    
    // Insert backup documents directly (complete restore)
    await priceSnapshots.insertMany(backupDocs);
    const restoredCount = await priceSnapshots.countDocuments({});
    console.log(`Restored ${restoredCount} documents from backup`);
    
    console.log("Restoration completed successfully");
  } catch (error) {
    console.error("Restoration failed:", error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}

main();
