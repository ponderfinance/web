import { Suspense } from 'react'
import { View, Text, Skeleton } from 'reshaped'
import TokenDetailPage from '@/src/modules/explore/components/TokenDetailPage'

interface TokenPageProps {
  params: {
    address: string
  }
}

export default function TokenPage({ params }: TokenPageProps) {
  return (
    <Suspense>
      <TokenDetailPage params={params} />
    </Suspense>
  )
}

function TokenPageSkeleton() {
  return (
    <View direction="column" gap={24}>
      <Skeleton height={380} width="100%" borderRadius="large" />
      <Skeleton height={200} width="100%" borderRadius="large" />
      <Skeleton height={150} width="100%" borderRadius="large" />
    </View>
  )
}
