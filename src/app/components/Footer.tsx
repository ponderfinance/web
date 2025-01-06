import { View, Text } from 'reshaped'
import { GithubLogo, XLogo } from '@phosphor-icons/react'

export const Footer = () => {
  const currentYear = new Date().getFullYear()

  return (
    <View
      direction="row"
      align="center"
      justify="space-between"
      paddingInline={4}
      paddingTop={16}
      paddingBottom={4}
    >
      {/*<View>*/}
      {/*  <Text variant="caption-1">*/}
      {/*    &copy; {currentYear} <em style={{ fontFamily: 'serif', fontSize: 14 }}>i</em>{' '}*/}
      {/*    Labs*/}
      {/*  </Text>*/}
      {/*</View>*/}
      <View direction="row" justify="end" gap={4}>
        <a
          href="https://github.com/taayyohh/ponderfinance"
          target="_blank"
          rel="noreferrer"
          className="uppercase"
        >
          <GithubLogo size={18} />
        </a>
        <a
          href="https://github.com/taayyohh/ponderfinance"
          target="_blank"
          rel="noreferrer"
          className="uppercase"
        >
          <XLogo size={18} />
        </a>
      </View>
    </View>
  )
}
