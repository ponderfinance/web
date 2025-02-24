import React, { useState } from 'react'
import { Modal, Button, View, Text, TextField, Actionable } from 'reshaped'
import { useToggle } from 'reshaped'

interface Token {
  name: string
  symbol: string
  address: `0x${string}`
  icon: string
}

interface TokenSelectorProps {
  onSelectToken: (token: `0x${string}`) => void
  disabled?: boolean
  isProcessing?: boolean
  tokenAddress?: `0x${string}`
}

interface TokenItemProps {
  token: Token
  onSelect: () => void
}

const tokenData: Token[] = [
  {
    name: 'KOI',
    symbol: 'KOI',
    address: '0xe456B9B279e159842a91375e382804F7980e8Aa7',
    icon: '🔷',
  },
  // {
  //   name: 'Tether',
  //   symbol: 'USDT',
  //   address: '0x1f86F79F109060725b6f4146bAeE9b7aca41267d',
  //   icon: '💲',
  // },
  {
    name: 'Wrapped Bitkub Coin',
    symbol: 'KKUB',
    address: '0xBa71efd94be63bD47B78eF458DE982fE29f552f7',
    icon: '🟢',
  },
  // {
  //   name: 'Bitkub Coin',
  //   symbol: 'KUB',
  //   address: '0x0000000000000000000000000000000000000000',
  //   icon: '🟢',
  // },
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
}) => {
  const { active, activate, deactivate } = useToggle(false)
  const [searchTerm, setSearchTerm] = useState<string>('')

  // Find selected token based on address
  const selectedToken = findTokenByAddress(tokenAddress as `0x${string}`)

  const handleTokenSelect = (token: Token) => {
    onSelectToken(token?.address as `0x${string}`)
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
        {selectedToken ? selectedToken.symbol : 'Select Token'}
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
    >
      <Actionable onClick={onSelect}>
        <View direction="row" align="center" gap={2}>
          <View padding={2} height="40px" width="40px" align="center" justify="center">
            <Text>{token.icon}</Text>
          </View>

          <View>
            <Text weight="bold">{token.name}</Text>
            <Text color="neutral-faded">{token.symbol}</Text>
          </View>
        </View>

        {/*<Text color="neutral-faded">{token.address}</Text>*/}
      </Actionable>
    </View>
  )
}

export default TokenSelector
