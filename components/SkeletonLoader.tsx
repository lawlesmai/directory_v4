'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangle' | 'circle' | 'text';
  width?: string | number;
  height?: string | number;
  animated?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangle',
  width,
  height,
  animated = true,
}) => {
  const baseClasses = 'bg-gray-200 animate-pulse';
  const variantClasses = {
    rectangle: 'rounded',
    circle: 'rounded-full',
    text: 'rounded h-4',
  };

  const skeletonStyles = {
    width,
    height,
  };

  const SkeletonElement = animated ? motion.div : 'div';

  return (
    <SkeletonElement
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={skeletonStyles}
      {...(animated && {
        initial: { opacity: 0.6 },
        animate: { opacity: [0.6, 1, 0.6] },
        transition: {
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        },
      })}
    />
  );
};

interface BusinessCardSkeletonProps {
  animated?: boolean;
  className?: string;
}

export const BusinessCardSkeleton: React.FC<BusinessCardSkeletonProps> = ({
  animated = true,
  className = '',
}) => {
  return (
    <div className={`business-card skeleton-card bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {/* Image skeleton */}
      <Skeleton
        variant="rectangle"
        height="12rem"
        className="w-full"
        animated={animated}
      />

      {/* Content skeleton */}
      <div className="p-6 space-y-4">
        {/* Rating skeleton */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton
                key={i}
                variant="circle"
                width="1rem"
                height="1rem"
                animated={animated}
              />
            ))}
          </div>
          <Skeleton
            variant="text"
            width="6rem"
            animated={animated}
          />
        </div>

        {/* Business name skeleton */}
        <Skeleton
          variant="text"
          width="75%"
          height="1.5rem"
          animated={animated}
        />

        {/* Category info skeleton */}
        <div className="flex items-center space-x-2">
          <Skeleton variant="text" width="4rem" animated={animated} />
          <span className="text-gray-300">•</span>
          <Skeleton variant="text" width="6rem" animated={animated} />
          <span className="text-gray-300">•</span>
          <Skeleton variant="text" width="3rem" animated={animated} />
        </div>

        {/* Description skeleton */}
        <div className="space-y-2">
          <Skeleton variant="text" width="100%" animated={animated} />
          <Skeleton variant="text" width="85%" animated={animated} />
        </div>

        {/* Badges skeleton */}
        <div className="flex space-x-2">
          <Skeleton variant="rectangle" width="4rem" height="1.5rem" animated={animated} />
          <Skeleton variant="rectangle" width="5rem" height="1.5rem" animated={animated} />
        </div>

        {/* Actions skeleton */}
        <div className="flex space-x-2 pt-4 border-t border-gray-100">
          <Skeleton variant="rectangle" height="2.5rem" className="flex-1" animated={animated} />
          <Skeleton variant="rectangle" height="2.5rem" className="flex-1" animated={animated} />
          <Skeleton variant="rectangle" height="2.5rem" className="flex-1" animated={animated} />
        </div>
      </div>
    </div>
  );
};

interface SearchBarSkeletonProps {
  animated?: boolean;
  className?: string;
}

export const SearchBarSkeleton: React.FC<SearchBarSkeletonProps> = ({
  animated = true,
  className = '',
}) => {
  return (
    <div className={`search-skeleton ${className}`}>
      <Skeleton
        variant="rectangle"
        width="100%"
        height="3rem"
        className="rounded-full"
        animated={animated}
      />
    </div>
  );
};

interface FilterBarSkeletonProps {
  animated?: boolean;
  className?: string;
  itemCount?: number;
}

export const FilterBarSkeleton: React.FC<FilterBarSkeletonProps> = ({
  animated = true,
  className = '',
  itemCount = 7,
}) => {
  return (
    <div className={`filter-skeleton flex space-x-4 ${className}`}>
      {Array.from({ length: itemCount }, (_, i) => (
        <Skeleton
          key={i}
          variant="rectangle"
          width="5rem"
          height="2.5rem"
          className="rounded-full"
          animated={animated}
        />
      ))}
    </div>
  );
};

interface ListSkeletonProps {
  itemCount?: number;
  animated?: boolean;
  className?: string;
}

export const BusinessListSkeleton: React.FC<ListSkeletonProps> = ({
  itemCount = 3,
  animated = true,
  className = '',
}) => {
  return (
    <div className={`business-list-skeleton space-y-6 ${className}`}>
      {Array.from({ length: itemCount }, (_, index) => (
        <BusinessCardSkeleton
          key={index}
          animated={animated}
        />
      ))}
    </div>
  );
};

// Composite skeleton for the entire page
interface PageSkeletonProps {
  animated?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  businessCount?: number;
}

export const HomePageSkeleton: React.FC<PageSkeletonProps> = ({
  animated = true,
  showSearch = true,
  showFilters = true,
  businessCount = 6,
}) => {
  return (
    <div className="page-skeleton">
      {/* Header skeleton */}
      <header className="header-skeleton mb-8 space-y-6">
        {/* Navigation skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton variant="text" width="12rem" height="2rem" animated={animated} />
          <div className="flex space-x-4">
            <Skeleton variant="rectangle" width="6rem" height="2.5rem" animated={animated} />
            <Skeleton variant="rectangle" width="4rem" height="2.5rem" animated={animated} />
          </div>
        </div>

        {/* Search bar skeleton */}
        {showSearch && (
          <SearchBarSkeleton animated={animated} className="max-w-2xl mx-auto" />
        )}

        {/* Filter bar skeleton */}
        {showFilters && (
          <FilterBarSkeleton animated={animated} className="justify-center" />
        )}
      </header>

      {/* Main content skeleton */}
      <main className="main-skeleton">
        {/* Results header skeleton */}
        <div className="flex items-center justify-between mb-6">
          <Skeleton variant="text" width="15rem" height="1.5rem" animated={animated} />
          <div className="flex items-center space-x-4">
            <Skeleton variant="rectangle" width="8rem" height="2.5rem" animated={animated} />
            <Skeleton variant="rectangle" width="4rem" height="2.5rem" animated={animated} />
          </div>
        </div>

        {/* Business grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: businessCount }, (_, index) => (
            <BusinessCardSkeleton
              key={index}
              animated={animated}
            />
          ))}
        </div>
      </main>
    </div>
  );
};

export default {
  Skeleton,
  BusinessCardSkeleton,
  SearchBarSkeleton,
  FilterBarSkeleton,
  BusinessListSkeleton,
  HomePageSkeleton,
};