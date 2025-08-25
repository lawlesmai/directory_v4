'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default stale time: 5 minutes
            staleTime: 5 * 60 * 1000,
            // Default cache time: 10 minutes
            gcTime: 10 * 60 * 1000,
            // Disable refetching on window focus by default
            refetchOnWindowFocus: false,
            // Retry failed queries once
            retry: (failureCount, error) => {
              // Don't retry on 404s or permission errors
              if (error?.message?.includes('not found') || 
                  error?.message?.includes('permission')) {
                return false;
              }
              return failureCount < 1;
            },
            // Network mode - only try online requests
            networkMode: 'online',
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
            // Network mode for mutations
            networkMode: 'online',
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}