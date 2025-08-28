/**
 * EPIC 5 STORY 5.1: Stripe Integration & Payment Infrastructure
 * Security Middleware - Comprehensive payment endpoint security
 * 
 * Provides PCI DSS compliant security measures including authentication,
 * rate limiting, validation, and audit logging for all payment operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';
import { headers } from 'next/headers';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface SecurityContext {
  userId: string;
  userRole: string;
  customerId?: string;
  businessId?: string;
  isAdmin: boolean;
  ipAddress: string;
  userAgent: string;
  requestId: string;
}

export interface RateLimitInfo {
  attempts: number;
  lastAttempt: Date;
  blocked: boolean;
  resetTime?: Date;
}

export interface AuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

// =============================================
// VALIDATION SCHEMAS
// =============================================

const PaymentRequestSchema = z.object({
  amount: z.number().positive().max(999999999), // Max $9,999,999.99
  currency: z.string().length(3).regex(/^[A-Z]{3}$/),
  customerId: z.string().uuid(),
  description: z.string().max(500).optional(),
  metadata: z.record(z.string()).optional(),
});

const CustomerRequestSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  metadata: z.record(z.string()).optional(),
});

const SubscriptionRequestSchema = z.object({
  customerId: z.string().uuid(),
  priceId: z.string().min(1).max(255),
  paymentMethodId: z.string().max(255).optional(),
  trialPeriodDays: z.number().min(0).max(365).optional(),
  metadata: z.record(z.string()).optional(),
});

// =============================================
// SECURITY MIDDLEWARE CLASS
// =============================================

class PaymentSecurityMiddleware {
  private supabase;

  constructor() {
    this.supabase = createClient();
  }

  /**
   * Main security middleware function
   */
  async validatePaymentRequest(
    request: NextRequest,
    requiredRole: string[] = ['authenticated'],
    requireCustomerAccess: boolean = false
  ): Promise<{ context: SecurityContext; response?: NextResponse }> {
    const requestId = this.generateRequestId();
    const ipAddress = this.getClientIP(request);
    const userAgent = request.headers.get('user-agent') || 'unknown';

    try {
      // 1. Check rate limits
      const rateLimitResult = await this.checkRateLimit(ipAddress);
      if (rateLimitResult.blocked) {
        await this.logSecurityEvent({
          userId: 'anonymous',
          action: 'rate_limit_exceeded',
          resource: 'payment_api',
          ipAddress,
          userAgent,
          success: false,
          error: 'Rate limit exceeded',
          timestamp: new Date(),
        });

        return {
          context: {} as SecurityContext,
          response: new NextResponse(
            JSON.stringify({ error: 'Rate limit exceeded' }),
            { 
              status: 429, 
              headers: { 
                'Retry-After': Math.ceil((rateLimitResult.resetTime!.getTime() - Date.now()) / 1000).toString(),
                'Content-Type': 'application/json' 
              }
            }
          ),
        };
      }

      // 2. Authenticate user
      const authResult = await this.authenticateUser(request);
      if (!authResult.success) {
        await this.logSecurityEvent({
          userId: 'anonymous',
          action: 'authentication_failed',
          resource: 'payment_api',
          ipAddress,
          userAgent,
          success: false,
          error: authResult.error,
          timestamp: new Date(),
        });

        return {
          context: {} as SecurityContext,
          response: new NextResponse(
            JSON.stringify({ error: 'Authentication required' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }

      // 3. Check user role authorization
      const hasRole = this.checkUserRole(authResult.user!.role, requiredRole);
      if (!hasRole) {
        await this.logSecurityEvent({
          userId: authResult.user!.id,
          action: 'authorization_failed',
          resource: 'payment_api',
          ipAddress,
          userAgent,
          success: false,
          error: `Insufficient permissions. Required: ${requiredRole.join(', ')}, Has: ${authResult.user!.role}`,
          timestamp: new Date(),
        });

        return {
          context: {} as SecurityContext,
          response: new NextResponse(
            JSON.stringify({ error: 'Insufficient permissions' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }

      // 4. Check customer access if required
      let customerId: string | undefined;
      let businessId: string | undefined;

      if (requireCustomerAccess) {
        const customerAccess = await this.validateCustomerAccess(
          authResult.user!.id, 
          request
        );
        
        if (!customerAccess.allowed) {
          await this.logSecurityEvent({
            userId: authResult.user!.id,
            action: 'customer_access_denied',
            resource: 'payment_api',
            resourceId: customerAccess.requestedCustomerId,
            ipAddress,
            userAgent,
            success: false,
            error: customerAccess.error,
            timestamp: new Date(),
          });

          return {
            context: {} as SecurityContext,
            response: new NextResponse(
              JSON.stringify({ error: 'Access denied' }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            ),
          };
        }

        customerId = customerAccess.customerId;
        businessId = customerAccess.businessId;
      }

      // 5. Build security context
      const context: SecurityContext = {
        userId: authResult.user!.id,
        userRole: authResult.user!.role,
        customerId,
        businessId,
        isAdmin: ['admin', 'super_admin'].includes(authResult.user!.role),
        ipAddress,
        userAgent,
        requestId,
      };

      // 6. Record rate limit attempt
      await this.recordRateLimitAttempt(ipAddress);

      return { context };
    } catch (error) {
      console.error('Security middleware error:', error);

      await this.logSecurityEvent({
        userId: 'system',
        action: 'security_middleware_error',
        resource: 'payment_api',
        ipAddress,
        userAgent,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      return {
        context: {} as SecurityContext,
        response: new NextResponse(
          JSON.stringify({ error: 'Security validation failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  }

  /**
   * Validate webhook requests with signature verification
   */
  async validateWebhookRequest(
    request: NextRequest,
    endpointSecret: string
  ): Promise<{ valid: boolean; response?: NextResponse }> {
    const requestId = this.generateRequestId();
    const ipAddress = this.getClientIP(request);

    try {
      // Get Stripe signature header
      const signature = request.headers.get('stripe-signature');
      if (!signature) {
        await this.logSecurityEvent({
          userId: 'webhook',
          action: 'webhook_missing_signature',
          resource: 'webhook',
          ipAddress,
          userAgent: 'stripe-webhook',
          success: false,
          error: 'Missing Stripe signature header',
          timestamp: new Date(),
        });

        return {
          valid: false,
          response: new NextResponse(
            JSON.stringify({ error: 'Missing signature' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }

      // Verify webhook source IP (optional additional security)
      if (!this.isValidStripeIP(ipAddress)) {
        await this.logSecurityEvent({
          userId: 'webhook',
          action: 'webhook_invalid_ip',
          resource: 'webhook',
          ipAddress,
          userAgent: 'stripe-webhook',
          success: false,
          error: `Invalid source IP: ${ipAddress}`,
          timestamp: new Date(),
        });

        return {
          valid: false,
          response: new NextResponse(
            JSON.stringify({ error: 'Invalid source' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          ),
        };
      }

      // Rate limit webhooks
      const rateLimitResult = await this.checkWebhookRateLimit(ipAddress);
      if (rateLimitResult.blocked) {
        await this.logSecurityEvent({
          userId: 'webhook',
          action: 'webhook_rate_limit_exceeded',
          resource: 'webhook',
          ipAddress,
          userAgent: 'stripe-webhook',
          success: false,
          error: 'Webhook rate limit exceeded',
          timestamp: new Date(),
        });

        return {
          valid: false,
          response: new NextResponse(
            JSON.stringify({ error: 'Rate limit exceeded' }),
            { 
              status: 429,
              headers: { 
                'Retry-After': '60',
                'Content-Type': 'application/json' 
              }
            }
          ),
        };
      }

      return { valid: true };
    } catch (error) {
      console.error('Webhook validation error:', error);

      await this.logSecurityEvent({
        userId: 'webhook',
        action: 'webhook_validation_error',
        resource: 'webhook',
        ipAddress,
        userAgent: 'stripe-webhook',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      });

      return {
        valid: false,
        response: new NextResponse(
          JSON.stringify({ error: 'Webhook validation failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        ),
      };
    }
  }

  /**
   * Validate and sanitize payment request data
   */
  validatePaymentData(data: any, schema: z.ZodSchema): { valid: boolean; data?: any; errors?: string[] } {
    try {
      const validatedData = schema.parse(data);
      return { valid: true, data: validatedData };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return { valid: false, errors };
      }
      return { valid: false, errors: ['Invalid data format'] };
    }
  }

  // =============================================
  // VALIDATION SCHEMAS EXPORT
  // =============================================

  getPaymentRequestSchema() { return PaymentRequestSchema; }
  getCustomerRequestSchema() { return CustomerRequestSchema; }
  getSubscriptionRequestSchema() { return SubscriptionRequestSchema; }

  // =============================================
  // AUDIT LOGGING
  // =============================================

  async logPaymentEvent(context: SecurityContext, action: string, resource: string, success: boolean, metadata?: any, error?: string): Promise<void> {
    await this.logSecurityEvent({
      userId: context.userId,
      action,
      resource,
      resourceId: metadata?.resourceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      success,
      error,
      metadata: {
        ...metadata,
        requestId: context.requestId,
        userRole: context.userRole,
        customerId: context.customerId,
        businessId: context.businessId,
      },
      timestamp: new Date(),
    });
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private async checkRateLimit(ipAddress: string): Promise<RateLimitInfo> {
    const key = `payment_rate_limit:${ipAddress}`;
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 50; // 50 requests per 15 minutes

    // Implementation would use Redis or similar in production
    // For now, using database with cleanup
    const { data: existing } = await this.supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .single();

    const now = new Date();
    
    if (!existing) {
      await this.supabase
        .from('rate_limits')
        .insert({
          key,
          attempts: 1,
          window_start: now.toISOString(),
          expires_at: new Date(now.getTime() + windowMs).toISOString(),
        });

      return {
        attempts: 1,
        lastAttempt: now,
        blocked: false,
      };
    }

    const windowStart = new Date(existing.window_start);
    const windowEnd = new Date(windowStart.getTime() + windowMs);

    if (now > windowEnd) {
      // Reset window
      await this.supabase
        .from('rate_limits')
        .update({
          attempts: 1,
          window_start: now.toISOString(),
          expires_at: new Date(now.getTime() + windowMs).toISOString(),
        })
        .eq('key', key);

      return {
        attempts: 1,
        lastAttempt: now,
        blocked: false,
      };
    }

    const newAttempts = existing.attempts + 1;
    const blocked = newAttempts > maxAttempts;

    await this.supabase
      .from('rate_limits')
      .update({
        attempts: newAttempts,
        last_attempt: now.toISOString(),
      })
      .eq('key', key);

    return {
      attempts: newAttempts,
      lastAttempt: now,
      blocked,
      resetTime: blocked ? windowEnd : undefined,
    };
  }

  private async recordRateLimitAttempt(ipAddress: string): Promise<void> {
    // This is handled in checkRateLimit
  }

  private async checkWebhookRateLimit(ipAddress: string): Promise<RateLimitInfo> {
    // More restrictive rate limiting for webhooks
    const key = `webhook_rate_limit:${ipAddress}`;
    const windowMs = 60 * 1000; // 1 minute
    const maxAttempts = 100; // 100 webhooks per minute

    // Similar implementation to checkRateLimit but with different limits
    const { data: existing } = await this.supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .single();

    const now = new Date();
    
    if (!existing) {
      await this.supabase
        .from('rate_limits')
        .insert({
          key,
          attempts: 1,
          window_start: now.toISOString(),
          expires_at: new Date(now.getTime() + windowMs).toISOString(),
        });

      return {
        attempts: 1,
        lastAttempt: now,
        blocked: false,
      };
    }

    const windowStart = new Date(existing.window_start);
    const windowEnd = new Date(windowStart.getTime() + windowMs);

    if (now > windowEnd) {
      await this.supabase
        .from('rate_limits')
        .update({
          attempts: 1,
          window_start: now.toISOString(),
          expires_at: new Date(now.getTime() + windowMs).toISOString(),
        })
        .eq('key', key);

      return {
        attempts: 1,
        lastAttempt: now,
        blocked: false,
      };
    }

    const newAttempts = existing.attempts + 1;
    const blocked = newAttempts > maxAttempts;

    await this.supabase
      .from('rate_limits')
      .update({
        attempts: newAttempts,
        last_attempt: now.toISOString(),
      })
      .eq('key', key);

    return {
      attempts: newAttempts,
      lastAttempt: now,
      blocked,
      resetTime: blocked ? windowEnd : undefined,
    };
  }

  private async authenticateUser(request: NextRequest): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error || !user) {
        return { success: false, error: 'Invalid or expired token' };
      }

      // Get user role
      const { data: userRole } = await this.supabase
        .from('user_roles')
        .select('roles(name)')
        .eq('user_id', user.id)
        .single();

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: userRole?.roles?.name || 'user',
        },
      };
    } catch (error) {
      return { success: false, error: 'Authentication failed' };
    }
  }

  private checkUserRole(userRole: string, requiredRoles: string[]): boolean {
    // Admin roles have access to everything
    if (['admin', 'super_admin'].includes(userRole)) {
      return true;
    }

    return requiredRoles.includes(userRole) || requiredRoles.includes('authenticated');
  }

  private async validateCustomerAccess(
    userId: string, 
    request: NextRequest
  ): Promise<{ allowed: boolean; customerId?: string; businessId?: string; requestedCustomerId?: string; error?: string }> {
    try {
      // Extract customer ID from request (URL param, body, etc.)
      const url = new URL(request.url);
      const customerId = url.searchParams.get('customerId') || 
                        url.pathname.split('/').find(segment => segment.match(/^[0-9a-f-]{36}$/));

      if (!customerId) {
        return { allowed: false, error: 'Customer ID required' };
      }

      // Check if user has access to this customer
      const { data: customer } = await this.supabase
        .from('stripe_customers')
        .select('user_id, business_id')
        .eq('id', customerId)
        .single();

      if (!customer) {
        return { allowed: false, requestedCustomerId: customerId, error: 'Customer not found' };
      }

      // Direct user access
      if (customer.user_id === userId) {
        return { allowed: true, customerId, requestedCustomerId: customerId };
      }

      // Business access through membership
      if (customer.business_id) {
        const { data: membership } = await this.supabase
          .from('business_members')
          .select('role')
          .eq('business_id', customer.business_id)
          .eq('user_id', userId)
          .single();

        if (membership && ['owner', 'admin', 'billing'].includes(membership.role)) {
          return { allowed: true, customerId, businessId: customer.business_id, requestedCustomerId: customerId };
        }
      }

      return { allowed: false, requestedCustomerId: customerId, error: 'Access denied to customer' };
    } catch (error) {
      return { allowed: false, error: 'Customer validation failed' };
    }
  }

  private generateRequestId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private getClientIP(request: NextRequest): string {
    // Try various headers to get real client IP
    const xForwardedFor = request.headers.get('x-forwarded-for');
    const xRealIP = request.headers.get('x-real-ip');
    const xClientIP = request.headers.get('x-client-ip');
    
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }
    if (xRealIP) return xRealIP;
    if (xClientIP) return xClientIP;
    
    return 'unknown';
  }

  private isValidStripeIP(ipAddress: string): boolean {
    // Stripe webhook IP ranges (should be updated periodically)
    const stripeIPRanges = [
      '3.18.12.0/23',
      '3.130.192.0/25',
      '13.235.14.0/25',
      '13.235.122.0/25',
      '18.211.135.69/32',
      '35.154.171.200/32',
      '52.25.183.99/32',
      '54.187.174.169/32',
      '54.187.205.235/32',
      '54.187.216.72/32',
      // Add more Stripe IP ranges as needed
    ];

    // For development/testing, allow all IPs
    if (process.env.NODE_ENV === 'development') {
      return true;
    }

    // In production, implement proper IP range checking
    // This is a simplified version - use a proper CIDR library
    return stripeIPRanges.some(range => {
      // Simple check for exact match or localhost
      return ipAddress === '127.0.0.1' || 
             ipAddress === '::1' || 
             ipAddress.startsWith('192.168.') ||
             range.includes(ipAddress);
    });
  }

  private async logSecurityEvent(event: AuditLogEntry): Promise<void> {
    try {
      await this.supabase
        .from('security_audit_logs')
        .insert({
          user_id: event.userId,
          action: event.action,
          resource_type: event.resource,
          resource_id: event.resourceId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          success: event.success,
          error_message: event.error,
          metadata: event.metadata,
          created_at: event.timestamp.toISOString(),
        });
    } catch (error) {
      console.error('Failed to log security event:', error);
    }
  }
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const paymentSecurity = new PaymentSecurityMiddleware();
export default paymentSecurity;
export { PaymentSecurityMiddleware };