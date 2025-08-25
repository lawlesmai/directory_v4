'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { getAnalytics } from '../utils/analytics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'critical';
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Track error with analytics
    try {
      const analytics = getAnalytics();
      analytics.trackError(error, {
        errorInfo,
        level: this.props.level || 'component',
        context: this.props.context,
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        retryCount: this.retryCount,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      });
    } catch (analyticsError) {
      console.warn('Failed to track error with analytics:', analyticsError);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Error Boundary Caught Error');
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.error('Component Stack:', errorInfo.componentStack);
      console.groupEnd();
    }

    // Send to external error tracking service
    this.sendToErrorTracking(error, errorInfo);
  }

  private sendToErrorTracking = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Send to external error tracking service (e.g., Sentry, LogRocket, etc.)
      const errorData = {
        message: error.message,
        stack: error.stack,
        name: error.name,
        componentStack: errorInfo.componentStack,
        level: this.props.level || 'component',
        context: this.props.context,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        retryCount: this.retryCount
      };

      // For now, send to our internal API endpoint
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorData)
      });
    } catch (trackingError) {
      console.warn('Failed to send error to tracking service:', trackingError);
    }
  };

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: null, errorInfo: null });
      
      // Track retry attempt
      try {
        const analytics = getAnalytics();
        analytics.track('error_boundary_retry', {
          retryCount: this.retryCount,
          maxRetries: this.maxRetries,
          level: this.props.level,
          context: this.props.context
        });
      } catch (error) {
        console.warn('Failed to track retry attempt:', error);
      }
    }
  };

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI based on error level
      const { level = 'component' } = this.props;
      
      if (level === 'critical') {
        return (
          <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-red-500 text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h1>
              <p className="text-gray-600 mb-6">
                We're experiencing technical difficulties. Please try again.
              </p>
              <div className="space-y-3">
                {this.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  className="w-full bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Reload Page
                </button>
              </div>
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details (Development)
                  </summary>
                  <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto max-h-32">
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
          </div>
        );
      }

      if (level === 'page') {
        return (
          <div className="min-h-[400px] flex items-center justify-center">
            <div className="text-center p-6">
              <div className="text-yellow-500 text-4xl mb-3">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                This page encountered an error
              </h2>
              <p className="text-gray-600 mb-4">
                We're working to fix this issue.
              </p>
              <div className="space-x-3">
                {this.retryCount < this.maxRetries && (
                  <button
                    onClick={this.handleRetry}
                    className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={this.handleReload}
                  className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Reload
                </button>
              </div>
            </div>
          </div>
        );
      }

      // Component level error
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex">
            <div className="text-red-500 text-lg mr-2">⚠️</div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800 mb-1">
                Component Error
              </h3>
              <p className="text-sm text-red-700 mb-2">
                This component failed to render properly.
              </p>
              {this.retryCount < this.maxRetries && (
                <button
                  onClick={this.handleRetry}
                  className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 transition-colors"
                >
                  Retry ({this.maxRetries - this.retryCount} left)
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

// Specialized error boundaries for different use cases

export function PageErrorBoundary({ children, pageName }: { children: ReactNode; pageName?: string }) {
  return (
    <ErrorBoundary
      level="page"
      context={pageName}
      onError={(error, errorInfo) => {
        console.error(`Page error in ${pageName || 'unknown page'}:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function ComponentErrorBoundary({ 
  children, 
  componentName, 
  fallback 
}: { 
  children: ReactNode; 
  componentName?: string;
  fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary
      level="component"
      context={componentName}
      fallback={fallback}
      onError={(error, errorInfo) => {
        console.error(`Component error in ${componentName || 'unknown component'}:`, error, errorInfo);
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

export function CriticalErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      level="critical"
      context="application"
      onError={(error, errorInfo) => {
        console.error('Critical application error:', error, errorInfo);
        // Could trigger additional alerting here
      }}
    >
      {children}
    </ErrorBoundary>
  );
}

// Hook for programmatic error reporting
export function useErrorReporting() {
  const reportError = (error: Error, context?: Record<string, any>) => {
    try {
      const analytics = getAnalytics();
      analytics.trackError(error, {
        ...context,
        reportedProgrammatically: true,
        timestamp: Date.now()
      });
    } catch (analyticsError) {
      console.warn('Failed to report error with analytics:', analyticsError);
    }

    // Also send to error tracking service
    fetch('/api/errors', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        name: error.name,
        context,
        programmaticReport: true,
        timestamp: Date.now(),
        url: typeof window !== 'undefined' ? window.location.href : 'unknown'
      })
    }).catch(trackingError => {
      console.warn('Failed to send programmatic error report:', trackingError);
    });
  };

  return { reportError };
}