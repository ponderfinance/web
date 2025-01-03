import { Button, DropdownMenu, Text, View } from 'reshaped'
import { Gear, GearSix } from '@phosphor-icons/react'

function SwapSettings({
  slippage,
  setSlippage,
}: {
  slippage: number
  setSlippage: (slippage: number) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger>
        {(attributes) => (
          <Button attributes={attributes} variant="ghost" size="small" rounded={true}>
            <GearSix size={18} />
          </Button>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <View gap={4}>
          <Text align="center" color="neutral">
            Slippage Tolerance
          </Text>
          <View direction="row" gap={2} justify="center">
            <Button
              variant={slippage === 0.1 ? 'outline' : 'ghost'}
              size="small"
              onClick={() => setSlippage(0.1)}
            >
              0.1%
            </Button>
            <Button
              variant={slippage === 0.5 ? 'outline' : 'ghost'}
              size="small"
              onClick={() => setSlippage(0.5)}
            >
              0.5%
            </Button>
            <Button
              variant={slippage === 1.0 ? 'outline' : 'ghost'}
              size="small"
              onClick={() => setSlippage(1.0)}
            >
              1.0%
            </Button>
          </View>
        </View>
      </DropdownMenu.Content>
    </DropdownMenu>
  )
}

export const InterfaceTabs = ({
  slippage,
  setSlippage,
}: {
  slippage: number
  setSlippage: (slippage: number) => void
}) => {
  return (
    <View direction="row" gap={1} justify="space-between" align="center">
      <View direction="row" gap={1}>
        <Button variant="outline" size="small" rounded={true}>
          <View padding={1} paddingInline={2}>
            <Text variant="caption-1" weight="bold">
              Swap
            </Text>
          </View>
        </Button>
        <Button variant="ghost" size="small" rounded={true}>
          <View padding={1} paddingInline={2}>
            <Text variant="caption-1" weight="bold">
              Send
            </Text>
          </View>
        </Button>
      </View>
      <View>
        <SwapSettings slippage={slippage} setSlippage={setSlippage} />
      </View>
    </View>
  )
}
