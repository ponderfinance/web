import type { Metadata } from 'next'
import Providers from '@/app/providers'
import localFont from 'next/font/local'
import { Header } from '@/app/components/Header'
import { Barlow_Condensed } from 'next/font/google'

import 'reshaped/themes/reshaped/theme.css'
import '@/app/themes/ponder/theme.css'
import './globals.css'

const arialNarrow = localFont({
  src: [
    {
      path: '../public/fonts/arialnarrow.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../public/fonts/arialnarrow_bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../public/fonts/arialnarrow_italic.ttf',
      weight: '400',
      style: 'italic',
    },
    {
      path: '../public/fonts/arialnarrow_bolditalic.ttf',
      weight: '700',
      style: 'italic',
    },
  ],
  display: 'swap',
  variable: '--font-arial-narrow',
})

// Silkscreen font configuration
const silkscreen = Barlow_Condensed({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-barlow-condensed', // Add this line to use as CSS variable
})

export const metadata: Metadata = {
  title: 'Ponder Finance Decentralized Exchange',
  description: 'trade. earn. meme.',
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
    <html lang="en" data-rs-theme="ponder" data-rs-color-mode="dark">
      <body
        className={`${arialNarrow.variable} ${silkscreen.variable} ${arialNarrow.className}`}
      >
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  )
}
