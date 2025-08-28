/**
 * EPIC 5 STORY 5.4: Payment Security Provider
 * Security context and validation for payment components
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface SecurityCheckResult {
  isSecure: boolean;
  issues: string[];
  recommendations: string[];
}

interface PaymentSecurityContextType {
  securityCheck: SecurityCheckResult;
  isValidEnvironment: boolean;
  encryptionSupported: boolean;
  browserSupported: boolean;
  validateCardInput: (input: string) => boolean;
  sanitizeInput: (input: string) => string;
  checkCSP: () => boolean;
}

const PaymentSecurityContext = createContext<PaymentSecurityContextType | null>(null);

export function usePaymentSecurity() {
  const context = useContext(PaymentSecurityContext);
  if (!context) {
    throw new Error('usePaymentSecurity must be used within PaymentSecurityProvider');
  }
  return context;
}

interface PaymentSecurityProviderProps {
  children: React.ReactNode;
}

export function PaymentSecurityProvider({ children }: PaymentSecurityProviderProps) {
  const [securityCheck, setSecurityCheck] = useState<SecurityCheckResult>({
    isSecure: false,
    issues: [],
    recommendations: []
  });
  const [isValidEnvironment, setIsValidEnvironment] = useState(false);
  const [encryptionSupported, setEncryptionSupported] = useState(false);
  const [browserSupported, setBrowserSupported] = useState(false);

  useEffect(() => {
    performSecurityCheck();
  }, []);

  const performSecurityCheck = async () => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let isSecure = true;

    // Check HTTPS
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      issues.push('Connection is not secure (HTTPS required)');
      recommendations.push('Ensure all payment pages use HTTPS encryption');
      isSecure = false;
    }

    // Check browser support for required APIs
    const browserChecks = checkBrowserSupport();
    if (!browserChecks.supported) {
      issues.push(...browserChecks.issues);
      recommendations.push(...browserChecks.recommendations);
      isSecure = false;
    }
    setBrowserSupported(browserChecks.supported);

    // Check Web Crypto API support
    const cryptoSupported = checkCryptoSupport();
    setEncryptionSupported(cryptoSupported);
    if (!cryptoSupported) {
      issues.push('Web Crypto API not supported');
      recommendations.push('Upgrade to a modern browser with encryption support');
    }

    // Check Content Security Policy
    const cspValid = checkCSP();
    if (!cspValid) {
      recommendations.push('Consider implementing Content Security Policy headers');
    }

    // Check for suspicious extensions or modifications
    const environmentCheck = checkEnvironmentIntegrity();
    setIsValidEnvironment(environmentCheck.valid);
    if (!environmentCheck.valid) {
      issues.push(...environmentCheck.issues);
      recommendations.push(...environmentCheck.recommendations);
      isSecure = false;
    }

    // Check for mixed content
    const mixedContentCheck = checkMixedContent();
    if (!mixedContentCheck.valid) {
      issues.push(...mixedContentCheck.issues);
      recommendations.push(...mixedContentCheck.recommendations);
    }

    setSecurityCheck({
      isSecure: isSecure && issues.length === 0,
      issues,
      recommendations
    });
  };

  const checkBrowserSupport = () => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let supported = true;

    // Check for required APIs
    if (typeof window === 'undefined') {
      return { supported: true, issues, recommendations };
    }

    // Payment Request API (for Apple Pay, Google Pay)
    if (!window.PaymentRequest) {
      recommendations.push('Browser does not support Payment Request API (Apple Pay/Google Pay unavailable)');
    }

    // Fetch API
    if (!window.fetch) {
      issues.push('Fetch API not supported');
      recommendations.push('Use a modern browser with Fetch API support');
      supported = false;
    }

    // Promises
    if (!window.Promise) {
      issues.push('Promises not supported');
      recommendations.push('Use a modern browser with Promise support');
      supported = false;
    }

    // Local Storage
    try {
      if (!window.localStorage) {
        issues.push('Local Storage not supported');
        supported = false;
      }
    } catch (e) {
      issues.push('Local Storage access blocked');
      recommendations.push('Enable local storage for payment form functionality');
    }

    return { supported, issues, recommendations };
  };

  const checkCryptoSupport = () => {
    if (typeof window === 'undefined') return false;
    return !!(window.crypto && window.crypto.subtle);
  };

  const checkCSP = () => {
    // This is a basic check - in production you'd want more sophisticated CSP validation
    try {
      const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      return !!meta;
    } catch (e) {
      return false;
    }
  };

  const checkEnvironmentIntegrity = () => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let valid = true;

    if (typeof window === 'undefined') {
      return { valid: true, issues, recommendations };
    }

    // Check for suspicious global modifications
    try {
      // Check if XMLHttpRequest has been modified
      if (window.XMLHttpRequest && window.XMLHttpRequest.toString().includes('[native code]') === false) {
        issues.push('XMLHttpRequest appears to be modified');
        recommendations.push('Disable browser extensions that modify network requests');
        valid = false;
      }

      // Check if fetch has been modified
      if (window.fetch && window.fetch.toString().includes('[native code]') === false) {
        issues.push('Fetch API appears to be modified');
        recommendations.push('Disable browser extensions that intercept network requests');
      }

      // Check for common debugging/testing tools in production
      if (process.env.NODE_ENV === 'production') {
        const suspiciousGlobals = ['__REACT_DEVTOOLS_GLOBAL_HOOK__'];
        suspiciousGlobals.forEach(global => {
          if ((window as any)[global]) {
            recommendations.push('Development tools detected in production environment');
          }
        });
      }

    } catch (e) {
      // If we can't check, assume it's okay
    }

    return { valid, issues, recommendations };
  };

  const checkMixedContent = () => {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let valid = true;

    if (typeof window === 'undefined') {
      return { valid: true, issues, recommendations };
    }

    // Check for mixed content issues
    if (window.location.protocol === 'https:') {
      // Check for HTTP resources on HTTPS page
      const httpResources = Array.from(document.querySelectorAll('script[src], link[href], img[src]'))
        .filter((el: any) => el.src?.startsWith('http:') || el.href?.startsWith('http:'));
      
      if (httpResources.length > 0) {
        issues.push('Mixed content detected (HTTP resources on HTTPS page)');
        recommendations.push('Ensure all resources use HTTPS');
        valid = false;
      }
    }

    return { valid, issues, recommendations };
  };

  const validateCardInput = (input: string): boolean => {
    // Basic validation to prevent obvious security issues
    if (!input || typeof input !== 'string') return false;
    
    // Remove any HTML tags
    if (/<[^>]*>/.test(input)) return false;
    
    // Check for script injection attempts
    if (/script|javascript|vbscript|onload|onerror/i.test(input)) return false;
    
    // Check for SQL injection patterns
    if /(union|select|insert|delete|drop|create|alter|exec|execute)/i.test(input)) return false;
    
    return true;
  };

  const sanitizeInput = (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    
    // Remove HTML tags
    const withoutHtml = input.replace(/<[^>]*>/g, '');
    
    // Remove potentially dangerous characters
    const sanitized = withoutHtml.replace(/[<>\"'&]/g, '');
    
    // Limit length
    return sanitized.substring(0, 255);
  };

  const contextValue: PaymentSecurityContextType = {
    securityCheck,
    isValidEnvironment,
    encryptionSupported,
    browserSupported,
    validateCardInput,
    sanitizeInput,
    checkCSP
  };

  return (
    <PaymentSecurityContext.Provider value={contextValue}>
      {children}
    </PaymentSecurityContext.Provider>
  );
}

// Hook for security warnings
export function useSecurityWarnings() {
  const { securityCheck, isValidEnvironment } = usePaymentSecurity();
  
  const getWarningComponent = () => {
    if (securityCheck.isSecure && isValidEnvironment) {
      return null;
    }

    return (
      <div className="security-warnings space-y-2 mb-4">
        {securityCheck.issues.map((issue, index) => (
          <div key={index} className="security-warning p-3 bg-red-warning/20 border border-red-warning/30 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-red-warning flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="font-medium text-red-warning text-sm">{issue}</div>
                {securityCheck.recommendations[index] && (
                  <div className="text-xs text-red-warning/80 mt-1">
                    {securityCheck.recommendations[index]}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        
        {securityCheck.recommendations
          .filter((_, index) => !securityCheck.issues[index]) // Show recommendations without corresponding issues
          .map((recommendation, index) => (
            <div key={index} className="security-recommendation p-3 bg-gold-primary/20 border border-gold-primary/30 rounded-lg">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-gold-primary flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-gold-primary">{recommendation}</div>
              </div>
            </div>
          ))}
      </div>
    );
  };

  return { getWarningComponent, hasWarnings: !securityCheck.isSecure || !isValidEnvironment };
}

export default PaymentSecurityProvider;