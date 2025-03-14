'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { Button, Hidden, Icon, Modal, Popover, Text, useToggle, View } from 'reshaped'
import Link from 'next/link'
import { List, PaperPlaneTilt, Path, Triangle } from '@phosphor-icons/react'
import { usePathname, useRouter } from 'next/navigation'
import { Footer } from '@/src/components/Footer'
import { XKOIButton } from '@/src/components/xKOIButton'
import { useAccount } from 'wagmi'
import { shortenAddress } from '@/src/utils/numbers'

export const Header = () => {
  const { authenticated, login, logout } = usePrivy()
  const pathname = usePathname()
  const router = useRouter()
  const { active, activate, deactivate } = useToggle(false)
  const account = useAccount()

  return (
    <View
      direction="row"
      justify="space-between"
      align="center"
      paddingInline={{ s: 1, m: 4 }}
      paddingTop={{ s: 1, m: 4 }}
      paddingBottom={{ s: 1, m: 4 }}
      backgroundColor="page"
      position="fixed"
      width="100%"
      zIndex={50}
    >
      <View direction="row" gap={4} align="center">
        <Link href="/">
          <View align="center" direction="row" justify="center">
            <Popover triggerType="hover">
              <Popover.Trigger>
                {(attributes) => (
                  <Button attributes={attributes} variant="ghost">
                    <View direction="row" gap={1} align="center" justify="center">
                      <Image
                        src={'/ponder-logo.png'}
                        alt={'Ponder Logo'}
                        width={60}
                        height={23}
                      />
                      <Text
                        attributes={{ style: { fontFamily: 'var(--font-pirata-one)' } }}
                        variant="body-1"
                        weight="regular"
                        color="primary"
                      >
                        ponder finance
                      </Text>
                      {/*<View attributes={{ style: { transform: 'rotate(180deg)' } }}>*/}
                      {/*  <Triangle size={10} />*/}
                      {/*</View>*/}
                    </View>
                  </Button>
                )}
              </Popover.Trigger>
              <Popover.Content>
                <Footer />
                <View direction="row" gap={2}>
                  <a href="https://magic.decentralized-content.com/ipfs/bafkreigugdnvgtgfjx5hhghvzocvd5uwzat5zut4xsokbdtdnl4oyd4wny">
                    <Text variant="caption-2">Terms of Service</Text>
                  </a>
                  <a href="https://magic.decentralized-content.com/ipfs/bafkreigyvyrxudd5zb6az5upwuypv46u66wsjs5r254hhfrlqoa3icrewq">
                    <Text variant="caption-2">Privacy Policy</Text>
                  </a>
                </View>
              </Popover.Content>
            </Popover>
          </View>
        </Link>

        <Hidden hide={{ s: true, m: false }}>
          <View direction="row" gap={1}>
            <Popover triggerType="hover" padding={1}>
              <Popover.Trigger>
                {(attributes) => (
                  <Button attributes={attributes} variant="ghost">
                    <Text
                      variant="body-1"
                      color={pathname === '/swap' ? 'neutral' : 'neutral-faded'}
                    >
                      <Link href={'/swap'}>Trade</Link>
                    </Text>
                  </Button>
                )}
              </Popover.Trigger>
              <Popover.Content>
                <View direction="column" gap={1}>
                  <Button
                    color="neutral"
                    onClick={() => router.push('/swap')}
                    attributes={{
                      style: {
                        justifyContent: 'start',
                        paddingTop: 12,
                        paddingBottom: 12,
                      },
                    }}
                  >
                    <Path size={16} />
                    <Text variant="body-2">Swap</Text>
                  </Button>
                  <Button
                    color="neutral"
                    onClick={() => router.push('/send')}
                    attributes={{
                      style: {
                        justifyContent: 'start',
                        paddingTop: 12,
                        paddingBottom: 12,
                      },
                    }}
                  >
                    <PaperPlaneTilt size={16} />
                    <Text variant="body-2">Send</Text>
                  </Button>
                </View>
              </Popover.Content>
            </Popover>

            <Popover triggerType="hover" padding={1}>
              <Popover.Trigger>
                {(attributes) => (
                  <Button attributes={attributes} variant="ghost">
                    <Text
                      variant="body-1"
                      color={
                        pathname.includes('/positions') ? 'neutral' : 'neutral-faded'
                      }
                    >
                      <Link href="/positions">Pool </Link>
                    </Text>
                  </Button>
                )}
              </Popover.Trigger>
              <Popover.Content>
                <View direction="column" gap={1}>
                  <Button
                    color="neutral"
                    onClick={() => router.push('/positions')}
                    attributes={{
                      style: {
                        justifyContent: 'start',
                        paddingTop: 12,
                        paddingBottom: 12,
                      },
                    }}
                  >
                    <Text variant="body-2">View positions</Text>
                  </Button>
                  <Button
                    color="neutral"
                    onClick={() => router.push('/positions/create')}
                    attributes={{
                      style: {
                        justifyContent: 'start',
                        paddingTop: 12,
                        paddingBottom: 12,
                      },
                    }}
                  >
                    <Text variant="body-2">Create position</Text>
                  </Button>
                </View>
              </Popover.Content>
            </Popover>

            <Link href="/explore">
              <Button variant="ghost">
                <Text
                  variant="body-1"
                  color={pathname === '/explore' ? 'neutral' : 'neutral-faded'}
                >
                  Explore
                </Text>
              </Button>
            </Link>
          </View>
        </Hidden>
      </View>

      <Hidden hide={{ s: true, m: false }}>
        <View direction="row" gap={2} align="center">
          <Button
            variant="ghost"
            size="small"
            attributes={{ style: { borderRadius: 'medium' } }}
            rounded={true}
          >
            <Image src={'/bitkub-logo.png'} alt={'Bitkub Logo'} width={32} height={32} />
          </Button>

          <XKOIButton />

          <Button
            /*//@ts-ignore*/
            onClick={!authenticated ? login : logout}
            variant={authenticated ? 'ghost' : 'faded'}
            rounded={true}
            color="primary"
          >
            {authenticated && account?.address
              ? shortenAddress(account?.address)
              : 'Connect'}
          </Button>
        </View>
      </Hidden>
      <Hidden hide={{ s: false, m: true }}>
        <Button variant="ghost" onClick={activate}>
          <Icon svg={List} size={6} />
        </Button>
      </Hidden>
      <Modal position="bottom" active={active} onClose={deactivate}>
        <View direction="column" gap={2} align="start">
          <Button
            variant="ghost"
            onClick={() => {
              router.push('/swap')
              deactivate()
            }}
          >
            <Text variant="body-1">Swap</Text>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              router.push('/send')
              deactivate()
            }}
          >
            <Text variant="body-1">Send</Text>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              router.push('/positions/creat')
              deactivate()
            }}
          >
            <Text variant="body-1">Create position</Text>
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              router.push('/positions')
              deactivate()
            }}
          >
            <Text variant="body-1">View positions</Text>
          </Button>
        </View>
      </Modal>
    </View>
  )
}
