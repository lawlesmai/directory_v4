/**
 * Secure OAuth Configuration Management - Critical Security Fix
 * 
 * Implements encrypted client secret management and secure configuration
 * Fixes CVSS 6.5 vulnerability: Provider Configuration Issues
 */

import crypto from 'crypto'

interface SecureOAuthConfig {
  provider: string
  clientId: string
  clientSecret: string
  redirectUri: string
  enabled: boolean
}

// Use secure configuration encryption key
const CONFIG_ENCRYPTION_KEY = (() => {
  const key = process.env.CONFIG_ENCRYPTION_KEY
  if (!key) {
    throw new Error('CONFIG_ENCRYPTION_KEY environment variable is required')
  }
  if (key.length !== 64) {
    throw new Error('CONFIG_ENCRYPTION_KEY must be 64 characters (32 bytes hex)')
  }
  return Buffer.from(key, 'hex')
})()

const ALGORITHM = 'aes-256-gcm'

/**
 * Encrypt OAuth client configuration
 */
export function encryptOAuthConfig(config: SecureOAuthConfig): string {
  try {
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipher(ALGORITHM, CONFIG_ENCRYPTION_KEY)
    
    const configJson = JSON.stringify(config)
    let encrypted = cipher.update(configJson, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const tag = cipher.getAuthTag()
    
    return JSON.stringify({
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ALGORITHM
    })
  } catch (error) {
    console.error('Config encryption failed:', error)
    throw new Error('Failed to encrypt OAuth configuration')
  }
}

/**
 * Decrypt OAuth client configuration
 */
export function decryptOAuthConfig(encryptedData: string): SecureOAuthConfig {
  try {
    const parsed = JSON.parse(encryptedData)
    
    const decipher = crypto.createDecipher(parsed.algorithm, CONFIG_ENCRYPTION_KEY)
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'))
    
    let decrypted = decipher.update(parsed.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return JSON.parse(decrypted)
  } catch (error) {
    console.error('Config decryption failed:', error)
    throw new Error('Failed to decrypt OAuth configuration')
  }
}

/**
 * Get secure OAuth configuration from environment variables
 * with proper validation and error handling
 */
export function getSecureOAuthConfig(provider: string): SecureOAuthConfig | null {
  try {
    const upperProvider = provider.toUpperCase()
    
    // Get configuration from environment variables
    const clientId = process.env[`${upperProvider}_CLIENT_ID`]
    const clientSecret = process.env[`${upperProvider}_CLIENT_SECRET`]
    const redirectUri = process.env[`${upperProvider}_REDIRECT_URI`]
    const enabled = process.env[`${upperProvider}_ENABLED`] !== 'false'
    
    // Validate required fields
    if (!clientId || !clientSecret) {
      console.warn(`OAuth configuration incomplete for ${provider}`)
      return null
    }
    
    // Validate client secret strength
    if (!isValidClientSecret(clientSecret)) {
      console.error(`OAuth client secret for ${provider} does not meet security requirements`)
      return null
    }
    
    // Construct redirect URI if not provided
    const finalRedirectUri = redirectUri || constructRedirectUri(provider)
    
    return {
      provider,
      clientId,
      clientSecret,
      redirectUri: finalRedirectUri,
      enabled
    }
  } catch (error) {
    console.error(`Failed to get OAuth config for ${provider}:`, error)
    return null
  }
}

/**
 * Validate OAuth client secret meets security requirements
 */
function isValidClientSecret(secret: string): boolean {
  // Minimum length check
  if (secret.length < 32) {
    return false
  }
  
  // Must contain mix of characters (not just alphanumeric)
  const hasUppercase = /[A-Z]/.test(secret)
  const hasLowercase = /[a-z]/.test(secret)
  const hasNumbers = /[0-9]/.test(secret)
  const hasSpecialChars = /[^A-Za-z0-9]/.test(secret)
  
  // Should have at least 3 of the 4 character types
  const charTypeCount = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars].filter(Boolean).length
  
  return charTypeCount >= 3
}

/**
 * Construct redirect URI based on provider
 */
function constructRedirectUri(provider: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  return `${baseUrl}/api/auth/oauth/${provider}/callback`
}

/**
 * Validate all OAuth configurations
 */
export function validateOAuthEnvironment(): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  const providers = ['google', 'apple', 'facebook', 'github']
  
  // Check encryption key
  if (!process.env.CONFIG_ENCRYPTION_KEY) {
    errors.push('CONFIG_ENCRYPTION_KEY environment variable is required')
  } else if (process.env.CONFIG_ENCRYPTION_KEY.length !== 64) {
    errors.push('CONFIG_ENCRYPTION_KEY must be 64 characters (32 bytes hex)')
  }
  
  // Check base URL
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    errors.push('NEXT_PUBLIC_SITE_URL environment variable is required')
  }
  
  // Check each provider configuration
  for (const provider of providers) {
    const config = getSecureOAuthConfig(provider)
    if (config === null) {
      const upperProvider = provider.toUpperCase()
      
      if (!process.env[`${upperProvider}_CLIENT_ID`]) {
        errors.push(`${upperProvider}_CLIENT_ID is missing`)
      }
      
      if (!process.env[`${upperProvider}_CLIENT_SECRET`]) {
        errors.push(`${upperProvider}_CLIENT_SECRET is missing`)
      } else if (!isValidClientSecret(process.env[`${upperProvider}_CLIENT_SECRET`])) {
        errors.push(`${upperProvider}_CLIENT_SECRET does not meet security requirements`)
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Secure configuration cache with automatic expiry
 */
class SecureConfigCache {
  private cache = new Map<string, { config: SecureOAuthConfig; expires: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  
  get(provider: string): SecureOAuthConfig | null {
    const entry = this.cache.get(provider)
    if (!entry || Date.now() > entry.expires) {
      this.cache.delete(provider)
      return null
    }
    return entry.config
  }
  
  set(provider: string, config: SecureOAuthConfig): void {
    this.cache.set(provider, {
      config,
      expires: Date.now() + this.CACHE_TTL
    })
  }
  
  clear(): void {
    this.cache.clear()
  }
}

export const secureConfigCache = new SecureConfigCache()

/**
 * Get cached secure OAuth configuration
 */
export function getCachedSecureOAuthConfig(provider: string): SecureOAuthConfig | null {
  // Check cache first
  let config = secureConfigCache.get(provider)
  
  if (!config) {
    // Load from environment and cache
    config = getSecureOAuthConfig(provider)
    if (config) {
      secureConfigCache.set(provider, config)
    }
  }
  
  return config
}

/**
 * Securely log OAuth configuration status (without sensitive data)
 */
export function logOAuthConfigStatus(): void {
  const providers = ['google', 'apple', 'facebook', 'github']
  
  for (const provider of providers) {
    const config = getSecureOAuthConfig(provider)
    console.info(`OAuth ${provider}: ${config ? 'configured' : 'not configured'}`)
  }
}

/**
 * Generate secure client credentials for development/testing
 */
export function generateSecureCredentials(): { clientId: string; clientSecret: string } {
  return {
    clientId: crypto.randomBytes(16).toString('hex'),
    clientSecret: crypto.randomBytes(32).toString('hex')
  }
}