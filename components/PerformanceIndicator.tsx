'use client';

import React, { useState, useEffect } from 'react';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

interface PerformanceIndicatorProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  showDetails?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  minimized?: boolean;
  thresholds?: {
    good: number;
    poor: number;
  };
}

const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  position = 'bottom-right',
  showDetails = false,
  autoHide = true,
  autoHideDelay = 5000,
  minimized = false,
  thresholds = { good: 80, poor: 50 }
}) => {
  const { metrics, getReport, performanceScore, isMonitoring } = usePerformanceMonitor({
    enableRealTimeMonitoring: true,
    reportingInterval: 2000,
    enableMemoryMonitoring: true,
    enableNetworkMonitoring: true
  });

  const [isVisible, setIsVisible] = useState(!autoHide);
  const [isMinimized, setIsMinimized] = useState(minimized);
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    if (autoHide && autoHideDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);

      return () => clearTimeout(timer);
    }
  }, [autoHide, autoHideDelay]);

  const getPerformanceColor = (score: number): string => {
    if (score >= thresholds.good) return 'text-green-500';
    if (score >= thresholds.poor) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getPerformanceBackground = (score: number): string => {
    if (score >= thresholds.good) return 'bg-green-500/10 border-green-500/20';
    if (score >= thresholds.poor) return 'bg-yellow-500/10 border-yellow-500/20';
    return 'bg-red-500/10 border-red-500/20';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatTime = (time: number): string => {
    return `${Math.round(time)}ms`;
  };

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  if (!isMonitoring) {
    return null;
  }

  return (
    <>
      {/* Toggle Button (when hidden or minimized) */}
      {(!isVisible || isMinimized) && (
        <button
          onClick={() => {
            setIsVisible(true);
            setIsMinimized(false);
          }}
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          className={`
            fixed z-50 p-2 rounded-full backdrop-blur-sm border transition-all duration-300
            hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500/50
            ${positionClasses[position]}
            ${getPerformanceBackground(performanceScore)}
          `}
          aria-label="Show performance indicator"
        >
          <div className="w-3 h-3 relative">
            <div 
              className={`absolute inset-0 rounded-full animate-pulse ${getPerformanceColor(performanceScore).replace('text-', 'bg-')}`}
            />
            <div 
              className={`absolute inset-0.5 rounded-full ${getPerformanceColor(performanceScore).replace('text-', 'bg-')}`}
            />
          </div>
          
          {/* Tooltip */}
          {showTooltip && (
            <div className="absolute z-10 px-2 py-1 text-xs bg-black/80 text-white rounded whitespace-nowrap pointer-events-none -top-8 left-1/2 transform -translate-x-1/2">
              Performance: {performanceScore}%
            </div>
          )}
        </button>
      )}

      {/* Full Performance Indicator */}
      {isVisible && !isMinimized && (
        <div className={`
          fixed z-50 backdrop-blur-md bg-white/90 dark:bg-gray-900/90 border border-gray-200/50 
          dark:border-gray-700/50 rounded-lg shadow-lg min-w-64 max-w-80
          ${positionClasses[position]}
        `}>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-gray-200/50 dark:border-gray-700/50">
            <div className="flex items-center gap-2">
              <div 
                className={`w-2 h-2 rounded-full animate-pulse ${getPerformanceColor(performanceScore).replace('text-', 'bg-')}`}
              />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Performance
              </h3>
              <span className={`text-sm font-bold ${getPerformanceColor(performanceScore)}`}>
                {performanceScore}%
              </span>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                aria-label="Minimize"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 rounded text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                aria-label="Close"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Metrics */}
          <div className="p-3 space-y-3">
            {/* Performance Score Circle */}
            <div className="flex items-center justify-center">
              <div className="relative w-16 h-16">
                <svg className="transform -rotate-90 w-16 h-16" viewBox="0 0 24 24">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-gray-200 dark:text-gray-700"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${(performanceScore / 100) * 62.8} 62.8`}
                    className={getPerformanceColor(performanceScore).replace('text-', 'stroke-')}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-xs font-bold ${getPerformanceColor(performanceScore)}`}>
                    {performanceScore}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">FPS:</span>
                  <span className={`font-mono ${metrics.frameRate < 30 ? 'text-red-500' : metrics.frameRate < 50 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {metrics.frameRate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Load:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {formatTime(metrics.loadTime)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">FCP:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {formatTime(metrics.firstContentfulPaint)}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Memory:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {formatBytes(metrics.memoryUsage)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">DOM:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {formatTime(metrics.domReady)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">LCP:</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">
                    {formatTime(metrics.largestContentfulPaint)}
                  </span>
                </div>
              </div>
            </div>

            {/* Network Info */}
            {metrics.networkEffectiveType && (
              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Network:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-gray-900 dark:text-gray-100">
                      {metrics.networkEffectiveType}
                    </span>
                    {metrics.connectionDownlink && (
                      <span className="text-gray-500">
                        {metrics.connectionDownlink.toFixed(1)}Mbps
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Metrics (expandable) */}
            {showDetails && (
              <div className="pt-2 border-t border-gray-200/50 dark:border-gray-700/50">
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200">
                    Detailed Metrics
                  </summary>
                  <div className="mt-2 space-y-1 pl-2">
                    <div className="flex justify-between">
                      <span>Interactions:</span>
                      <span className="font-mono">{metrics.interactionCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Avg Response:</span>
                      <span className="font-mono">{formatTime(metrics.averageResponseTime)}</span>
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-1 p-2 border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={() => {
                const report = getReport();
                console.log('Performance Report:', report);
              }}
              className="flex-1 px-2 py-1 text-xs bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded transition-colors"
            >
              Report
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-2 py-1 text-xs bg-gray-500/10 hover:bg-gray-500/20 text-gray-600 dark:text-gray-400 rounded transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default PerformanceIndicator;