import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/app/providers'
import localFont from 'next/font/local'
import { Header } from '@/app/components/Header'
import { FeedPet } from '@/app/components/FeedPet'
import { EnableWithdraw } from '@/app/components/EnableWithdrawl'
import { Silkscreen } from 'next/font/google'

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
const silkscreen = Silkscreen({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-silkscreen', // Add this line to use as CSS variable
})

export const metadata: Metadata = {
  title: 'Snack Snack',
  description: 'Snack your way to savings',
  openGraph: {
    images: {
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Snack Snack',
    },
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Snack Snack',
    description: 'Snack your way to savings',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
    <body className={`${arialNarrow.variable} ${silkscreen.variable} ${arialNarrow.className}`}>
    <Providers>
      <Header/>
      {children}
    </Providers>
    </body>
    </html>
  )
}
