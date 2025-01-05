'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { Button, Popover, Text, View } from 'reshaped'
import Link from 'next/link'
import { PaperPlaneTilt, Path } from '@phosphor-icons/react'

export const Header = () => {
  const { authenticated, login, logout } = usePrivy()

  return (
    <View
      direction="row"
      justify="space-between"
      align="center"
      paddingInline={8}
      paddingTop={4}
    >
      <View direction="row" gap={12} align="center">
        <Link href="/">
          <View align="center" direction="row" justify="center">
            <Image src={'/koi-logo.png'} alt={'Koi Logo'} width={64} height={64} />
          </View>
        </Link>

        <View direction="row" gap={4}>
          <Popover triggerType="hover">
            <Popover.Trigger>
              {(attributes) => (
                <Button attributes={attributes} variant="ghost">
                  <Text variant="body-1">
                    <Link href={'/swap'}>Trade</Link>
                  </Text>
                </Button>
              )}
            </Popover.Trigger>
            <Popover.Content>
              <View direction="column" gap={2}>
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

          <Popover triggerType="hover">
            <Popover.Trigger>
              {(attributes) => (
                <Button attributes={attributes} variant="ghost">
                  <Text variant="body-1">
                    <Link href="/pool">Pool </Link>
                  </Text>
                </Button>
              )}
            </Popover.Trigger>
            <Popover.Content>
              <View direction="column" gap={2}>
                <Link href={'/pool'}>
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
                <Link href={'/pool/create'}>
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

          <Link href="/earn">
            <Button variant="ghost">
              <Text variant="body-1">Earn </Text>
            </Button>
          </Link>

          <Link href="/launch">
            <Button variant="ghost">
              <Text variant="body-1">Launch</Text>
            </Button>
          </Link>
        </View>
      </View>

      <Button onClick={!authenticated ? login : logout} variant="outline">
        {authenticated ? 'Logout' : 'Login'}
      </Button>
    </View>
  )
}
