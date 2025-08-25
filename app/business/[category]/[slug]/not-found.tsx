import { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Search } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Business Not Found | The Lawless Directory',
  description: 'The requested business could not be found in our directory.',
  robots: {
    index: false,
    follow: false
  }
}

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center p-8">
        <div className="w-24 h-24 mx-auto mb-6 bg-sage/20 rounded-full flex items-center justify-center">
          <Search size={32} className="text-sage/60" />
        </div>
        
        <h1 className="text-2xl font-bold text-sage-50 mb-4">
          Business Not Found
        </h1>
        
        <p className="text-sage/80 mb-8 leading-relaxed">
          The business you're looking for doesn't exist or may have been removed from our directory.
        </p>
        
        <div className="space-y-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-sage hover:bg-sage/90 text-navy-900 rounded-lg font-semibold transition-all duration-200 hover:scale-105"
          >
            <ArrowLeft size={18} />
            Back to Directory
          </Link>
          
          <div className="text-sage/60 text-sm">
            Or{' '}
            <Link href="/" className="text-sage hover:text-sage/80 underline">
              search for other businesses
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}