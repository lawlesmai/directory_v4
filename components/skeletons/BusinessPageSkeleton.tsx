'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export const BusinessPageSkeleton: React.FC = () => {
  return (
    <div className="business-page-skeleton min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800">
      {/* Navigation Header Skeleton */}
      <div className="sticky top-0 z-40 bg-gradient-to-r from-navy-900/95 to-navy-800/95 backdrop-blur-xl border-b border-sage/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-sage/20 rounded-full animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-4 bg-sage/20 rounded w-16 animate-pulse" />
                <div className="w-1 h-4 bg-sage/20 rounded animate-pulse" />
                <div className="h-4 bg-sage/20 rounded w-20 animate-pulse" />
                <div className="w-1 h-4 bg-sage/20 rounded animate-pulse" />
                <div className="h-4 bg-sage/20 rounded w-24 animate-pulse" />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-sage/20 rounded-full animate-pulse" />
              <div className="w-8 h-8 bg-sage/20 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Business Header Skeleton */}
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-8 bg-sage/20 rounded w-64 animate-pulse" />
                    <div className="w-6 h-6 bg-sage/20 rounded-full animate-pulse" />
                  </div>
                  
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-4 bg-sage/20 rounded w-32 animate-pulse" />
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 bg-sage/20 rounded animate-pulse" />
                      <div className="h-4 bg-sage/20 rounded w-12 animate-pulse" />
                      <div className="h-4 bg-sage/20 rounded w-20 animate-pulse" />
                    </div>
                    <div className="h-4 bg-sage/20 rounded w-8 animate-pulse" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="h-6 bg-sage/20 rounded-full w-24 animate-pulse" />
                    <div className="h-6 bg-sage/20 rounded-full w-20 animate-pulse" />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 bg-sage/20 rounded-full animate-pulse" />
                  <div className="w-12 h-12 bg-sage/20 rounded-full animate-pulse" />
                </div>
              </div>
            </div>

            {/* Image Gallery Skeleton */}
            <div className="space-y-4">
              <div className="h-6 bg-sage/20 rounded w-20 animate-pulse" />
              <div className="aspect-video bg-sage/20 rounded-lg animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-16 h-16 bg-sage/20 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>

            {/* Description Skeleton */}
            <div className="space-y-4">
              <div className="h-6 bg-sage/20 rounded w-32 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 bg-sage/20 rounded w-full animate-pulse" />
                <div className="h-4 bg-sage/20 rounded w-5/6 animate-pulse" />
                <div className="h-4 bg-sage/20 rounded w-4/6 animate-pulse" />
                <div className="h-4 bg-sage/20 rounded w-3/4 animate-pulse" />
              </div>
            </div>

            {/* Reviews Section Skeleton */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="h-6 bg-sage/20 rounded w-40 animate-pulse" />
                <div className="h-8 bg-sage/20 rounded w-24 animate-pulse" />
              </div>
              
              {/* Rating Summary */}
              <div className="p-4 bg-sage/10 rounded-lg border border-sage/20">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="text-center lg:text-left">
                    <div className="flex items-center justify-center lg:justify-start gap-2 mb-2">
                      <div className="h-8 bg-sage/20 rounded w-12 animate-pulse" />
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <div key={i} className="w-5 h-5 bg-sage/20 rounded animate-pulse" />
                        ))}
                      </div>
                    </div>
                    <div className="h-4 bg-sage/20 rounded w-32 animate-pulse mx-auto lg:mx-0" />
                  </div>
                  
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map((rating) => (
                      <div key={rating} className="flex items-center gap-2">
                        <div className="w-8 h-4 bg-sage/20 rounded animate-pulse" />
                        <div className="flex-1 h-2 bg-sage/20 rounded animate-pulse" />
                        <div className="w-8 h-4 bg-sage/20 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Review Cards */}
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-4 bg-sage/10 rounded-lg border border-sage/20 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-sage/20 rounded-full animate-pulse" />
                      <div>
                        <div className="h-4 bg-sage/20 rounded w-24 mb-1 animate-pulse" />
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <div key={star} className="w-3 h-3 bg-sage/20 rounded animate-pulse" />
                            ))}
                          </div>
                          <div className="h-3 bg-sage/20 rounded w-16 animate-pulse" />
                        </div>
                      </div>
                    </div>
                    <div className="w-4 h-4 bg-sage/20 rounded animate-pulse" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="h-4 bg-sage/20 rounded w-full animate-pulse" />
                    <div className="h-4 bg-sage/20 rounded w-4/5 animate-pulse" />
                    <div className="h-4 bg-sage/20 rounded w-3/5 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1 space-y-6">
            {/* Quick Actions */}
            <div className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6 space-y-4">
              <div className="h-6 bg-sage/20 rounded w-32 animate-pulse" />
              
              <div className="space-y-3">
                <div className="h-10 bg-sage/20 rounded animate-pulse" />
                <div className="h-10 bg-sage/20 rounded animate-pulse" />
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-10 bg-sage/20 rounded animate-pulse" />
                ))}
              </div>
            </div>

            {/* Business Information */}
            <div className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6 space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <div className="h-6 bg-sage/20 rounded w-40 animate-pulse" />
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-sage/20 rounded animate-pulse" />
                      <div className="h-4 bg-sage/20 rounded flex-1 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Business Hours */}
              <div className="space-y-4">
                <div className="h-6 bg-sage/20 rounded w-32 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-10 bg-sage/20 rounded animate-pulse" />
                  <div className="h-4 bg-sage/20 rounded w-24 animate-pulse" />
                </div>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <div className="h-6 bg-sage/20 rounded w-36 animate-pulse" />
                <div className="grid grid-cols-1 gap-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-10 bg-sage/20 rounded animate-pulse" />
                  ))}
                </div>
              </div>
            </div>

            {/* Location Map */}
            <div className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6">
              <div className="h-6 bg-sage/20 rounded w-20 mb-4 animate-pulse" />
              <div className="aspect-video bg-sage/20 rounded-lg animate-pulse" />
            </div>

            {/* Similar Businesses */}
            <div className="bg-gradient-to-br from-navy-800/50 to-navy-700/50 backdrop-blur-lg border border-sage/20 rounded-lg p-6">
              <div className="h-6 bg-sage/20 rounded w-36 mb-4 animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-sage/20 rounded-lg animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-4 bg-sage/20 rounded w-3/4 animate-pulse" />
                      <div className="h-3 bg-sage/20 rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="h-4 bg-sage/20 rounded w-32 mt-4 mx-auto animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}