import PairDetailPage from '@/src/components/PairDetailPage'

export default function Page({ params }: { params: { address: string } }) {
  return <PairDetailPage params={params} />
}
