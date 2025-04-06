const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");

console.log("Script starting...");

// Read MONGO_URI from .env file
function getMongoUriFromEnv() {
  try {
    const envPath = path.resolve(process.cwd(), "../.env");
    console.log(`Looking for .env file at: ${envPath}`);
    
    const envContent = fs.readFileSync(envPath, "utf8");
    const mongoLine = envContent.split("\n").find(line => line.startsWith("MONGO_URI="));
    if (!mongoLine) throw new Error("MONGO_URI not found in .env file");
    let uri = mongoLine.substring(10);
    if (uri.startsWith("\"") && uri.endsWith("\"")) {
      uri = uri.substring(1, uri.length - 1);
    }
    // Mask the URI for security in logs
    const maskedUri = uri.replace(/mongodb(\+srv)?:\/\/([^:]+)(:.+)?@/, "mongodb$1://$2:***@");
    console.log(`Found MONGO_URI: ${maskedUri}`);
    return uri;
  } catch (error) {
    console.error("Error reading .env file:", error.message);
    throw error;
  }
}

function calculatePriceFromReserves(reserve1, reserve0) {
  if (reserve0 === 0n) return "0";
  const scale = 10n ** 18n; 
  return ((reserve1 * scale) / reserve0).toString();
}

// Main function
async function main() { 
  let mongoClient = null;
  
  try {
    console.log("Starting price restoration using historical reserve data...");
    
    // Get MongoDB URI from .env file
    const mongoUrl = getMongoUriFromEnv();
    
    mongoClient = new MongoClient(mongoUrl);
    await mongoClient.connect();
    console.log("Connected to MongoDB");

    const db = mongoClient.db();
    const priceSnapshots = db.collection("PriceSnapshot"); 
    const reserveSnapshots = db.collection("PairReserveSnapshot");

    const snapshots = await priceSnapshots.find({}).toArray();
    console.log(`Found ${snapshots.length} price snapshots to process`);

    let updatedCount = 0;
    let errorCount = 0;
    let noReserveDataCount = 0;
    
    // Process in batches of 10 for better logging
    for (let i = 0; i < snapshots.length; i += 10) {
      const batch = snapshots.slice(i, Math.min(i + 10, snapshots.length));
      
      // Process each snapshot
      for (const snapshot of batch) {
        try {
          // Find the closest reserve snapshot by timestamp
          const reserveSnapshot = await reserveSnapshots.findOne({ 
            pairId: snapshot.pairId,
            timestamp: { $lte: snapshot.timestamp + 60, $gte: snapshot.timestamp - 60 }
          });
          
          if (!reserveSnapshot) {
            // Try with a wider time window
            const closestReserve = await reserveSnapshots.findOne(
              { pairId: snapshot.pairId },
              { sort: { timestamp: 1 } }
            );
            
            if (!closestReserve) {
              console.warn(`No reserve data found for snapshot ${snapshot._id} at time ${snapshot.timestamp}`);
              noReserveDataCount++;
              continue;
            }
            
            console.log(`Using closest available reserve snapshot for ${snapshot._id}`);
            
            // Calculate prices based on the closest reserves
            if (closestReserve.reserve0 && closestReserve.reserve1) {
              const reserve0 = BigInt(closestReserve.reserve0);
              const reserve1 = BigInt(closestReserve.reserve1);
              
              if (reserve0 > 0n && reserve1 > 0n) {
                // Calculate prices
                const price0 = calculatePriceFromReserves(reserve1, reserve0);
                const price1 = calculatePriceFromReserves(reserve0, reserve1);
                
                // Update the snapshot
                await priceSnapshots.updateOne(
                  { _id: snapshot._id },
                  { 
                    $set: { 
                      price0,
                      price1
                    } 
                  }
                );
                
                updatedCount++;
              }
            }
          } else {
            // We found a matching reserve snapshot!
            const reserve0 = BigInt(reserveSnapshot.reserve0);
            const reserve1 = BigInt(reserveSnapshot.reserve1);
            
            if (reserve0 > 0n && reserve1 > 0n) {
              // Calculate prices
              const price0 = calculatePriceFromReserves(reserve1, reserve0);
              const price1 = calculatePriceFromReserves(reserve0, reserve1);
              
              // Update the snapshot
              await priceSnapshots.updateOne(
                { _id: snapshot._id },
                { 
                  $set: { 
                    price0,
                    price1
                  } 
                }
              );
              
              updatedCount++;
            } else {
              console.warn(`Zero reserves in snapshot for pair ${snapshot.pairId} at time ${reserveSnapshot.timestamp}`);
              errorCount++;
            }
          }
        } catch (error) {
          console.error(`Error processing snapshot ${snapshot._id}:`, error);
          errorCount++;
        }
      }
      
      console.log(`Processed ${Math.min(i + 10, snapshots.length)} of ${snapshots.length} snapshots`);
    }

    console.log(`Price restoration completed. Updated ${updatedCount} snapshots. Errors: ${errorCount}. No reserve data: ${noReserveDataCount}`);
    
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

// Run the main function
main();
