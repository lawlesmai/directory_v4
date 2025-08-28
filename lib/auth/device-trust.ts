/**
 * Device Trust Management and Fingerprinting System
 * Advanced device identification and trust scoring for MFA
 * 
 * The Lawless Directory - Epic 2 Story 2.4
 * Multi-Factor Authentication Infrastructure
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

// Configuration
const DEVICE_TRUST_CONFIG = {
  // Trust scoring thresholds
  trustThresholds: {
    low: 0.3,
    medium: 0.6,
    high: 0.8,
    verified: 0.95
  },
  
  // Trust factors weights
  trustWeights: {
    fingerprint: 0.25,
    behavioral: 0.20,
    geographic: 0.15,
    network: 0.15,
    temporal: 0.10,
    successful_auth: 0.10,
    user_designation: 0.05
  },
  
  // Behavior analysis
  behaviorWindow: {
    typingPatternSamples: 10,
    mouseMovementSamples: 5,
    interactionPatternDays: 7
  },
  
  // Geographic variance thresholds
  geoThresholds: {
    sameCity: 50, // km
    sameRegion: 500, // km
    sameCountry: 2000, // km
    suspicious: 5000 // km
  },
  
  // Time pattern analysis
  timePatterns: {
    normalVarianceHours: 4,
    suspiciousVarianceHours: 12,
    differentTimezone: true
  },
  
  // Device lifecycle
  deviceLifecycle: {
    maxTrustedDevices: 10,
    trustDecayDays: 30,
    inactiveThresholdDays: 90,
    autoCleanupDays: 365
  },
  
  // Risk factors
  riskFactors: {
    vpnUsage: 0.3,
    torUsage: 0.8,
    datacenterIP: 0.4,
    newLocation: 0.5,
    newNetwork: 0.3,
    unusualTime: 0.2,
    rapidLocationChange: 0.7
  }
} as const;

// Initialize Supabase client
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Device Fingerprint Interface
 */
interface DeviceFingerprint {
  canvas?: string;
  webgl?: string;
  audio?: string;
  fonts?: string[];
  screen: {
    width: number;
    height: number;
    colorDepth: number;
    pixelRatio: number;
  };
  timezone: {
    offset: number;
    name?: string;
  };
  language: string[];
  platform: string;
  userAgent: string;
  plugins?: string[];
  hardware?: {
    cores: number;
    memory?: number;
    touch: boolean;
  };
}

/**
 * Behavioral Pattern Interface
 */
interface BehavioralPattern {
  typing?: {
    avgSpeed: number;
    variance: number;
    rhythm: number[];
  };
  mouse?: {
    avgSpeed: number;
    acceleration: number;
    clickPattern: number[];
  };
  interaction?: {
    sessionDuration: number;
    clickRate: number;
    scrollBehavior: number[];
  };
}

/**
 * Geographic Context Interface
 */
interface GeographicContext {
  latitude?: number;
  longitude?: number;
  country?: string;
  region?: string;
  city?: string;
  postalCode?: string;
  timezone?: string;
  accuracy?: number;
}

/**
 * Network Context Interface
 */
interface NetworkContext {
  ipAddress: string;
  isp?: string;
  asn?: number;
  isVPN?: boolean;
  isTor?: boolean;
  isDatacenter?: boolean;
  isResidential?: boolean;
}

/**
 * Device Trust Score Result Interface
 */
interface DeviceTrustResult {
  deviceId: string;
  trustScore: number;
  trustLevel: 'low' | 'medium' | 'high' | 'verified';
  riskFactors: string[];
  requiresMFA: boolean;
  canRemember: boolean;
  analysis: {
    fingerprint: number;
    behavioral: number;
    geographic: number;
    network: number;
    temporal: number;
    successRate: number;
  };
}

/**
 * Device Registration Result Interface
 */
interface DeviceRegistrationResult {
  success: boolean;
  deviceId: string;
  trustScore?: number;
  requiresVerification?: boolean;
  error?: string;
}

/**
 * Device Trust Management Service
 */
