'use client';

import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { initializeAnalytics, Analytics } from '../../utils/analytics';
import { initializeAlertSystem, AlertSystem } from '../monitoring/alertSystem';

interface AnalyticsContextType {
  analytics: Analytics | null;
  alertSystem: AlertSystem | null;
}

const AnalyticsContext = createContext<AnalyticsContextType>({ analytics: null, alertSystem: null });

export const useAnalytics = () => {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalytics must be used within an AnalyticsProvider');
  }
  return context;
};

interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  const [analytics, setAnalytics] = React.useState<Analytics | null>(null);
  const [alertSystem, setAlertSystem] = React.useState<AlertSystem | null>(null);

  useEffect(() => {
    // Only initialize analytics in the browser environment
    if (typeof window !== 'undefined') {
      const analyticsConfig = {
        enableConsoleLogging: process.env.NODE_ENV === 'development',
        enableRemoteTracking: true,
        remoteEndpoint: '/api/analytics',
        batchSize: 10,
        flushInterval: 30000,
        enablePerformanceTracking: process.env.NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING === 'true',
        enableLocationTracking: false,
        enableErrorTracking: process.env.NEXT_PUBLIC_ENABLE_ERROR_TRACKING === 'true',
        enableCoreWebVitals: process.env.NEXT_PUBLIC_ENABLE_CORE_WEB_VITALS === 'true',
        enableGoogleAnalytics: !!(process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && 
                                   process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID !== 'G-XXXXXXXXXX'),
        googleAnalyticsConfig: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID && 
                              process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID !== 'G-XXXXXXXXXX' ? {
          measurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
          apiSecret: process.env.GA4_API_SECRET !== 'your-ga4-api-secret-here' ? process.env.GA4_API_SECRET : undefined,
          debugMode: process.env.NODE_ENV === 'development',
          sendPageView: true
        } : null
      };

      const analyticsInstance = initializeAnalytics(analyticsConfig);
      setAnalytics(analyticsInstance);

      // Initialize alert system
      const alertSystemInstance = initializeAlertSystem({
        enableAlerts: true,
        enableConsoleLogging: process.env.NODE_ENV === 'development',
        alertsEndpoint: '/api/alerts',
        checkIntervalMs: 30000 // Check every 30 seconds
      });
      setAlertSystem(alertSystemInstance);

      // Track initial page load
      analyticsInstance.trackPageView(window.location.pathname, document.title);

      // Track page visibility changes for engagement metrics
      const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          analyticsInstance.track('page_became_visible', {
            timestamp: Date.now(),
            url: window.location.href
          });
        } else {
          analyticsInstance.track('page_became_hidden', {
            timestamp: Date.now(),
            url: window.location.href
          });
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      // Clean up on unmount
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        analyticsInstance.destroy();
        alertSystemInstance.destroy();
      };
    }
  }, []);

  return (
    <AnalyticsContext.Provider value={{ analytics, alertSystem }}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// Hook for tracking page views in Next.js router events
export function usePageTracking() {
  const { analytics } = useAnalytics();

  useEffect(() => {
    if (!analytics || typeof window === 'undefined') return;

    const handleRouteChange = (url: string) => {
      analytics.trackPageView(url, document.title);
    };

    // Track route changes
    window.addEventListener('popstate', () => {
      handleRouteChange(window.location.pathname);
    });

    // Track initial page load if not already tracked
    handleRouteChange(window.location.pathname);
  }, [analytics]);
}

// Hook for tracking performance metrics
export function usePerformanceTracking() {
  const { analytics } = useAnalytics();

  useEffect(() => {
    if (!analytics || typeof window === 'undefined') return;

    // Track custom performance metrics
    const trackCustomTiming = (name: string, startTime: number) => {
      const endTime = performance.now();
      analytics.trackUserTiming(name, startTime, endTime);
    };

    // Expose global function for manual performance tracking
    (window as any).__trackTiming = trackCustomTiming;

    // Track long tasks that might impact performance
    if ('PerformanceObserver' in window) {
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              analytics.track('long_task', {
                duration: entry.duration,
                startTime: entry.startTime,
                name: entry.name,
                timestamp: Date.now()
              });
            }
          });
        });
        longTaskObserver.observe({ entryTypes: ['longtask'] });

        return () => {
          longTaskObserver.disconnect();
        };
      } catch (error) {
        console.warn('Long task observer not supported:', error);
      }
    }
  }, [analytics]);
}