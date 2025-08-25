// Analytics and Performance Tracking Utility
// Comprehensive analytics system for business directory application

interface AnalyticsEvent {
  name: string;
  timestamp: number;
  properties?: Record<string, any>;
  userId?: string;
  sessionId: string;
}

interface UserSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  pageViews: number;
  interactions: number;
  searches: number;
  businessViews: number;
  conversions: number;
  referrer?: string;
  userAgent: string;
  viewport: { width: number; height: number };
  location?: { latitude: number; longitude: number };
}

interface BusinessInteraction {
  businessId: string | number;
  businessName: string;
  action: 'view' | 'call' | 'website' | 'directions' | 'favorite' | 'share';
  timestamp: number;
  sessionId: string;
  position?: number; // Position in search results
  searchQuery?: string;
  category?: string;
}

interface SearchAnalytics {
  query: string;
  timestamp: number;
  sessionId: string;
  resultsCount: number;
  selectedResult?: {
    businessId: string | number;
    position: number;
  };
  filters?: string[];
  sortBy?: string;
  duration?: number; // Time spent viewing results
}

interface PerformanceMetrics {
  pageLoadTime: number;
  timeToInteractive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  sessionId: string;
  timestamp: number;
}

class Analytics {
  private events: AnalyticsEvent[] = [];
  private currentSession: UserSession;
  private businessInteractions: BusinessInteraction[] = [];
  private searchAnalytics: SearchAnalytics[] = [];
  private performanceMetrics: PerformanceMetrics[] = [];
  
  // Configuration
  private config = {
    enableConsoleLogging: false,
    enableRemoteTracking: false,
    remoteEndpoint: '/api/analytics',
    batchSize: 10,
    flushInterval: 30000, // 30 seconds
    enablePerformanceTracking: true,
    enableLocationTracking: false,
    enableErrorTracking: true
  };

