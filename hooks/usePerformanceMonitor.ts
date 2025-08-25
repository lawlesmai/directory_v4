import { useEffect, useRef, useCallback, useState } from 'react';

interface PerformanceMetrics {
  // Page load metrics
  loadTime: number;
  domReady: number;
  firstPaint: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  
  // Runtime metrics  
  frameRate: number;
  memoryUsage: number;
  
  // User interaction metrics
  interactionCount: number;
  averageResponseTime: number;
  
  // Network metrics
  networkEffectiveType?: string;
  connectionDownlink?: number;
}

interface PerformanceEntry {
  timestamp: number;
  metric: string;
  value: number;
  details?: Record<string, any>;
}

interface UsePerformanceMonitorOptions {
  enableRealTimeMonitoring?: boolean;
  reportingInterval?: number;
  maxHistorySize?: number;
  enableMemoryMonitoring?: boolean;
  enableNetworkMonitoring?: boolean;
  onMetricUpdate?: (metric: string, value: number) => void;
  onThresholdExceeded?: (metric: string, value: number, threshold: number) => void;
}

const DEFAULT_THRESHOLDS = {
  loadTime: 3000, // 3 seconds
  firstContentfulPaint: 1800, // 1.8 seconds
  largestContentfulPaint: 2500, // 2.5 seconds
  frameRate: 55, // Below 55 FPS
  memoryUsage: 50 * 1024 * 1024, // 50MB
  averageResponseTime: 100 // 100ms
};

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions = {}) => {
  const {
    enableRealTimeMonitoring = true,
    reportingInterval = 5000, // 5 seconds
    maxHistorySize = 100,
    enableMemoryMonitoring = true,
    enableNetworkMonitoring = true,
    onMetricUpdate,
    onThresholdExceeded
  } = options;

  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    domReady: 0,
    firstPaint: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    frameRate: 60,
    memoryUsage: 0,
    interactionCount: 0,
    averageResponseTime: 0
  });

  const historyRef = useRef<PerformanceEntry[]>([]);
  const interactionTimesRef = useRef<number[]>([]);
  const frameTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef(0);
  const observerRef = useRef<PerformanceObserver | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add performance entry to history
  const addToHistory = useCallback((metric: string, value: number, details?: Record<string, any>) => {
    const entry: PerformanceEntry = {
      timestamp: Date.now(),
      metric,
      value,
      details
    };
    
    historyRef.current.push(entry);
    
    // Keep history within bounds
    if (historyRef.current.length > maxHistorySize) {
      historyRef.current.shift();
    }
    
    // Call callbacks
    onMetricUpdate?.(metric, value);
    
    // Check thresholds
    const threshold = DEFAULT_THRESHOLDS[metric as keyof typeof DEFAULT_THRESHOLDS];
    if (threshold && (
      (metric.includes('Time') || metric.includes('Paint')) ? value > threshold :
      metric === 'frameRate' ? value < threshold :
      value > threshold
    )) {
      onThresholdExceeded?.(metric, value, threshold);
    }
  }, [maxHistorySize, onMetricUpdate, onThresholdExceeded]);

  // Collect page load metrics
  const collectLoadMetrics = useCallback(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    if (navigation) {
      const loadTime = navigation.loadEventEnd - navigation.fetchStart;
      const domReady = navigation.domContentLoadedEventEnd - navigation.fetchStart;
      
      setMetrics(prev => ({
        ...prev,
        loadTime,
        domReady
      }));
      
      addToHistory('loadTime', loadTime);
      addToHistory('domReady', domReady);
    }
  }, [addToHistory]);

  // Collect paint metrics using PerformanceObserver
  const setupPaintMetrics = useCallback(() => {
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            const value = entry.startTime;
            
            switch (entry.name) {
              case 'first-paint':
                setMetrics(prev => ({ ...prev, firstPaint: value }));
                addToHistory('firstPaint', value);
                break;
              case 'first-contentful-paint':
                setMetrics(prev => ({ ...prev, firstContentfulPaint: value }));
                addToHistory('firstContentfulPaint', value);
                break;
            }
          });
        });
        
        observer.observe({ entryTypes: ['paint'] });
        observerRef.current = observer;
        
        // Also observe LCP
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          
          if (lastEntry) {
            const lcp = lastEntry.startTime;
            setMetrics(prev => ({ ...prev, largestContentfulPaint: lcp }));
            addToHistory('largestContentfulPaint', lcp);
          }
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        
      } catch (error) {
        console.warn('PerformanceObserver not fully supported:', error);
      }
    }
  }, [addToHistory]);

  // Monitor frame rate
  const monitorFrameRate = useCallback((timestamp: number) => {
    if (lastFrameTimeRef.current > 0) {
      const frameTime = timestamp - lastFrameTimeRef.current;
      frameTimesRef.current.push(frameTime);
      
      // Keep last 60 frames
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }
      
      if (frameTimesRef.current.length >= 10) {
        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const fps = Math.round(1000 / avgFrameTime);
        
        setMetrics(prev => ({ ...prev, frameRate: fps }));
        addToHistory('frameRate', fps);
      }
    }
    
    lastFrameTimeRef.current = timestamp;
    
    if (enableRealTimeMonitoring) {
      requestAnimationFrame(monitorFrameRate);
    }
  }, [enableRealTimeMonitoring, addToHistory]);

  // Get memory usage
  const getMemoryUsage = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    return null;
  }, []);

  // Get network information
  const getNetworkInfo = useCallback(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData
      };
    }
    return null;
  }, []);

  // Track user interactions
  const trackInteraction = useCallback((startTime: number) => {
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    interactionTimesRef.current.push(responseTime);
    
    // Keep last 50 interactions
    if (interactionTimesRef.current.length > 50) {
      interactionTimesRef.current.shift();
    }
    
    const avgResponseTime = interactionTimesRef.current.reduce((a, b) => a + b, 0) / interactionTimesRef.current.length;
    
    setMetrics(prev => ({
      ...prev,
      interactionCount: prev.interactionCount + 1,
      averageResponseTime: Math.round(avgResponseTime)
    }));
    
    addToHistory('interactionResponseTime', responseTime);
    addToHistory('averageResponseTime', avgResponseTime);
  }, [addToHistory]);

  // Real-time monitoring interval
  useEffect(() => {
    if (!enableRealTimeMonitoring) return;
    
    intervalRef.current = setInterval(() => {
      // Update memory usage
      if (enableMemoryMonitoring) {
        const memory = getMemoryUsage();
        if (memory) {
          setMetrics(prev => ({ ...prev, memoryUsage: memory.used }));
          addToHistory('memoryUsage', memory.used, memory);
        }
      }
      
      // Update network info
      if (enableNetworkMonitoring) {
        const network = getNetworkInfo();
        if (network) {
          setMetrics(prev => ({
            ...prev,
            networkEffectiveType: network.effectiveType,
            connectionDownlink: network.downlink
          }));
          addToHistory('networkDownlink', network.downlink || 0, network);
        }
      }
    }, reportingInterval);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enableRealTimeMonitoring, enableMemoryMonitoring, enableNetworkMonitoring, reportingInterval, getMemoryUsage, getNetworkInfo, addToHistory]);

  // Initialize monitoring
  useEffect(() => {
    // Wait for page load to collect initial metrics
    if (document.readyState === 'loading') {
      window.addEventListener('load', collectLoadMetrics);
      document.addEventListener('DOMContentLoaded', collectLoadMetrics);
    } else {
      collectLoadMetrics();
    }
    
    // Setup paint metrics monitoring
    setupPaintMetrics();
    
    // Start frame rate monitoring
    if (enableRealTimeMonitoring) {
      requestAnimationFrame(monitorFrameRate);
    }
    
    return () => {
      window.removeEventListener('load', collectLoadMetrics);
      document.removeEventListener('DOMContentLoaded', collectLoadMetrics);
      
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [collectLoadMetrics, setupPaintMetrics, enableRealTimeMonitoring, monitorFrameRate]);

  // Get performance report
  const getReport = useCallback(() => {
    return {
      metrics: { ...metrics },
      history: [...historyRef.current],
      summary: {
        totalInteractions: metrics.interactionCount,
        averageFrameRate: frameTimesRef.current.length > 0 
          ? Math.round(frameTimesRef.current.reduce((a, b) => 1000/a + 1000/b, 0) / frameTimesRef.current.length)
          : 60,
        performanceScore: calculatePerformanceScore()
      }
    };
  }, [metrics]);

  // Calculate overall performance score (0-100)
  const calculatePerformanceScore = useCallback(() => {
    let score = 100;
    
    // Deduct points based on thresholds
    if (metrics.loadTime > DEFAULT_THRESHOLDS.loadTime) score -= 20;
    if (metrics.firstContentfulPaint > DEFAULT_THRESHOLDS.firstContentfulPaint) score -= 15;
    if (metrics.largestContentfulPaint > DEFAULT_THRESHOLDS.largestContentfulPaint) score -= 15;
    if (metrics.frameRate < DEFAULT_THRESHOLDS.frameRate) score -= 20;
    if (metrics.averageResponseTime > DEFAULT_THRESHOLDS.averageResponseTime) score -= 10;
    if (metrics.memoryUsage > DEFAULT_THRESHOLDS.memoryUsage) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }, [metrics]);

  // Clear history
  const clearHistory = useCallback(() => {
    historyRef.current = [];
    interactionTimesRef.current = [];
    frameTimesRef.current = [];
  }, []);

  return {
    metrics,
    trackInteraction,
    getReport,
    clearHistory,
    getMemoryUsage,
    getNetworkInfo,
    performanceScore: calculatePerformanceScore(),
    isMonitoring: enableRealTimeMonitoring
  };
};

export default usePerformanceMonitor;