import type { Metadata } from 'next'
import Providers from '@/app/providers'
import { Header } from '@/app/components/Header'
import { Footer } from '@/app/components/Footer'
import 'reshaped/themes/reshaped/theme.css'
import './globals.css'

// Silkscreen font configuration
export const metadata: Metadata = {
  title: 'Ponder Finance',
  description: 'trade. pool. earn. create',
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
    <html lang="en" data-rs-theme="reshaped" data-rs-color-mode="dark">
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
        <Footer />
      </body>
    </html>
  )
}
