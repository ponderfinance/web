'use client'

import { Button, Popover, Text, View } from 'reshaped'
import Image from 'next/image'
import { Token } from '@/src/types'

interface TokenSelectorProps {
  selectedToken: Token | null
  onTokenChange: (token: Token) => void
  supportedTokens: Token[]
}

export const TokenSelector = ({
  selectedToken,
  onTokenChange,
  supportedTokens,
}: TokenSelectorProps) => {
  return (
    <View direction="column" gap={2}>
      <Text variant="body-2">Token</Text>
      <Popover triggerType="click">
        <Popover.Trigger>
          {(attributes) => (
            <Button
              attributes={attributes}
              variant="outline"
              fullWidth
              rounded
            >
              <View direction="row" gap={2} align="center">
                {selectedToken ? (
                  <>
                    <Image
                      src={selectedToken.icon}
                      alt={selectedToken.symbol}
                      width={24}
                      height={24}
                    />
                    <Text>{selectedToken.symbol}</Text>
                  </>
                ) : (
                  <Text>Select token</Text>
                )}
              </View>
            </Button>
          )}
        </Popover.Trigger>
        <Popover.Content>
          <View direction="column" gap={1}>
            {supportedTokens.map((token) => (
              <Button
                key={token.address}
                variant="ghost"
                onClick={() => onTokenChange(token)}
                fullWidth
                rounded
              >
                <View direction="row" gap={2} align="center">
                  <Image
                    src={token.icon}
                    alt={token.symbol}
                    width={24}
                    height={24}
                  />
                  <Text>{token.symbol}</Text>
                </View>
              </Button>
            ))}
          </View>
        </Popover.Content>
      </Popover>
    </View>
  )
} 