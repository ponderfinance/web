const { PrismaClient } = require('@prisma/client');
const { formatUnits } = require('viem');

async function verifyPriceCalculation() {
  console.log('Verifying price calculations for stablecoins...');
  const prisma = new PrismaClient();
  
  try {
    // Get KKUB token for reference
    const kkubToken = await prisma.token.findFirst({
      where: { symbol: 'KKUB' },
      select: {
        id: true,
        address: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    console.log(`KKUB price: $${kkubToken.priceUSD}`);
    
    // Check USDT price calculation
    console.log('\n--- USDT Price Verification ---');
    const usdt = await prisma.token.findFirst({
      where: { symbol: 'USDT' },
      select: {
        id: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    console.log(`Current USDT price in DB: $${usdt.priceUSD}`);
    
    // Find USDT-KKUB pair
    const usdtPair = await prisma.pair.findFirst({
      where: {
        OR: [
          { token0Id: usdt.id, token1Id: kkubToken.id },
          { token0Id: kkubToken.id, token1Id: usdt.id }
        ]
      },
      include: {
        token0: true,
        token1: true
      }
    });
    
    console.log('\nUST/KKUB Pair Analysis:');
    console.log(`Token0: ${usdtPair.token0.symbol}`);
    console.log(`Token1: ${usdtPair.token1.symbol}`);
    console.log(`Reserve0: ${usdtPair.reserve0}`);
    console.log(`Reserve1: ${usdtPair.reserve1}`);
    console.log(`Token0 Decimals: ${usdtPair.token0.decimals}`);
    console.log(`Token1 Decimals: ${usdtPair.token1.decimals}`);
    
    // Calculate USDT price
    const isUsdtToken0 = usdtPair.token0Id === usdt.id;
    console.log(`USDT is token0: ${isUsdtToken0}`);
    
    const reserve0 = BigInt(usdtPair.reserve0);
    const reserve1 = BigInt(usdtPair.reserve1);
    
    if (reserve0 <= 0n || reserve1 <= 0n) {
      console.log('Invalid reserves (zero or negative)');
      return;
    }
    
    const token0Decimals = usdtPair.token0.decimals || 18;
    const token1Decimals = usdtPair.token1.decimals || 18;
    
    // Calculate price based on which token is USDT
    let priceRatio;
    if (isUsdtToken0) {
      // USDT is token0, calculate: KKUB per USDT = reserve1 / reserve0 (adjusted for decimals)
      console.log('\nCalculation when USDT is token0:');
      console.log(`Formula: (reserve1 * 10^token0Decimals) / reserve0`);
      console.log(`= (${reserve1} * 10^${token0Decimals}) / ${reserve0}`);
      
      const adjustedReserve1 = reserve1 * BigInt(10 ** token0Decimals);
      console.log(`Adjusted reserve1: ${adjustedReserve1}`);
      
      const rawRatio = adjustedReserve1 / reserve0;
      console.log(`Raw ratio: ${rawRatio}`);
      
      priceRatio = Number(formatUnits(rawRatio, token1Decimals));
      console.log(`Price ratio after format units (decimals ${token1Decimals}): ${priceRatio}`);
      console.log('This represents how much KKUB you get for 1 USDT');
      
      // Calculate USDT price in USD
      const usdtPriceUSD = priceRatio * parseFloat(kkubToken.priceUSD);
      console.log(`\nFinal USDT price in USD = ${priceRatio} * ${kkubToken.priceUSD} = $${usdtPriceUSD}`);
    } else {
      // USDT is token1, calculate: USDT per KKUB = reserve0 / reserve1 (adjusted for decimals)
      console.log('\nCalculation when USDT is token1:');
      console.log(`Formula: (reserve0 * 10^token1Decimals) / reserve1`);
      console.log(`= (${reserve0} * 10^${token1Decimals}) / ${reserve1}`);
      
      const adjustedReserve0 = reserve0 * BigInt(10 ** token1Decimals);
      console.log(`Adjusted reserve0: ${adjustedReserve0}`);
      
      const rawRatio = adjustedReserve0 / reserve1;
      console.log(`Raw ratio: ${rawRatio}`);
      
      priceRatio = Number(formatUnits(rawRatio, token0Decimals));
      console.log(`Price ratio after format units (decimals ${token0Decimals}): ${priceRatio}`);
      console.log('This represents how much USDT you get for 1 KKUB');
      
      // Calculate USDT price in USD
      const usdtPriceUSD = parseFloat(kkubToken.priceUSD) / priceRatio;
      console.log(`\nFinal USDT price in USD = ${kkubToken.priceUSD} / ${priceRatio} = $${usdtPriceUSD}`);
    }
    
    // Now check USDC price calculation
    console.log('\n\n--- USDC Price Verification ---');
    const usdc = await prisma.token.findFirst({
      where: { symbol: 'USDC' },
      select: {
        id: true,
        symbol: true,
        decimals: true,
        priceUSD: true
      }
    });
    
    console.log(`Current USDC price in DB: $${usdc.priceUSD}`);
    
    // Find USDC-KKUB pair
    const usdcPair = await prisma.pair.findFirst({
      where: {
        OR: [
          { token0Id: usdc.id, token1Id: kkubToken.id },
          { token0Id: kkubToken.id, token1Id: usdc.id }
        ]
      },
      include: {
        token0: true,
        token1: true
      }
    });
    
    console.log('\nUSDC/KKUB Pair Analysis:');
    console.log(`Token0: ${usdcPair.token0.symbol}`);
    console.log(`Token1: ${usdcPair.token1.symbol}`);
    console.log(`Reserve0: ${usdcPair.reserve0}`);
    console.log(`Reserve1: ${usdcPair.reserve1}`);
    console.log(`Token0 Decimals: ${usdcPair.token0.decimals}`);
    console.log(`Token1 Decimals: ${usdcPair.token1.decimals}`);
    
    // Calculate USDC price
    const isUsdcToken0 = usdcPair.token0Id === usdc.id;
    console.log(`USDC is token0: ${isUsdcToken0}`);
    
    const usdcReserve0 = BigInt(usdcPair.reserve0);
    const usdcReserve1 = BigInt(usdcPair.reserve1);
    
    if (usdcReserve0 <= 0n || usdcReserve1 <= 0n) {
      console.log('Invalid reserves (zero or negative)');
      return;
    }
    
    const usdcToken0Decimals = usdcPair.token0.decimals || 18;
    const usdcToken1Decimals = usdcPair.token1.decimals || 18;
    
    // Calculate price based on which token is USDC
    let usdcPriceRatio;
    if (isUsdcToken0) {
      // USDC is token0, calculate: KKUB per USDC = reserve1 / reserve0 (adjusted for decimals)
      console.log('\nCalculation when USDC is token0:');
      console.log(`Formula: (reserve1 * 10^token0Decimals) / reserve0`);
      console.log(`= (${usdcReserve1} * 10^${usdcToken0Decimals}) / ${usdcReserve0}`);
      
      const adjustedReserve1 = usdcReserve1 * BigInt(10 ** usdcToken0Decimals);
      console.log(`Adjusted reserve1: ${adjustedReserve1}`);
      
      const rawRatio = adjustedReserve1 / usdcReserve0;
      console.log(`Raw ratio: ${rawRatio}`);
      
      usdcPriceRatio = Number(formatUnits(rawRatio, usdcToken1Decimals));
      console.log(`Price ratio after format units (decimals ${usdcToken1Decimals}): ${usdcPriceRatio}`);
      console.log('This represents how much KKUB you get for 1 USDC');
      
      // Calculate USDC price in USD
      const usdcPriceUSD = usdcPriceRatio * parseFloat(kkubToken.priceUSD);
      console.log(`\nFinal USDC price in USD = ${usdcPriceRatio} * ${kkubToken.priceUSD} = $${usdcPriceUSD}`);
    } else {
      // USDC is token1, calculate: USDC per KKUB = reserve0 / reserve1 (adjusted for decimals)
      console.log('\nCalculation when USDC is token1:');
      console.log(`Formula: (reserve0 * 10^token1Decimals) / reserve1`);
      console.log(`= (${usdcReserve0} * 10^${usdcToken1Decimals}) / ${usdcReserve1}`);
      
      const adjustedReserve0 = usdcReserve0 * BigInt(10 ** usdcToken1Decimals);
      console.log(`Adjusted reserve0: ${adjustedReserve0}`);
      
      const rawRatio = adjustedReserve0 / usdcReserve1;
      console.log(`Raw ratio: ${rawRatio}`);
      
      usdcPriceRatio = Number(formatUnits(rawRatio, usdcToken0Decimals));
      console.log(`Price ratio after format units (decimals ${usdcToken0Decimals}): ${usdcPriceRatio}`);
      console.log('This represents how much USDC you get for 1 KKUB');
      
      // Calculate USDC price in USD
      const usdcPriceUSD = parseFloat(kkubToken.priceUSD) / usdcPriceRatio;
      console.log(`\nFinal USDC price in USD = ${kkubToken.priceUSD} / ${usdcPriceRatio} = $${usdcPriceUSD}`);
    }
    
  } catch (error) {
    console.error('Error verifying price calculations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the verification
verifyPriceCalculation()
  .then(() => {
    console.log('\nVerification completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Verification failed:', error);
    process.exit(1);
  }); 