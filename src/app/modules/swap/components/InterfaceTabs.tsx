import { Button, DropdownMenu, Text, View } from 'reshaped'
import { Gear, GearSix } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
  slippage?: number | undefined
  setSlippage?: ((slippage: number) => void) | undefined
}) => {
  const pathname = usePathname()

  return (
    <View direction="row" gap={1} justify="space-between" align="center">
      <View direction="row" gap={1}>
        <Button
          variant={pathname === '/swap' ? 'faded' : 'ghost'}
          size="small"
          rounded={true}
        >
          <Link href={'/swap'}>
            <View padding={1} paddingInline={2}>
              <Text variant="caption-1" weight="bold">
                Swap
              </Text>
            </View>
          </Link>
        </Button>
        <Button
          variant={pathname === '/send' ? 'faded' : 'ghost'}
          size="small"
          rounded={true}
        >
          <Link href={'/send'}>
            <View padding={1} paddingInline={2}>
              <Text variant="caption-1" weight="bold">
                Send
              </Text>
            </View>
          </Link>
        </Button>
      </View>
      {slippage && setSlippage && (
        <View>
          <SwapSettings slippage={slippage} setSlippage={setSlippage} />
        </View>
      )}
    </View>
  )
}
