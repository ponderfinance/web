'use client'

import { usePrivy } from '@privy-io/react-auth'
import Image from 'next/image'
import { Button, Text, View } from 'reshaped'
import Link from 'next/link'

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

        <View direction="row" gap={8}>
          <Text variant="body-1">
            <Link href="/swap">Trade </Link>
          </Text>
          <Text variant="body-1">
            <Link href="/pool">Pool </Link>
          </Text>
          <Text variant="body-1">
            <Link href="/earn">Earn </Link>
          </Text>
          <Text variant="body-1">
            <Link href="/launch">Launch </Link>
          </Text>
        </View>
      </View>

      <Button onClick={!authenticated ? login : logout} variant="outline">
        {authenticated ? 'Logout' : 'Login'}
      </Button>
    </View>
  )
}
