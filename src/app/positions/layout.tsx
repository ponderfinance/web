import type { Metadata } from 'next'
import { View } from 'reshaped'

export const metadata: Metadata = {
  title: 'Bitkub (KUB): Buy and sell on Ponder',
  description: 'Manage pool liquidity on Ponder',
  openGraph: {
    images: {
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Ponder Finance',
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ponder Finance Decentralized Exchange',
    description: 'trade. earn. meme.',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <View>{children}</View>
}
