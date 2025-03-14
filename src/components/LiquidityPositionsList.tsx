'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { Text, View, Button, Skeleton, Modal } from 'reshaped'
import { usePonderSDK, useRemoveLiquidity } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { Address, formatUnits } from 'viem'
import { graphql, useLazyLoadQuery } from 'react-relay'
import LiquidityPositionItem from './LiquidityPositionItem'
import { LiquidityPositionsListQuery } from '@/src/__generated__/LiquidityPositionsListQuery.graphql'

const UserPositionsQuery = graphql`
  query LiquidityPositionsListQuery($userAddress: String!) {
    userPositions(userAddress: $userAddress) {
      liquidityPositions {
        ...LiquidityPositionItem_position
      }
    }
  }
`

interface Position {
  id: string
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
  const [wethAddress, setWethAddress] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isModalActive, setIsModalActive] = useState(false)
  const [percentToRemove, setPercentToRemove] = useState('100')
  const [isApproving, setIsApproving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [error, setError] = useState<string>('')
  const removeLiquidity = useRemoveLiquidity()

  // Fetch WETH address on component mount
  useEffect(() => {
    const fetchWethAddress = async () => {
      if (sdk) {
        try {
          const address = await sdk.router.KKUB()
          setWethAddress(address.toLowerCase())
        } catch (err) {
          console.error('Error fetching WETH address:', err)
        }
      }
    }

    fetchWethAddress()
  }, [sdk])

  // Fetch user positions data - this will trigger Suspense until loaded
  const data = useLazyLoadQuery<LiquidityPositionsListQuery>(
    UserPositionsQuery,
    {
      userAddress: account.address?.toLowerCase() || '',
    },
    {
      fetchPolicy: 'network-only',
    }
  )

  // Check if approval is needed
  const checkApproval = async () => {
    if (!selectedPosition || !sdk || !account.address) return true

    try {
      const pair = sdk.getPair(selectedPosition.pairAddress)

      // Check router approval
      const routerAllowance = await pair.allowance(
        account.address as Address,
        sdk.router.address
      )

      const needsApproval = routerAllowance < selectedPosition.userLPBalance

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
  const handleRemoveLiquidity = async () => {
    if (!selectedPosition || !sdk || !account.address) return

    try {
      setIsRemoving(true)
      setError('')

      // Calculate liquidity amount based on percentage
      const percent = parseFloat(percentToRemove) || 0
      const liquidityToRemove =
        (selectedPosition.userLPBalance * BigInt(Math.floor(percent))) / BigInt(100)

      // Calculate expected output with more precise calculations
      // We need to calculate based on the reserves and the proportion of liquidity
      const expectedToken0 =
        (liquidityToRemove * selectedPosition.reserve0) / selectedPosition.totalSupply
      const expectedToken1 =
        (liquidityToRemove * selectedPosition.reserve1) / selectedPosition.totalSupply

      // Apply 5% slippage tolerance (multiply by 0.95)
      const safeMinToken0 = (expectedToken0 * BigInt(95)) / BigInt(100)
      const safeMinToken1 = (expectedToken1 * BigInt(95)) / BigInt(100)

      console.log('Expected output amounts:', {
        expectedToken0: expectedToken0.toString(),
        expectedToken1: expectedToken1.toString(),
        safeMinToken0: safeMinToken0.toString(),
        safeMinToken1: safeMinToken1.toString(),
      })

      if (selectedPosition.isWETHPair) {
        try {
          const kkubAddress = await sdk.router.KKUB()
          console.log('KKUB address:', kkubAddress)

          // Determine which token is ETH
          const isToken0KKUB =
            selectedPosition.token0.address.toLowerCase() === kkubAddress.toLowerCase()

          // Get the non-KKUB token address
          const nonKKUBToken = isToken0KKUB
            ? selectedPosition.token1.address
            : selectedPosition.token0.address

          // DEBUGGING: Use extremely low minimum values
          const tokenMin = BigInt(1) // 1 wei
          const ethMin = BigInt(1) // 1 wei

          console.log('Final parameters for removeLiquidityETH:', {
            tokenAddress: nonKKUBToken,
            liquidity: liquidityToRemove.toString(),
            amountTokenMin: tokenMin.toString(),
            amountETHMin: ethMin.toString(),
            to: account.address,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200).toString(),
          })

          // Try with minimal values first to see if the transaction will succeed
          const result = await removeLiquidity.mutateAsync({
            pairAddress: selectedPosition.pairAddress,
            liquidity: liquidityToRemove,
            token0Min: BigInt(0), // These are not used directly for ETH pairs
            token1Min: BigInt(0), // These are not used directly for ETH pairs
            isETHPair: true,
            tokenAddress: nonKKUBToken,
            amountTokenMin: tokenMin, // Use minimal values for debugging
            amountETHMin: ethMin, // Use minimal values for debugging
            deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
            toAddress: account.address,
          })

          console.log('ETH pair removal result:', result)
        } catch (err) {
          console.error('Error in ETH pair removal:', err)
          throw err
        }
      } else {
        // Standard token pair handling remains the same
        console.log('Standard pair removal params:', {
          token0: selectedPosition.token0.address,
          token1: selectedPosition.token1.address,
          safeMinToken0: safeMinToken0.toString(),
          safeMinToken1: safeMinToken1.toString(),
        })

        const result = await removeLiquidity.mutateAsync({
          pairAddress: selectedPosition.pairAddress,
          liquidity: liquidityToRemove,
          token0Min: safeMinToken0,
          token1Min: safeMinToken1,
          deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
          toAddress: account.address,
        })

        console.log('Standard pair removal result:', result)
      }

      setIsModalActive(false)
    } catch (err) {
      console.error('Error removing liquidity:', err)
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Failed to remove liquidity. Check console for details.')
      }
    } finally {
      setIsRemoving(false)
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

  // Wait for WETH address before rendering
  if (!wethAddress) {
    return (
      <View direction="column" gap={4}>
        <Skeleton height={20} width="100%" borderRadius="large" />
        <Skeleton height={20} width="100%" borderRadius="large" />
      </View>
    )
  }

  // Check if we have positions data
  if (!data?.userPositions?.liquidityPositions) {
    return (
      <View direction="column" gap={4}>
        <Text align="center">No data available</Text>
      </View>
    )
  }

  // Prepare the component with Suspense
  return (
    <View gap={16}>
      {data.userPositions.liquidityPositions.length === 0 && (
        <Text align="center">No liquidity positions found.</Text>
      )}

      {/* Render each position component */}
      {data.userPositions.liquidityPositions.map((positionNode, i) => (
        <LiquidityPositionItem
          key={i} //TODO: change
          positionRef={positionNode}
          onRemoveLiquidity={openRemoveModal}
          wethAddress={wethAddress}
        />
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
