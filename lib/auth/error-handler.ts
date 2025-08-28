/**
 * OAuth Error Handling System
 * Epic 2 Story 2.3: Social Media Login Integration
 * 
 * Comprehensive error handling, recovery strategies, and user feedback
 * for OAuth authentication flows.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { OAuthProvider } from './oauth-config'

export type OAuthErrorType = 
  | 'INVALID_PROVIDER'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'OAUTH_ERROR'
  | 'CSRF_VIOLATION'
  | 'TOKEN_EXCHANGE_FAILED'
  | 'USER_INFO_FAILED'
  | 'ACCOUNT_LINKING_FAILED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SECURITY_VIOLATION'
  | 'NETWORK_ERROR'
  | 'USER_CANCELLED'
  | 'ACCESS_DENIED'
  | 'INVALID_SCOPE'
  | 'SERVER_ERROR'
  | 'UNKNOWN_ERROR'

export interface OAuthError {
  type: OAuthErrorType
  message: string
  userMessage: string
  details?: any
  provider?: OAuthProvider
  recoverable: boolean
  recoveryActions?: RecoveryAction[]
  shouldRetry: boolean
  retryAfter?: number
  supportCode?: string
}

export interface RecoveryAction {
  action: 'retry' | 'different_provider' | 'contact_support' | 'try_later' | 'check_permissions'
  label: string
  description: string
  priority: number
}

/**
 * OAuth Error Handler
 */
export class OAuthErrorHandler {
  private supabase = createClient()

  /**
   * Handle OAuth provider errors
   */
  handleProviderError(
    error: string,
    errorDescription?: string,
    provider?: OAuthProvider,
    state?: string
  ): OAuthError {
    const supportCode = this.generateSupportCode()

    switch (error) {
      case 'access_denied':
        return {
          type: 'ACCESS_DENIED',
          message: `User denied access to ${provider} account`,
          userMessage: 'You cancelled the authorization. You can try again or use a different sign-in method.',
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: `Retry signing in with ${provider}`,
              priority: 1
            },
            {
              action: 'different_provider',
              label: 'Use Different Method',
              description: 'Try signing in with email or another provider',
              priority: 2
            }
          ],
          supportCode
        }

