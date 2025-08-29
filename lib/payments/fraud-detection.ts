/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Fraud Detection Engine - ML-based real-time transaction risk scoring
 * 
 * Provides real-time fraud detection using behavioral analysis, risk scoring,
 * geographic analysis, device fingerprinting, and velocity checks.
 */

import { createClient } from '@/lib/supabase/server';
import { SecuritySeverity } from './security-framework';
import crypto from 'crypto';

// =============================================
// TYPES AND INTERFACES
// =============================================

export interface TransactionContext {
  transactionId: string;
  userId: string;
  customerId?: string;
  amount: number;
  currency: string;
  paymentMethodId: string;
  merchantId?: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  billingAddress?: Address;
  shippingAddress?: Address;
  metadata?: Record<string, any>;
}

export interface FraudRiskScore {
  transactionId: string;
  overallScore: number; // 0-100 (0 = no risk, 100 = high risk)
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  recommendations: FraudRecommendation[];
  decision: FraudDecision;
  confidence: number; // 0-1
  timestamp: Date;
}

export interface RiskFactor {
  type: RiskFactorType;
  score: number; // 0-100
  weight: number; // 0-1
  description: string;
  evidence: any;
  severity: SecuritySeverity;
}

export interface DeviceFingerprint {
  id: string;
  userId?: string;
  browserInfo: BrowserInfo;
  screenInfo: ScreenInfo;
  networkInfo: NetworkInfo;
  behaviorPattern: BehaviorPattern;
  firstSeen: Date;
  lastSeen: Date;
  trustScore: number; // 0-1
  riskIndicators: string[];
}

export interface BehaviorPattern {
  typingPattern?: TypingMetrics;
  mousePattern?: MouseMetrics;
  navigationPattern?: NavigationMetrics;
  sessionDuration: number;
  clickFrequency: number;
  scrollPattern?: ScrollMetrics;
}

export interface GeographicRisk {
  country: string;
  region: string;
  city: string;
  coordinates?: { lat: number; lon: number };
  riskScore: number; // 0-100
  riskFactors: string[];
  isHighRisk: boolean;
  isBlacklisted: boolean;
  vpnDetected: boolean;
  proxyDetected: boolean;
}

export interface VelocityCheck {
  userId: string;
  customerId?: string;
  paymentMethodId?: string;
  timeWindow: string; // e.g., '1h', '24h', '7d'
  transactionCount: number;
  totalAmount: number;
  uniqueDevices: number;
  uniqueLocations: number;
  riskScore: number;
  exceeded: boolean;
  thresholds: VelocityThresholds;
}

export interface FraudRule {
  id: string;
  name: string;
  description: string;
  category: FraudRuleCategory;
  conditions: RuleCondition[];
  action: FraudAction;
  priority: number;
  enabled: boolean;
  falsePositiveRate?: number;
  accuracy?: number;
  lastUpdated: Date;
}

// =============================================
// ENUMS
// =============================================

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum RiskFactorType {
  VELOCITY = 'velocity',
  GEOGRAPHIC = 'geographic',
  DEVICE = 'device',
  BEHAVIORAL = 'behavioral',
  PAYMENT_METHOD = 'payment_method',
  AMOUNT = 'amount',
  TIME_PATTERN = 'time_pattern',
  REPUTATION = 'reputation'
}

export enum FraudDecision {
  APPROVE = 'approve',
  REVIEW = 'review',
  DECLINE = 'decline',
  BLOCK = 'block'
}

export enum FraudAction {
  ALLOW = 'allow',
  CHALLENGE = 'challenge',
  REVIEW = 'review',
  DECLINE = 'decline',
  BLOCK_USER = 'block_user',
  BLOCK_DEVICE = 'block_device'
}

export enum FraudRuleCategory {
  VELOCITY = 'velocity',
  GEOGRAPHIC = 'geographic',
  DEVICE = 'device',
  AMOUNT = 'amount',
  BEHAVIORAL = 'behavioral',
  REPUTATION = 'reputation'
}

