'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { Button, Popover, Skeleton, Text, View } from 'reshaped'
import Link from 'next/link'
import { PaperPlaneTilt, Path, Triangle } from '@phosphor-icons/react'
import { usePathname } from 'next/navigation'
import { Footer } from '@/src/app/components/Footer'
import { XKOIButton } from '@/src/app/components/xKOIButton'

export const Header = () => {
  const { authenticated, login, logout } = usePrivy()
  const pathname = usePathname()

  return (
    <View
      direction="row"
      justify="space-between"
      align="center"
      paddingInline={8}
      paddingTop={4}
      paddingBottom={4}
      backgroundColor="page"
      position="fixed"
      width="100%"
      zIndex={50}
    >
      <View direction="row" gap={12} align="center">
        <Link href="/">
          <View align="center" direction="row" justify="center">
            <Popover triggerType="hover" padding={1}>
              <Popover.Trigger>
                {(attributes) => (
                  <Button attributes={attributes} variant="ghost">
                    <View direction="row" gap={3} align="center" justify="center">
                      <Image
                        src={'/koi-logo.png'}
                        alt={'Koi Logo'}
                        width={120}
                        height={23}
                      />
                      <View attributes={{ style: { transform: 'rotate(180deg)' } }}>
                        <Triangle size={10} />
                      </View>
                    </View>
                  </Button>
                )}
              </Popover.Trigger>
              <Popover.Content>
                <Footer />
              </Popover.Content>
            </Popover>
          </View>
        </Link>

        <View direction="row" gap={4}>
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
                <Link href={'/swap'}>
                  <View
                    direction="row"
                    gap={2}
                    align="center"
                    padding={3}
                    backgroundColor="elevation-base"
                    borderRadius="medium"
                  >
                    <Path size={16} />
                    <Text variant="body-2">Swap</Text>
                  </View>
                </Link>
                <Link href={'/send'}>
                  <View
                    direction="row"
                    gap={2}
                    align="center"
                    padding={3}
                    backgroundColor="elevation-base"
                    borderRadius="medium"
                  >
                    <PaperPlaneTilt size={16} />
                    <Text variant="body-2">Send</Text>
                  </View>
                </Link>
              </View>
            </Popover.Content>
          </Popover>

          <Popover triggerType="hover" padding={1}>
            <Popover.Trigger>
              {(attributes) => (
                <Button attributes={attributes} variant="ghost">
                  <Text
                    variant="body-1"
                    color={pathname === '/pool' ? 'neutral' : 'neutral-faded'}
                  >
                    <Link href="/positions">Pool </Link>
                  </Text>
                </Button>
              )}
            </Popover.Trigger>
            <Popover.Content>
              <View direction="column" gap={1}>
                <Link href={'/positions'}>
                  <View
                    direction="row"
                    gap={2}
                    align="center"
                    padding={3}
                    backgroundColor="elevation-base"
                    borderRadius="medium"
                  >
                    <Text variant="body-2">View positions</Text>
                  </View>
                </Link>
                <Link href={'/positions/create'}>
                  <View
                    direction="row"
                    gap={2}
                    align="center"
                    padding={3}
                    backgroundColor="elevation-base"
                    borderRadius="medium"
                  >
                    <Text variant="body-2">Create position</Text>
                  </View>
                </Link>
              </View>
            </Popover.Content>
          </Popover>

          <Link href="/launch">
            <Button variant="ghost">
              <Text
                variant="body-1"
                color={pathname === '/launch' ? 'neutral' : 'neutral-faded'}
              >
                Launch
              </Text>
            </Button>
          </Link>
        </View>
      </View>

      <View direction="row" gap={2}>
        <XKOIButton />

        <Button onClick={!authenticated ? login : logout} variant="faded" color="neutral">
          {authenticated ? 'Logout' : 'Login'}
        </Button>
      </View>
    </View>
  )
}
