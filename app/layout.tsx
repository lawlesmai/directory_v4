import type { Metadata } from 'next'
import { Poppins, Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '../lib/providers/QueryProvider'
import { ModalProvider } from '../lib/providers/ModalProvider'

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'The Lawless Directory - Find It Here. Not Everywhere.',
  description: 'Discover local businesses in your area. The modern business directory that connects communities.',
  keywords: ['business directory', 'local businesses', 'community', 'search', 'discovery'],
  authors: [{ name: 'The Lawless Directory Team' }],
  openGraph: {
    title: 'The Lawless Directory',
    description: 'Discover local businesses in your area. The modern business directory that connects communities.',
    type: 'website',
  },
  viewport: { width: 'device-width', initialScale: 1 },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <body className="font-body antialiased">
        <QueryProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </QueryProvider>
      </body>
    </html>
  )
}