      case 'invalid_scope':
        return {
          type: 'INVALID_SCOPE',
          message: `Invalid scope requested for ${provider}`,
          userMessage: 'There was a problem with the requested permissions. Please try again.',
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Retry the authentication process',
              priority: 1
            },
            {
              action: 'contact_support',
              label: 'Contact Support',
              description: 'Get help if the problem persists',
              priority: 3
            }
          ],
          supportCode
        }

      case 'invalid_request':
        return {
          type: 'OAUTH_ERROR',
          message: `Invalid OAuth request for ${provider}: ${errorDescription}`,
          userMessage: 'There was a technical problem with the sign-in process. Please try again.',
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Retry the sign-in process',
              priority: 1
            },
            {
              action: 'try_later',
              label: 'Try Later',
              description: 'Wait a few minutes and try again',
              priority: 2
            }
          ],
          supportCode
        }

      case 'server_error':
      case 'temporarily_unavailable':
        return {
          type: 'SERVER_ERROR',
          message: `${provider} server error: ${errorDescription}`,
          userMessage: `${provider} is temporarily unavailable. Please try again in a few minutes.`,
          provider,
          recoverable: true,
          shouldRetry: true,
          retryAfter: 300, // 5 minutes
          recoveryActions: [
            {
              action: 'try_later',
              label: 'Try Later',
              description: 'Wait a few minutes and try again',
              priority: 1
            },
            {
              action: 'different_provider',
              label: 'Use Different Method',
              description: 'Try signing in with email or another provider',
              priority: 2
            }
          ],
          supportCode
        }

      case 'invalid_client':
        return {
          type: 'PROVIDER_NOT_CONFIGURED',
          message: `${provider} OAuth client configuration error`,
          userMessage: 'This sign-in method is temporarily unavailable. Please try a different method.',
          provider,
          recoverable: false,
          shouldRetry: false,
          recoveryActions: [
            {
              action: 'different_provider',
              label: 'Use Different Method',
              description: 'Try signing in with email or another provider',
              priority: 1
            },
            {
              action: 'contact_support',
              label: 'Contact Support',
              description: 'Report this technical issue',
              priority: 2
            }
          ],
          supportCode
        }

      default:
        return {
          type: 'OAUTH_ERROR',
          message: `OAuth error from ${provider}: ${error} - ${errorDescription}`,
          userMessage: `There was a problem signing in with ${provider}. Please try again or use a different method.`,
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Retry the sign-in process',
              priority: 1
            },
            {
              action: 'different_provider',
              label: 'Use Different Method',
              description: 'Try signing in with email or another provider',
              priority: 2
            }
          ],
          supportCode
        }
    }
  }

  /**
   * Handle internal system errors
   */
  handleSystemError(
    errorType: OAuthErrorType,
    error: Error | string,
    provider?: OAuthProvider,
    context?: any
  ): OAuthError {
    const supportCode = this.generateSupportCode()
    const errorMessage = error instanceof Error ? error.message : error

    switch (errorType) {
      case 'RATE_LIMIT_EXCEEDED':
        return {
          type: 'RATE_LIMIT_EXCEEDED',
          message: `Rate limit exceeded for ${provider || 'OAuth'} requests`,
          userMessage: 'Too many sign-in attempts. Please wait a few minutes before trying again.',
          provider,
          recoverable: true,
          shouldRetry: true,
          retryAfter: context?.retryAfter || 900, // 15 minutes default
          recoveryActions: [
            {
              action: 'try_later',
              label: 'Wait and Try Again',
              description: `Wait ${Math.ceil((context?.retryAfter || 900) / 60)} minutes before retrying`,
              priority: 1
            },
            {
              action: 'different_provider',
              label: 'Use Different Method',
              description: 'Try signing in with a different provider',
              priority: 2
            }
          ],
          supportCode
        }

      case 'SECURITY_VIOLATION':
        return {
          type: 'SECURITY_VIOLATION',
          message: `Security violation detected: ${errorMessage}`,
          userMessage: 'Your sign-in attempt was blocked for security reasons. Please try again or contact support.',
          provider,
          recoverable: false,
          shouldRetry: false,
          recoveryActions: [
            {
              action: 'contact_support',
              label: 'Contact Support',
              description: 'Get help with this security issue',
              priority: 1
            },
            {
              action: 'try_later',
              label: 'Try Later',
              description: 'Wait and try again from your usual location',
              priority: 2
            }
          ],
          supportCode
        }

      case 'TOKEN_EXCHANGE_FAILED':
        return {
          type: 'TOKEN_EXCHANGE_FAILED',
          message: `Failed to exchange authorization code: ${errorMessage}`,
          userMessage: 'There was a problem completing your sign-in. Please try again.',
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Retry the sign-in process',
              priority: 1
            },
            {
              action: 'try_later',
              label: 'Try Later',
              description: 'Wait a few minutes and try again',
              priority: 2
            }
          ],
          supportCode
        }

      case 'USER_INFO_FAILED':
        return {
          type: 'USER_INFO_FAILED',
          message: `Failed to retrieve user information from ${provider}: ${errorMessage}`,
          userMessage: `Unable to get your profile information from ${provider}. Please check your account permissions and try again.`,
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'check_permissions',
              label: 'Check Permissions',
              description: `Make sure you've granted the necessary permissions to your ${provider} account`,
              priority: 1
            },
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Retry the sign-in process',
              priority: 2
            }
          ],
          supportCode
        }

      case 'ACCOUNT_LINKING_FAILED':
        return {
          type: 'ACCOUNT_LINKING_FAILED',
          message: `Failed to link ${provider} account: ${errorMessage}`,
          userMessage: `Unable to connect your ${provider} account. This might be because it's already connected to another account.`,
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'contact_support',
              label: 'Contact Support',
              description: 'Get help linking your accounts',
              priority: 1
            },
            {
              action: 'different_provider',
              label: 'Use Different Account',
              description: 'Try with a different social account',
              priority: 2
            }
          ],
          supportCode
        }

      case 'NETWORK_ERROR':
        return {
          type: 'NETWORK_ERROR',
          message: `Network error during OAuth flow: ${errorMessage}`,
          userMessage: 'Unable to connect to the sign-in service. Please check your internet connection and try again.',
          provider,
          recoverable: true,
          shouldRetry: true,
          retryAfter: 60,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Check your connection and retry',
              priority: 1
            },
            {
              action: 'try_later',
              label: 'Try Later',
              description: 'Wait a few minutes and try again',
              priority: 2
            }
          ],
          supportCode
        }

      default:
        return {
          type: 'UNKNOWN_ERROR',
          message: `Unknown OAuth error: ${errorMessage}`,
          userMessage: 'An unexpected error occurred during sign-in. Please try again or contact support.',
          provider,
          recoverable: true,
          shouldRetry: true,
          recoveryActions: [
            {
              action: 'retry',
              label: 'Try Again',
              description: 'Retry the sign-in process',
              priority: 1
            },
            {
              action: 'contact_support',
              label: 'Contact Support',
              description: 'Get help with this error',
              priority: 2
            }
          ],
          supportCode
        }
    }
  }

  /**
   * Create error response for API endpoints
   */
  createErrorResponse(oauthError: OAuthError): NextResponse {
    const statusCode = this.getHttpStatusCode(oauthError.type)
    
    return NextResponse.json({
      error: {
        type: oauthError.type,
        message: oauthError.userMessage,
        details: oauthError.details,
        provider: oauthError.provider,
        recoverable: oauthError.recoverable,
        shouldRetry: oauthError.shouldRetry,
        retryAfter: oauthError.retryAfter,
        recoveryActions: oauthError.recoveryActions,
        supportCode: oauthError.supportCode
      }
    }, { status: statusCode })
  }

  /**
   * Create error redirect for OAuth callbacks
   */
  createErrorRedirect(oauthError: OAuthError, baseUrl: string): NextResponse {
    const errorUrl = new URL('/auth/error', baseUrl)
    errorUrl.searchParams.set('type', oauthError.type)
    errorUrl.searchParams.set('message', oauthError.userMessage)
    errorUrl.searchParams.set('provider', oauthError.provider || '')
    errorUrl.searchParams.set('recoverable', oauthError.recoverable.toString())
    errorUrl.searchParams.set('shouldRetry', oauthError.shouldRetry.toString())
    errorUrl.searchParams.set('supportCode', oauthError.supportCode || '')
    
    if (oauthError.retryAfter) {
      errorUrl.searchParams.set('retryAfter', oauthError.retryAfter.toString())
    }
    
    if (oauthError.recoveryActions) {
      errorUrl.searchParams.set('recoveryActions', JSON.stringify(oauthError.recoveryActions))
    }

    return NextResponse.redirect(errorUrl)
  }

  /**
   * Log OAuth error for monitoring and debugging
   */
  async logError(
    oauthError: OAuthError,
    request: NextRequest,
    userId?: string,
    additionalContext?: any
  ): Promise<void> {
    try {
      await (this.supabase as any).from('auth_audit_logs').insert({
        event_type: 'oauth_error',
        event_category: 'error',
        user_id: userId,
        success: false,
        failure_reason: oauthError.message,
        event_data: {
          error_type: oauthError.type,
          user_message: oauthError.userMessage,
          provider: oauthError.provider,
          recoverable: oauthError.recoverable,
          should_retry: oauthError.shouldRetry,
          support_code: oauthError.supportCode,
          details: oauthError.details,
          additional_context: additionalContext
        },
        ip_address: this.extractIPAddress(request),
        user_agent: request.headers.get('user-agent') || 'unknown'
      })

      // Also log to security events if it's a security-related error
      if (oauthError.type === 'SECURITY_VIOLATION' || oauthError.type === 'CSRF_VIOLATION') {
        await this.supabase.from('oauth_security_incidents').insert([{
          incident_type: oauthError.type.toLowerCase(),
          severity: 'high',
          description: oauthError.message,
          provider: oauthError.provider,
          user_id: userId,
          ip_address: this.extractIPAddress(request),
          user_agent: request.headers.get('user-agent') || 'unknown',
          raw_data: {
            error: oauthError,
            context: additionalContext
          }
        }])
      }

    } catch (error) {
      console.error('Failed to log OAuth error:', error)
    }
  }

  /**
   * Analyze error patterns for monitoring
   */
  async analyzeErrorPatterns(
    provider?: OAuthProvider,
    timeWindow: number = 60 * 60 * 1000 // 1 hour
  ): Promise<{
    errorRate: number
    commonErrors: Array<{ type: string; count: number }>
    affectedUsers: number
    recommendations: string[]
  }> {
    try {
      const since = new Date(Date.now() - timeWindow).toISOString()
      
      const { data: errors } = await this.supabase
        .from('auth_audit_logs')
        .select('event_data, user_id')
        .eq('event_type', 'oauth_error')
        .eq('success', false)
        .gte('created_at', since)
        .then((result: any) => ({
          data: result.data?.filter((log: any) => 
            !provider || log.event_data?.provider === provider
          )
        }))

      if (!errors || errors.length === 0) {
        return {
          errorRate: 0,
          commonErrors: [],
          affectedUsers: 0,
          recommendations: []
        }
      }

      const totalAttempts = errors.length
      const errorTypes = errors.reduce((acc: any, error: any) => {
        const type = error.event_data?.error_type || 'UNKNOWN'
        acc[type] = (acc[type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const uniqueUsers = new Set(errors.map((e: any) => e.user_id).filter(Boolean)).size
      const commonErrors = Object.entries(errorTypes)
        .map(([type, count]) => ({ type, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      const recommendations = this.generateRecommendations(commonErrors, provider)

      return {
        errorRate: totalAttempts,
        commonErrors,
        affectedUsers: uniqueUsers,
        recommendations
      }

    } catch (error) {
      console.error('Error analyzing patterns:', error)
      return {
        errorRate: 0,
        commonErrors: [],
        affectedUsers: 0,
        recommendations: ['Unable to analyze error patterns']
      }
    }
  }

  // Private utility methods

  private generateSupportCode(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `OAUTH-${timestamp}-${random}`.toUpperCase()
  }

  private getHttpStatusCode(errorType: OAuthErrorType): number {
    switch (errorType) {
      case 'INVALID_PROVIDER':
      case 'OAUTH_ERROR':
      case 'CSRF_VIOLATION':
      case 'ACCESS_DENIED':
      case 'INVALID_SCOPE':
        return 400
      
      case 'RATE_LIMIT_EXCEEDED':
        return 429
      
      case 'SECURITY_VIOLATION':
        return 403
      
      case 'PROVIDER_NOT_CONFIGURED':
        return 503
      
      case 'TOKEN_EXCHANGE_FAILED':
      case 'USER_INFO_FAILED':
      case 'ACCOUNT_LINKING_FAILED':
      case 'SERVER_ERROR':
      case 'NETWORK_ERROR':
      case 'UNKNOWN_ERROR':
        return 500
      
      default:
        return 500
    }
  }

  private extractIPAddress(request: NextRequest): string {
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    return forwardedFor?.split(',')[0].trim() || realIp || 'unknown'
  }

  private generateRecommendations(
    commonErrors: Array<{ type: string; count: number }>,
    provider?: OAuthProvider
  ): string[] {
    const recommendations: string[] = []

    for (const error of commonErrors) {
      switch (error.type) {
        case 'RATE_LIMIT_EXCEEDED':
          recommendations.push('Consider increasing rate limits or implementing exponential backoff')
          break
        case 'TOKEN_EXCHANGE_FAILED':
          recommendations.push(`Check ${provider} OAuth configuration and network connectivity`)
          break
        case 'USER_INFO_FAILED':
          recommendations.push(`Verify ${provider} API permissions and user info endpoint`)
          break
        case 'SECURITY_VIOLATION':
          recommendations.push('Review security rules and consider adjusting thresholds')
          break
        case 'PROVIDER_NOT_CONFIGURED':
          recommendations.push(`Check ${provider} OAuth client configuration`)
          break
      }
    }

    if (recommendations.length === 0) {
      recommendations.push('Monitor error patterns and user feedback')
    }

    return [...new Set(recommendations)]
  }
}

/**
 * Global error handler instance
 */
export const oauthErrorHandler = new OAuthErrorHandler()

/**
 * Helper function to create standardized OAuth errors
 */
export function createOAuthError(
  type: OAuthErrorType,
  message: string,
  provider?: OAuthProvider,
  details?: any
): OAuthError {
  return oauthErrorHandler.handleSystemError(type, message, provider, details)
}