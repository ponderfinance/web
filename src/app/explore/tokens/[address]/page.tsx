import { Suspense } from 'react'
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


