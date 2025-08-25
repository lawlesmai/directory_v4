/**
 * Custom React Query hooks for business data fetching
 * The Lawless Directory - Database Integration Hooks
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { businessApi, type BusinessSearchParams, type EnhancedBusiness } from '../lib/api/businesses';
import { useDebounce } from './useDebounce';

// Query key factories for consistent cache management
export const businessQueryKeys = {
  all: ['businesses'] as const,
  lists: () => [...businessQueryKeys.all, 'list'] as const,
  list: (params: BusinessSearchParams) => [...businessQueryKeys.lists(), params] as const,
  details: () => [...businessQueryKeys.all, 'detail'] as const,
  detail: (slug: string) => [...businessQueryKeys.details(), slug] as const,
  search: () => [...businessQueryKeys.all, 'search'] as const,
  searchSuggestions: (query: string) => [...businessQueryKeys.search(), 'suggestions', query] as const,
  categories: () => ['categories'] as const,
  featured: () => [...businessQueryKeys.all, 'featured'] as const,
  reviews: (businessId: string) => ['reviews', businessId] as const
};

/**
 * Hook for fetching paginated business listings
 */
export const useBusinesses = (params: BusinessSearchParams = {}) => {
  return useQuery({
    queryKey: businessQueryKeys.list(params),
    queryFn: () => businessApi.getBusinesses(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('not found')) return false;
      return failureCount < 2;
    },
  });
};

/**
 * Hook for infinite scrolling business listings
 */
export const useInfiniteBusinesses = (params: BusinessSearchParams = {}) => {
  return useInfiniteQuery({
    queryKey: businessQueryKeys.list(params),
    queryFn: ({ pageParam = 0 }) =>
      businessApi.getBusinesses({
        ...params,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.hasMore) {
        return allPages.length * (params.limit || 20);
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching business details by slug
 */
export const useBusinessDetails = (slug: string) => {
  return useQuery({
    queryKey: businessQueryKeys.detail(slug),
    queryFn: () => businessApi.getBusinessBySlug(slug),
    enabled: !!slug,
    staleTime: 10 * 60 * 1000, // 10 minutes for business details
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    retry: (failureCount, error: any) => {
      if (error?.message?.includes('not found')) return false;
      return failureCount < 2;
    },
  });
};

/**
 * Hook for search suggestions with debouncing
 */
export const useSearchSuggestions = (query: string, limit: number = 10) => {
  const debouncedQuery = useDebounce(query, 300); // 300ms debounce

  return useQuery({
    queryKey: businessQueryKeys.searchSuggestions(debouncedQuery),
    queryFn: () => businessApi.searchSuggestions(debouncedQuery, limit),
    enabled: debouncedQuery.length >= 2,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching categories
 */
export const useCategories = () => {
  return useQuery({
    queryKey: businessQueryKeys.categories(),
    queryFn: () => businessApi.getCategories(),
    staleTime: 30 * 60 * 1000, // 30 minutes - categories don't change often
    gcTime: 60 * 60 * 1000, // 1 hour cache time
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching featured businesses
 */
export const useFeaturedBusinesses = (limit: number = 6) => {
  return useQuery({
    queryKey: [...businessQueryKeys.featured(), limit],
    queryFn: () => businessApi.getFeaturedBusinesses(limit),
    staleTime: 15 * 60 * 1000, // 15 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for fetching business reviews
 */
export const useBusinessReviews = (businessId: string, limit: number = 10, offset: number = 0) => {
  return useQuery({
    queryKey: [...businessQueryKeys.reviews(businessId), { limit, offset }],
    queryFn: () => businessApi.getBusinessReviews(businessId, limit, offset),
    enabled: !!businessId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for prefetching business details (useful for hovering over cards)
 */
export const usePrefetchBusinessDetails = () => {
  const queryClient = useQueryClient();

  const prefetchBusiness = (slug: string) => {
    queryClient.prefetchQuery({
      queryKey: businessQueryKeys.detail(slug),
      queryFn: () => businessApi.getBusinessBySlug(slug),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });
  };

  return { prefetchBusiness };
};

/**
 * Hook for location-based business search
 */
export const useNearbyBusinesses = (
  location: { lat: number; lng: number } | null,
  params: Omit<BusinessSearchParams, 'location'> = {}
) => {
  return useQuery({
    queryKey: businessQueryKeys.list({ ...params, location: location || undefined }),
    queryFn: () => businessApi.getBusinesses({ ...params, location: location || undefined }),
    enabled: !!location,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

/**
 * Hook for real-time search with optimistic updates
 */
export const useOptimisticSearch = () => {
  const queryClient = useQueryClient();

  const performSearch = useMutation({
    mutationFn: (params: BusinessSearchParams) => businessApi.getBusinesses(params),
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: businessQueryKeys.list(params) });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(businessQueryKeys.list(params));

      // Optimistically update to show loading state
      queryClient.setQueryData(businessQueryKeys.list(params), (old: any) => ({
        ...old,
        data: old?.data || [],
        isLoading: true,
      }));

      return { previousData, params };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(businessQueryKeys.list(context.params), context.previousData);
      }
    },
    onSettled: (data, error, params) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: businessQueryKeys.list(params) });
    },
  });

  return performSearch;
};

/**
 * Combined hook for business data management with common patterns
 */
export const useBusinessData = () => {
  const queryClient = useQueryClient();

  const invalidateBusinesses = () => {
    queryClient.invalidateQueries({ queryKey: businessQueryKeys.lists() });
  };

  const invalidateBusinessDetails = (slug?: string) => {
    if (slug) {
      queryClient.invalidateQueries({ queryKey: businessQueryKeys.detail(slug) });
    } else {
      queryClient.invalidateQueries({ queryKey: businessQueryKeys.details() });
    }
  };

  const clearSearchCache = () => {
    queryClient.removeQueries({ queryKey: businessQueryKeys.search() });
  };

  const getBusinessFromCache = (slug: string): EnhancedBusiness | undefined => {
    const cached = queryClient.getQueryData(businessQueryKeys.detail(slug));
    return cached?.data || undefined;
  };

  return {
    invalidateBusinesses,
    invalidateBusinessDetails,
    clearSearchCache,
    getBusinessFromCache,
  };
};

export default {
  useBusinesses,
  useInfiniteBusinesses,
  useBusinessDetails,
  useSearchSuggestions,
  useCategories,
  useFeaturedBusinesses,
  useBusinessReviews,
  usePrefetchBusinessDetails,
  useNearbyBusinesses,
  useOptimisticSearch,
  useBusinessData,
};