import React, { useState, useEffect } from 'react'
import { Modal, Button, View, Text, TextField, Icon, Image, Skeleton } from 'reshaped'
import { useToggle } from 'reshaped'
import { shortenAddress } from '@/src/utils/numbers'
import { CaretDown } from '@phosphor-icons/react'
import { Address, isAddress } from 'viem'
import { useTokenInfo } from '@ponderfinance/sdk'
import { graphql, useLazyLoadQuery, useFragment } from 'react-relay'
import { getIpfsGateway } from '@/src/utils/ipfs'
import { TokenSelectorQuery } from '@/src/__generated__/TokenSelectorQuery.graphql'
import { TokenSelectorTokenFragment$key } from '@/src/__generated__/TokenSelectorTokenFragment.graphql'
import { withRelayBoundary } from '@/src/lib/relay/withRelayBoundary'

// Define our GraphQL query for fetching tokens
const tokenSelectorQuery = graphql`
  query TokenSelectorQuery {
    tokens(first: 12, orderBy: priceUsd, orderDirection: desc) {
      edges {
        node {
          ...TokenSelectorTokenFragment
        }
      }
    }
  }
`

// Define a fragment for token data
const tokenFragment = graphql`
  fragment TokenSelectorTokenFragment on Token {
    id
    address
    name
    symbol
    decimals
    imageUri
    priceUsd
  }
`

interface Token {
  id: string
  name: string
  symbol: string
  address: `0x${string}`
  decimals: number
  imageUri?: string | null
  priceUsd?: string | null
  isNative?: boolean
  isCustom?: boolean
}

interface TokenSelectorProps {
  onSelectToken: (token: `0x${string}`) => void
  disabled?: boolean
  isProcessing?: boolean
  tokenAddress?: `0x${string}`
  otherSelectedToken?: `0x${string}` // Added to support token switching
}

interface TokenItemProps {
  token: Token
  onSelect: () => void
}

// Native KUB token definition
const NATIVE_KUB: Token = {
  id: 'native-kub',
  name: 'KUB Coin',
  symbol: 'KUB',
  address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
  decimals: 18,
  imageUri: '/tokens/bitkub.png',
  isNative: true,
}

// Function to find a token by address
const findTokenByAddress = (
  address?: `0x${string}`,
  tokens: Token[] = [],
  customTokens: Token[] = []
): Token | null => {
  if (!address) return null

  // Normalize addresses for comparison (case-insensitive)
  const normalizedAddress = address.toLowerCase()

  // Check if it's the native token
  if (normalizedAddress === '0x0000000000000000000000000000000000000000') {
    return NATIVE_KUB
  }

  // Search in both fetched and custom tokens
  const allTokens = [...tokens, ...customTokens]
  const token = allTokens.find(
    (token) => token.address.toLowerCase() === normalizedAddress
  )

  return token || null
}

