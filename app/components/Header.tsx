'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { Button, Link, Text, View } from 'reshaped'

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
        <Text variant="body-1">Ponder</Text>
        <View direction="row" gap={8}>
          <Text variant="body-1">
            <Link href="/swap" variant="plain">
              Trade{' '}
            </Link>
          </Text>
          <Text variant="body-1">
            <Link href="/pool" variant="plain">
              Pool{' '}
            </Link>
          </Text>
          <Text variant="body-1">
            <Link href="/farm" variant="plain">
              Farm{' '}
            </Link>
          </Text>
          <Text variant="body-1">
            <Link href="/launch" variant="plain">
              Launch{' '}
            </Link>
          </Text>
        </View>
      </View>

      <Button onClick={!authenticated ? login : logout} variant="outline">
        {authenticated ? 'Logout' : 'Login'}
      </Button>
    </View>
  )
}
