'use client'

import React, { useState } from 'react'
import { Text, View, Button, Modal, Slider } from 'reshaped'
import { KKUB_ADDRESS, usePonderSDK, useRemoveLiquidity } from '@ponderfinance/sdk'
import { useAccount } from 'wagmi'
import { Address } from 'viem'
import LiquidityPositionItem from './LiquidityPositionItem'
import { PoolPageQuery } from '@/src/__generated__/PoolPageQuery.graphql'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { TokenPair } from './TokenPair'

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

interface LiquidityPositionsListProps {
  positionsData: NonNullable<PoolPageQuery['response']['userPositions']>
}

export function LiquidityPositionsList({ positionsData }: LiquidityPositionsListProps) {
  const sdk = usePonderSDK()
  const account = useAccount()
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [isModalActive, setIsModalActive] = useState(false)
  const [percentToRemove, setPercentToRemove] = useState('100')
  const [isApproving, setIsApproving] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [needsApproval, setNeedsApproval] = useState(false)
  const [error, setError] = useState<string>('')
  const removeLiquidity = useRemoveLiquidity()
  const wethAddress = KKUB_ADDRESS[CURRENT_CHAIN.id]

  // Check if approval is needed
  const checkApproval = async () => {
    if (!selectedPosition || !sdk || !account.address) return true

    try {
      const pair = sdk.getPair(selectedPosition.pairAddress)

      // First verify the actual LP token balance
      const lpBalance = await pair.balanceOf(account.address as Address)

      // Calculate the amount we need to remove based on percentage
      const percent = parseFloat(percentToRemove) || 0
      const liquidityToRemove = (lpBalance * BigInt(Math.floor(percent))) / BigInt(100)

      if (liquidityToRemove <= BigInt(0)) {
        return false // No approval needed if we're not removing anything
      }

      // Check router approval
      const routerAllowance = await pair.allowance(
        account.address as Address,
        sdk.router.address
      )

      const needsApproval = routerAllowance < liquidityToRemove

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

      // Get the actual balance from the contract
      const lpBalance = await pair.balanceOf(account.address as Address)

      // Calculate the amount we need to approve based on percentage
      const percent = parseFloat(percentToRemove) || 0
      const liquidityToRemove = (lpBalance * BigInt(Math.floor(percent))) / BigInt(100)

      if (liquidityToRemove <= BigInt(0)) {
        setError('No LP tokens to approve. Your balance may be zero.')
        setIsApproving(false)
        return
      }

      // Approve 5% more than needed to account for any calculation differences
      const approvalAmount = (liquidityToRemove * BigInt(105)) / BigInt(100)

      // Only approve router
      await pair.approve(sdk.router.address, approvalAmount)

      // Verify approval was successful
      const newAllowance = await pair.allowance(
        account.address as Address,
        sdk.router.address
      )

      if (newAllowance >= liquidityToRemove) {
        setNeedsApproval(false)
      } else {
        setError('Approval amount insufficient. Please try again or check your wallet.')
      }
    } catch (err) {
      console.error('Approval error:', err)
      if (err instanceof Error) {
        setError(`Failed to approve tokens: ${err.message}`)
      } else {
        setError('Failed to approve tokens. Please try again.')
      }
    } finally {
      setIsApproving(false)
    }
  }

  // Handle router-based removal using the SDK hook
  const handleRemoveLiquidity = async () => {
    if (!selectedPosition || !sdk || !account.address) return

    try {
      // First verify that we have the necessary approvals
      const stillNeedsApproval = await checkApproval()
      if (stillNeedsApproval) {
        setError(
          'LP tokens need to be approved before removing liquidity. Please approve first.'
        )
        setNeedsApproval(true)
        return
      }

      setIsRemoving(true)
      setError('')

      // Get the current balance directly from the contract
      const pair = sdk.getPair(selectedPosition.pairAddress)
      const lpBalance = await pair.balanceOf(account.address as Address)

      // Calculate liquidity amount based on percentage and actual balance
      const percent = parseFloat(percentToRemove) || 0
      const liquidityToRemove = (lpBalance * BigInt(Math.floor(percent))) / BigInt(100)

      // Calculate expected output with more precise calculations
      // We need to calculate based on the reserves and the proportion of liquidity
      const expectedToken0 =
        (liquidityToRemove * selectedPosition.reserve0) / selectedPosition.totalSupply
      const expectedToken1 =
        (liquidityToRemove * selectedPosition.reserve1) / selectedPosition.totalSupply

      // Apply 5% slippage tolerance (multiply by 0.95)
      const safeMinToken0 = (expectedToken0 * BigInt(95)) / BigInt(100)
      const safeMinToken1 = (expectedToken1 * BigInt(95)) / BigInt(100)

      const result = await removeLiquidity.mutateAsync({
        pairAddress: selectedPosition.pairAddress,
        liquidity: liquidityToRemove,
        token0Min: safeMinToken0,
        token1Min: safeMinToken1,
        deadline: BigInt(Math.floor(Date.now() / 1000) + 1200),
        toAddress: account.address,
        // Don't use isETHPair flag - treat all pairs as regular token pairs
      })

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
    try {
      const needsApprove = await checkApproval()
      setNeedsApproval(needsApprove)
    } catch (err) {
      console.error('Error checking approvals:', err)
      setNeedsApproval(true)
    }
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
        <Text align="center">Loading WETH address...</Text>
      </View>
    )
  }

  // Check if we have positions data
  if (!positionsData?.liquidityPositions) {
    return (
      <View direction="column" gap={4}>
        <Text align="center">No data available</Text>
      </View>
    )
  }

  // Return the component UI
  return (
    <View gap={{ s: 8, m: 16 }}>
      {positionsData.liquidityPositions.length === 0 && (
        <Text align="center">No liquidity positions found.</Text>
      )}

      {/* Render each position component */}
      {positionsData.liquidityPositions.map((positionNode, i) => (
        <LiquidityPositionItem
          key={i} //TODO: change
          positionRef={positionNode}
          onRemoveLiquidity={openRemoveModal}
          wethAddress={wethAddress}
        />
      ))}

      {/* Remove Liquidity Modal */}
      <Modal active={isModalActive} onClose={() => setIsModalActive(false)}>
        <View direction="column" gap={4}>
          <Modal.Title>Remove Liquidity</Modal.Title>
          {selectedPosition && (
            <View direction="column" gap={12}>
              <Modal.Subtitle>
                <View direction="row" align="center" gap={2}>
                  {/* Use TokenPair component for token display */}
                  <TokenPair
                    tokenAddressA={selectedPosition.token0.address}
                    tokenAddressB={selectedPosition.token1.address}
                    size="small"
                  />
                  {selectedPosition.isWETHPair && <Text>(ETH Pair)</Text>}
                </View>
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
                <Text>Percentage to remove: {percentToRemove}%</Text>
                {/* Use Reshaped Slider component */}
                <View paddingBlock={4}>
                  <Slider
                    name="percentToRemove"
                    min={0}
                    max={100}
                    step={1}
                    value={parseInt(percentToRemove) || 0}
                    onChange={(args) => setPercentToRemove(args.value.toString())}
                  />
                </View>
              </View>

              <View direction="column" gap={4}>
                <Text>You will receive approximately (minimum amounts):</Text>
                <Text>
                  {formatExpectedOutput(selectedPosition).token0}{' '}
                  {selectedPosition.token0.symbol}
                </Text>
                <Text>
                  {formatExpectedOutput(selectedPosition).token1}{' '}
                  {selectedPosition.token1.symbol}
                </Text>
              </View>
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
          </View>
        </View>
      </Modal>
    </View>
  )
}
