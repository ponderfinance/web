const { MongoClient, ObjectId } = require('mongodb');
const { createPublicClient, http, decodeEventLog, AbiEvent, Log } = require('viem');
// const { bitkub_mainnet } = require('viem/chains'); // Viem doesn't export this directly
// Use path alias from tsconfig
const { CURRENT_CHAIN } = require('@/src/constants/chains');
// --- TypeScript Configuration Note ---
// This script uses BigInt literals (e.g., 10n ** 18n).
// Ensure your tsconfig.json has "target": "ES2020" or higher.
// --- ----------------------------- ---
// Add ABI definition for Sync event (simplified)
const PAIR_ABI_SYNC_EVENT = [{
        type: 'event',
        name: 'Sync',
        inputs: [
            { name: 'reserve0', type: 'uint112', indexed: false, internalType: 'uint112' },
            { name: 'reserve1', type: 'uint112', indexed: false, internalType: 'uint112' },
        ],
        anonymous: false,
    }];
// Assuming RPC URL is available via env or hardcoded
const rpcUrl = process.env.RPC_URL || CURRENT_CHAIN.rpcUrls.default.http[0];
const publicClient = createPublicClient({
    chain: CURRENT_CHAIN,
    transport: http(rpcUrl),
});
function calculatePriceFromReserves(reserve1, reserve0) {
    if (reserve0 === 0n)
        return '0';
    const scale = 10n ** 18n;
    return ((reserve1 * scale) / reserve0).toString();
}
// Ensure only one main function definition
async function main() {
    let mongoClient = null;
    try {
        console.log('Starting historical price restoration...');
        const mongoUrl = process.env.MONGO_URI;
        if (!mongoUrl) {
            throw new Error('MONGO_URI environment variable is not set');
        }
        mongoClient = new MongoClient(mongoUrl);
        await mongoClient.connect();
        console.log('Connected to MongoDB');
        if (!mongoClient) {
            throw new Error('MongoDB client is not connected.');
        }
        const db = mongoClient.db();
        // Remove generics from collection calls
        const priceSnapshots = db.collection('PriceSnapshot');
        const pairs = db.collection('Pair');
        // Cast result after fetching
        const snapshots = await priceSnapshots.find({}).toArray();
        console.log(`Found ${snapshots.length} price snapshots to process`);
        let updatedCount = 0;
        let errorCount = 0;
        const batchSize = 50;
        for (let i = 0; i < snapshots.length; i += batchSize) {
            const batch = snapshots.slice(i, i + batchSize);
            const updatePromises = batch.map(async (snapshot) => {
                try {
                    const pairObjectId = typeof snapshot.pairId === 'string' ? new ObjectId(snapshot.pairId) : snapshot.pairId;
                    // Cast result after findOne
                    const pair = await pairs.findOne({ _id: pairObjectId });
                    if (!pair) {
                        console.warn(`No pair found for snapshot ${snapshot._id} with pairId ${snapshot.pairId}`);
                        errorCount++;
                        return;
                    }
                    const blockNumber = BigInt(snapshot.blockNumber);
                    let blockTimestamp;
                    try {
                        const block = await publicClient.getBlock({ blockNumber: blockNumber });
                        blockTimestamp = Number(block.timestamp);
                    }
                    catch (blockError) {
                        console.error(`Error fetching block ${snapshot.blockNumber} for snapshot ${snapshot._id}:`, blockError);
                        errorCount++;
                        return;
                    }
                    let historicalReserve0 = null;
                    let historicalReserve1 = null;
                    try {
                        // Use typeof Log for type annotation
                        const logs = await publicClient.getLogs({
                            address: pair.address,
                            // Use typeof AbiEvent for cast
                            event: PAIR_ABI_SYNC_EVENT[0],
                            fromBlock: blockNumber,
                            toBlock: blockNumber,
                        });
                        if (logs.length === 0) {
                            console.warn(`No Sync event found for pair ${pair.address} at block ${snapshot.blockNumber} (snapshot ${snapshot._id})`);
                            errorCount++;
                            return;
                        }
                        const syncLog = logs[logs.length - 1];
                        const decodedEvent = decodeEventLog({
                            // Use typeof AbiEvent for cast
                            abi: PAIR_ABI_SYNC_EVENT,
                            data: syncLog.data,
                            topics: syncLog.topics,
                        });
                        const args = decodedEvent.args;
                        if (decodedEvent.eventName === 'Sync' &&
                            args &&
                            typeof args.reserve0 === 'bigint' &&
                            typeof args.reserve1 === 'bigint') {
                            historicalReserve0 = args.reserve0;
                            historicalReserve1 = args.reserve1;
                        }
                        else {
                            console.error(`Failed to decode Sync event or invalid args for pair ${pair.address} at block ${snapshot.blockNumber} (snapshot ${snapshot._id})`, { args: decodedEvent.args });
                            errorCount++;
                            return;
                        }
                    }
                    catch (logError) {
                        console.error(`Error fetching/decoding Sync log for pair ${pair.address} at block ${snapshot.blockNumber} (snapshot ${snapshot._id}):`, logError);
                        errorCount++;
                        return;
                    }
                    if (historicalReserve0 === null || historicalReserve1 === null) {
                        return;
                    }
                    if (historicalReserve0 > 0n && historicalReserve1 > 0n) {
                        const token0Price = calculatePriceFromReserves(historicalReserve1, historicalReserve0);
                        const token1Price = calculatePriceFromReserves(historicalReserve0, historicalReserve1);
                        await priceSnapshots.updateOne({ _id: snapshot._id }, // Cast _id to any
                        {
                            $set: {
                                token0Price,
                                token1Price,
                                timestamp: blockTimestamp,
                            },
                        });
                        return true;
                    }
                    else {
                        console.log(`Skipping snapshot ${snapshot._id} due to zero historical reserves at block ${snapshot.blockNumber}`);
                        return false;
                    }
                }
                catch (error) {
                    console.error(`Error processing snapshot ${snapshot._id}:`, error);
                    errorCount++;
                    return false;
                }
            });
            const results = await Promise.all(updatePromises);
            const successfulUpdatesInBatch = results.filter(res => res === true).length;
            updatedCount += successfulUpdatesInBatch;
            console.log(`Batch ${Math.floor(i / batchSize) + 1} processed. Updated ${updatedCount} snapshots so far. Errors/Skipped in batch: ${batch.length - successfulUpdatesInBatch}. Total errors/skipped: ${errorCount}`);
        }
        console.log(`Historical price restoration completed. Successfully updated ${updatedCount} snapshots. Encountered ${errorCount} errors or skipped snapshots.`);
    }
    catch (error) {
        console.error('Historical price restoration failed:', error);
        process.exitCode = 1;
    }
    finally {
        if (mongoClient) {
            await mongoClient.close();
            console.log('MongoDB connection closed.');
        }
    }
}
main();
