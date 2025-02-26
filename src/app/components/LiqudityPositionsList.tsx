import React, { useState, useEffect } from 'react'
import { Text, Card, View, Button, Skeleton, Modal } from 'reshaped'
import { usePonderSDK, useRemoveLiquidity } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { Address, formatUnits, formatEther } from 'viem'
import { erc20Abi } from 'viem'

interface Position {
  pairAddress: Address
  token0: {
    address: Address
    symbol: string
    decimals: number
  }
  token1: {
    address: Address
    symbol: string
    decimals: number
  }
  userLPBalance: bigint
  totalSupply: bigint
  reserve0: bigint
  reserve1: bigint
  poolShare: string
  token0Amount: string
  token1Amount: string
  stakedInFarm: boolean
  isWETHPair: boolean
  tokenAddress?: Address
}

export default function LiquidityPositionsList() {
  const sdk = usePonderSDK()
  const account = useAccount()
  const [positions, setPositions] = useState<Position[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isModalActive, setIsModalActive] = useState(false)
  const [percentToRemove, setPercentToRemove] = useState('100')
  const [isApproving, setIsApproving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(false)
  const removeLiquidity = useRemoveLiquidity()

  // Check if approval is needed
  const checkApproval = async () => {
    if (!selectedPosition || !sdk || !account.address) return true

    try {
      console.log('Checking approval for pair:', selectedPosition.pairAddress)
      console.log('Router address:', sdk.router.address)

      const pair = sdk.getPair(selectedPosition.pairAddress)

      // Check router approval
      const routerAllowance = await pair.allowance(
        account.address as Address,
        sdk.router.address
      )

      console.log('Router allowance:', formatEther(routerAllowance))
      console.log('LP balance:', formatEther(selectedPosition.userLPBalance))

      const needsApproval = routerAllowance < selectedPosition.userLPBalance
      console.log('Needs approval:', needsApproval)

      return needsApproval
    } catch (err) {
      console.error('Error checking approval:', err)
      return true
    }
  }

  // Handle approval of LP tokens
  const handleApprove = async () => {
    if (!selectedPosition || !sdk || !account.address) return

    try {
      setIsApproving(true)
      setError('')

      const pair = sdk.getPair(selectedPosition.pairAddress)

      // Only approve router
      console.log('Approving router...')
      const routerTx = await pair.approve(
        sdk.router.address,
        selectedPosition.userLPBalance
      )
      // await routerTx.wait()
      // console.log('Router approval confirmed:', routerTx.hash)

      setNeedsApproval(false)
    } catch (err) {
      console.error('Approval error:', err)
      setError('Failed to approve tokens. Please try again.')
    } finally {
      setIsApproving(false)
    }
  }

  // Handle router-based removal using the SDK hook
// Handle router-based removal using the SDK hook
  const handleRemoveLiquidity = async () => {
    if (!selectedPosition || !sdk || !account.address) return;

    try {
      setIsRemoving(true);
      setError('');
      console.log('Starting remove liquidity via router...');

      // Calculate liquidity amount based on percentage
      const percent = parseFloat(percentToRemove) || 0;
      const liquidityBigInt = selectedPosition.userLPBalance;
      const liquidityToRemove =
          (liquidityBigInt * BigInt(Math.floor(percent))) / BigInt(100);

      console.log('Removing liquidity:', formatEther(liquidityToRemove));
      console.log('Is WETH pair:', selectedPosition.isWETHPair);

      // Get token information
      const pair = sdk.getPair(selectedPosition.pairAddress);
      const [token0, token1] = await Promise.all([
        pair.token0(),
        pair.token1(),
      ]);

      // Calculate safer minimum output values with 95% slippage protection
      const expectedToken0 = (liquidityToRemove * selectedPosition.reserve0) / selectedPosition.totalSupply;
      const expectedToken1 = (liquidityToRemove * selectedPosition.reserve1) / selectedPosition.totalSupply;

      // Apply 5% slippage tolerance
      const safeMinToken0 = (expectedToken0 * BigInt(95)) / BigInt(100);
      const safeMinToken1 = (expectedToken1 * BigInt(95)) / BigInt(100);

      console.log('Expected output amounts:', {
        expectedToken0: expectedToken0.toString(),
        expectedToken1: expectedToken1.toString(),
        safeMinToken0: safeMinToken0.toString(),
        safeMinToken1: safeMinToken1.toString()
      });

      if (selectedPosition.isWETHPair) {
        console.log('Removing from ETH pair');

        // Get KKUB address
        const kkubAddress = await sdk.router.KKUB();

        // Determine which token is ETH
        const isToken0KKUB = token0.toLowerCase() === kkubAddress.toLowerCase();
        const nonKKUBToken = isToken0KKUB ? token1 : token0;
        const tokenMin = isToken0KKUB ? safeMinToken1 : safeMinToken0;
        const ethMin = isToken0KKUB ? safeMinToken0 : safeMinToken1;

        console.log('ETH pair details:', {
          isToken0KKUB,
          nonKKUBToken,
          tokenMin: tokenMin.toString(),
          ethMin: ethMin.toString()
        });

        // For ETH pairs, use special ETH parameters
        const result = await removeLiquidity.mutateAsync({
          pairAddress: selectedPosition.pairAddress,
          liquidity: liquidityToRemove,
          token0Min: safeMinToken0,
          token1Min: safeMinToken1,
          isETHPair: true,
          tokenAddress: nonKKUBToken,
          amountTokenMin: tokenMin,
          amountETHMin: ethMin,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 minutes
          toAddress: account.address,
          // Enable if you know this is a fee-on-transfer token
          supportsFeeOnTransfer: selectedPosition.isFeeOnTransfer || false,
        });

        console.log('ETH pair liquidity removal result:', result);
      } else {
        console.log('Removing from standard token pair');
        console.log('Token pair details:', {
          token0,
          token1,
          safeMinToken0: safeMinToken0.toString(),
          safeMinToken1: safeMinToken1.toString()
        });

        // Standard token pair removal
        const result = await removeLiquidity.mutateAsync({
          pairAddress: selectedPosition.pairAddress,
          liquidity: liquidityToRemove,
          token0Min: safeMinToken0,
          token1Min: safeMinToken1,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200), // 20 minutes
          toAddress: account.address,
        });

        console.log('Standard pair liquidity removal result:', result);
      }

      await fetchPositions();
      setIsModalActive(false);
    } catch (err) {
      console.error('Error removing liquidity:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to remove liquidity. Check console for details.');
      }
    } finally {
      setIsRemoving(false);
    }
  };
  // Fetch all user's liquidity positions
  const fetchPositions = async () => {
    if (!sdk || !account.address) return

    try {
      setIsLoading(true)
      setError('')

      // Get WETH address for identifying ETH pairs
      const wethAddress = await sdk.router.KKUB()
      console.log('WETH address:', wethAddress)

      // Get all pairs from factory
      const allPairs = await sdk.factory.getAllPairs()
      const positions: Position[] = []

      // Check each pair for user's position
      for (const pairAddress of allPairs) {
        const pair = sdk.getPair(pairAddress)
        const lpBalance = await pair.balanceOf(account.address)

        // If user has no balance in this pair, skip
        if (lpBalance === BigInt(0)) continue

        // Get pair details
        const [token0, token1, reserves, totalSupply] = await Promise.all([
          pair.token0(),
          pair.token1(),
          pair.getReserves(),
          pair.totalSupply(),
        ])

        // Get token info
        const [token0Symbol, token1Symbol, token0Decimals, token1Decimals] =
          await Promise.all([
            sdk.publicClient.readContract({
              address: token0,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: token1,
              abi: erc20Abi,
              functionName: 'symbol',
            }),
            sdk.publicClient.readContract({
              address: token0,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
            sdk.publicClient.readContract({
              address: token1,
              abi: erc20Abi,
              functionName: 'decimals',
            }),
          ])

        // Calculate share of the pool
        const poolShare = ((Number(lpBalance) / Number(totalSupply)) * 100).toFixed(2)

        // Calculate token amounts based on share
        const token0Amount = formatUnits(
          (lpBalance * reserves.reserve0) / totalSupply,
          token0Decimals
        )
        const token1Amount = formatUnits(
          (lpBalance * reserves.reserve1) / totalSupply,
          token1Decimals
        )

        // Check if this is a WETH pair
        const isWETHPair =
          token0.toLowerCase() === wethAddress.toLowerCase() ||
          token1.toLowerCase() === wethAddress.toLowerCase()

        // If it's a WETH pair, determine which token is the non-WETH token
        const tokenAddress = isWETHPair
          ? token0.toLowerCase() === wethAddress.toLowerCase()
            ? token1
            : token0
          : undefined

        positions.push({
          pairAddress,
          token0: {
            address: token0,
            symbol: token0Symbol,
            decimals: token0Decimals,
          },
          token1: {
            address: token1,
            symbol: token1Symbol,
            decimals: token1Decimals,
          },
          userLPBalance: lpBalance,
          totalSupply,
          reserve0: reserves.reserve0,
          reserve1: reserves.reserve1,
          poolShare,
          token0Amount,
          token1Amount,
          stakedInFarm: false,
          isWETHPair,
          tokenAddress,
        })
      }

      setPositions(positions)
    } catch (err) {
      console.error('Error fetching positions:', err)
      setError('Failed to fetch liquidity positions')
    } finally {
      setIsLoading(false)
    }
  }

  // Open modal and check approvals
  const openRemoveModal = async (position: Position) => {
    setSelectedPosition(position)
    setPercentToRemove('100')
    setError('')
    setIsModalActive(true)

    // Check if approval is needed
    const needsApprove = await checkApproval()
    setNeedsApproval(needsApprove)
  }

  // Format expected output amounts
  const formatExpectedOutput = (position: Position) => {
    if (!position) return { token0: '0', token1: '0' }

    const percent = parseFloat(percentToRemove) || 0
    const token0Value = parseFloat(position.token0Amount)
    const token1Value = parseFloat(position.token1Amount)

    return {
      token0: ((token0Value * percent) / 100).toFixed(6),
      token1: ((token1Value * percent) / 100).toFixed(6),
    }
  }

  // Load positions on mount and when account changes
  useEffect(() => {
    if (sdk && account.address) {
      fetchPositions()
    }

    const interval = setInterval(() => {
      if (sdk && account.address) {
        fetchPositions()
      }
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [sdk, account.address])

  return (
    <View gap={16}>
      {isLoading && (
        <View direction="column" gap={4}>
          <Skeleton height={20} width="100%" />
          <Skeleton height={20} width="100%" />
        </View>
      )}

      {error && <Text>{error}</Text>}

      {positions.length === 0 && !isLoading && (
        <Text align="center">No liquidity positions found.</Text>
      )}

      {positions.map((position) => (
        <Card key={position.pairAddress}>
          <View direction="column" gap={16}>
            <View gap={4}>
              <Text variant="featured-1">
                {position.token0.symbol}/{position.token1.symbol}
                {position.isWETHPair && ' (ETH Pair)'}
              </Text>
              <Text variant="body-3">Pair: {position.pairAddress}</Text>
            </View>

            <View gap={8} direction="column">
              <View direction="row" justify="space-between">
                <Text>Your Pool Share:</Text>
                <Text>{position.poolShare}%</Text>
              </View>

              <View direction="row" justify="space-between">
                <Text>Your Position:</Text>
                <View gap={2} direction="column" align="end">
                  <Text>
                    {position.token0Amount} {position.token0.symbol}
                  </Text>
                  <Text>
                    {position.token1Amount} {position.token1.symbol}
                  </Text>
                </View>
              </View>

              <View direction="row" justify="space-between">
                <Text>LP Tokens:</Text>
                <View gap={2} direction="column" align="end">
                  <Text>{formatEther(position.userLPBalance)}</Text>
                  {position.stakedInFarm && <Text color="positive">Farming Active</Text>}
                </View>
              </View>

              <Button
                disabled={position.stakedInFarm}
                color={position.stakedInFarm ? 'neutral' : 'primary'}
                onClick={() => {
                  if (!position.stakedInFarm) {
                    openRemoveModal(position)
                  }
                }}
              >
                {position.stakedInFarm ? 'Unstake from Farm First' : 'Remove Liquidity'}
              </Button>
            </View>
          </View>
        </Card>
      ))}

      {/* Remove Liquidity Modal */}
      <Modal active={isModalActive} onClose={() => setIsModalActive(false)}>
        <View direction="column" gap={16}>
          <Modal.Title>Remove Liquidity</Modal.Title>

          {selectedPosition && (
            <View direction="column" gap={12}>
              <Modal.Subtitle>
                {selectedPosition.token0.symbol}/{selectedPosition.token1.symbol} Pool
                {selectedPosition.isWETHPair && ' (ETH Pair)'}
              </Modal.Subtitle>

              <View direction="column" gap={8}>
                <Text>Current Position:</Text>
                <Text>
                  {selectedPosition.token0Amount} {selectedPosition.token0.symbol}
                </Text>
                <Text>
                  {selectedPosition.token1Amount} {selectedPosition.token1.symbol}
                </Text>
              </View>

              <View direction="column" gap={4}>
                <Text>Percentage to remove:</Text>
                <input
                  value={percentToRemove}
                  onChange={(e) => {
                    const value = e.target.value
                    const num = parseFloat(value)
                    if (!isNaN(num)) {
                      setPercentToRemove(Math.min(100, Math.max(0, num)).toString())
                    } else if (value === '') {
                      setPercentToRemove('')
                    }
                  }}
                  type="number"
                  min="0"
                  max="100"
                  style={{ width: '100%', padding: '8px' }}
                />
              </View>

              <View direction="column" gap={4}>
                <Text>You will receive approximately:</Text>
                <Text>
                  {formatExpectedOutput(selectedPosition).token0}{' '}
                  {selectedPosition.token0.symbol}
                </Text>
                <Text>
                  {formatExpectedOutput(selectedPosition).token1}{' '}
                  {selectedPosition.token1.symbol}
                </Text>
                <Text color="neutral">(Amounts subject to price impact and fees)</Text>
              </View>

              {error && <Text>{error}</Text>}
            </View>
          )}

          <View direction="column" gap={8}>
            {needsApproval ? (
              <Button
                color="primary"
                loading={isApproving}
                onClick={handleApprove}
                fullWidth
              >
                Approve LP Tokens
              </Button>
            ) : (
              <Button
                color="primary"
                loading={isRemoving}
                onClick={handleRemoveLiquidity}
                fullWidth
              >
                Remove Liquidity
              </Button>
            )}
            <Button color="neutral" onClick={() => setIsModalActive(false)} fullWidth>
              Cancel
            </Button>
          </View>
        </View>
      </Modal>
    </View>
  )
}
