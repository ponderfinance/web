import React, { useState } from 'react'
import { Modal, Button, View, Text, TextField, Actionable, Icon } from 'reshaped'
import { useToggle } from 'reshaped'
import Image from 'next/image'
import { shortenAddress } from '@/src/app/utils/numbers'
import { CaretDown } from '@phosphor-icons/react'

interface Token {
  name: string
  symbol: string
  address: `0x${string}`
  icon: string
  isNative?: boolean
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
const tokenData: Token[] = [
  {
    name: 'KOI',
    symbol: 'KOI',
    address: '0x33C9B02596d7b1CB4066cC2CeEdd37f3A7c7Aa07',
    icon: '/tokens/xkoi.png',
  },
  {
    name: 'Native Bitkub',
    symbol: 'KUB',
    address: '0x0000000000000000000000000000000000000000',
    icon: '/tokens/bitkub.png',
    isNative: true,
  },
  {
    name: 'Wrapped Bitkub',
    symbol: 'KKUB',
    address: '0xBa71efd94be63bD47B78eF458DE982fE29f552f7',
    icon: '/tokens/bitkub.png',
  },
]

// Function to find a token by address
const findTokenByAddress = (address?: `0x${string}`): Token | null => {
  if (!address) return null

  // Normalize addresses for comparison (case-insensitive)
  const normalizedAddress = address.toLowerCase()
  const token = tokenData.find(
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

  // Find selected token based on address
  const selectedToken = findTokenByAddress(tokenAddress as `0x${string}`)

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
  }

  // Filter tokens based on search term
  const filteredTokens = searchTerm
    ? tokenData.filter(
        (token) =>
          token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          token.address.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : tokenData

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
          <View>
            <Icon svg={CaretDown} size={4} color="neutral-faded" />
          </View>
        </View>
      </Button>

      <Modal
        active={active}
        onClose={deactivate}
        size="400px"
        position={{ s: 'bottom', l: 'center' }}
        padding={2}
      >
        <View gap={3} paddingInline={2} paddingTop={1} height={'80vh'}>
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
              placeholder="Search tokens"
              onChange={handleSearchChange}
              value={searchTerm}
              inputAttributes={{
                'aria-label': 'Search for tokens',
                style: { backgroundColor: 'transparent' },
              }}
              size="large"
              rounded
            />
          </View>

          {/* Single token list */}
          <View gap={1} maxHeight={'400px'}>
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
      padding={2}
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
        <View direction="row" align="center" gap={4}>
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
