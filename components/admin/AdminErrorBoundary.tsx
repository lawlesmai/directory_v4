'use client';

import React, { Component, ErrorInfo } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  RefreshCw,
  Shield,
  Bug,
  FileText,
  Home,
  ArrowLeft
} from 'lucide-react';
import { GlassMorphism } from '@/components/GlassMorphism';

interface AdminErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  showDetails?: boolean;
  className?: string;
}

interface AdminErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorLog {
  id: string;
  error: Error;
  errorInfo: ErrorInfo;
  timestamp: Date;
  userAgent: string;
  url: string;
  userId?: string;
}

class AdminErrorBoundary extends Component<AdminErrorBoundaryProps, AdminErrorBoundaryState> {
  private errorLogs: ErrorLog[] = [];

  constructor(props: AdminErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<AdminErrorBoundaryState> {
    const errorId = `admin-error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      hasError: true,
      error,
      errorId
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error for admin monitoring
    const errorLog: ErrorLog = {
      id: this.state.errorId,
      error,
      errorInfo,
      timestamp: new Date(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: 'admin-user' // In production, get from auth context
    };

    this.errorLogs.push(errorLog);
    
    // Store in sessionStorage for debugging
    try {
      const existingLogs = JSON.parse(sessionStorage.getItem('admin-error-logs') || '[]');
      existingLogs.push({
        ...errorLog,
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack
        },
        errorInfo: {
          componentStack: errorInfo.componentStack
        }
      });
      sessionStorage.setItem('admin-error-logs', JSON.stringify(existingLogs.slice(-10))); // Keep last 10 errors
    } catch (storageError) {
      console.error('Failed to store error log:', storageError);
    }

    // Report to monitoring service in production
    this.reportError(errorLog);
    
    // Call custom error handler
    this.props.onError?.(error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });
  }

  private reportError = async (errorLog: ErrorLog) => {
    // In production, send to error tracking service (Sentry, LogRocket, etc.)
    try {
      // Mock API call for demo
      console.group('🚨 Admin Portal Error Report');
      console.error('Error ID:', errorLog.id);
      console.error('Error:', errorLog.error);
      console.error('Component Stack:', errorLog.errorInfo.componentStack);
      console.error('User Agent:', errorLog.userAgent);
      console.error('URL:', errorLog.url);
      console.error('Timestamp:', errorLog.timestamp.toISOString());
      console.groupEnd();
      
      // In production:
      // await fetch('/api/admin/errors', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(errorLog)
      // });
    } catch (reportingError) {
      console.error('Failed to report error:', reportingError);
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/admin';
  };

  private handleGoBack = () => {
    window.history.back();
  };

  private downloadErrorReport = () => {
    const errorReport = {
      errorId: this.state.errorId,
      timestamp: new Date().toISOString(),
      error: {
        name: this.state.error?.name,
        message: this.state.error?.message,
        stack: this.state.error?.stack
      },
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      logs: this.errorLogs.slice(-5) // Last 5 errors
    };

    const blob = new Blob([JSON.stringify(errorReport, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `admin-error-report-${this.state.errorId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, errorInfo, errorId } = this.state;
      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-navy-dark flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-2xl"
          >
            <GlassMorphism variant="medium" className="p-8">
              <div className="space-y-6">
                {/* Header */}
                <div className="text-center space-y-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                    className="inline-flex p-4 bg-red-500/10 rounded-full border border-red-500/20"
                  >
                    <AlertTriangle className="w-12 h-12 text-red-400" />
                  </motion.div>
                  
                  <div>
                    <h1 className="text-3xl font-bold text-cream mb-2">
                      Admin Portal Error
                    </h1>
                    <p className="text-sage/70">
                      An unexpected error occurred in the admin interface
                    </p>
                  </div>
                </div>

                {/* Error Info */}
                <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Bug className="w-4 h-4 text-red-400" />
                      <span className="font-medium text-cream">Error Details</span>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-sage/60">Error ID: </span>
                        <code className="text-red-400 bg-navy-dark/50 px-2 py-1 rounded text-xs">
                          {errorId}
                        </code>
                      </div>
                      
                      <div>
                        <span className="text-sage/60">Type: </span>
                        <span className="text-cream">{error?.name || 'Unknown Error'}</span>
                      </div>
                      
                      <div>
                        <span className="text-sage/60">Message: </span>
                        <span className="text-cream">{error?.message || 'No error message available'}</span>
                      </div>
                      
                      <div>
                        <span className="text-sage/60">Time: </span>
                        <span className="text-cream">{new Date().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Development Details */}
                {isDevelopment && this.props.showDetails && error && (
                  <details className="p-4 bg-navy-dark/30 border border-sage/20 rounded-lg">
                    <summary className="cursor-pointer text-sm font-medium text-cream hover:text-teal-primary transition-colors">
                      Technical Details (Development)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div>
                        <h4 className="text-xs font-medium text-sage/70 mb-2">Stack Trace:</h4>
                        <pre className="text-xs bg-navy-dark/50 p-3 rounded overflow-x-auto text-red-400">
                          {error.stack}
                        </pre>
                      </div>
                      
                      {errorInfo && (
                        <div>
                          <h4 className="text-xs font-medium text-sage/70 mb-2">Component Stack:</h4>
                          <pre className="text-xs bg-navy-dark/50 p-3 rounded overflow-x-auto text-sage/60">
                            {errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={this.handleRetry}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-gradient-to-r from-teal-primary to-teal-secondary text-cream rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Try Again
                  </motion.button>
                  
                  <button
                    onClick={this.handleGoBack}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-3 bg-sage/10 border border-sage/20 text-sage/70 rounded-lg font-medium hover:bg-sage/20 hover:text-cream transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Go Back
                  </button>
                </div>

                {/* Secondary Actions */}
                <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-sage/10">
                  <button
                    onClick={this.handleGoHome}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm text-sage/70 hover:text-cream transition-colors"
                  >
                    <Home className="w-4 h-4" />
                    Admin Dashboard
                  </button>
                  
                  <button
                    onClick={this.downloadErrorReport}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm text-sage/70 hover:text-cream transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Download Report
                  </button>
                  
                  <button
                    onClick={this.handleReload}
                    className="flex items-center justify-center gap-2 flex-1 px-4 py-2 text-sm text-sage/70 hover:text-cream transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Reload Page
                  </button>
                </div>

                {/* Help Text */}
                <div className="text-center pt-4 border-t border-sage/10">
                  <p className="text-xs text-sage/60">
                    If this error persists, please contact the system administrator
                    with the error ID: <code className="text-red-400">{errorId}</code>
                  </p>
                </div>
              </div>
            </GlassMorphism>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to access error boundary functionality
const useErrorHandler = () => {
  return {
    reportError: (error: Error, context?: string) => {
      console.error('Manual error report:', error, context);
      // In production, send to error tracking
    },
    
    downloadLogs: () => {
      try {
        const logs = sessionStorage.getItem('admin-error-logs');
        if (logs) {
          const blob = new Blob([logs], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `admin-error-logs-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error('Failed to download logs:', error);
      }
    },
    
    clearLogs: () => {
      try {
        sessionStorage.removeItem('admin-error-logs');
      } catch (error) {
        console.error('Failed to clear logs:', error);
      }
    }
  };
};

// Wrapper component for easier usage
const AdminErrorProvider: React.FC<{
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}> = ({ children, onError }) => {
  return (
    <AdminErrorBoundary 
      onError={onError}
      showDetails={process.env.NODE_ENV === 'development'}
    >
      {children}
    </AdminErrorBoundary>
  );
};

// Component exports
export { AdminErrorProvider, useErrorHandler };
export { AdminErrorBoundary as AdminErrorBoundaryComponent };

// Default export for easier importing
export default AdminErrorBoundary;