export class DeviceTrustService {
  /**
   * Generates device fingerprint hash
   */
  static generateDeviceId(fingerprint: DeviceFingerprint): string {
    const fingerprintString = JSON.stringify({
      canvas: fingerprint.canvas,
      webgl: fingerprint.webgl,
      audio: fingerprint.audio,
      screen: fingerprint.screen,
      timezone: fingerprint.timezone,
      platform: fingerprint.platform,
      userAgent: fingerprint.userAgent.substring(0, 100), // Truncate for stability
      language: fingerprint.language.join(','),
      hardware: fingerprint.hardware
    });
    
    return crypto
      .createHash('sha256')
      .update(fingerprintString)
      .digest('hex')
      .substring(0, 32); // 32 character device ID
  }
  
  /**
   * Registers or updates device trust information
   */
  static async registerDevice(
    userId: string,
    fingerprint: DeviceFingerprint,
    context: {
      ipAddress: string;
      geographic?: GeographicContext;
      network?: NetworkContext;
      behavioral?: BehavioralPattern;
      userAgent: string;
    }
  ): Promise<DeviceRegistrationResult> {
    try {
      const deviceId = this.generateDeviceId(fingerprint);
      const fingerprintHash = this.hashFingerprint(fingerprint);
      
      // Check if device already exists
      const { data: existingDevice } = await supabase
        .from('device_trust_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .single();
      
      const isNewDevice = !existingDevice;
      
      // Calculate trust score
      const trustResult = await this.calculateTrustScore(
        userId,
        deviceId,
        fingerprint,
        context,
        existingDevice
      );
      
      // Prepare device data
      const deviceData = {
        user_id: userId,
        device_id: deviceId,
        canvas_fingerprint: fingerprint.canvas,
        webgl_fingerprint: fingerprint.webgl,
        audio_fingerprint: fingerprint.audio,
        font_fingerprint: fingerprint.fonts?.join(','),
        screen_resolution: `${fingerprint.screen.width}x${fingerprint.screen.height}`,
        timezone_offset: fingerprint.timezone.offset,
        language_preference: fingerprint.language[0],
        platform_details: {
          platform: fingerprint.platform,
          userAgent: context.userAgent,
          hardware: fingerprint.hardware
        },
        base_trust_score: trustResult.trustScore,
        final_trust_score: trustResult.trustScore,
        risk_flags: trustResult.riskFactors,
        risk_score: this.calculateRiskScore(trustResult.riskFactors),
        updated_at: new Date().toISOString()
      };
      
      if (isNewDevice) {
        // Insert new device
        const { error: insertError } = await supabase
          .from('device_trust_scores')
          .insert([{
            ...deviceData,
            created_at: new Date().toISOString()
          }]);
        
        if (insertError) {
          throw new Error(`Failed to register device: ${insertError.message}`);
        }
        
        // Log new device registration
        await this.logDeviceEvent({
          userId,
          deviceId,
          eventType: 'device_registered',
          trustScore: trustResult.trustScore,
          ipAddress: context.ipAddress
        });
        
      } else {
        // Update existing device
        const { error: updateError } = await supabase
          .from('device_trust_scores')
          .update(deviceData)
          .eq('user_id', userId)
          .eq('device_id', deviceId);
        
        if (updateError) {
          throw new Error(`Failed to update device: ${updateError.message}`);
        }
      }
      
      // Update trusted devices table if trust level is sufficient
      if (trustResult.trustScore >= DEVICE_TRUST_CONFIG.trustThresholds.medium) {
        await this.updateTrustedDevice(userId, deviceId, trustResult.trustScore);
      }
      
      return {
        success: true,
        deviceId,
        trustScore: trustResult.trustScore,
        requiresVerification: trustResult.requiresMFA
      };
      
    } catch (error) {
      console.error('Device registration error:', error);
      return {
        success: false,
        deviceId: '',
        error: error instanceof Error ? error.message : 'Registration failed'
      };
    }
  }
  
  /**
   * Calculates comprehensive device trust score
   */
  static async calculateTrustScore(
    userId: string,
    deviceId: string,
    fingerprint: DeviceFingerprint,
    context: {
      ipAddress: string;
      geographic?: GeographicContext;
      network?: NetworkContext;
      behavioral?: BehavioralPattern;
    },
    existingDevice?: any
  ): Promise<DeviceTrustResult> {
    const analysis = {
      fingerprint: 0,
      behavioral: 0,
      geographic: 0,
      network: 0,
      temporal: 0,
      successRate: 0
    };
    
    const riskFactors: string[] = [];
    
    // 1. Fingerprint Analysis
    analysis.fingerprint = await this.analyzeFingerprintStability(
      userId,
      deviceId,
      fingerprint,
      existingDevice
    );
    
    // 2. Behavioral Analysis
    if (context.behavioral) {
      analysis.behavioral = await this.analyzeBehavioralPattern(
        userId,
        deviceId,
        context.behavioral
      );
    } else {
      analysis.behavioral = 0.5; // Neutral when no data
    }
    
    // 3. Geographic Analysis
    if (context.geographic) {
      const geoResult = await this.analyzeGeographicConsistency(
        userId,
        deviceId,
        context.geographic
      );
      analysis.geographic = geoResult.score;
      riskFactors.push(...geoResult.riskFactors);
    } else {
      analysis.geographic = 0.5;
    }
    
    // 4. Network Analysis
    if (context.network) {
      const networkResult = this.analyzeNetworkContext(context.network);
      analysis.network = networkResult.score;
      riskFactors.push(...networkResult.riskFactors);
    } else {
      analysis.network = 0.5;
    }
    
    // 5. Temporal Analysis
    const temporalResult = await this.analyzeTemporalPattern(userId, deviceId);
    analysis.temporal = temporalResult.score;
    riskFactors.push(...temporalResult.riskFactors);
    
    // 6. Success Rate Analysis
    analysis.successRate = await this.analyzeAuthenticationSuccessRate(userId, deviceId);
    
    // Calculate weighted trust score
    const weights = DEVICE_TRUST_CONFIG.trustWeights;
    const trustScore = Math.min(1.0, Math.max(0.0,
      analysis.fingerprint * weights.fingerprint +
      analysis.behavioral * weights.behavioral +
      analysis.geographic * weights.geographic +
      analysis.network * weights.network +
      analysis.temporal * weights.temporal +
      analysis.successRate * weights.successful_auth
    ));
    
    // Determine trust level
    const trustLevel = this.getTrustLevel(trustScore);
    
    return {
      deviceId,
      trustScore,
      trustLevel,
      riskFactors: [...new Set(riskFactors)], // Remove duplicates
      requiresMFA: trustScore < DEVICE_TRUST_CONFIG.trustThresholds.high,
      canRemember: trustScore >= DEVICE_TRUST_CONFIG.trustThresholds.medium,
      analysis
    };
  }
  
  /**
   * Analyzes fingerprint stability
   */
  private static async analyzeFingerprintStability(
    userId: string,
    deviceId: string,
    current: DeviceFingerprint,
    existing?: any
  ): Promise<number> {
    if (!existing) {
      return 0.5; // Neutral for new devices
    }
    
    let stability = 1.0;
    let matchCount = 0;
    let totalChecks = 0;
    
    // Check core fingerprint components
    const checks = [
      { current: current.canvas, existing: existing.canvas_fingerprint, weight: 0.3 },
      { current: current.webgl, existing: existing.webgl_fingerprint, weight: 0.3 },
      { current: current.audio, existing: existing.audio_fingerprint, weight: 0.2 },
      { current: current.screen, existing: existing.screen_resolution, weight: 0.2 }
    ];
    
    for (const check of checks) {
      totalChecks++;
      if (check.current && check.existing) {
        const matches = this.compareFingerprints(check.current, check.existing);
        if (matches) {
          matchCount += check.weight;
        }
      } else {
        matchCount += check.weight * 0.5; // Partial credit for missing data
      }
    }
    
    return totalChecks > 0 ? matchCount / totalChecks : 0.5;
  }
  
  /**
   * Analyzes behavioral patterns
   */
  private static async analyzeBehavioralPattern(
    userId: string,
    deviceId: string,
    current: BehavioralPattern
  ): Promise<number> {
    // Get historical behavioral data
    const { data: historical } = await supabase
      .from('device_trust_scores')
      .select('behavioral_trust_score, typing_pattern, mouse_movement_pattern')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .single();
    
    if (!historical || !historical.typing_pattern) {
      return 0.6; // Slightly positive for new behavioral data
    }
    
    let behaviorScore = 0.8; // Start optimistic
    
    // Analyze typing patterns if available
    if (current.typing && historical.typing_pattern) {
      const typingConsistency = this.compareTypingPatterns(
        current.typing,
        historical.typing_pattern
      );
      behaviorScore *= typingConsistency;
    }
    
    // Analyze mouse patterns if available
    if (current.mouse && historical.mouse_movement_pattern) {
      const mouseConsistency = this.compareMousePatterns(
        current.mouse,
        historical.mouse_movement_pattern
      );
      behaviorScore *= mouseConsistency;
    }
    
    return Math.max(0.1, Math.min(1.0, behaviorScore));
  }
  
  /**
   * Analyzes geographic consistency
   */
  private static async analyzeGeographicConsistency(
    userId: string,
    deviceId: string,
    current: GeographicContext
  ): Promise<{ score: number; riskFactors: string[] }> {
    const riskFactors: string[] = [];
    let geoScore = 0.8; // Start with high trust
    
    if (!current.latitude || !current.longitude) {
      return { score: 0.5, riskFactors: ['no_location_data'] };
    }
    
    // Get recent locations for this device
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const { data: recentSessions } = await supabase
      .from('user_sessions')
      .select('latitude, longitude, country_code, created_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .gte('created_at', oneMonthAgo.toISOString())
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (recentSessions && recentSessions.length > 0) {
      const distances = recentSessions.map((session: any) =>
        this.calculateDistance(
          current.latitude!,
          current.longitude!,
          session.latitude as number,
          session.longitude as number
        )
      );
      
      const avgDistance = distances.reduce((a: number, b: number) => a + b, 0) / distances.length;
      const maxDistance = Math.max(...distances);
      
      // Check for suspicious location changes
      if (maxDistance > DEVICE_TRUST_CONFIG.geoThresholds.suspicious) {
        riskFactors.push('rapid_location_change');
        geoScore *= 0.3;
      } else if (avgDistance > DEVICE_TRUST_CONFIG.geoThresholds.sameCountry) {
        riskFactors.push('inconsistent_location');
        geoScore *= 0.6;
      } else if (avgDistance > DEVICE_TRUST_CONFIG.geoThresholds.sameRegion) {
        riskFactors.push('new_region');
        geoScore *= 0.8;
      }
      
      // Check country consistency
      const recentCountries = [...new Set(recentSessions.map((s: any) => s.country_code))];
      if (recentCountries.length > 3) {
        riskFactors.push('multiple_countries');
        geoScore *= 0.5;
      }
    }
    
    return { score: geoScore, riskFactors };
  }
  
  /**
   * Analyzes network context
   */
  private static analyzeNetworkContext(
    network: NetworkContext
  ): { score: number; riskFactors: string[] } {
    const riskFactors: string[] = [];
    let networkScore = 0.8;
    
    if (network.isVPN) {
      riskFactors.push('vpn_usage');
      networkScore *= (1 - DEVICE_TRUST_CONFIG.riskFactors.vpnUsage);
    }
    
    if (network.isTor) {
      riskFactors.push('tor_usage');
      networkScore *= (1 - DEVICE_TRUST_CONFIG.riskFactors.torUsage);
    }
    
    if (network.isDatacenter) {
      riskFactors.push('datacenter_ip');
      networkScore *= (1 - DEVICE_TRUST_CONFIG.riskFactors.datacenterIP);
    }
    
    return { score: networkScore, riskFactors };
  }
  
  /**
   * Analyzes temporal usage patterns
   */
  private static async analyzeTemporalPattern(
    userId: string,
    deviceId: string
  ): Promise<{ score: number; riskFactors: string[] }> {
    const riskFactors: string[] = [];
    let temporalScore = 0.8;
    
    // Get recent session times
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const { data: recentSessions } = await supabase
      .from('user_sessions')
      .select('created_at')
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .gte('created_at', oneWeekAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (recentSessions && recentSessions.length > 3) {
      const hours = recentSessions.map((session: any) => 
        new Date(session.created_at).getHours()
      );
      
      const avgHour = hours.reduce((a: number, b: number) => a + b, 0) / hours.length;
      const variance = hours.reduce((sum: number, hour: number) => 
        sum + Math.pow(hour - avgHour, 2), 0
      ) / hours.length;
      
      const currentHour = new Date().getHours();
      const hourDifference = Math.abs(currentHour - avgHour);
      
      if (hourDifference > DEVICE_TRUST_CONFIG.timePatterns.suspiciousVarianceHours) {
        riskFactors.push('unusual_time');
        temporalScore *= (1 - DEVICE_TRUST_CONFIG.riskFactors.unusualTime);
      } else if (hourDifference > DEVICE_TRUST_CONFIG.timePatterns.normalVarianceHours) {
        temporalScore *= 0.9;
      }
    }
    
    return { score: temporalScore, riskFactors };
  }
  
  /**
   * Analyzes authentication success rate
   */
  private static async analyzeAuthenticationSuccessRate(
    userId: string,
    deviceId: string
  ): Promise<number> {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const { count: totalAttempts } = await supabase
      .from('mfa_verification_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .gte('created_at', oneMonthAgo.toISOString());
    
    const { count: successfulAttempts } = await supabase
      .from('mfa_verification_attempts')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .eq('device_id', deviceId)
      .eq('is_valid', true)
      .gte('created_at', oneMonthAgo.toISOString());
    
    if (!totalAttempts || totalAttempts === 0) {
      return 0.5; // Neutral for devices with no history
    }
    
    const successRate = (successfulAttempts || 0) / totalAttempts;
    return Math.max(0.1, Math.min(1.0, successRate));
  }
  
  /**
   * Updates trusted device information
   */
  private static async updateTrustedDevice(
    userId: string,
    deviceId: string,
    trustScore: number
  ): Promise<void> {
    const trustLevel = this.getTrustLevel(trustScore);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + DEVICE_TRUST_CONFIG.deviceLifecycle.trustDecayDays);
    
    await supabase
      .from('trusted_devices')
      .upsert({
        user_id: userId,
        device_id: deviceId,
        trust_level: trustLevel,
        last_verified_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true
      });
  }
  
  /**
   * Utility methods
   */
  
  private static hashFingerprint(fingerprint: DeviceFingerprint): string {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(fingerprint))
      .digest('hex');
  }
  
  private static compareFingerprints(current: any, existing: any): boolean {
    if (typeof current === 'string' && typeof existing === 'string') {
      return current === existing;
    }
    return JSON.stringify(current) === JSON.stringify(existing);
  }
  
  private static compareTypingPatterns(current: any, historical: any): number {
    // Simplified comparison - in production would use more sophisticated ML
    return 0.8;
  }
  
  private static compareMousePatterns(current: any, historical: any): number {
    // Simplified comparison - in production would use more sophisticated ML
    return 0.8;
  }
  
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
  
  private static deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }
  
  public static getTrustLevel(score: number): 'low' | 'medium' | 'high' | 'verified' {
    const thresholds = DEVICE_TRUST_CONFIG.trustThresholds;
    if (score >= thresholds.verified) return 'verified';
    if (score >= thresholds.high) return 'high';
    if (score >= thresholds.medium) return 'medium';
    return 'low';
  }
  
  private static calculateRiskScore(riskFactors: string[]): number {
    const riskValues = DEVICE_TRUST_CONFIG.riskFactors;
    return riskFactors.reduce((total, factor) => {
      return total + (riskValues[factor as keyof typeof riskValues] || 0);
    }, 0);
  }
  
  private static async logDeviceEvent(params: {
    userId: string;
    deviceId: string;
    eventType: string;
    trustScore: number;
    ipAddress: string;
  }): Promise<void> {
    await supabase
      .from('auth_audit_logs')
      .insert([{
        event_type: `device_${params.eventType}`,
        event_category: 'device_trust',
        user_id: params.userId,
        success: true,
        ip_address: params.ipAddress,
        event_data: {
          device_id: params.deviceId,
          trust_score: params.trustScore
        }
      }]);
  }
}

/**
 * Device Trust Utilities
 */
export class DeviceTrustUtils {
  /**
   * Gets device trust status for user
   */
  static async getDeviceTrustStatus(
    userId: string,
    deviceId: string
  ): Promise<{
    isTrusted: boolean;
    trustLevel: string;
    trustScore: number;
    requiresMFA: boolean;
    riskFactors: string[];
    lastVerified?: Date;
  }> {
    try {
      const { data: device } = await supabase
        .from('device_trust_scores')
        .select('*')
        .eq('user_id', userId)
        .eq('device_id', deviceId)
        .single();
      
      if (!device) {
        return {
          isTrusted: false,
          trustLevel: 'unknown',
          trustScore: 0,
          requiresMFA: true,
          riskFactors: ['unregistered_device']
        };
      }
      
      const trustScore = device.final_trust_score || 0;
      const trustLevel = DeviceTrustService.getTrustLevel(trustScore);
      
      return {
        isTrusted: trustScore >= DEVICE_TRUST_CONFIG.trustThresholds.medium,
        trustLevel,
        trustScore,
        requiresMFA: trustScore < DEVICE_TRUST_CONFIG.trustThresholds.high,
        riskFactors: device.risk_flags || [],
        lastVerified: device.updated_at ? new Date(device.updated_at) : undefined
      };
      
    } catch (error) {
      console.error('Error getting device trust status:', error);
      return {
        isTrusted: false,
        trustLevel: 'error',
        trustScore: 0,
        requiresMFA: true,
        riskFactors: ['system_error']
      };
    }
  }
  
