import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

interface CSRFOptions {
  tokenName?: string;
  cookieName?: string;
  secret?: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}

interface CSRFResult {
  success: boolean;
  token?: string;
  message?: string;
}

class CSRFProtection {
  private options: Required<CSRFOptions>;

  constructor(options: CSRFOptions = {}) {
    this.options = {
      tokenName: 'csrf-token',
      cookieName: 'csrf-token',
      secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
      httpOnly: false, // CSRF tokens need to be accessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      ...options,
    };
  }

  generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async verifyToken(req: NextRequest): Promise<CSRFResult> {
    // Skip CSRF verification for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return { success: true };
    }

    try {
      // Get token from header
      const headerToken = req.headers.get('x-csrf-token') || 
                         req.headers.get('csrf-token');
      
      // Get token from cookie
      const cookieStore = cookies();
      const cookieToken = cookieStore.get(this.options.cookieName)?.value;

      if (!headerToken) {
        return {
          success: false,
          message: 'CSRF token missing from request headers',
        };
      }

      if (!cookieToken) {
        return {
          success: false,
          message: 'CSRF token missing from cookies',
        };
      }

      // Verify tokens match
      if (headerToken !== cookieToken) {
        return {
          success: false,
          message: 'CSRF token mismatch',
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        message: 'CSRF token verification failed',
      };
    }
  }

  setTokenCookie(token: string): string {
    // Return cookie string for setting in response
    const { cookieName, httpOnly, secure, sameSite } = this.options;
    const flags = [
      `${cookieName}=${token}`,
      'Path=/',
      httpOnly && 'HttpOnly',
      secure && 'Secure',
      `SameSite=${sameSite}`,
    ].filter(Boolean).join('; ');

    return flags;
  }

  getTokenFromCookies(): string | null {
    try {
      const cookieStore = cookies();
      return cookieStore.get(this.options.cookieName)?.value || null;
    } catch {
      return null;
    }
  }
}

// Default CSRF instance
export const csrf = new CSRFProtection();

// Helper functions
export function generateCSRFToken(): string {
  return csrf.generateToken();
}

export async function verifyCSRFToken(req: NextRequest): Promise<CSRFResult> {
  return csrf.verifyToken(req);
}

export function setCSRFTokenCookie(token: string): string {
  return csrf.setTokenCookie(token);
}

export function getCSRFTokenFromCookies(): string | null {
  return csrf.getTokenFromCookies();
}

// Middleware helper
export async function withCSRFProtection(req: NextRequest): Promise<CSRFResult> {
  return csrf.verifyToken(req);
}

export { CSRFProtection };
export type { CSRFOptions, CSRFResult };
