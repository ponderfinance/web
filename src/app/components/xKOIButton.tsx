import { Button, Link, Skeleton, Text, View } from 'reshaped'

export const XKOIButton = () => {
  return (
    <Button variant="outline" rounded={true} color="primary">
      <Link href="/xkoi" attributes={{ style: { textDecoration: 'none' } }}>
        <View direction="row" gap={2} align="center" justify="center">
          <Skeleton height={5} width={5} borderRadius="circular" />
          <View direction="row" gap={1}>
            <Text variant="caption-1">13k</Text>
            <Text variant="caption-1">xKOI</Text>
          </View>
        </View>
      </Link>
    </Button>
  )
}
