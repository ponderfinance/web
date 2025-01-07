import type { Metadata } from 'next'
import Providers from '@/src/app/providers'
import { Header } from '@/src/app/components/Header'
import { Footer } from '@/src/app/components/Footer'
// import 'reshaped/themes/reshaped/theme.css'
import '@/src/themes/ponder/theme.css'
import { Analytics } from '@vercel/analytics/react'

import './globals.css'
import { Pathway_Extreme } from 'next/font/google'

// Pathway Extreme font configuration
const pathwayExtreme = Pathway_Extreme({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
})

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
    <html
      dir="ltr"
      lang="en"
      data-rs-theme="ponder"
      data-rs-color-mode="dark"
      className={pathwayExtreme.className}
    >
      <body>
        <Providers>
          <Header />
          {children}
          {/*<Footer />*/}
        </Providers>
        <Analytics />
      </body>
    </html>
  )
}