const TokenItem: React.FC<TokenItemProps> = ({ token, onSelect }) => {
  // Get token icon source - use default if not available
  // Handle both IPFS URIs and local paths
  const tokenIcon = token.imageUri
    ? (token.imageUri.startsWith('ipfs://') ? getIpfsGateway(token.imageUri) : token.imageUri)
    : '/tokens/coin.svg'

  return (
    <Button
      variant="ghost"
      onClick={onSelect}
      fullWidth={true}
      attributes={{ style: { width: '100%', padding: '12px', justifyContent: 'flex-start' } }}
    >
      <View direction="row" align="center" gap={4} width="100%">
        <View height="40px" width="40px" align="center" justify="center">
          <Image
            src={tokenIcon}
            height={10}
            width={10}
            alt={token.symbol || 'Token Icon'}
          />
        </View>

        <View align="start" grow={true}>
          <Text variant="body-2">{token.name}</Text>
          <View direction="row" gap={2} align="center">
            <Text color="neutral">{token.symbol}</Text>
            {!token.isNative && (
              <Text color="neutral-faded" variant="body-3">
                {shortenAddress(token.address)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </Button>
  )
}

// Component to render with Relay data after mount
const TokenSelectorWithData: React.FC<{
  active: boolean
  deactivate: () => void
  activate: () => void
  onSelectToken: (token: `0x${string}`) => void
  disabled: boolean
  isProcessing: boolean
  tokenAddress?: `0x${string}`
  otherSelectedToken?: `0x${string}`
}> = ({
  active,
  deactivate,
  activate,
  onSelectToken,
  disabled,
  isProcessing,
  tokenAddress,
  otherSelectedToken,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [customTokens, setCustomTokens] = useState<Token[]>([])
  const [isSearchingToken, setIsSearchingToken] = useState<boolean>(false)

  // Fetch tokens using the GraphQL query
  const data = useLazyLoadQuery<TokenSelectorQuery>(
    tokenSelectorQuery,
    {},
    {
      fetchPolicy: 'network-only',
    }
  )

  // Extract tokens from Relay data
  const tokens: Token[] = data.tokens.edges.map(({ node }) => {
    const tokenData = useFragment<TokenSelectorTokenFragment$key>(tokenFragment, node)

    return {
      id: tokenData.id,
      name: tokenData.name || 'Unknown Token',
      symbol: tokenData.symbol || '???',
      address: tokenData.address as `0x${string}`,
      decimals: tokenData.decimals || 18,
      imageUri: tokenData.imageUri,
      priceUsd: tokenData.priceUsd,
    }
  })

  // Add Native KUB to the list
  const allTokens = [NATIVE_KUB, ...tokens]

  // Find selected token based on address
  const selectedToken = findTokenByAddress(tokenAddress, allTokens, customTokens)

  // Get token info when search term is a valid address
  const isValidAddress = isAddress(searchTerm as Address)
  const { data: tokenInfo, isLoading: isTokenInfoLoading } = useTokenInfo(
    isValidAddress
      ? (searchTerm as Address)
      : ('0x0000000000000000000000000000000000000000' as Address),
    isValidAddress
  )

  // Effect to add custom token when found
  useEffect(() => {
    if (tokenInfo && isValidAddress && searchTerm) {
      const existingToken = findTokenByAddress(
        searchTerm as `0x${string}`,
        allTokens,
        customTokens
      )

      if (!existingToken) {
        const newCustomToken: Token = {
          id: `custom-${searchTerm}`,
          name: tokenInfo.name || 'Unknown Token',
          symbol: tokenInfo.symbol || '???',
          address: searchTerm as `0x${string}`,
          decimals: tokenInfo.decimals || 18,
          imageUri: '/tokens/coin.svg', // Default icon
          isCustom: true,
        }

        setCustomTokens((prev) => {
          // Check for duplicates before adding
          if (
            !prev.some(
              (token) => token.address.toLowerCase() === searchTerm.toLowerCase()
            )
          ) {
            return [...prev, newCustomToken]
          }
          return prev
        })
      }

      setIsSearchingToken(false)
    }
  }, [tokenInfo, isValidAddress, searchTerm, allTokens, customTokens])

  // Handler for token selection with Uniswap-like token switching
  const handleTokenSelect = (token: Token) => {
    // Check if the selected token is already selected in the other field
    if (
      otherSelectedToken &&
      token.address.toLowerCase() === otherSelectedToken.toLowerCase()
    ) {
      // Perform token switch logic (will be handled by the parent component)
      onSelectToken(token.address)
    } else {
      // Regular token selection
      onSelectToken(token.address)
    }
    deactivate()
  }

  const handleSearchChange = (event: { value: string }) => {
    setSearchTerm(event.value)

    // If it's a valid address, set the searching state
    if (isAddress(event.value as Address)) {
      setIsSearchingToken(true)
    }
  }

  // Filter tokens based on search term
  const filteredTokens = searchTerm
    ? [...allTokens, ...customTokens].filter(
        (token) =>
          token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [...allTokens, ...customTokens]

  return (
    <>
      <Button
        onClick={activate}
        variant="outline"
        disabled={disabled}
        rounded={true}
        loading={isProcessing}
      >
        <View direction="row" gap={2} align="center" paddingInline={1}>
          <View insetStart={-2}>
            {selectedToken?.imageUri && (
              <Image
                src={
                  selectedToken.imageUri.startsWith('ipfs://')
                    ? getIpfsGateway(selectedToken.imageUri) || '/tokens/coin.svg'
                    : selectedToken.imageUri
                }
                height={6}
                width={6}
                alt={selectedToken.symbol || 'Selected Token Icon'}
              />
            )}
          </View>
          <View insetStart={-2}>
            {selectedToken ? selectedToken.symbol : 'Select Token'}
          </View>
          {!disabled && (
            <View>
              <Icon svg={CaretDown} size={4} color="neutral-faded" />
            </View>
          )}
        </View>
      </Button>

      <Modal
        active={active}
        onClose={deactivate}
        size="400px"
        position={{ s: 'bottom', l: 'center' }}
        padding={2}
        attributes={{ style: { maxHeight: '80vh' } }}
      >
        <View 
          gap={3} 
          paddingInline={2} 
          paddingTop={2} 
          height={{ s: '80vh', l: 'auto' }}
          attributes={{ style: { maxHeight: '80vh' } }}
        >
          <View direction="row" justify="space-between" align="center">
            <Modal.Title>
              <Text variant="body-1" weight="regular">
                Select a token
              </Text>
            </Modal.Title>
            <Button
              variant="ghost"
              onClick={deactivate}
              size="small"
              aria-label="Close modal"
            />
          </View>

          <View borderRadius="medium">
            <TextField
              name="tokenSearch"
              placeholder="Search tokens or paste address"
              onChange={handleSearchChange}
              value={searchTerm}
              inputAttributes={{
                'aria-label': 'Search for tokens',
              }}
              size="large"
              attributes={{
                style: { backgroundColor: 'var(--rs-color-background-neutral-faded)' },
              }}
              rounded
            />
          </View>

          {/* Show loading state when searching for a token */}
          {isSearchingToken && isTokenInfoLoading && (
            <View align="center" padding={4}>
              <Text color="neutral">Loading token info...</Text>
            </View>
          )}

          {/* Show "Add Custom Token" button when a valid address is entered but not found */}
          {isValidAddress &&
            !isTokenInfoLoading &&
            tokenInfo &&
            !findTokenByAddress(searchTerm as `0x${string}`, allTokens, customTokens) && (
              <View
                direction="row"
                justify="space-between"
                align="center"
                borderRadius="medium"
                padding={2}
                backgroundColor="positive-faded"
              >
                <View>
                  <Text>
                    {tokenInfo.name || 'Unknown Token'} ({tokenInfo.symbol})
                  </Text>
                  <Text variant="body-3">
                    {shortenAddress(searchTerm as `0x${string}`)}
                  </Text>
                </View>
                <Button
                  variant="ghost"
                  color="positive"
                  onClick={() => {
                    const newToken: Token = {
                      id: `custom-${searchTerm}`,
                      name: tokenInfo.name || 'Unknown Token',
                      symbol: tokenInfo.symbol || '???',
                      address: searchTerm as `0x${string}`,
                      decimals: tokenInfo.decimals || 18,
                      imageUri: '/tokens/coin.svg',
                      isCustom: true,
                    }
                    setCustomTokens([...customTokens, newToken])
                    handleTokenSelect(newToken)
                  }}
                >
                  Add
                </Button>
              </View>
            )}

          {/* Error message for invalid address */}
          {searchTerm && isValidAddress && !isTokenInfoLoading && !tokenInfo && (
            <View
              align="center"
              padding={2}
              backgroundColor="critical-faded"
              borderRadius="medium"
            >
              <Text color="critical">Invalid token address</Text>
            </View>
          )}

          {/* Token list */}
          <View 
            gap={2} 
            width="100%" 
            overflow="auto" 
            paddingBottom={2}
            grow={true}
            attributes={{ style: { flex: 1 } }}
          >
            {filteredTokens.length > 0 ? (
              filteredTokens.map((token) => (
                <TokenItem
                  key={token.address} // Using address as key instead of id
                  token={token}
                  onSelect={() => handleTokenSelect(token)}
                />
              ))
            ) : (
              <Text align="center" color="neutral">
                No tokens found
              </Text>
            )}
          </View>
        </View>
      </Modal>
    </>
  )
}

// Wrap TokenSelectorWithData with Relay boundary
const TokenSelectorWithDataSafe = withRelayBoundary(
  TokenSelectorWithData,
  () => (
    <Button variant="outline" disabled>
      <View direction="row" gap={2} align="center" paddingInline={1}>
        <Skeleton height={6} width={6} borderRadius="circular" />
        <Skeleton height={4} width={8} />
        <Icon svg={CaretDown} size={4} color="neutral-faded" />
      </View>
    </Button>
  )
)

// Main component with client-side data fetching
const TokenSelector: React.FC<TokenSelectorProps> = (props) => {
  const { active, activate, deactivate } = useToggle(false)
  const [isMounted, setIsMounted] = useState<boolean>(false)

  // Only run query after component is mounted (client-side)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Simplified version before mounting
  if (!isMounted) {
    return (
      <Button
        onClick={activate}
        variant="outline"
        disabled={props.disabled}
        rounded={true}
        loading={props.isProcessing}
      >
        <View direction="row" gap={2} align="center" paddingInline={1}>
          <View insetStart={-2}>
            <Skeleton height={6} width={6} borderRadius="circular" />
          </View>
          <View insetStart={-2}>
            <Skeleton height={4} width={8} />
          </View>
          {!props.disabled && (
            <View>
              <Icon svg={CaretDown} size={4} color="neutral-faded" />
            </View>
          )}
        </View>
      </Button>
    )
  }

  // Once mounted, render the full component with Relay data
  return (
    <TokenSelectorWithDataSafe
      active={active}
      activate={activate}
      deactivate={deactivate}
      onSelectToken={props.onSelectToken}
      disabled={props.disabled || false}
      isProcessing={props.isProcessing || false}
      tokenAddress={props.tokenAddress}
      otherSelectedToken={props.otherSelectedToken}
    />
  )
}

export default TokenSelector
