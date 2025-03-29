'use client'

import { Button, Popover, Text, View } from 'reshaped'
import { Chain } from '@/src/types'
import Image from 'next/image'

interface ChainSelectorProps {
  sourceChain: Chain | null
  destChain: Chain | null
  onSourceChainChange: (chain: Chain) => void
  supportedChains: Chain[]
}

export const ChainSelector = ({
  sourceChain,
  destChain,
  onSourceChainChange,
  supportedChains,
}: ChainSelectorProps) => {
  const handleSwitchChains = () => {
    if (sourceChain && destChain) {
      onSourceChainChange(destChain)
    }
  }

  return (
    <View direction="column" gap={2}>
      <Text variant="body-2">From</Text>
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
                {sourceChain ? (
                  <>
                    <Image
                      src={sourceChain.icon}
                      alt={sourceChain.name}
                      width={24}
                      height={24}
                      style={{ borderRadius: '50%' }}
                    />
                    <Text>{sourceChain.name}</Text>
                  </>
                ) : (
                  <Text>Select chain</Text>
                )}
              </View>
            </Button>
          )}
        </Popover.Trigger>
        <Popover.Content>
          <View direction="column" gap={1}>
            {supportedChains.map((chain) => (
              <Button
                key={chain.id}
                variant="ghost"
                onClick={() => onSourceChainChange(chain)}
                fullWidth
                rounded
              >
                <View direction="row" gap={2} align="center">
                  <Image
                    src={chain.icon}
                    alt={chain.name}
                    width={24}
                    height={24}
                    style={{ borderRadius: '50%' }}
                  />
                  <Text>{chain.name}</Text>
                </View>
              </Button>
            ))}
          </View>
        </Popover.Content>
      </Popover>

      <View direction="row" justify="center">
        <Button
          variant="ghost"
          onClick={handleSwitchChains}
          disabled={!sourceChain || !destChain}
        >
          <Text>↓</Text>
        </Button>
      </View>

      <Text variant="body-2">To</Text>
      <Button
        variant="outline"
        fullWidth
        rounded
        attributes={{ style: { pointerEvents: 'none' } }}
      >
        <View direction="row" gap={2} align="center">
          {destChain ? (
            <>
              <Image
                src={destChain.icon}
                alt={destChain.name}
                width={24}
                height={24}
                style={{ borderRadius: '50%' }}
              />
              <Text>{destChain.name}</Text>
            </>
          ) : (
            <Text>Select chain</Text>
          )}
        </View>
      </Button>
    </View>
  )
} 