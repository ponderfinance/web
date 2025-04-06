const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Restoring from backup and keeping only indexer-defined fields...");
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
    const collections = await db.listCollections().toArray();
    const hasBackup = collections.some(c => c.name === "PriceSnapshot_Backup");
    
    if (!hasBackup) {
      console.log("No backup collection found. Aborting.");
      return;
    }
    
    const backupCollection = db.collection("PriceSnapshot_Backup");
    const priceSnapshots = db.collection("PriceSnapshot");
    
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
    
    // Extract only indexer-defined fields from each document
    const pureDocs = backupDocs.map(doc => ({
      _id: doc._id,
      pairId: doc.pairId,
      timestamp: doc.timestamp,
      blockNumber: doc.blockNumber,
      createdAt: doc.createdAt,
      price0: doc.price0,
      price1: doc.price1
      // Intentionally excluding token0Price and token1Price
    }));
    
    // Insert the cleaned documents
    await priceSnapshots.insertMany(pureDocs);
    console.log(`Restored ${pureDocs.length} documents with only indexer-defined fields`);
    
    console.log("Restoration completed");
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
