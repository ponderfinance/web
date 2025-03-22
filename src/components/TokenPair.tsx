import React, { Suspense, useState, useEffect } from 'react'
import { Image, Text, View, Skeleton } from 'reshaped'
import { graphql, useFragment, useLazyLoadQuery } from 'react-relay'
import { shortenAddress } from '@/src/utils/numbers'
import { TokenPairFragment$key } from '@/src/__generated__/TokenPairFragment.graphql'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { TokenPairQuery } from '@/src/__generated__/TokenPairQuery.graphql'
import { readContract } from 'viem/actions'
import { createPublicClient, http } from 'viem'
import { CURRENT_CHAIN } from '@/src/constants/chains'

// Standard ERC20 ABI for token info
const erc20Abi = [
  {
    constant: true,
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Create a viem public client
const publicClient = createPublicClient({
  chain: CURRENT_CHAIN,
  transport: http(CURRENT_CHAIN.rpcUrls.default.http[0]),
})

// Interface to store contract data
interface TokenContractData {
  symbol: string
  decimals: number
  name: string
}

export interface TokenPairProps {
  tokenA?: TokenPairFragment$key | null
  tokenB?: TokenPairFragment$key | null
  tokenAddressA?: `0x${string}`
  tokenAddressB?: `0x${string}`
  size?: 'small' | 'large'
}

export const tokenFragment = graphql`
  fragment TokenPairFragment on Token {
    id
    address
    name
    symbol
    decimals
    imageURI
  }
`

// Query to fetch token data by address
export const tokenByAddressQuery = graphql`
  query TokenPairQuery($addressA: String!, $addressB: String!) {
    tokenA: tokenByAddress(address: $addressA) {
      ...TokenPairFragment
    }
    tokenB: tokenByAddress(address: $addressB) {
      ...TokenPairFragment
    }
  }
`

// Default fallback images if token not found
const DEFAULT_TOKEN_ICON = '/tokens/coin.svg'
const NATIVE_KUB_ICON = '/tokens/bitkub.png'

// Loading fallback component for Suspense
const TokenPairSkeleton: React.FC<{ size?: 'small' | 'large' }> = ({
  size = 'small',
}) => (
  <View direction="row" align="center" gap={size === 'small' ? 2 : 4}>
    <View position="relative">
      <Skeleton
        width={size === 'small' ? 12 : 16}
        height={size === 'small' ? 8 : 11}
        borderRadius="circular"
      />
    </View>
    <Skeleton width={100} height={size === 'small' ? 20 : 24} />
  </View>
)

// Function to fetch token data from contract
const fetchTokenFromContract = async (
  address: `0x${string}`
): Promise<TokenContractData | null> => {
  if (address === '0x0000000000000000000000000000000000000000') {
    return {
      symbol: 'KUB',
      name: 'Native KUB',
      decimals: 18,
    }
  }

  try {
    // Fetch token data from contract
    const [symbol, name, decimals] = await Promise.all([
      readContract(publicClient, {
        address,
        abi: erc20Abi,
        functionName: 'symbol',
      }).catch(() => 'UNKNOWN'),
      readContract(publicClient, {
        address,
        abi: erc20Abi,
        functionName: 'name',
      }).catch(() => 'Unknown Token'),
      readContract(publicClient, {
        address,
        abi: erc20Abi,
        functionName: 'decimals',
      }).catch(() => 18),
    ])

    return {
      symbol: typeof symbol === 'string' ? symbol : 'UNKNOWN',
      name: typeof name === 'string' ? name : 'Unknown Token',
      decimals: typeof decimals === 'number' ? decimals : 18,
    }
  } catch (error) {
    console.error(`Error fetching token data from contract ${address}:`, error)
    return null
  }
}

// Base TokenPair component that handles data display
const BaseTokenPair: React.FC<TokenPairProps> = ({
  tokenA,
  tokenB,
  tokenAddressA,
  tokenAddressB,
  size = 'small',
}) => {
  // Check if the tokens are native KUB (address 0x0...)
  const isTokenANative = tokenAddressA === '0x0000000000000000000000000000000000000000'
  const isTokenBNative = tokenAddressB === '0x0000000000000000000000000000000000000000'

  // State for contract-fetched token data
  const [contractTokenA, setContractTokenA] = useState<TokenContractData | null>(null)
  const [contractTokenB, setContractTokenB] = useState<TokenContractData | null>(null)
  const [isLoadingContractA, setIsLoadingContractA] = useState(false)
  const [isLoadingContractB, setIsLoadingContractB] = useState(false)

  // Fetch token data from GraphQL if we only have addresses
  const shouldFetchFromRelay = (!tokenA || !tokenB) && (tokenAddressA || tokenAddressB)

  // Normalize addresses for the query
  const normalizedAddressA = tokenAddressA || '0x0000000000000000000000000000000000000000'
  const normalizedAddressB = tokenAddressB || '0x0000000000000000000000000000000000000000'

  // Query token data from GraphQL
  const tokenData = shouldFetchFromRelay
    ? useLazyLoadQuery<TokenPairQuery>(
        tokenByAddressQuery,
        {
          addressA: normalizedAddressA.toLowerCase(),
          addressB: normalizedAddressB.toLowerCase(),
        },
        {
          fetchPolicy: 'store-or-network',
          fetchKey: `${normalizedAddressA}-${normalizedAddressB}`, // Ensure refetch on address change
        }
      )
    : null

  // Use the fragment for pre-loaded token data or get from query
  const tokenAData = tokenA
    ? useFragment<TokenPairFragment$key>(tokenFragment, tokenA)
    : tokenData?.tokenA
      ? useFragment<TokenPairFragment$key>(tokenFragment, tokenData.tokenA)
      : null

  const tokenBData = tokenB
    ? useFragment<TokenPairFragment$key>(tokenFragment, tokenB)
    : tokenData?.tokenB
      ? useFragment<TokenPairFragment$key>(tokenFragment, tokenData.tokenB)
      : null

  // Fetch token data from contract if not found in database
  useEffect(() => {
    const fetchTokenA = async () => {
      if (
        !tokenAData &&
        tokenAddressA &&
        !isTokenANative &&
        !contractTokenA &&
        !isLoadingContractA
      ) {
        setIsLoadingContractA(true)
        try {
          const data = await fetchTokenFromContract(tokenAddressA)
          setContractTokenA(data)
        } catch (error) {
          console.error('Error fetching token A from contract:', error)
        } finally {
          setIsLoadingContractA(false)
        }
      }
    }

    const fetchTokenB = async () => {
      if (
        !tokenBData &&
        tokenAddressB &&
        !isTokenBNative &&
        !contractTokenB &&
        !isLoadingContractB
      ) {
        setIsLoadingContractB(true)
        try {
          const data = await fetchTokenFromContract(tokenAddressB)
          setContractTokenB(data)
        } catch (error) {
          console.error('Error fetching token B from contract:', error)
        } finally {
          setIsLoadingContractB(false)
        }
      }
    }

    fetchTokenA()
    fetchTokenB()
  }, [
    tokenAData,
    tokenBData,
    tokenAddressA,
    tokenAddressB,
    isTokenANative,
    isTokenBNative,
    contractTokenA,
    contractTokenB,
    isLoadingContractA,
    isLoadingContractB,
  ])

  // Determine first token display information
  const firstTokenDisplay = {
    symbol: isTokenANative
      ? 'KUB'
      : tokenAData?.symbol ||
        contractTokenA?.symbol ||
        (tokenAddressA ? shortenAddress(tokenAddressA) : 'Token A'),
    icon: isTokenANative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenAData?.imageURI || '') || DEFAULT_TOKEN_ICON,
    name: isTokenANative
      ? 'Native KUB'
      : tokenAData?.name || contractTokenA?.name || 'Unknown Token',
  }

  // Determine second token display information
  const secondTokenDisplay = {
    symbol: isTokenBNative
      ? 'KUB'
      : tokenBData?.symbol ||
        contractTokenB?.symbol ||
        (tokenAddressB ? shortenAddress(tokenAddressB) : 'Token B'),
    icon: isTokenBNative
      ? NATIVE_KUB_ICON
      : getIpfsGateway(tokenBData?.imageURI || '') || DEFAULT_TOKEN_ICON,
    name: isTokenBNative
      ? 'Native KUB'
      : tokenBData?.name || contractTokenB?.name || 'Unknown Token',
  }

  // Debug logging
  // console.log('Token Display:', {
  //   first: firstTokenDisplay,
  //   second: secondTokenDisplay,
  //   fromDB: { A: !!tokenAData, B: !!tokenBData },
  //   fromContract: { A: !!contractTokenA, B: !!contractTokenB },
  // })

  return (
    <View>
      <View direction="row" align="center" gap={size === 'small' ? 2 : 4}>
        <View position="relative">
          <View
            height={size === 'small' ? 8 : 11}
            width={size === 'small' ? 8 : 11}
            overflow="hidden"
            insetStart={size === 'small' ? -4.25 : -5.5}
          >
            <View
              position="absolute"
              insetTop={0}
              insetEnd={size === 'small' ? -4 : -5.25}
              attributes={{ style: { zIndex: 2 } }}
              overflow="hidden"
              borderRadius="circular"
              height={size === 'small' ? 8 : 11}
              width={size === 'small' ? 8 : 11}
            >
              <Image
                src={firstTokenDisplay.icon}
                height={size === 'small' ? 8 : 11}
                width={size === 'small' ? 8 : 11}
                alt={firstTokenDisplay.symbol}
              />
            </View>
          </View>
          <View
            height={size === 'small' ? 8 : 11}
            width={size === 'small' ? 8 : 11}
            overflow="hidden"
            insetEnd={size === 'small' ? -4.25 : -6}
            insetTop={0}
            position="absolute"
          >
            <View
              position="absolute"
              insetTop={0}
              insetStart={size === 'small' ? -4 : -5.25}
              overflow="hidden"
              borderRadius="circular"
              attributes={{
                style: {
                  zIndex: 1,
                },
              }}
            >
              <Image
                src={secondTokenDisplay.icon}
                height={size === 'small' ? 8 : 11}
                width={size === 'small' ? 8 : 11}
                alt={secondTokenDisplay.symbol}
              />
            </View>
          </View>
        </View>
        <Text variant={size === 'small' ? 'body-2' : 'body-1'}>
          {firstTokenDisplay.symbol} / {secondTokenDisplay.symbol}
        </Text>
      </View>
    </View>
  )
}

// Main export component with Suspense handling
export const TokenPair: React.FC<TokenPairProps> = (props) => {
  // If we have both fragments, no need for suspense - can render directly
  if (props.tokenA && props.tokenB) {
    return <BaseTokenPair {...props} />
  }

  // Otherwise, wrap in Suspense for data fetching
  return (
    <Suspense>
      <BaseTokenPair {...props} />
    </Suspense>
  )
}
