/**
 * TOTP (Time-based One-Time Password) Implementation
 * RFC 6238 Compliant TOTP Generator and Verifier
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import crypto from 'crypto';

// TOTP Configuration - RFC 6238 compliant
const TOTP_CONFIG = {
  // Time step in seconds (RFC 6238 recommends 30 seconds)
  timeStep: 30,
  
  // Window for time drift tolerance (usually 1-2 steps before and after)
  window: 1,
  
  // Code length (6 digits is standard, 8 for enhanced security)
  codeLength: 6,
  
  // Hash algorithm (SHA-1 is RFC standard, SHA-256/512 for enhanced security)
  algorithm: 'sha1' as const,
  
  // Secret key length in bytes (minimum 20 bytes for SHA-1)
  secretLength: 32,
  
  // Base32 alphabet for encoding
  base32Alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
};

/**
 * Generates a cryptographically secure random secret for TOTP
 * @returns Base32 encoded secret
 */
export function generateTOTPSecret(): string {
  const secretBuffer = crypto.randomBytes(TOTP_CONFIG.secretLength);
  return base32Encode(secretBuffer);
}

/**
 * Generates TOTP code for given secret and time
 * @param secret - Base32 encoded secret
 * @param time - Unix timestamp (defaults to current time)
 * @returns 6-digit TOTP code
 */
export function generateTOTPCode(secret: string, time?: number): string {
  const timeValue = Math.floor((time || Date.now()) / 1000 / TOTP_CONFIG.timeStep);
  const secretBuffer = base32Decode(secret);
  
  // Convert time to 8-byte big-endian buffer
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeUInt32BE(Math.floor(timeValue / 0x100000000), 0);
  timeBuffer.writeUInt32BE(timeValue & 0xffffffff, 4);
  
  // HMAC-SHA1 (or other algorithm) of time with secret
  const hmac = crypto.createHmac(TOTP_CONFIG.algorithm, secretBuffer);
  hmac.update(timeBuffer);
  const digest = hmac.digest();
  
  // Dynamic truncation as per RFC 4226
  const offset = digest[digest.length - 1] & 0x0f;
  const code = (
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  ) % Math.pow(10, TOTP_CONFIG.codeLength);
  
  // Pad with leading zeros
  return code.toString().padStart(TOTP_CONFIG.codeLength, '0');
}

/**
 * Verifies TOTP code against secret with time window tolerance
 * @param secret - Base32 encoded secret
 * @param code - 6-digit code to verify
 * @param time - Unix timestamp (defaults to current time)
 * @returns Verification result with time offset
 */
export function verifyTOTPCode(
  secret: string, 
  code: string, 
  time?: number
): { valid: boolean; timeOffset: number } {
  const currentTime = time || Date.now();
  const cleanCode = code.replace(/\s/g, ''); // Remove whitespace
  
  // Check if code length is valid
  if (cleanCode.length !== TOTP_CONFIG.codeLength) {
    return { valid: false, timeOffset: 0 };
  }
  
  // Check current time window and adjacent windows for clock drift
  for (let i = -TOTP_CONFIG.window; i <= TOTP_CONFIG.window; i++) {
    const testTime = currentTime + (i * TOTP_CONFIG.timeStep * 1000);
    const expectedCode = generateTOTPCode(secret, testTime);
    
    if (constantTimeCompare(cleanCode, expectedCode)) {
      return { valid: true, timeOffset: i };
    }
  }
  
  return { valid: false, timeOffset: 0 };
}

/**
 * Generates QR code data URL for TOTP setup
 * @param secret - Base32 encoded secret
 * @param accountName - User's account identifier (email/username)
 * @param issuer - Service name (The Lawless Directory)
 * @returns otpauth:// URL for QR code generation
 */
