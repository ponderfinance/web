// Script to verify how the resolver is calculating displayed prices
const fs = require('fs');
require('dotenv').config({ path: '../.env' });

// Simulate resolver price calculation for verification
function calculateDisplayPriceFromRaw(rawPrice, token0Decimals, token1Decimals, isToken0Stablecoin, isToken1Stablecoin) {
  try {
    // This mimics the code from your resolver
    if (isToken1Stablecoin) {
      // If token1 is a stablecoin, show token0's price in USD
      const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals);
      return parseFloat(rawPrice) * decimalAdjustment;
    } else if (isToken0Stablecoin) {
      // If token0 is a stablecoin, show token1's price in USD
      const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
      return parseFloat(rawPrice) * decimalAdjustment;
    } else {
      // If neither token is a stablecoin, need additional token price info
      return parseFloat(rawPrice);
    }
  } catch (error) {
    console.error('Error calculating display price:', error);
    return 0;
  }
}

console.log('RESOLVER PRICE CALCULATION VERIFICATION');
console.log('======================================');
console.log('This script helps verify how the resolver calculates displayed prices from raw values');
console.log('');

console.log('Generating sample calculations to verify:');
console.log('');

// Some sample token decimals for common scenarios
const sampleCalculations = [
  // USDT (18 decimals) paired with another token (18 decimals)
  {
    pairDesc: 'USDT (18 decimals) - TOKEN (18 decimals)',
    rawPrice0: '1000000000000000000', // 1.0 in wei format
    token0Decimals: 18,
    token1Decimals: 18,
    isToken0Stablecoin: true,
    isToken1Stablecoin: false
  },
  // USDT (18 decimals) paired with a token with 9 decimals
  {
    pairDesc: 'USDT (18 decimals) - TOKEN (9 decimals)',
    rawPrice0: '1000000000', // 1.0 in smaller decimal format
    token0Decimals: 18,
    token1Decimals: 9,
    isToken0Stablecoin: true,
    isToken1Stablecoin: false
  },
  // KOI (hypothetical 18 decimals) paired with USDT (18 decimals)
  {
    pairDesc: 'KOI (18 decimals) - USDT (18 decimals)',
    rawPrice0: '1000000000000000', // 0.001 in wei format
    token0Decimals: 18,
    token1Decimals: 18,
    isToken0Stablecoin: false,
    isToken1Stablecoin: true
  }
];

// Display the sample calculations
sampleCalculations.forEach(sample => {
  console.log(`Pair: ${sample.pairDesc}`);
  console.log(`Raw price: ${sample.rawPrice0}`);
  console.log(`Display price (calculated by resolver): ${calculateDisplayPriceFromRaw(
    sample.rawPrice0,
    sample.token0Decimals,
    sample.token1Decimals,
    sample.isToken0Stablecoin,
    sample.isToken1Stablecoin
  )}`);
  console.log('');
});

console.log('MongoDB commands to check your specific KOI pairs:');
console.log('');

console.log('// Find the KOI token and its decimals');
console.log('const koiToken = db.Token.findOne({ symbol: "KOI" });');
console.log('print(`KOI token found: ${koiToken.address}, decimals: ${koiToken.decimals}`);');
console.log('');

console.log('// Find pairs with KOI');
console.log('const koiPairs = db.Pair.find({');
console.log('  $or: [');
console.log('    { token0Id: koiToken._id.toString() },');
console.log('    { token1Id: koiToken._id.toString() }');
console.log('  ]');
console.log('}).toArray();');
console.log('');

console.log('// For each pair, get counterpart token and sample prices');
console.log('koiPairs.forEach(pair => {');
console.log('  const isKoiToken0 = pair.token0Id === koiToken._id.toString();');
console.log('  const counterpartId = isKoiToken0 ? pair.token1Id : pair.token0Id;');
console.log('  const counterpartToken = db.Token.findOne({ _id: counterpartId });');
console.log('  ');
console.log('  print(`\\nPair: ${pair.address}`);');
console.log('  print(`KOI is ${isKoiToken0 ? "token0" : "token1"}`);');
console.log('  print(`Counterpart: ${counterpartToken.symbol}, decimals: ${counterpartToken.decimals}`);');
console.log('  ');
console.log('  // Check if counterpart is a stablecoin');
console.log('  const isCounterpartStablecoin = ["USDT", "USDC", "DAI", "BUSD"].includes(counterpartToken.symbol);');
console.log('  print(`Paired with stablecoin: ${isCounterpartStablecoin}`);');
console.log('  ');
console.log('  // Get a sample price snapshot');
console.log('  const snapshot = db.PriceSnapshot.findOne({ pairId: pair._id.toString() });');
console.log('  if (snapshot) {');
console.log('    print(`Sample snapshot price0: ${snapshot.price0}`);');
console.log('    print(`Sample snapshot price1: ${snapshot.price1}`);');
console.log('    ');
console.log('    // Calculate the price that would be displayed');
console.log('    try {');
console.log('      const rawPrice = isKoiToken0 ? snapshot.price0 : snapshot.price1;');
console.log('      const koiDecimals = koiToken.decimals || 18;');
console.log('      const counterpartDecimals = counterpartToken.decimals || 18;');
console.log('      ');
console.log('      if (isCounterpartStablecoin) {');
console.log('        if (isKoiToken0) {');
console.log('          // KOI is token0, counterpart is stablecoin (token1)');
console.log('          const decimalAdjustment = Math.pow(10, counterpartDecimals - koiDecimals);');
console.log('          const displayPrice = parseFloat(rawPrice) * decimalAdjustment;');
console.log('          print(`Calculated display price for KOI: $${displayPrice}`);');
console.log('        } else {');
console.log('          // KOI is token1, counterpart is stablecoin (token0)');
console.log('          const decimalAdjustment = Math.pow(10, koiDecimals - counterpartDecimals);');
console.log('          const displayPrice = parseFloat(rawPrice) * decimalAdjustment;');
console.log('          print(`Calculated display price for KOI: $${displayPrice}`);');
console.log('        }');
console.log('      } else {');
console.log('        print("Non-stablecoin pair, would need additional price info");');
console.log('      }');
console.log('    } catch (e) {');
console.log('      print(`Error calculating price: ${e.message}`);');
console.log('    }');
console.log('  } else {');
console.log('    print("No price snapshots found for this pair");');
console.log('  }');
console.log('});');
console.log('');

console.log('======================================');
console.log('After running the MongoDB commands above, you should be able to see:');
console.log('1. The exact token decimals for KOI and counterpart tokens');
console.log('2. The raw price values stored in snapshots');
console.log('3. How those values would be converted to USD display prices');
console.log('');
console.log('This information will help verify if the resolver is working correctly');
console.log('with the restored price data. If the calculated display price matches');
console.log('what you expect (~$0.00160), then the restoration is working properly.'); 