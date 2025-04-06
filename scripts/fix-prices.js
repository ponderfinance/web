const fs = require("fs");
const { MongoClient, ObjectId } = require("mongodb");
const envPath = "../.env";
function calculatePriceFromReserves(reserve1, reserve0) {
  if (reserve0 === 0n) return "0";
  const scale = 10n ** 18n;
  return ((reserve1 * scale) / reserve0).toString();
}
async function main() {
  let mongoClient = null;
  try {
    console.log("Starting price restoration...");
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
    const pairs = db.collection("Pair");
    const snapshots = await priceSnapshots.find({}).toArray();
    console.log(`Found ${snapshots.length} price snapshots to process`);
    let updatedCount = 0;
    let errorCount = 0;
    for (let i = 0; i < snapshots.length; i += 10) {
      const batch = snapshots.slice(i, Math.min(i + 10, snapshots.length));
      for (const snapshot of batch) {
        try {
          const pairObjectId = typeof snapshot.pairId === "string" ? new ObjectId(snapshot.pairId) : snapshot.pairId;
          const pair = await pairs.findOne({ _id: pairObjectId });
          if (!pair) {
            console.warn(`No pair found for snapshot ${snapshot._id}`);
            errorCount++;
            continue;
          }
          if (pair.reserve0 && pair.reserve1) {
            const reserve0 = BigInt(pair.reserve0);
            const reserve1 = BigInt(pair.reserve1);
            if (reserve0 > 0n && reserve1 > 0n) {
              const price0 = calculatePriceFromReserves(reserve1, reserve0);
              const price1 = calculatePriceFromReserves(reserve0, reserve1);
              await priceSnapshots.updateOne(
                { _id: snapshot._id },
                { $set: { price0, price1 } }
              );
              updatedCount++;
            } else {
              errorCount++;
            }
          } else {
            errorCount++;
          }
        } catch (error) {
          console.error(`Error processing snapshot:`, error);
          errorCount++;
        }
      }
      console.log(`Processed ${Math.min(i + 10, snapshots.length)} of ${snapshots.length} snapshots. Updated: ${updatedCount}, Errors: ${errorCount}`);
    }
    console.log(`Price restoration completed. Updated ${updatedCount} snapshots. Errors: ${errorCount}`);
  } catch (error) {
    console.error("Price restoration failed:", error);
    process.exitCode = 1;
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}
main();
