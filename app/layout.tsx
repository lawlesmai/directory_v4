import type { Metadata, Viewport } from 'next'
import { Poppins, Inter } from 'next/font/google'
import './globals.css'
import { QueryProvider } from '../lib/providers/QueryProvider'
import { ModalProvider } from '../lib/providers/ModalProvider'
import { AnalyticsProvider } from '../lib/providers/AnalyticsProvider'
import { CriticalErrorBoundary } from '../components/ErrorBoundary'

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
  // PWA metadata
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Lawless Directory',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'msapplication-TileColor': '#005F73',
    'msapplication-config': '/browserconfig.xml',
    'format-detection': 'telephone=no',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#005F73',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${poppins.variable} ${inter.variable}`}>
      <head>
        {/* PWA Icons */}
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192x192.svg" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon-192x192.svg" />
        <link rel="shortcut icon" href="/icons/icon-192x192.svg" />
        
        {/* iOS Splash Screens */}
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          href="/splash/iPhone_14_Pro_Max_portrait.png"
        />
        <link
          rel="apple-touch-startup-image"
          media="screen and (device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"
          href="/splash/iPhone_14_Pro_portrait.png"
        />
        
        {/* CSS Custom Properties for Safe Areas */}
        <style dangerouslySetInnerHTML={{
          __html: `
            :root {
              --safe-area-inset-top: env(safe-area-inset-top, 0px);
              --safe-area-inset-right: env(safe-area-inset-right, 0px);
              --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
              --safe-area-inset-left: env(safe-area-inset-left, 0px);
            }
          `
        }} />
      </head>
      
      <body className="font-body antialiased">
        <CriticalErrorBoundary>
          <AnalyticsProvider>
            <QueryProvider>
              <ModalProvider>
                {children}
              </ModalProvider>
            </QueryProvider>
          </AnalyticsProvider>
        </CriticalErrorBoundary>
        
        {/* Service Worker Registration Script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js', { scope: '/' })
                    .then(function(registration) {
                      console.log('SW registered: ', registration);
                    })
                    .catch(function(registrationError) {
                      console.log('SW registration failed: ', registrationError);
                    });
                });
              }
            `
          }}
        />
      </body>
    </html>
  )
}