export function generateQRCodeURL(
  secret: string, 
  accountName: string, 
  issuer: string = 'The Lawless Directory'
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: TOTP_CONFIG.algorithm.toUpperCase(),
    digits: TOTP_CONFIG.codeLength.toString(),
    period: TOTP_CONFIG.timeStep.toString()
  });
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?${params}`;
}

/**
 * Validates TOTP secret format
 * @param secret - Base32 encoded secret to validate
 * @returns true if valid format
 */
export function isValidTOTPSecret(secret: string): boolean {
  // Check if it's valid Base32
  const base32Regex = /^[A-Z2-7]+=*$/;
  if (!base32Regex.test(secret.toUpperCase())) {
    return false;
  }
  
  // Check minimum length
  const decodedLength = Math.floor((secret.length * 5) / 8);
  return decodedLength >= 10; // Minimum 80 bits as per RFC 4226
}

/**
 * Calculates remaining time until next TOTP code
 * @param time - Current time (defaults to now)
 * @returns Seconds remaining until next code
 */
export function getTimeRemaining(time?: number): number {
  const currentTime = Math.floor((time || Date.now()) / 1000);
  const currentStep = Math.floor(currentTime / TOTP_CONFIG.timeStep);
  const nextStep = (currentStep + 1) * TOTP_CONFIG.timeStep;
  return nextStep - currentTime;
}

/**
 * Base32 encoder
 * @param buffer - Buffer to encode
 * @returns Base32 encoded string
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = TOTP_CONFIG.base32Alphabet;
  let result = '';
  let bits = 0;
  let value = 0;
  
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  
  if (bits > 0) {
    result += alphabet[(value << (5 - bits)) & 31];
  }
  
  // Add padding
  const padLength = Math.ceil(result.length / 8) * 8;
  return result.padEnd(padLength, '=');
}

/**
 * Base32 decoder
 * @param encoded - Base32 encoded string
 * @returns Decoded buffer
 */
function base32Decode(encoded: string): Buffer {
  const alphabet = TOTP_CONFIG.base32Alphabet;
  const clean = encoded.toUpperCase().replace(/=+$/, '');
  
  let bits = 0;
  let value = 0;
  const result: number[] = [];
  
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error('Invalid Base32 character');
    }
    
    value = (value << 5) | index;
    bits += 5;
    
    if (bits >= 8) {
      result.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  
  return Buffer.from(result);
}

/**
 * Constant time string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  
  return result === 0;
}

/**
 * TOTP Configuration and Metadata
 */
export const TOTPConfig = {
  ...TOTP_CONFIG,
  
  /**
   * Recommended settings for different security levels
   */
  securityProfiles: {
    standard: {
      codeLength: 6,
      timeStep: 30,
      window: 1,
      algorithm: 'sha1' as const
    },
    enhanced: {
      codeLength: 8,
      timeStep: 30,
      window: 1,
      algorithm: 'sha256' as const
    },
    high: {
      codeLength: 8,
      timeStep: 15,
      window: 0,
      algorithm: 'sha512' as const
    }
  },
  
  /**
   * Popular TOTP app compatibility
   */
  appCompatibility: {
    'Google Authenticator': { codeLength: 6, timeStep: 30, algorithm: 'sha1' },
    'Authy': { codeLength: 6, timeStep: 30, algorithm: 'sha1' },
    'Microsoft Authenticator': { codeLength: 6, timeStep: 30, algorithm: 'sha1' },
    '1Password': { codeLength: 6, timeStep: 30, algorithm: 'sha1' },
    'Bitwarden': { codeLength: 6, timeStep: 30, algorithm: 'sha1' }
  }
} as const;

/**
 * TOTP Error Types
 */
export class TOTPError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TOTPError';
  }
}

export const TOTPErrors = {
  INVALID_SECRET: 'INVALID_SECRET',
  INVALID_CODE: 'INVALID_CODE',
  EXPIRED_CODE: 'EXPIRED_CODE',
  REPLAY_ATTACK: 'REPLAY_ATTACK',
  RATE_LIMITED: 'RATE_LIMITED'
} as const;