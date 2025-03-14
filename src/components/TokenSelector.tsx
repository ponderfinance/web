import React, { useState, useEffect } from 'react'
import { Modal, Button, View, Text, TextField, Actionable, Icon } from 'reshaped'
import { useToggle } from 'reshaped'
import Image from 'next/image'
import { shortenAddress } from '@/src/utils/numbers'
import { CaretDown } from '@phosphor-icons/react'
import { CURRENT_CHAIN } from '@/src/constants/chains'
import { KKUB_ADDRESS, KOI_ADDRESS } from '@/src/constants/addresses'
import { Address, isAddress } from 'viem'
import { useTokenInfo } from '@ponderfinance/sdk'

interface Token {
  name: string
  symbol: string
  address: `0x${string}`
  icon: string
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

// Updated token list to include Native KUB
const predefinedTokens: Token[] = [
  {
    name: 'KOI',
    symbol: 'KOI',
    address: KOI_ADDRESS[CURRENT_CHAIN.id],
    icon: '/tokens/xkoi.png',
  },
  {
    name: 'KUB Coin',
    symbol: 'KUB',
    address: '0x0000000000000000000000000000000000000000',
    icon: '/tokens/bitkub.png',
    isNative: true,
  },
  {
    name: 'Wrapped KUB Coin',
    symbol: 'KKUB',
    address: KKUB_ADDRESS[CURRENT_CHAIN.id],
    icon: '/tokens/bitkub.png',
  },
  {
    name: 'Bitkub-Peg USDT',
    symbol: 'USDT',
    address: '0x7d984C24d2499D840eB3b7016077164e15E5faA6',
    icon: '/tokens/usdt.png',
  },
]

// Function to find a token by address
const findTokenByAddress = (
  address?: `0x${string}`,
  customTokens: Token[] = []
): Token | null => {
  if (!address) return null

  // Normalize addresses for comparison (case-insensitive)
  const normalizedAddress = address.toLowerCase()

  // Search in both predefined and custom tokens
  const allTokens = [...predefinedTokens, ...customTokens]
  const token = allTokens.find(
    (token) => token.address.toLowerCase() === normalizedAddress
  )

  return token || null
}

const TokenSelector: React.FC<TokenSelectorProps> = ({
  onSelectToken,
  disabled = false,
  isProcessing = false,
  tokenAddress,
  otherSelectedToken,
}) => {
  const { active, activate, deactivate } = useToggle(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [customTokens, setCustomTokens] = useState<Token[]>([])
  const [isSearchingToken, setIsSearchingToken] = useState<boolean>(false)

  // Find selected token based on address
  const selectedToken = findTokenByAddress(tokenAddress as `0x${string}`, customTokens)

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
      const existingToken = findTokenByAddress(searchTerm as `0x${string}`, customTokens)

      if (!existingToken) {
        const newCustomToken: Token = {
          name: tokenInfo.name || 'Unknown Token',
          symbol: tokenInfo.symbol || '???',
          address: searchTerm as `0x${string}`,
          icon: '/tokens/coin.svg', // Default icon
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
  }, [tokenInfo, isValidAddress, searchTerm, customTokens])

  // Handler for token selection with Uniswap-like token switching
  const handleTokenSelect = (token: Token) => {
    // Check if the selected token is already selected in the other field
    if (
      otherSelectedToken &&
      token.address.toLowerCase() === otherSelectedToken.toLowerCase()
    ) {
      // Perform token switch logic (will be handled by the parent component)
      onSelectToken(token.address as `0x${string}`)
    } else {
      // Regular token selection
      onSelectToken(token.address as `0x${string}`)
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
    ? [...predefinedTokens, ...customTokens].filter(
        (token) =>
          token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : [...predefinedTokens, ...customTokens]

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
            {selectedToken?.icon && (
              <Image
                src={selectedToken.icon}
                height={24}
                width={24}
                alt={'Selected Token Icon'}
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
      >
        <View gap={3} paddingInline={2} paddingTop={2} height={'80vh'}>
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
            !findTokenByAddress(searchTerm as `0x${string}`, customTokens) && (
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
                      name: tokenInfo.name || 'Unknown Token',
                      symbol: tokenInfo.symbol || '???',
                      address: searchTerm as `0x${string}`,
                      icon: '/tokens/coin.svg',
                      isCustom: true,
                    }
                    setCustomTokens((prev) => [...prev, newToken])
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
          <View gap={2} maxHeight={'400px'} width="100%">
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

// Token item component
const TokenItem: React.FC<TokenItemProps> = ({ token, onSelect }) => {
  return (
    <View
      direction="row"
      justify="space-between"
      align="center"
      borderRadius="medium"
      grow={true}
      width="100%"
    >
      <Button
        variant="ghost"
        onClick={onSelect}
        fullWidth={true}
        attributes={{ style: { width: '100%' } }}
      >
        <View direction="row" align="center" gap={4} width="100%">
          <View height="40px" width="40px" align="center" justify="center">
            <Image src={token.icon} height={40} width={40} alt={'Token Image'} />
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
    </View>
  )
}

export default TokenSelector