  /**
   * Lists trusted devices for user
   */
  static async getTrustedDevices(userId: string): Promise<Array<{
    deviceId: string;
    deviceName?: string;
    trustLevel: string;
    lastUsed?: Date;
    location?: string;
    canRevoke: boolean;
  }>> {
    try {
      const { data: devices } = await supabase
        .from('trusted_devices')
        .select(`
          device_id,
          device_name,
          trust_level,
          last_used_at,
          is_active
        `)
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false });
      
      return devices?.map((device: any) => ({
        deviceId: device.device_id,
        deviceName: device.device_name || 'Unknown Device',
        trustLevel: device.trust_level,
        lastUsed: device.last_used_at ? new Date(device.last_used_at) : undefined,
        canRevoke: true
      })) || [];
      
    } catch (error) {
      console.error('Error getting trusted devices:', error);
      return [];
    }
  }
  
  /**
   * Revokes trust for a device
   */
  static async revokeDeviceTrust(
    userId: string,
    deviceId: string,
    reason: string = 'user_revoked'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await supabase
        .from('trusted_devices')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revoke_reason: reason
        })
        .eq('user_id', userId)
        .eq('device_id', deviceId);
      
      // Log revocation event
      await supabase
        .from('auth_audit_logs')
        .insert([{
          event_type: 'device_trust_revoked',
          event_category: 'device_trust',
          user_id: userId,
          success: true,
          event_data: {
            device_id: deviceId,
            reason
          }
        }]);
      
      return { success: true };
      
    } catch (error) {
      console.error('Error revoking device trust:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Revocation failed'
      };
    }
  }
}

// Export types and configuration
export type {
  DeviceFingerprint,
  BehavioralPattern,
  GeographicContext,
  NetworkContext,
  DeviceTrustResult,
  DeviceRegistrationResult
};

export { DEVICE_TRUST_CONFIG };