/**
 * Token Encryption Module - Critical Security Fix
 * 
 * Implements proper AES-256-GCM encryption for OAuth tokens
 * Fixes CVSS 7.5 vulnerability: Insecure Token Storage
 */

import crypto from 'crypto'

interface EncryptedToken {
  encrypted: string
  iv: string
  tag: string
  algorithm: string
}

// Use secure key derivation from environment
const ENCRYPTION_KEY = (() => {
  const key = process.env.TOKEN_ENCRYPTION_KEY
  if (!key) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required')
  }
  if (key.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 characters (32 bytes hex)')
  }
  return Buffer.from(key, 'hex')
})()

const ALGORITHM = 'aes-256-gcm'

/**
 * Encrypt a token using AES-256-GCM with random IV
 */
export async function encryptToken(token: string): Promise<string> {
  try {
    // Generate random initialization vector
    const iv = crypto.randomBytes(16)
    
    // Create cipher with IV using proper API
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
    cipher.setAAD(Buffer.from('oauth-token', 'utf8'))
    
    // Encrypt the token
    let encrypted = cipher.update(token, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    // Get authentication tag
    const tag = cipher.getAuthTag()
    
    // Return encrypted data with metadata
    const result: EncryptedToken = {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: ALGORITHM
    }
    
    return JSON.stringify(result)
  } catch (error) {
    console.error('Token encryption failed:', error)
    throw new Error('Failed to encrypt token')
  }
}

/**
 * Decrypt a token using AES-256-GCM
 */
export async function decryptToken(encryptedData: string): Promise<string> {
  try {
    const parsed: EncryptedToken = JSON.parse(encryptedData)
    
    // Validate structure
    if (!parsed.encrypted || !parsed.iv || !parsed.tag || parsed.algorithm !== ALGORITHM) {
      throw new Error('Invalid encrypted token format')
    }
    
    // Create decipher with IV using proper API
    const iv = Buffer.from(parsed.iv, 'hex')
    const decipher = crypto.createDecipheriv(parsed.algorithm, ENCRYPTION_KEY, iv)
    decipher.setAuthTag(Buffer.from(parsed.tag, 'hex'))
    decipher.setAAD(Buffer.from('oauth-token', 'utf8'))
    
    // Decrypt the token
    let decrypted = decipher.update(parsed.encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  } catch (error) {
    console.error('Token decryption failed:', error)
    throw new Error('Failed to decrypt token')
  }
}

/**
 * Securely hash tokens for comparison without storing plaintext
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Generate cryptographically secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Validate token encryption key format
 */
export function validateEncryptionKey(key: string): boolean {
  return typeof key === 'string' && key.length === 64 && /^[0-9a-fA-F]{64}$/.test(key)
}

/**
 * Generate a new encryption key (for initial setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex')
}