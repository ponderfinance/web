import type { Metadata } from 'next'
import './globals.css'
import { Footer } from '@/app/components/Footer'
import { Header } from '@/app/components/Header'
import { Nav } from '@/app/components/Nav'
import Providers from '@/app/providers'
import localFont from 'next/font/local'

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
})

export const metadata: Metadata = {
  title: 'Zora Starter App',
  description: 'Get started with Zora',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={arialNarrow.className}>
        <Providers>
          <Header />
          <div className="flex min-h-screen w-full max-w-screen-2xl flex-col gap-6 p-6 md:flex-row">
            <div className="w-full rounded-lg p-4 md:w-1/3">
              <Nav />
            </div>
            <div className="w-full rounded-lg p-4 md:w-2/3">
              <h2 className="text-lg font-semibold"> {children}</h2>
            </div>
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  )
}
