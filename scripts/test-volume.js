const calculateTokenVolume24h = async (id, loaders = {}) => {
  if (!id) return 0

  let utcOneDayBack = Math.floor(Date.now() / 1000) - 24 * 60 * 60
  let swaps = []

  try {
    // Check if loaders.swap.findMany is available
    if (loaders.swap && typeof loaders.swap.findMany === 'function') {
      console.log('Using swap loader to fetch swaps...')
      swaps = await loaders.swap.findMany({
        where: {
          OR: [
            { token0Id: id, timestamp: { gte: utcOneDayBack } },
            { token1Id: id, timestamp: { gte: utcOneDayBack } }
          ]
        }
      })
    } 
    // If not, try using pair loaders if available
    else if (loaders.pair && typeof loaders.pair.loadMany === 'function') {
      console.log('Using pair loaders to fetch pairs and then swaps...')
      // Get pairs where token is token0 or token1
      const pairs = await prismaClient.pair.findMany({
        where: {
          OR: [{ token0Id: id }, { token1Id: id }]
        },
        select: { id: true }
      })
      
      if (pairs.length > 0) {
        const pairIds = pairs.map(pair => pair.id)
        // Fetch swaps for these pairs
        swaps = await prismaClient.swap.findMany({
          where: {
            pairId: { in: pairIds },
            timestamp: { gte: utcOneDayBack }
          }
        })
      }
    }
    // Fallback to direct query
    else {
      console.log('No loaders available, using direct query...')
      // Get pairs where token is token0 or token1
      const pairs = await prismaClient.pair.findMany({
        where: {
          OR: [{ token0Id: id }, { token1Id: id }]
        },
        select: { id: true }
      })
      
      if (pairs.length > 0) {
        const pairIds = pairs.map(pair => pair.id)
        // Fetch swaps for these pairs
        swaps = await prismaClient.swap.findMany({
          where: {
            pairId: { in: pairIds },
            timestamp: { gte: utcOneDayBack }
          }
        })
      }
    }

    console.log(`Found ${swaps.length} swaps for token ${id}`)
  } catch (error) {
    console.error(`Error fetching swaps for token ${id}:`, error)
    return 0
  }

  if (!swaps.length) return 0

  // Initialize the volume
  let volume = 0

  // Retrieve token for getting its price
  const token = await prismaClient.token.findUnique({
    where: { id },
    include: {
      pairsAsToken0: {
        include: {
          token1: true
        }
      },
      pairsAsToken1: {
        include: {
          token0: true
        }
      }
    }
  })

  if (!token) {
    console.error(`Token ${id} not found`)
    return 0
  }

  console.log(`Processing volume for token: ${token.symbol}`)

  // Process each swap
  for (const swap of swaps) {
    // Retrieve the pair for this swap
    const pair = await prismaClient.pair.findUnique({
      where: { id: swap.pairId },
      include: {
        token0: true,
        token1: true
      }
    })

    if (!pair) {
      console.warn(`Pair not found for swap ${swap.id}`)
      continue
    }

    // Check if the token we're calculating volume for is token0 or token1 in the pair
    const isToken0 = pair.token0Id === id
    const isToken1 = pair.token1Id === id

    if (!isToken0 && !isToken1) {
      console.warn(`Token ${id} is neither token0 nor token1 in pair ${pair.id}`)
      continue
    }

    // Get the amount of the token in the swap
    const tokenAmount = isToken0 ? swap.amount0 : swap.amount1
    
    // Get price in USD
    let priceUSD
    try {
      priceUSD = await tokenPriceService.getTokenPriceUSD(token.address)
      console.log(`Price for ${token.symbol}: $${priceUSD}`)
    } catch (error) {
      console.error(`Error getting price for token ${token.symbol}:`, error)
      priceUSD = 0
    }

    // Calculate volume in USD
    const amountUSD = parseFloat(tokenAmount) * priceUSD
    volume += amountUSD

    console.log(`Swap ${swap.id}: Amount: ${tokenAmount} ${token.symbol}, Value: $${amountUSD.toFixed(2)}`)
  }

  console.log(`Total volume for ${token.symbol}: $${volume.toFixed(2)}`)
  return volume
} 