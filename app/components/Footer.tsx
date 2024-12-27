import { View, Text } from 'reshaped'

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
      <View>
        <Text variant="caption-1">&copy; {currentYear} Sellout Labs, Inc</Text>
      </View>
      <View>
        <div className="flex gap-4 text-sm">
          <a
            href="https://github.com/taayyohh/ponderfinance"
            target="_blank"
            rel="noreferrer"
            className="uppercase"
          >
            GITHUB
          </a>
        </div>
      </View>
    </View>
  )
}