// =============================================
// MAIN FRAUD DETECTION CLASS
// =============================================

export class FraudDetectionEngine {
  private supabase;
  private fraudRules: Map<string, FraudRule> = new Map();
  private modelWeights: ModelWeights;

  constructor() {
    this.supabase = createClient();
    this.modelWeights = this.loadModelWeights();
    this.initializeFraudRules();
  }

  /**
   * Main fraud detection method - analyzes transaction for fraud risk
   */
  async analyzeTransaction(context: TransactionContext): Promise<FraudRiskScore> {
    const startTime = Date.now();
    
    try {
      const riskFactors: RiskFactor[] = [];

      // 1. Velocity Analysis
      const velocityRisk = await this.analyzeVelocityRisk(context);
      riskFactors.push(...velocityRisk);

      // 2. Geographic Risk Analysis
      const geographicRisk = await this.analyzeGeographicRisk(context);
      riskFactors.push(...geographicRisk);

      // 3. Device Fingerprinting
      const deviceRisk = await this.analyzeDeviceRisk(context);
      riskFactors.push(...deviceRisk);

      // 4. Behavioral Analysis
      const behaviorRisk = await this.analyzeBehaviorRisk(context);
      riskFactors.push(...behaviorRisk);

      // 5. Payment Method Risk
      const paymentMethodRisk = await this.analyzePaymentMethodRisk(context);
      riskFactors.push(...paymentMethodRisk);

      // 6. Amount Risk Analysis
      const amountRisk = await this.analyzeAmountRisk(context);
      riskFactors.push(...amountRisk);

      // 7. Time Pattern Analysis
      const timePatternRisk = await this.analyzeTimePatternRisk(context);
      riskFactors.push(...timePatternRisk);

      // Calculate overall risk score using ML model
      const overallScore = this.calculateMLRiskScore(riskFactors);
      const riskLevel = this.determineRiskLevel(overallScore);
      const decision = this.makeFraudDecision(overallScore, riskFactors);
      const recommendations = this.generateRecommendations(riskFactors, decision);
      const confidence = this.calculateConfidence(riskFactors, overallScore);

      const fraudScore: FraudRiskScore = {
        transactionId: context.transactionId,
        overallScore,
        riskLevel,
        factors: riskFactors,
        recommendations,
        decision,
        confidence,
        timestamp: new Date()
      };

      // Store fraud analysis results
      await this.storeFraudAnalysis(fraudScore, context);

      // Record performance metrics
      await this.recordPerformanceMetric({
        operation: 'fraud_analysis',
        duration: Date.now() - startTime,
        transactionId: context.transactionId,
        riskScore: overallScore,
        factorCount: riskFactors.length
      });

      return fraudScore;
    } catch (error) {
      console.error('Fraud detection error:', error);
      
      // Return safe default in case of error
      return {
        transactionId: context.transactionId,
        overallScore: 50, // Medium risk default
        riskLevel: RiskLevel.MEDIUM,
        factors: [],
        recommendations: [{ action: FraudAction.REVIEW, reason: 'Analysis failed - manual review required' }],
        decision: FraudDecision.REVIEW,
        confidence: 0.1,
        timestamp: new Date()
      };
    }
  }

