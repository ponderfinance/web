'use client'

import { Button, Modal, Text, View, useToggle } from 'reshaped'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { useState, useEffect, useRef } from 'react'
import { Chain, Token } from '@/src/types'
import { ChainSelector } from './ChainSelector'
import { TokenSelector } from './TokenSelector'
import { AmountInput } from './AmountInput'
import { BridgeInfo } from './BridgeInfo'
import { BridgeActions } from './BridgeActions'
import { useBridge } from '@/src/hooks/bridge/useBridge'
import { parseUnits } from 'viem'
import { usePonderSDK } from '@ponderfinance/sdk'
import { useTokenApproval } from '@ponderfinance/sdk'

const SUPPORTED_CHAINS: Chain[] = [
  {
    id: 1,
    name: 'Ethereum',
    icon: '/tokens/eth.png',
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL || '',
  },
  {
    id: 96,
    name: 'Kubchain',
    icon: '/tokens/bitkub.png',
    rpcUrl: process.env.NEXT_PUBLIC_BITKUB_RPC_URL || '',
  },
]

const SUPPORTED_TOKENS: {
  [chainId: number]: Token[]
} = {
  1: [ // Ethereum
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`, // USDT
      symbol: 'USDT',
      decimals: 6,
      icon: '/tokens/usdt.png',
    },
    {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`, // USDC
      symbol: 'USDC',
      decimals: 6,
      icon: '/tokens/usdc.png',
    },
    {
      address: '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5' as `0x${string}`, // KUB
      symbol: 'KUB',
      decimals: 18,
      icon: '/tokens/bitkub.png',
    },
  ],
  96: [ // Kubchain
    {
      address: '0x67eBD850304c70d983B2d1b93ea79c7CD6c3F6b5' as `0x${string}`, // KUB
      symbol: 'KUB',
      decimals: 18,
      icon: '/tokens/bitkub.png',
    },
  ],
}

interface BridgeModalProps {
  isOpen: boolean
  onClose: () => void
}

