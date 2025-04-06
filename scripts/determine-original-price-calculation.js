const { MongoClient, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
async function main() {
  let mongoClient = null;
  try {
    console.log("Analyzing how original prices were calculated...");
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
    // Get a backup price snapshot to analyze original values
    const backup = db.collection("PriceSnapshot_Backup");
    const sample = await backup.findOne({});
    if (!sample) {
      console.log("No backup sample found.");
      return;
    }
    console.log("Sample from backup:");
    console.log(JSON.stringify({
      pairId: sample.pairId,
      price0: sample.price0,
      price1: sample.price1,
    }, null, 2));
    
    // Get a matching reserve snapshot (if available)
    const reserveSnapshots = db.collection("PairReserveSnapshot");
    const matchingReserve = await reserveSnapshots.findOne({
      pairId: sample.pairId,
      timestamp: { $lte: sample.timestamp + 5, $gte: sample.timestamp - 5 }
    });
    
    if (matchingReserve) {
      console.log("\nMatching reserve snapshot:");
      console.log(JSON.stringify({
        pairId: matchingReserve.pairId,
        timestamp: matchingReserve.timestamp,
        reserve0: matchingReserve.reserve0,
        reserve1: matchingReserve.reserve1,
      }, null, 2));
      
      // Try different calculations to see which one reproduces the original price
      const reserve0 = BigInt(matchingReserve.reserve0);
      const reserve1 = BigInt(matchingReserve.reserve1);
      const price0FromBackup = sample.price0;
      const price1FromBackup = sample.price1;
      
      // Calculate with different formulas
      const scale = 10n ** 18n;
      const calc1_price0 = ((reserve1 * scale) / reserve0).toString();
      const calc1_price1 = ((reserve0 * scale) / reserve1).toString();
      
      const calc2_price0 = (reserve1 * scale / reserve0).toString();
      const calc2_price1 = (reserve0 * scale / reserve1).toString();
      
      // Check if any calculation matches original values
      console.log("\nCalculation tests:");
      console.log(`Original price0: ${price0FromBackup}`);
      console.log(`Original price1: ${price1FromBackup}`);
      console.log(`\nCalc1 price0: ${calc1_price0}`);
      console.log(`Calc1 price1: ${calc1_price1}`);
      console.log(`Match price0: ${calc1_price0 === price0FromBackup}`);
      console.log(`Match price1: ${calc1_price1 === price1FromBackup}`);
      
      console.log(`\nCalc2 price0: ${calc2_price0}`);
      console.log(`Calc2 price1: ${calc2_price1}`);
      console.log(`Match price0: ${calc2_price0 === price0FromBackup}`);
      console.log(`Match price1: ${calc2_price1 === price1FromBackup}`);
      
      // Try to find the closest match
      console.log("\nClosest calculation:");
      const original0 = BigInt(price0FromBackup);
      const original1 = BigInt(price1FromBackup);
      
      // Try calculations with different scales
      for (let i = 10; i <= 25; i++) {
        const testScale = 10n ** BigInt(i);
        const test0 = (reserve1 * testScale) / reserve0;
        const test1 = (reserve0 * testScale) / reserve1;
        
        // Calculate how close we are
        const diff0 = (test0 > original0) ? test0 - original0 : original0 - test0;
        const diff1 = (test1 > original1) ? test1 - original1 : original1 - test1;
        const percentError0 = (diff0 * 10000n) / original0;
        const percentError1 = (diff1 * 10000n) / original1;
        
        console.log(`Scale 10^${i}:`);
        console.log(` - price0: ${test0.toString()}`);
        console.log(` - price1: ${test1.toString()}`);
        console.log(` - error0: ${(percentError0 / 100n).toString()}.${(percentError0 % 100n).toString().padStart(2, "0")}%`);
        console.log(` - error1: ${(percentError1 / 100n).toString()}.${(percentError1 % 100n).toString().padStart(2, "0")}%`);
      }
    } else {
      console.log("No matching reserve snapshot found. Trying different timestamp ranges...");
      // Try with a wider time window
      for (let window = 10; window <= 3600; window *= 2) {
        const widerMatch = await reserveSnapshots.findOne({
          pairId: sample.pairId,
          timestamp: { $lte: sample.timestamp + window, $gte: sample.timestamp - window }
        });
        
        if (widerMatch) {
          console.log(`Found match with time window: ${window} seconds`);
          console.log(JSON.stringify({
            pairId: widerMatch.pairId,
            timestamp: widerMatch.timestamp,
            timeDiff: Math.abs(widerMatch.timestamp - sample.timestamp),
            reserve0: widerMatch.reserve0,
            reserve1: widerMatch.reserve1,
          }, null, 2));
          break;
        }
        
        if (window >= 3600) {
          console.log("No matching reserve snapshot found even with extended window.");
        }
      }
    }
    
  } catch (error) {
    console.error("Analysis failed:", error);
  } finally {
    if (mongoClient) {
      await mongoClient.close();
      console.log("MongoDB connection closed");
    }
  }
}

main();
