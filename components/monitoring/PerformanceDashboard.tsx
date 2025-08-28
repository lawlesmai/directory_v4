'use client';

import React, { useState, useEffect } from 'react';
import { useAnalytics } from '../../lib/providers/AnalyticsProvider';

interface PerformanceMetrics {
  coreWebVitals: {
    lcp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fid: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    cls: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    fcp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    ttfb: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
    inp: { value: number; rating: 'good' | 'needs-improvement' | 'poor' };
  };
  performance: {
    pageLoadTime: number;
    timeToInteractive: number;
    performanceScore: number;
  };
  errors: {
    totalErrors: number;
    errorRate: number;
    criticalErrors: number;
  };
  session: {
    sessionId: string;
    pageViews: number;
    interactions: number;
    duration: number;
  };
}

interface DashboardProps {
  showRealTimeMetrics?: boolean;
  refreshInterval?: number;
}

export default function PerformanceDashboard({ 
  showRealTimeMetrics = true, 
  refreshInterval = 30000 
}: DashboardProps) {
  const { analytics } = useAnalytics();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const updateMetrics = () => {
    if (!analytics) return;

    try {
      const coreWebVitals = analytics.getCoreWebVitals();
      const performanceMetrics = analytics.getPerformanceMetrics();
      const sessionMetrics = analytics.getSessionMetrics();

      // Process Core Web Vitals
      const latestVitals = coreWebVitals.reduce((acc: Record<string, any>, vital: any) => {
        if (!acc[vital.name.toLowerCase()] || vital.timestamp > acc[vital.name.toLowerCase()].timestamp) {
          acc[vital.name.toLowerCase()] = vital;
        }
        return acc;
      }, {} as Record<string, any>);

      // Calculate performance score
      const performanceScore = analytics.getPerformanceScore();

      // Get latest performance metrics
      const latestPerf = performanceMetrics[performanceMetrics.length - 1];

      const dashboardMetrics: PerformanceMetrics = {
        coreWebVitals: {
          lcp: latestVitals.lcp ? { value: latestVitals.lcp.value, rating: latestVitals.lcp.rating } : { value: 0, rating: 'poor' },
          fid: latestVitals.fid ? { value: latestVitals.fid.value, rating: latestVitals.fid.rating } : { value: 0, rating: 'good' },
          cls: latestVitals.cls ? { value: latestVitals.cls.value, rating: latestVitals.cls.rating } : { value: 0, rating: 'good' },
          fcp: latestVitals.fcp ? { value: latestVitals.fcp.value, rating: latestVitals.fcp.rating } : { value: 0, rating: 'poor' },
          ttfb: latestVitals.ttfb ? { value: latestVitals.ttfb.value, rating: latestVitals.ttfb.rating } : { value: 0, rating: 'poor' },
          inp: latestVitals.inp ? { value: latestVitals.inp.value, rating: latestVitals.inp.rating } : { value: 0, rating: 'good' }
        },
        performance: {
          pageLoadTime: latestPerf?.pageLoadTime || 0,
          timeToInteractive: latestPerf?.timeToInteractive || 0,
          performanceScore
        },
        errors: {
          totalErrors: 0, // Would come from error tracking
          errorRate: 0,
          criticalErrors: 0
        },
        session: {
          sessionId: sessionMetrics.sessionId,
          pageViews: sessionMetrics.pageViews,
          interactions: sessionMetrics.interactions,
          duration: Date.now() - sessionMetrics.startTime
        }
      };

      setMetrics(dashboardMetrics);
      setLastUpdated(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to update dashboard metrics:', error);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (analytics && showRealTimeMetrics) {
      updateMetrics();
      const interval = setInterval(updateMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [analytics, showRealTimeMetrics, refreshInterval]);

  const getRatingColor = (rating: 'good' | 'needs-improvement' | 'poor') => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50';
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatMetricValue = (name: string, value: number) => {
    switch (name.toLowerCase()) {
      case 'lcp':
      case 'fcp':
      case 'ttfb':
        return `${(value / 1000).toFixed(2)}s`;
      case 'fid':
      case 'inp':
        return `${Math.round(value)}ms`;
      case 'cls':
        return value.toFixed(3);
      default:
        return value.toString();
    }
  };

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6 text-center">
        <p className="text-gray-500">No performance metrics available</p>
        <button
          onClick={updateMetrics}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Refresh Metrics
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            Performance Dashboard
          </h2>
          <div className="flex items-center space-x-4">
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={updateMetrics}
              className="text-sm px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Core Web Vitals */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Core Web Vitals</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(metrics.coreWebVitals).map(([name, data]) => (
              <div
                key={name}
                className={`p-4 rounded-lg border ${getRatingColor(data.rating)}`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium uppercase">{name}</p>
                    <p className="text-2xl font-bold">
                      {formatMetricValue(name, data.value)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded ${getRatingColor(data.rating)}`}>
                    {data.rating === 'needs-improvement' ? 'Needs Work' : data.rating}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Performance</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm font-medium text-blue-800">Page Load Time</p>
              <p className="text-2xl font-bold text-blue-900">
                {(metrics.performance.pageLoadTime / 1000).toFixed(2)}s
              </p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm font-medium text-purple-800">Time to Interactive</p>
              <p className="text-2xl font-bold text-purple-900">
                {(metrics.performance.timeToInteractive / 1000).toFixed(2)}s
              </p>
            </div>
            <div className="p-4 bg-indigo-50 rounded-lg">
              <p className="text-sm font-medium text-indigo-800">Performance Score</p>
              <p className="text-2xl font-bold text-indigo-900">
                {metrics.performance.performanceScore}/100
              </p>
            </div>
          </div>
        </div>

        {/* Session Information */}
        <div className="mb-8">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Current Session</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-600">Session ID</p>
              <p className="text-sm font-mono text-gray-900 truncate">
                {metrics.session.sessionId}
              </p>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800">Page Views</p>
              <p className="text-2xl font-bold text-green-900">
                {metrics.session.pageViews}
              </p>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <p className="text-sm font-medium text-orange-800">Interactions</p>
              <p className="text-2xl font-bold text-orange-900">
                {metrics.session.interactions}
              </p>
            </div>
            <div className="p-4 bg-teal-50 rounded-lg">
              <p className="text-sm font-medium text-teal-800">Duration</p>
              <p className="text-xl font-bold text-teal-900">
                {formatDuration(metrics.session.duration)}
              </p>
            </div>
          </div>
        </div>

        {/* Performance Thresholds */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-md font-semibold text-gray-900 mb-4">Performance Thresholds</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Core Web Vitals Targets</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• LCP: &lt; 2.5s (Good), &lt; 4.0s (Needs Improvement)</li>
                <li>• FID: &lt; 100ms (Good), &lt; 300ms (Needs Improvement)</li>
                <li>• CLS: &lt; 0.1 (Good), &lt; 0.25 (Needs Improvement)</li>
                <li>• FCP: &lt; 1.8s (Good), &lt; 3.0s (Needs Improvement)</li>
                <li>• TTFB: &lt; 800ms (Good), &lt; 1800ms (Needs Improvement)</li>
                <li>• INP: &lt; 200ms (Good), &lt; 500ms (Needs Improvement)</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Performance Targets</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Page Load Time: &lt; 2.0s</li>
                <li>• Time to Interactive: &lt; 3.0s</li>
                <li>• Performance Score: &gt; 90</li>
                <li>• Error Rate: &lt; 1%</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}