  /**
   * Device fingerprinting for fraud prevention
   */
  async generateDeviceFingerprint(deviceData: any): Promise<DeviceFingerprint> {
    try {
      const fingerprintId = this.calculateFingerprintId(deviceData);
      
      const fingerprint: DeviceFingerprint = {
        id: fingerprintId,
        browserInfo: {
          userAgent: deviceData.userAgent || '',
          language: deviceData.language || 'en',
          timezone: deviceData.timezone || 'UTC',
          platform: deviceData.platform || 'unknown',
          cookiesEnabled: deviceData.cookiesEnabled || false,
          doNotTrack: deviceData.doNotTrack || false
        },
        screenInfo: {
          width: deviceData.screenWidth || 0,
          height: deviceData.screenHeight || 0,
          colorDepth: deviceData.colorDepth || 0,
          pixelRatio: deviceData.pixelRatio || 1
        },
        networkInfo: {
          connectionType: deviceData.connectionType || 'unknown',
          downlink: deviceData.downlink || 0,
          effectiveType: deviceData.effectiveType || 'unknown'
        },
        behaviorPattern: {
          sessionDuration: 0,
          clickFrequency: 0
        },
        firstSeen: new Date(),
        lastSeen: new Date(),
        trustScore: 0.5, // Default neutral score
        riskIndicators: []
      };

      // Check for existing fingerprint
      const existing = await this.getExistingFingerprint(fingerprintId);
      if (existing) {
        fingerprint.firstSeen = existing.firstSeen;
        fingerprint.trustScore = existing.trustScore;
        fingerprint.riskIndicators = existing.riskIndicators;
      }

      // Update trust score based on behavior
      fingerprint.trustScore = await this.calculateTrustScore(fingerprint);

      // Store fingerprint
      await this.storeDeviceFingerprint(fingerprint);

      return fingerprint;
    } catch (error) {
      throw new Error(`Device fingerprinting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Real-time velocity checking
   */
  async checkVelocity(userId: string, customerId: string, paymentMethodId: string): Promise<VelocityCheck[]> {
    try {
      const checks: VelocityCheck[] = [];
      const timeWindows = ['1h', '24h', '7d', '30d'];
      
      for (const window of timeWindows) {
        const windowMs = this.parseTimeWindow(window);
        const since = new Date(Date.now() - windowMs);
        
        // Query transaction history
        const { data: transactions } = await this.supabase
          .from('payment_transactions')
          .select('amount, created_at, ip_address, device_fingerprint')
          .eq('user_id', userId)
          .gte('created_at', since.toISOString())
          .order('created_at', { ascending: false });

        if (transactions) {
          const uniqueDevices = new Set(transactions.map(t => t.device_fingerprint).filter(Boolean)).size;
          const uniqueLocations = new Set(transactions.map(t => t.ip_address).filter(Boolean)).size;
          const totalAmount = transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
          
          const thresholds = this.getVelocityThresholds(window);
          const riskScore = this.calculateVelocityRiskScore(
            transactions.length,
            totalAmount,
            uniqueDevices,
            uniqueLocations,
            thresholds
          );

          checks.push({
            userId,
            customerId,
            paymentMethodId,
            timeWindow: window,
            transactionCount: transactions.length,
            totalAmount,
            uniqueDevices,
            uniqueLocations,
            riskScore,
            exceeded: riskScore > 70,
            thresholds
          });
        }
      }

      return checks;
    } catch (error) {
      throw new Error(`Velocity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update fraud rules and ML model
   */
  async updateFraudModel(trainingData: FraudTrainingData[]): Promise<void> {
    try {
      // Retrain model weights based on new data
      const newWeights = await this.retrainModel(trainingData);
      this.modelWeights = newWeights;

      // Update fraud rules based on performance
      await this.optimizeFraudRules(trainingData);

      // Store updated model
      await this.storeModelWeights(newWeights);
    } catch (error) {
      throw new Error(`Model update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // =============================================
  // PRIVATE ANALYSIS METHODS
  // =============================================

  private async analyzeVelocityRisk(context: TransactionContext): Promise<RiskFactor[]> {
    const velocityChecks = await this.checkVelocity(
      context.userId,
      context.customerId || '',
      context.paymentMethodId
    );

    return velocityChecks.map(check => ({
      type: RiskFactorType.VELOCITY,
      score: check.riskScore,
      weight: this.modelWeights.velocity,
      description: `${check.transactionCount} transactions in ${check.timeWindow}`,
      evidence: check,
      severity: check.riskScore > 80 ? SecuritySeverity.HIGH : 
               check.riskScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
    }));
  }

  private async analyzeGeographicRisk(context: TransactionContext): Promise<RiskFactor[]> {
    try {
      const geoData = await this.getGeographicData(context.ipAddress);
      const riskScore = this.calculateGeographicRiskScore(geoData, context);
      
      return [{
        type: RiskFactorType.GEOGRAPHIC,
        score: riskScore,
        weight: this.modelWeights.geographic,
        description: `Transaction from ${geoData.country}, ${geoData.city}`,
        evidence: geoData,
        severity: riskScore > 80 ? SecuritySeverity.HIGH : 
                 riskScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
      }];
    } catch (error) {
      return [{
        type: RiskFactorType.GEOGRAPHIC,
        score: 30,
        weight: this.modelWeights.geographic,
        description: 'Geographic analysis failed',
        evidence: { error: error instanceof Error ? error.message : 'Unknown error' },
        severity: SecuritySeverity.MEDIUM
      }];
    }
  }

  private async analyzeDeviceRisk(context: TransactionContext): Promise<RiskFactor[]> {
    if (!context.deviceFingerprint) {
      return [{
        type: RiskFactorType.DEVICE,
        score: 40,
        weight: this.modelWeights.device,
        description: 'No device fingerprint available',
        evidence: {},
        severity: SecuritySeverity.MEDIUM
      }];
    }

    const deviceData = await this.getExistingFingerprint(context.deviceFingerprint);
    if (!deviceData) {
      return [{
        type: RiskFactorType.DEVICE,
        score: 60,
        weight: this.modelWeights.device,
        description: 'Unknown device',
        evidence: { deviceFingerprint: context.deviceFingerprint },
        severity: SecuritySeverity.MEDIUM
      }];
    }

    const riskScore = (1 - deviceData.trustScore) * 100;
    
    return [{
      type: RiskFactorType.DEVICE,
      score: riskScore,
      weight: this.modelWeights.device,
      description: `Device trust score: ${deviceData.trustScore.toFixed(2)}`,
      evidence: deviceData,
      severity: riskScore > 80 ? SecuritySeverity.HIGH : 
               riskScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
    }];
  }

  private async analyzeBehaviorRisk(context: TransactionContext): Promise<RiskFactor[]> {
    // Analyze behavioral patterns (timing, session duration, etc.)
    const behaviorScore = await this.calculateBehaviorRiskScore(context);
    
    return [{
      type: RiskFactorType.BEHAVIORAL,
      score: behaviorScore,
      weight: this.modelWeights.behavioral,
      description: 'Behavioral pattern analysis',
      evidence: { userId: context.userId, timestamp: context.timestamp },
      severity: behaviorScore > 80 ? SecuritySeverity.HIGH : 
               behaviorScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
    }];
  }

  private async analyzePaymentMethodRisk(context: TransactionContext): Promise<RiskFactor[]> {
    // Analyze payment method risk
    const paymentMethodScore = await this.calculatePaymentMethodRiskScore(context);
    
    return [{
      type: RiskFactorType.PAYMENT_METHOD,
      score: paymentMethodScore,
      weight: this.modelWeights.paymentMethod,
      description: 'Payment method risk analysis',
      evidence: { paymentMethodId: context.paymentMethodId },
      severity: paymentMethodScore > 80 ? SecuritySeverity.HIGH : 
               paymentMethodScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
    }];
  }

  private async analyzeAmountRisk(context: TransactionContext): Promise<RiskFactor[]> {
    const amountScore = this.calculateAmountRiskScore(context.amount, context.userId);
    
    return [{
      type: RiskFactorType.AMOUNT,
      score: amountScore,
      weight: this.modelWeights.amount,
      description: `Transaction amount: ${context.currency} ${context.amount}`,
      evidence: { amount: context.amount, currency: context.currency },
      severity: amountScore > 80 ? SecuritySeverity.HIGH : 
               amountScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
    }];
  }

  private async analyzeTimePatternRisk(context: TransactionContext): Promise<RiskFactor[]> {
    const timePatternScore = this.calculateTimePatternRiskScore(context.timestamp, context.userId);
    
    return [{
      type: RiskFactorType.TIME_PATTERN,
      score: timePatternScore,
      weight: this.modelWeights.timePattern,
      description: 'Transaction timing pattern analysis',
      evidence: { timestamp: context.timestamp },
      severity: timePatternScore > 80 ? SecuritySeverity.HIGH : 
               timePatternScore > 60 ? SecuritySeverity.MEDIUM : SecuritySeverity.LOW
    }];
  }

  // =============================================
  // ML MODEL AND SCORING METHODS
  // =============================================

  private calculateMLRiskScore(factors: RiskFactor[]): number {
    if (factors.length === 0) return 50; // Default medium risk

    let weightedSum = 0;
    let totalWeight = 0;

    for (const factor of factors) {
      weightedSum += factor.score * factor.weight;
      totalWeight += factor.weight;
    }

    const baseScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
    
    // Apply neural network-like adjustments
    const adjustedScore = this.applyModelAdjustments(baseScore, factors);
    
    return Math.max(0, Math.min(100, Math.round(adjustedScore)));
  }

  private applyModelAdjustments(baseScore: number, factors: RiskFactor[]): number {
    let adjustedScore = baseScore;

    // High-risk factor amplification
    const highRiskFactors = factors.filter(f => f.severity === SecuritySeverity.HIGH).length;
    if (highRiskFactors > 1) {
      adjustedScore *= 1.2; // Amplify when multiple high-risk factors
    }

    // Low-risk factor dampening
    const lowRiskFactors = factors.filter(f => f.severity === SecuritySeverity.LOW).length;
    if (lowRiskFactors > factors.length * 0.7) {
      adjustedScore *= 0.8; // Reduce when mostly low-risk factors
    }

    return adjustedScore;
  }

  private determineRiskLevel(score: number): RiskLevel {
    if (score >= 80) return RiskLevel.CRITICAL;
    if (score >= 60) return RiskLevel.HIGH;
    if (score >= 30) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private makeFraudDecision(score: number, factors: RiskFactor[]): FraudDecision {
    const criticalFactors = factors.filter(f => f.severity === SecuritySeverity.CRITICAL).length;
    
    if (criticalFactors > 0 || score >= 90) return FraudDecision.BLOCK;
    if (score >= 70) return FraudDecision.DECLINE;
    if (score >= 50) return FraudDecision.REVIEW;
    return FraudDecision.APPROVE;
  }

  private generateRecommendations(factors: RiskFactor[], decision: FraudDecision): FraudRecommendation[] {
    const recommendations: FraudRecommendation[] = [];
    
    // Generate recommendations based on high-risk factors
    const highRiskFactors = factors.filter(f => f.score > 70);
    
    for (const factor of highRiskFactors) {
      switch (factor.type) {
        case RiskFactorType.VELOCITY:
          recommendations.push({
            action: FraudAction.CHALLENGE,
            reason: 'High velocity detected - require additional authentication'
          });
          break;
        case RiskFactorType.GEOGRAPHIC:
          recommendations.push({
            action: FraudAction.REVIEW,
            reason: 'Unusual geographic location - manual review recommended'
          });
          break;
        case RiskFactorType.DEVICE:
          recommendations.push({
            action: FraudAction.CHALLENGE,
            reason: 'Unknown or suspicious device - require device verification'
          });
          break;
      }
    }
    
    return recommendations;
  }

  private calculateConfidence(factors: RiskFactor[], score: number): number {
    // Confidence based on number of factors and their consistency
    const factorCount = factors.length;
    const scoreVariance = this.calculateScoreVariance(factors);
    
    let confidence = Math.min(0.9, factorCount * 0.15); // More factors = higher confidence
    confidence *= (1 - scoreVariance / 100); // Lower variance = higher confidence
    
    return Math.max(0.1, Math.min(1, confidence));
  }

  // =============================================
  // HELPER METHODS
  // =============================================

  private calculateFingerprintId(deviceData: any): string {
    const fingerprintString = JSON.stringify({
      userAgent: deviceData.userAgent,
      screenWidth: deviceData.screenWidth,
      screenHeight: deviceData.screenHeight,
      timezone: deviceData.timezone,
      language: deviceData.language,
      platform: deviceData.platform
    });
    
    return crypto.createHash('sha256').update(fingerprintString).digest('hex');
  }

  private async getExistingFingerprint(fingerprintId: string): Promise<DeviceFingerprint | null> {
    try {
      const { data } = await this.supabase
        .from('device_fingerprints')
        .select('*')
        .eq('id', fingerprintId)
        .single();
      
      return data;
    } catch {
      return null;
    }
  }

  private async calculateTrustScore(fingerprint: DeviceFingerprint): Promise<number> {
    // Calculate trust score based on device history and behavior
    let trustScore = 0.5; // Start neutral
    
    const daysSinceFirstSeen = Math.max(1, (Date.now() - fingerprint.firstSeen.getTime()) / (24 * 60 * 60 * 1000));
    trustScore += Math.min(0.3, daysSinceFirstSeen * 0.01); // Age bonus
    
    if (fingerprint.riskIndicators.length === 0) {
      trustScore += 0.2; // No risk indicators bonus
    } else {
      trustScore -= fingerprint.riskIndicators.length * 0.1; // Risk penalty
    }
    
    return Math.max(0, Math.min(1, trustScore));
  }

  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)([hmwd])$/);
    if (!match) return 60 * 60 * 1000; // Default to 1 hour
    
    const [, amount, unit] = match;
    const num = parseInt(amount);
    
    switch (unit) {
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      case 'w': return num * 7 * 24 * 60 * 60 * 1000;
      case 'm': return num * 30 * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  private getVelocityThresholds(window: string): VelocityThresholds {
    const thresholds: Record<string, VelocityThresholds> = {
      '1h': { transactions: 5, amount: 100000, devices: 2, locations: 2 }, // $1,000
      '24h': { transactions: 20, amount: 500000, devices: 3, locations: 3 }, // $5,000
      '7d': { transactions: 100, amount: 2000000, devices: 5, locations: 5 }, // $20,000
      '30d': { transactions: 500, amount: 10000000, devices: 10, locations: 10 } // $100,000
    };
    
    return thresholds[window] || thresholds['1h'];
  }

  private calculateVelocityRiskScore(
    transactions: number,
    amount: number,
    devices: number,
    locations: number,
    thresholds: VelocityThresholds
  ): number {
    let score = 0;
    
    score += Math.min(50, (transactions / thresholds.transactions) * 25);
    score += Math.min(50, (amount / thresholds.amount) * 25);
    score += Math.min(25, (devices / thresholds.devices) * 25);
    score += Math.min(25, (locations / thresholds.locations) * 25);
    
    return Math.min(100, score);
  }

  private loadModelWeights(): ModelWeights {
    return {
      velocity: 0.25,
      geographic: 0.20,
      device: 0.20,
      behavioral: 0.15,
      paymentMethod: 0.10,
      amount: 0.05,
      timePattern: 0.05
    };
  }

  private async initializeFraudRules(): Promise<void> {
    // Initialize default fraud rules
    // This would typically load from database
  }

  private async getGeographicData(ipAddress: string): Promise<GeographicRisk> {
    // Mock implementation - would use real geolocation service
    return {
      country: 'US',
      region: 'CA',
      city: 'San Francisco',
      riskScore: 20,
      riskFactors: [],
      isHighRisk: false,
      isBlacklisted: false,
      vpnDetected: false,
      proxyDetected: false
    };
  }

  private calculateGeographicRiskScore(geoData: GeographicRisk, context: TransactionContext): number {
    return geoData.riskScore;
  }

  private async calculateBehaviorRiskScore(context: TransactionContext): Promise<number> {
    // Mock implementation - would analyze user behavior patterns
    return 25;
  }

  private async calculatePaymentMethodRiskScore(context: TransactionContext): Promise<number> {
    // Mock implementation - would analyze payment method risk
    return 20;
  }

  private calculateAmountRiskScore(amount: number, userId: string): number {
    // Simple amount risk calculation
    if (amount > 100000) return 80; // $1,000+
    if (amount > 50000) return 60;  // $500+
    if (amount > 10000) return 40;  // $100+
    return 20;
  }

  private calculateTimePatternRiskScore(timestamp: Date, userId: string): number {
    const hour = timestamp.getHours();
    // Higher risk for unusual hours (2-6 AM)
    if (hour >= 2 && hour <= 6) return 40;
    return 10;
  }

  private calculateScoreVariance(factors: RiskFactor[]): number {
    if (factors.length <= 1) return 0;
    
    const scores = factors.map(f => f.score);
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length;
    
    return Math.sqrt(variance);
  }

  private async storeFraudAnalysis(score: FraudRiskScore, context: TransactionContext): Promise<void> {
    // Implementation would store fraud analysis results
  }

  private async storeDeviceFingerprint(fingerprint: DeviceFingerprint): Promise<void> {
    // Implementation would store device fingerprint
  }

  private async recordPerformanceMetric(metric: any): Promise<void> {
    // Implementation would record performance metrics
  }

  private async retrainModel(trainingData: FraudTrainingData[]): Promise<ModelWeights> {
    // Mock implementation - would retrain ML model
    return this.modelWeights;
  }

  private async optimizeFraudRules(trainingData: FraudTrainingData[]): Promise<void> {
    // Mock implementation - would optimize fraud rules
  }

  private async storeModelWeights(weights: ModelWeights): Promise<void> {
    // Implementation would store model weights
  }
}

// =============================================
// ADDITIONAL TYPES
// =============================================

interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

interface BrowserInfo {
  userAgent: string;
  language: string;
  timezone: string;
  platform: string;
  cookiesEnabled: boolean;
  doNotTrack: boolean;
}

interface ScreenInfo {
  width: number;
  height: number;
  colorDepth: number;
  pixelRatio: number;
}

interface NetworkInfo {
  connectionType: string;
  downlink: number;
  effectiveType: string;
}

interface TypingMetrics {
  averageSpeed: number;
  rhythm: number[];
  accuracy: number;
}

interface MouseMetrics {
  movementPattern: number[];
  clickPattern: number[];
  scrollBehavior: number[];
}

interface NavigationMetrics {
  pageViews: string[];
  sessionDuration: number;
  bounceRate: number;
}

interface ScrollMetrics {
  speed: number;
  pattern: string;
  frequency: number;
}

interface VelocityThresholds {
  transactions: number;
  amount: number;
  devices: number;
  locations: number;
}

interface FraudRecommendation {
  action: FraudAction;
  reason: string;
}

interface RuleCondition {
  field: string;
  operator: string;
  value: any;
  weight: number;
}

interface ModelWeights {
  velocity: number;
  geographic: number;
  device: number;
  behavioral: number;
  paymentMethod: number;
  amount: number;
  timePattern: number;
}

interface FraudTrainingData {
  transactionId: string;
  features: RiskFactor[];
  actualOutcome: 'fraud' | 'legitimate';
  confidence: number;
}

// =============================================
// SINGLETON INSTANCE
// =============================================

const fraudDetection = new FraudDetectionEngine();
export default fraudDetection;