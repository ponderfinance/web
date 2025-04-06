const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Creating backup and restoring original price values...");
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
    // Check if we have already created a backup
    const collections = await db.listCollections().toArray();
    const hasBackup = collections.some(c => c.name === "PriceSnapshot_Backup");
    const priceSnapshots = db.collection("PriceSnapshot");
    
    // If no backup exists, create one first
    if (!hasBackup) {
      console.log("Creating backup collection...");
      // Get all documents from PriceSnapshot
      const allSnapshots = await priceSnapshots.find({}).toArray();
      console.log(`Backing up ${allSnapshots.length} snapshot documents...`);
      
      if (allSnapshots.length > 0) {
        // Create backup collection and insert all documents
        const backupCollection = db.collection("PriceSnapshot_Backup");
        await backupCollection.insertMany(allSnapshots);
        const backupCount = await backupCollection.countDocuments();
        console.log(`Created backup with ${backupCount} documents`);
      } else {
        console.log("No documents to back up");
      }
    } else {
      console.log("Backup collection already exists");
    }
    
    // Now restore from backup if it exists
    if (hasBackup || collections.some(c => c.name === "PriceSnapshot_Backup")) {
      console.log("Restoring original price values from backup...");
      const backupCollection = db.collection("PriceSnapshot_Backup");
      const backupCount = await backupCollection.countDocuments();
      console.log(`Found ${backupCount} backup documents`);
      
      if (backupCount > 0) {
        // Clear the current collection
        await priceSnapshots.deleteMany({});
        console.log("Cleared current PriceSnapshot collection");
        
        // Copy from backup
        const backupDocs = await backupCollection.find({}).toArray();
        await priceSnapshots.insertMany(backupDocs);
        console.log(`Restored ${backupDocs.length} snapshot documents from backup`);
      } else {
        console.log("Backup collection is empty, restoration cancelled");
      }
    } else {
      console.log("No backup found to restore from");
    }
    
    console.log("Price restoration process completed");
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
