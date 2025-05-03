import { redirect } from 'next/navigation'

// Explicitly mark as dynamic to prevent static build issues
export const dynamic = 'force-dynamic'

export default function ExplorePage() {
  redirect('/explore/tokens')
}
