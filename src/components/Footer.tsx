'use client'

import { View, Text } from 'reshaped'
import { DiscordLogo, GithubLogo, XLogo } from '@phosphor-icons/react'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <View
      direction="row"
      align="center"
      justify="space-between"
      paddingTop={16}
      paddingBottom={4}
    >
      <View direction="row" justify="end" gap={4}>
        <a
          href="https://github.com/ponderfinance"
          target="_blank"
          rel="noreferrer"
          className="uppercase"
        >
          <GithubLogo size={18} />
        </a>
        <a
          href="https://x.com/ponderdex"
          target="_blank"
          rel="noreferrer"
          className="uppercase"
        >
          <XLogo size={18} />
        </a>
        <a
          href="https://discord.gg/3XSkc3J6mX"
          target="_blank"
          rel="noreferrer"
          className="uppercase"
        >
          <DiscordLogo size={18} />
        </a>
      </View>
      <View>
        <Text variant="caption-1">
          &copy; {currentYear} <em style={{ fontFamily: 'serif', fontSize: 14 }}>i</em>{' '}
          Labs
        </Text>
      </View>
    </View>
  )
}