export const BridgeModal = ({ isOpen, onClose }: BridgeModalProps) => {
  const sdk = usePonderSDK()
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [sourceChain, setSourceChain] = useState<Chain | null>(null)
  const [destChain, setDestChain] = useState<Chain | null>(null)
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [amount, setAmount] = useState<string>('')
  const [isApproving, setIsApproving] = useState(false)
  const [isBridging, setIsBridging] = useState(false)
  const [fee, setFee] = useState<bigint | null>(null)

  const { bridgeTokens, computeFee } = useBridge()
  const { approve, allowance } = useTokenApproval(
    selectedToken?.address,
    sdk?.bridge?.address,
    !!selectedToken && !!sdk?.bridge?.address
  )

  useEffect(() => {
    console.log('BridgeModal state:', { isOpen, sdk: !!sdk })
  }, [isOpen, sdk])

  // Effect to set initial source chain based on current chain
  useEffect(() => {
    if (!sourceChain && chainId && isOpen) {
      const currentChain = SUPPORTED_CHAINS.find(chain => chain.id === chainId)
      if (currentChain) {
        setSourceChain(currentChain)
        // Set destination chain automatically to the other supported chain
        const otherChain = SUPPORTED_CHAINS.find(chain => chain.id !== chainId)
        if (otherChain) {
          setDestChain(otherChain)
        }
      }
    }
  }, [chainId, sourceChain, isOpen])

  const handleSourceChainChange = async (chain: Chain) => {
    try {
      // Switch to the selected chain first
      if (chainId !== chain.id) {
        console.log('Switching to chain:', chain.id)
        await switchChain({ chainId: chain.id })
        // Wait a bit for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Then update the UI state
      setSourceChain(chain)
      // Set destination chain to the other supported chain
      const otherChain = SUPPORTED_CHAINS.find(c => c.id !== chain.id)
      if (otherChain) {
        setDestChain(otherChain)
      }
      // Reset token and amount when changing chains
      setSelectedToken(null)
      setAmount('')
      setFee(null)
    } catch (error) {
      console.error('Failed to switch chain:', error)
    }
  }

  const handleTokenChange = async (token: Token) => {
    setSelectedToken(token)
    if (amount && destChain) {
      try {
        const parsedAmount = parseUnits(amount, token.decimals)
        const computedFee = await computeFee(
          token.address,
          BigInt(destChain.id),
          parsedAmount
        )
        setFee(computedFee)
      } catch (error) {
        console.error('Failed to compute fee:', error)
      }
    }
  }

  // If SDK is not available, don't render the modal
  if (!sdk) {
    console.log('SDK not available, not rendering modal')
    return null
  }

  const handleApprove = async () => {
    if (!sourceChain || !selectedToken || !amount || !address || !sdk?.bridge?.address) return

    try {
      setIsApproving(true)
      const parsedAmount = parseUnits(amount, selectedToken.decimals)
      
      // First ensure we're on the source chain
      if (chainId !== sourceChain.id) {
        await switchChain({ chainId: sourceChain.id })
      }

      // Then approve
      await approve.mutateAsync({
        token: selectedToken.address,
        spender: sdk.bridge.address,
        amount: parsedAmount
      })
      
      // Refetch allowance to update the state
      await allowance.refetch()
      
    } catch (error) {
      console.error('Approval failed:', error)
    } finally {
      setIsApproving(false)
    }
  }

  const handleBridge = async () => {
    if (!sourceChain || !destChain || !selectedToken || !amount || !address || !sdk?.bridge?.address) return

    try {
      setIsBridging(true)
      const parsedAmount = parseUnits(amount, selectedToken.decimals)
      
      // Check allowance first
      const currentAllowance = await allowance.refetch()
      if (!currentAllowance.data || currentAllowance.data < parsedAmount) {
        console.log('Insufficient allowance, please approve first')
        return
      }

      // Ensure we're on the source chain
      if (chainId !== sourceChain.id) {
        console.log('Switching to source chain:', sourceChain.id)
        await switchChain({ chainId: sourceChain.id })
        // Wait a bit for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
      
      console.log('Executing bridge transaction on chain:', sourceChain.id)
      await bridgeTokens({
        token: selectedToken.address,
        amount: parsedAmount,
        destChainID: BigInt(destChain.id),
        destTokenType: 2, // ERC20
        recipient: address
      }, sourceChain.id)
      
      onClose()
    } catch (error) {
      console.error('Bridge failed:', error)
    } finally {
      setIsBridging(false)
    }
  }

  const handleAmountChange = async (newAmount: string) => {
    setAmount(newAmount)
    if (selectedToken && destChain && newAmount) {
      try {
        const parsedAmount = parseUnits(newAmount, selectedToken.decimals)
        const computedFee = await computeFee(
          selectedToken.address,
          BigInt(destChain.id),
          parsedAmount
        )
        setFee(computedFee)
      } catch (error) {
        console.error('Failed to compute fee:', error)
      }
    }
  }

  // Switch back to Bitkub Chain when modal closes
  const handleClose = async () => {
    try {
      if (chainId !== 96) {
        console.log('Switching back to Bitkub Chain')
        await switchChain({ chainId: 96 })
        // Wait a bit for the chain switch to complete
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error('Failed to switch back to Bitkub Chain:', error)
    } finally {
      // Reset all state
      setSourceChain(null)
      setDestChain(null)
      setSelectedToken(null)
      setAmount('')
      setFee(null)
      onClose()
    }
  }

  return (
    <Modal
      position="end"
      active={isOpen}
      onClose={handleClose}
      attributes={{
        style: {
          width: '100%',
          maxWidth: '400px',
        },
      }}
    >
      <View direction="column" gap={4} padding={4}>
        <View direction="row" justify="space-between" align="center">
          <Text variant="featured-1">Bridge Tokens</Text>
          <Button variant="ghost" onClick={handleClose}>
            ✕
          </Button>
        </View>

        <ChainSelector
          sourceChain={sourceChain}
          destChain={destChain}
          onSourceChainChange={handleSourceChainChange}
          supportedChains={SUPPORTED_CHAINS}
        />

        <TokenSelector
          selectedToken={selectedToken}
          onTokenChange={handleTokenChange}
          supportedTokens={sourceChain ? SUPPORTED_TOKENS[sourceChain.id] || [] : []}
        />

        <AmountInput
          amount={amount}
          onAmountChange={handleAmountChange}
          selectedToken={selectedToken}
          sourceChain={sourceChain}
        />

        <BridgeInfo
          sourceChain={sourceChain}
          destChain={destChain}
          selectedToken={selectedToken}
          amount={amount}
          fee={fee}
        />

        <BridgeActions
          isApproving={isApproving}
          isBridging={isBridging}
          onApprove={handleApprove}
          onBridge={handleBridge}
          allowance={allowance.data}
          amount={amount}
          selectedToken={selectedToken}
        />
      </View>
    </Modal>
  )
} 