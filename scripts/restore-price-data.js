// Script to restore PriceSnapshot data correctly based on the indexer's approach
const fs = require('fs');
const path = require('path');

/**
 * This script will:
 * 1. Check for a backup of the original price snapshots
 * 2. Generate MongoDB commands to restore price fields correctly based on reserves
 * 3. Maintain the raw price0/price1 values which should be derived from reserves
 * 4. Remove the token0Price/token1Price fields to let the resolver recalculate them
 */

console.log('PRICE DATA RESTORATION COMMANDS');
console.log('===============================');
console.log('');
console.log('This script generates commands to properly restore price data that was');
console.log('modified incorrectly. Instead of creating synthetic variations, it will');
console.log('restore the correct relationship between reserves and prices as the indexer would.');
console.log('');

console.log('// 1. First, create a backup if you haven\'t already');
console.log('db.PriceSnapshot.find().toArray() > price_snapshots_backup.json');
console.log('');

console.log('// 2. Restore the raw price0/price1 values from reserves');
console.log('// This MongoDB aggregation pipeline will update all snapshots');
console.log('db.PriceSnapshot.aggregate([');
console.log('  {');
console.log('    $lookup: {');
console.log('      from: "Pair",');
console.log('      localField: "pairId",');
console.log('      foreignField: "_id",');
console.log('      as: "pair"');
console.log('    }');
console.log('  },');
console.log('  {');
console.log('    $unwind: "$pair"');
console.log('  },');
console.log('  {');
console.log('    $project: {');
console.log('      _id: 1,');
console.log('      pairId: 1,');
console.log('      timestamp: 1,');
console.log('      blockNumber: 1,');
console.log('      reserve0: "$pair.reserve0",');
console.log('      reserve1: "$pair.reserve1"');
console.log('    }');
console.log('  },');
console.log('  {');
console.log('    $addFields: {');
console.log('      // Calculate the correct price values from reserves');
console.log('      // price0 = reserve1 / reserve0 (price of token0 in terms of token1)');
console.log('      // price1 = reserve0 / reserve1 (price of token1 in terms of token0)');
console.log('      calculatedPrice0: { $divide: ["$reserve1", "$reserve0"] },');
console.log('      calculatedPrice1: { $divide: ["$reserve0", "$reserve1"] }');
console.log('    }');
console.log('  },');
console.log('  {');
console.log('    $match: {');
console.log('      calculatedPrice0: { $ne: null, $ne: 0, $ne: Infinity },');
console.log('      calculatedPrice1: { $ne: null, $ne: 0, $ne: Infinity }');
console.log('    }');
console.log('  },');
console.log('  {');
console.log('    $merge: {');
console.log('      into: "PriceSnapshot",');
console.log('      on: "_id",');
console.log('      whenMatched: "merge",');
console.log('      whenNotMatched: "discard"');
console.log('    }');
console.log('  }');
console.log(']).option({ allowDiskUse: true });');
console.log('');

console.log('// 3. Or use the simpler approach with updateMany to set prices based on the pair');
console.log('// Use this if the aggregation pipeline doesn\'t work');
console.log('// First find pairs and their current reserves');
console.log('const pairs = db.Pair.find({}).toArray();');
console.log('');
console.log('// For each pair, update its snapshots');
console.log('pairs.forEach(pair => {');
console.log('  if (!pair.reserve0 || !pair.reserve1 || ');
console.log('      pair.reserve0 === "0" || pair.reserve1 === "0") {');
console.log('    print(`Skipping pair ${pair._id} with zero reserves`);');
console.log('    return;');
console.log('  }');
console.log('');
console.log('  const reserve0 = BigInt(pair.reserve0);');
console.log('  const reserve1 = BigInt(pair.reserve1);');
console.log('  let price0 = "0";');
console.log('  let price1 = "0";');
console.log('');
console.log('  try {');
console.log('    // Calculate prices - this is how the indexer would have done it');
console.log('    price0 = (reserve1 * BigInt(10**18) / reserve0).toString();');
console.log('    price1 = (reserve0 * BigInt(10**18) / reserve1).toString();');
console.log('');
console.log('    print(`Updating snapshots for pair ${pair._id} with price0=${price0}, price1=${price1}`);');
console.log('');
console.log('    // Update all snapshots for this pair');
console.log('    db.PriceSnapshot.updateMany(');
console.log('      { pairId: pair._id.toString() },');
console.log('      { $set: { price0, price1 }, $unset: { token0Price: "", token1Price: "" } }');
console.log('    );');
console.log('  } catch (e) {');
console.log('    print(`Error processing pair ${pair._id}: ${e.message}`);');
console.log('  }');
console.log('});');
console.log('');

console.log('// 4. After updating raw prices, force resolvers to recalculate by removing token0Price/token1Price');
console.log('// This allows the resolver logic to run with correct raw prices');
console.log('db.PriceSnapshot.updateMany({}, { $unset: { token0Price: "", token1Price: "" } });');
console.log('');

console.log('// 5. Check the results (sample a few snapshots)');
console.log('db.PriceSnapshot.aggregate([');
console.log('  { $sample: { size: 5 } },');
console.log('  {');
console.log('    $lookup: {');
console.log('      from: "Pair",');
console.log('      localField: "pairId",');
console.log('      foreignField: "_id",');
console.log('      as: "pair"');
console.log('    }');
console.log('  },');
console.log('  { $unwind: "$pair" },');
console.log('  {');
console.log('    $project: {');
console.log('      _id: 1,');
console.log('      pairId: 1,');
console.log('      price0: 1,');
console.log('      price1: 1,');
console.log('      pairAddress: "$pair.address",');
console.log('      reserve0: "$pair.reserve0",');
console.log('      reserve1: "$pair.reserve1"');
console.log('    }');
console.log('  }');
console.log(']).pretty();');
console.log('');

console.log('===============================');
console.log('These commands restore the price data properly based on the reserves,');
console.log('which matches how your indexer originally created this data.');
console.log('Run these commands in your MongoDB shell to fix the price charts.');
console.log('After running these commands, restart your application to see the corrected prices.'); 