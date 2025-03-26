import type { Metadata } from 'next'
import Providers from '../providers'
import { Header } from '@/src/components/Header'
import { Footer } from '@/src/components/Footer'
// import 'reshaped/themes/reshaped/theme.css'
import '@/src/themes/ponder/theme.css'
import { Analytics } from '@vercel/analytics/react'

import './globals.css'
// import { Pirata_One } from 'next/font/google'
import { View } from 'reshaped'

// const pirataOne = Pirata_One({
//   subsets: ['latin'],
//   weight: ['400'],
//   display: 'swap',
//   variable: '--font-pirata-one',
// })

export const metadata: Metadata = {
  title: 'Ponder Finance',
  description: 'trade. pool. earn. launch',
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
  return (
    <html dir="ltr" lang="en" data-rs-theme="ponder" data-rs-color-mode="dark">
      <body style={{ fontFamily: "'Pathway Extreme', sans-serif" }}>
        <Providers>
          <Header />
          <View
            maxWidth={{ s: '100%', m: '1032px' }}
            attributes={{ style: { margin: '0 auto' } }}
            insetTop={{ s: 16, m: 24 }}
          >
            {children}
          </View>
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