  private batchTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<typeof this.config> = {}) {
    this.config = { ...this.config, ...config };
    this.currentSession = this.initializeSession();
    
    this.setupEventListeners();
    this.startBatchTimer();
    
    if (this.config.enablePerformanceTracking) {
      this.trackPerformanceMetrics();
    }
    
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking();
    }
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSession(): UserSession {
    return {
      sessionId: this.generateSessionId(),
      startTime: Date.now(),
      pageViews: 1,
      interactions: 0,
      searches: 0,
      businessViews: 0,
      conversions: 0,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    };
  }

  private setupEventListeners(): void {
    // Page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.endSession();
      } else {
        this.currentSession = this.initializeSession();
      }
    });

    // Before page unload
    window.addEventListener('beforeunload', () => {
      this.endSession();
      this.flush();
    });

    // Window resize
    window.addEventListener('resize', () => {
      this.track('viewport_change', {
        width: window.innerWidth,
        height: window.innerHeight
      });
    });

    // Location tracking (if enabled)
    if (this.config.enableLocationTracking && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.currentSession.location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          };
        },
        (error) => {
          console.warn('Location tracking failed:', error);
        }
      );
    }
  }

  private setupErrorTracking(): void {
    window.addEventListener('error', (event) => {
      this.track('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.track('unhandled_promise_rejection', {
        reason: event.reason?.toString(),
        stack: event.reason?.stack
      });
    });
  }

  private trackPerformanceMetrics(): void {
    // Wait for page load
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          const metrics: PerformanceMetrics = {
            pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
            timeToInteractive: navigation.domInteractive - navigation.fetchStart,
            firstContentfulPaint: 0,
            largestContentfulPaint: 0,
            cumulativeLayoutShift: 0,
            sessionId: this.currentSession.sessionId,
            timestamp: Date.now()
          };

          // Get paint metrics
          if ('getEntriesByType' in performance) {
            const paintEntries = performance.getEntriesByType('paint');
            const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
            if (fcpEntry) {
              metrics.firstContentfulPaint = fcpEntry.startTime;
            }
          }

          // Get LCP using PerformanceObserver
          if ('PerformanceObserver' in window) {
            try {
              const observer = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1];
                if (lastEntry) {
                  metrics.largestContentfulPaint = lastEntry.startTime;
                }
              });
              observer.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (error) {
              console.warn('LCP tracking failed:', error);
            }
          }

          this.performanceMetrics.push(metrics);
          this.track('performance_metrics', metrics);
        }
      }, 1000);
    });
  }

  private startBatchTimer(): void {
    this.batchTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private endSession(): void {
    this.currentSession.endTime = Date.now();
    this.track('session_end', {
      duration: this.currentSession.endTime - this.currentSession.startTime,
      ...this.currentSession
    });
  }

  // Public methods for tracking events

  public track(eventName: string, properties?: Record<string, any>): void {
    const event: AnalyticsEvent = {
      name: eventName,
      timestamp: Date.now(),
      properties,
      sessionId: this.currentSession.sessionId
    };

    this.events.push(event);
    this.currentSession.interactions++;

    if (this.config.enableConsoleLogging) {
      console.log('📊 Analytics Event:', event);
    }

    // Auto-flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  public trackPageView(page: string, title?: string): void {
    this.currentSession.pageViews++;
    this.track('page_view', {
      page,
      title: title || document.title,
      url: window.location.href,
      referrer: document.referrer
    });
  }

  public trackSearch(query: string, resultsCount: number, filters?: string[], sortBy?: string): SearchAnalytics {
    const searchData: SearchAnalytics = {
      query,
      timestamp: Date.now(),
      sessionId: this.currentSession.sessionId,
      resultsCount,
      filters,
      sortBy
    };

    this.searchAnalytics.push(searchData);
    this.currentSession.searches++;
    
    this.track('search', searchData);
    return searchData;
  }

  public trackBusinessInteraction(
    businessId: string | number,
    businessName: string,
    action: BusinessInteraction['action'],
    additionalData?: {
      position?: number;
      searchQuery?: string;
      category?: string;
    }
  ): void {
    const interaction: BusinessInteraction = {
      businessId,
      businessName,
      action,
      timestamp: Date.now(),
      sessionId: this.currentSession.sessionId,
      ...additionalData
    };

    this.businessInteractions.push(interaction);
    
    if (action === 'view') {
      this.currentSession.businessViews++;
    } else if (['call', 'website', 'directions'].includes(action)) {
      this.currentSession.conversions++;
    }

    this.track('business_interaction', interaction);
  }

  public trackUserTiming(name: string, startTime: number, endTime?: number): void {
    const duration = endTime ? endTime - startTime : performance.now() - startTime;
    
    this.track('user_timing', {
      name,
      duration,
      startTime,
      endTime: endTime || performance.now()
    });
  }

  public trackCustomEvent(category: string, action: string, label?: string, value?: number): void {
    this.track('custom_event', {
      category,
      action,
      label,
      value
    });
  }

  public trackError(error: Error, context?: Record<string, any>): void {
    this.track('application_error', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      context
    });
  }

  // Utility methods

  public getSessionMetrics(): UserSession {
    return { ...this.currentSession };
  }

  public getSearchMetrics(): SearchAnalytics[] {
    return [...this.searchAnalytics];
  }

  public getBusinessInteractionMetrics(): BusinessInteraction[] {
    return [...this.businessInteractions];
  }

  public getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  public getPopularSearches(limit: number = 10): { query: string; count: number }[] {
    const queryCount = this.searchAnalytics.reduce((acc, search) => {
      acc[search.query] = (acc[search.query] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(queryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  public getTopBusinesses(limit: number = 10): { businessName: string; interactions: number }[] {
    const businessCount = this.businessInteractions.reduce((acc, interaction) => {
      acc[interaction.businessName] = (acc[interaction.businessName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(businessCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([businessName, interactions]) => ({ businessName, interactions }));
  }

  public getConversionRate(): number {
    const totalBusinessViews = this.currentSession.businessViews;
    const totalConversions = this.currentSession.conversions;
    
    return totalBusinessViews > 0 ? (totalConversions / totalBusinessViews) * 100 : 0;
  }

  // Data persistence and reporting

  public flush(): void {
    if (this.events.length === 0) return;

    const batch = [...this.events];
    this.events = [];

    if (this.config.enableRemoteTracking) {
      this.sendToServer(batch);
    }

    // Store locally for offline capability
    this.storeLocally(batch);
  }

  private async sendToServer(events: AnalyticsEvent[]): Promise<void> {
    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          events,
          session: this.currentSession,
          timestamp: Date.now()
        })
      });

      if (!response.ok) {
        throw new Error(`Analytics request failed: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send analytics:', error);
      // Re-add events to queue for retry
      this.events.unshift(...events);
    }
  }

  private storeLocally(events: AnalyticsEvent[]): void {
    try {
      const stored = localStorage.getItem('analytics_events') || '[]';
      const existingEvents = JSON.parse(stored);
      const updatedEvents = [...existingEvents, ...events];
      
      // Keep only last 1000 events to prevent storage bloat
      const trimmedEvents = updatedEvents.slice(-1000);
      
      localStorage.setItem('analytics_events', JSON.stringify(trimmedEvents));
    } catch (error) {
      console.warn('Failed to store analytics locally:', error);
    }
  }

  public exportData(): {
    events: AnalyticsEvent[];
    session: UserSession;
    searches: SearchAnalytics[];
    businessInteractions: BusinessInteraction[];
    performanceMetrics: PerformanceMetrics[];
  } {
    return {
      events: [...this.events],
      session: { ...this.currentSession },
      searches: [...this.searchAnalytics],
      businessInteractions: [...this.businessInteractions],
      performanceMetrics: [...this.performanceMetrics]
    };
  }

  public clearData(): void {
    this.events = [];
    this.searchAnalytics = [];
    this.businessInteractions = [];
    this.performanceMetrics = [];
    localStorage.removeItem('analytics_events');
  }

  public destroy(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
    }
    this.flush();
    this.clearData();
  }
}

// Singleton instance
let analyticsInstance: Analytics | null = null;

export const initializeAnalytics = (config?: Parameters<typeof Analytics.prototype.constructor>[0]): Analytics => {
  if (!analyticsInstance) {
    analyticsInstance = new Analytics(config);
  }
  return analyticsInstance;
};

export const getAnalytics = (): Analytics => {
  if (!analyticsInstance) {
    throw new Error('Analytics not initialized. Call initializeAnalytics first.');
  }
  return analyticsInstance;
};

// Convenience functions
export const track = (eventName: string, properties?: Record<string, any>): void => {
  getAnalytics().track(eventName, properties);
};

export const trackPageView = (page: string, title?: string): void => {
  getAnalytics().trackPageView(page, title);
};

export const trackSearch = (query: string, resultsCount: number, filters?: string[], sortBy?: string): SearchAnalytics => {
  return getAnalytics().trackSearch(query, resultsCount, filters, sortBy);
};

// Enhanced search-specific analytics functions
export const trackSearchStart = (query: string, filters: Record<string, any> = {}): void => {
  track('search_started', {
    query,
    filters,
    timestamp: Date.now()
  });
};

export const trackSearchComplete = (
  query: string, 
  resultsCount: number, 
  responseTime: number, 
  filters: Record<string, any> = {}
): void => {
  track('search_completed', {
    query,
    resultsCount,
    responseTime,
    filters,
    timestamp: Date.now()
  });
  
  // Also use the existing trackSearch method
  trackSearch(query, resultsCount, Object.keys(filters));
};

export const trackSearchSuggestionClick = (suggestion: string, position: number, originalQuery: string): void => {
  track('search_suggestion_clicked', {
    suggestion,
    position,
    originalQuery,
    timestamp: Date.now()
  });
};

export const trackSearchFilter = (filterType: string, filterValue: any, activeFilters: Record<string, any>): void => {
  track('search_filter_applied', {
    filterType,
    filterValue,
    activeFilters,
    totalActiveFilters: Object.keys(activeFilters).length,
    timestamp: Date.now()
  });
};

export const trackSearchLocation = (location: { lat: number; lng: number }, searchQuery?: string): void => {
  track('search_location_used', {
    location,
    searchQuery,
    timestamp: Date.now()
  });
};

export const trackSearchError = (query: string, error: string, filters: Record<string, any> = {}): void => {
  track('search_error', {
    query,
    error,
    filters,
    timestamp: Date.now()
  });
};

export const trackSearchPerformance = (
  responseTime: number, 
  cacheHit: boolean, 
  resultCount: number, 
  searchMethod: string
): void => {
  track('search_performance', {
    responseTime,
    cacheHit,
    resultCount,
    searchMethod,
    timestamp: Date.now()
  });
};

export const trackBusinessInteraction = (
  businessId: string | number,
  businessName: string,
  action: BusinessInteraction['action'],
  additionalData?: Parameters<Analytics['trackBusinessInteraction']>[3]
): void => {
  getAnalytics().trackBusinessInteraction(businessId, businessName, action, additionalData);
};

export default Analytics;