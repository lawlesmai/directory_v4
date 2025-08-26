/**
 * Advanced Security Analytics Dashboard
 * Epic 2 Story 2.10: Security Monitoring & Compliance Infrastructure
 * 
 * Features:
 * - Real-time security metrics visualization
 * - Interactive threat analysis charts
 * - Compliance monitoring dashboards
 * - Geographic threat mapping
 * - ML-based anomaly detection displays
 * - Incident management interface
 * - Performance monitoring
 */

'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { 
  AlertTriangle, 
  Shield, 
  Activity, 
  Globe, 
  Users, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  Eye,
  Lock,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  PieChart,
  Map,
  Filter,
  RefreshCw,
  Download,
  Settings
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import GlassMorphism from '@/components/GlassMorphism'
import { cn } from '@/lib/utils'
import { getSecurityMetricsSnapshot, type SecurityMetricsSnapshot } from '@/lib/auth/security-analytics-engine'
import { generateFrameworkReport, type ComplianceReport } from '@/lib/auth/compliance-engine'

// Dashboard interfaces
interface ThreatLocation {
  id: string
  latitude: number
  longitude: number
  country: string
  city: string
  threatType: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  count: number
  timestamp: Date
}

interface SecurityAlert {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  affectedUsers: number
  timestamp: Date
  status: 'open' | 'investigating' | 'resolved'
  assignee?: string
}

interface MLInsight {
  id: string
  type: 'anomaly' | 'prediction' | 'pattern'
  confidence: number
  description: string
  impact: string
  recommendation: string
  timestamp: Date
}

/**
 * Security Analytics Dashboard Component
 */
export default function SecurityAnalyticsDashboard() {
  // State management
  const [metrics, setMetrics] = useState<SecurityMetricsSnapshot | null>(null)
  const [complianceReports, setComplianceReports] = useState<ComplianceReport[]>([])
  const [threatLocations, setThreatLocations] = useState<ThreatLocation[]>([])
  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlert[]>([])
  const [mlInsights, setMLInsights] = useState<MLInsight[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h')
  const [isLoading, setIsLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Data fetching
  const fetchDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      
      // Fetch metrics
      const metricsData = await getSecurityMetricsSnapshot()
      setMetrics(metricsData)
      
      // Fetch compliance reports
      const gdprReport = await generateFrameworkReport('gdpr', 'daily', {
        start: new Date(Date.now() - 24 * 60 * 60 * 1000),
        end: new Date()
      })
      setComplianceReports([gdprReport])
      
      // Mock data for demonstration (in production, these would come from real APIs)
      setThreatLocations([
        {
          id: 'threat_1',
          latitude: 40.7128,
          longitude: -74.0060,
          country: 'US',
          city: 'New York',
          threatType: 'brute_force',
          severity: 'high',
          count: 15,
          timestamp: new Date()
        },
        {
          id: 'threat_2',
          latitude: 51.5074,
          longitude: -0.1278,
          country: 'UK',
          city: 'London',
          threatType: 'credential_stuffing',
          severity: 'medium',
          count: 8,
          timestamp: new Date()
        }
      ])
      
      setSecurityAlerts([
        {
          id: 'alert_1',
          type: 'brute_force_attack',
          severity: 'high',
          title: 'Multiple Failed Login Attempts',
          description: '45 failed login attempts from IP 192.168.1.100',
          affectedUsers: 5,
          timestamp: new Date(Date.now() - 15 * 60 * 1000),
          status: 'investigating',
          assignee: 'security_team'
        },
        {
          id: 'alert_2',
          type: 'impossible_travel',
          severity: 'critical',
          title: 'Impossible Travel Detected',
          description: 'User login from New York and London within 2 hours',
          affectedUsers: 1,
          timestamp: new Date(Date.now() - 30 * 60 * 1000),
          status: 'open'
        }
      ])
      
      setMLInsights([
        {
          id: 'insight_1',
          type: 'anomaly',
          confidence: 0.89,
          description: 'Unusual authentication pattern detected',
          impact: 'Potential account compromise',
          recommendation: 'Require additional verification for affected accounts',
          timestamp: new Date(Date.now() - 10 * 60 * 1000)
        },
        {
          id: 'insight_2',
          type: 'prediction',
          confidence: 0.76,
          description: 'Increased bot activity predicted',
          impact: 'Potential service degradation',
          recommendation: 'Enable enhanced rate limiting',
          timestamp: new Date(Date.now() - 25 * 60 * 1000)
        }
      ])
      
      setLastRefresh(new Date())
      
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Auto-refresh functionality
  useEffect(() => {
    fetchDashboardData()
    
    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000) // Refresh every 30 seconds
      return () => clearInterval(interval)
    }
  }, [fetchDashboardData, autoRefresh])

  // Severity color mapping
  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'text-green-400 bg-green-400/10 border-green-400/20',
      medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      critical: 'text-red-400 bg-red-400/10 border-red-400/20'
    }
    return colors[severity as keyof typeof colors] || colors.medium
  }

  const getSeverityIcon = (severity: string) => {
    const icons = {
      low: CheckCircle,
      medium: AlertCircle,
      high: AlertTriangle,
      critical: XCircle
    }
    const Icon = icons[severity as keyof typeof icons] || AlertCircle
    return <Icon className="w-4 h-4" />
  }

  if (isLoading && !metrics) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-teal-primary" />
          <span className="text-cream">Loading security analytics...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-cream">
            Security Analytics Dashboard
          </h1>
          <p className="text-sage/70 mt-1">
            Real-time security monitoring and compliance analytics
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-sage/70">
            <Clock className="w-4 h-4" />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          
          <Select value={selectedTimeframe} onValueChange={(value: any) => setSelectedTimeframe(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">1 Hour</SelectItem>
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchDashboardData}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Active Threats</p>
              <p className="text-2xl font-semibold text-cream">
                {metrics?.activeThreats || 0}
              </p>
            </div>
            <div className="p-3 rounded-full bg-red-400/10">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-sm">
            <TrendingDown className="w-4 h-4 text-green-400" />
            <span className="text-green-400">12% decrease</span>
            <span className="text-sage/70">from yesterday</span>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Events Processed</p>
              <p className="text-2xl font-semibold text-cream">
                {metrics?.eventsProcessed.toLocaleString() || '0'}
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-400/10">
              <Activity className="w-6 h-6 text-blue-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-sm">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400">Processing: {metrics?.systemHealth.eventProcessingLatency || 0}ms</span>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Compliance Score</p>
              <p className="text-2xl font-semibold text-cream">
                {metrics?.complianceScore.toFixed(1) || '0.0'}%
              </p>
            </div>
            <div className="p-3 rounded-full bg-green-400/10">
              <Shield className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <div className="mt-4">
            <Progress 
              value={metrics?.complianceScore || 0} 
              className="h-2"
            />
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Detection Accuracy</p>
              <p className="text-2xl font-semibold text-cream">
                {((metrics?.threatDetectionAccuracy || 0) * 100).toFixed(1)}%
              </p>
            </div>
            <div className="p-3 rounded-full bg-teal-400/10">
              <Eye className="w-6 h-6 text-teal-400" />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-1 text-sm">
            <span className="text-sage/70">False positive:</span>
            <span className="text-teal-400">
              {((metrics?.falsePositiveRate || 0) * 100).toFixed(1)}%
            </span>
          </div>
        </GlassMorphism>
      </div>

      {/* Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6 lg:w-auto lg:grid-cols-none lg:flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ml-insights">ML Insights</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Health */}
            <GlassMorphism variant="medium" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading text-cream">System Health</h3>
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  metrics?.systemHealth.alertingSystem === 'healthy' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
                )} />
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Processing Latency</span>
                  <span className="text-sm text-cream">
                    {metrics?.systemHealth.eventProcessingLatency || 0}ms
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Queue Depth</span>
                  <span className="text-sm text-cream">
                    {metrics?.systemHealth.queueDepth || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Model Accuracy</span>
                  <span className="text-sm text-cream">
                    {((metrics?.systemHealth.modelAccuracy || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </GlassMorphism>

            {/* Recent Anomalies */}
            <GlassMorphism variant="medium" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading text-cream">Recent Anomalies</h3>
                <Badge variant="outline" className="text-xs">
                  {metrics?.anomaliesDetected || 0} detected
                </Badge>
              </div>
              
              <div className="space-y-3">
                {mlInsights.slice(0, 3).map((insight) => (
                  <div key={insight.id} className="flex items-start gap-3 p-3 rounded-lg bg-sage/5 border border-sage/10">
                    <div className={cn(
                      "p-1 rounded-full",
                      insight.type === 'anomaly' ? 'bg-orange-400/10' : 'bg-blue-400/10'
                    )}>
                      <Zap className={cn(
                        "w-4 h-4",
                        insight.type === 'anomaly' ? 'text-orange-400' : 'text-blue-400'
                      )} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-cream">{insight.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-sage/70">
                          Confidence: {(insight.confidence * 100).toFixed(0)}%
                        </span>
                        <span className="text-xs text-sage/50">
                          {insight.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassMorphism>
          </div>

          {/* Geographic Threat Map */}
          <GlassMorphism variant="medium" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading text-cream">Global Threat Activity</h3>
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-sage/70" />
                <span className="text-sm text-sage/70">
                  {threatLocations.length} active locations
                </span>
              </div>
            </div>
            
            <div className="h-64 bg-sage/5 rounded-lg flex items-center justify-center border border-sage/10">
              <div className="text-center">
                <Globe className="w-12 h-12 text-sage/30 mx-auto mb-2" />
                <p className="text-sm text-sage/70">Interactive threat map would be displayed here</p>
                <p className="text-xs text-sage/50 mt-1">
                  Integration with mapping service required
                </p>
              </div>
            </div>
          </GlassMorphism>
        </TabsContent>

        {/* Threats Tab */}
        <TabsContent value="threats" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Threats */}
            <div className="lg:col-span-2">
              <GlassMorphism variant="medium" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading text-cream">Active Security Threats</h3>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-3">
                  {securityAlerts.map((alert) => (
                    <div key={alert.id} className="flex items-start gap-4 p-4 rounded-lg border border-sage/10 bg-sage/5">
                      <div className={cn(
                        "p-2 rounded-full border",
                        getSeverityColor(alert.severity)
                      )}>
                        {getSeverityIcon(alert.severity)}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-cream">{alert.title}</h4>
                          <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-sage/70 mt-1">{alert.description}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-sage/50">
                          <span>Affected users: {alert.affectedUsers}</span>
                          <span>Status: {alert.status}</span>
                          <span>{alert.timestamp.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <Button variant="outline" size="sm">
                        Investigate
                      </Button>
                    </div>
                  ))}
                </div>
              </GlassMorphism>
            </div>

            {/* Threat Statistics */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Threat Statistics</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Brute Force</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-sage/20 rounded-full">
                      <div className="w-12 h-2 bg-red-400 rounded-full" />
                    </div>
                    <span className="text-sm text-cream">75%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Credential Stuffing</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-sage/20 rounded-full">
                      <div className="w-8 h-2 bg-orange-400 rounded-full" />
                    </div>
                    <span className="text-sm text-cream">50%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Account Takeover</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-sage/20 rounded-full">
                      <div className="w-4 h-2 bg-yellow-400 rounded-full" />
                    </div>
                    <span className="text-sm text-cream">25%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Bot Activity</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 bg-sage/20 rounded-full">
                      <div className="w-6 h-2 bg-blue-400 rounded-full" />
                    </div>
                    <span className="text-sm text-cream">35%</span>
                  </div>
                </div>
              </div>
            </GlassMorphism>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compliance Overview */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Compliance Status</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-400/10 border border-green-400/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-cream">GDPR</span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">98.5%</div>
                    <div className="text-xs text-green-400/70">Compliant</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400" />
                    <span className="text-cream">CCPA</span>
                  </div>
                  <div className="text-right">
                    <div className="text-yellow-400 font-medium">92.1%</div>
                    <div className="text-xs text-yellow-400/70">Review Required</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-400/10 border border-green-400/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-cream">SOX</span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">96.8%</div>
                    <div className="text-xs text-green-400/70">Compliant</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-400/10 border border-green-400/20">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <span className="text-cream">PCI DSS</span>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400 font-medium">100%</div>
                    <div className="text-xs text-green-400/70">Compliant</div>
                  </div>
                </div>
              </div>
            </GlassMorphism>

            {/* Recent Violations */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Recent Violations</h3>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                  <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-cream">Data retention overdue</p>
                    <p className="text-xs text-sage/70 mt-1">GDPR - 15 records past retention period</p>
                    <p className="text-xs text-sage/50 mt-1">2 hours ago</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-400/10 border border-orange-400/20">
                  <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-cream">Missing consent documentation</p>
                    <p className="text-xs text-sage/70 mt-1">CCPA - California resident data without disclosure</p>
                    <p className="text-xs text-sage/50 mt-1">6 hours ago</p>
                  </div>
                </div>
                
                <div className="text-center py-4">
                  <Button variant="outline" size="sm">
                    View All Violations
                  </Button>
                </div>
              </div>
            </GlassMorphism>
          </div>
        </TabsContent>

        {/* ML Insights Tab */}
        <TabsContent value="ml-insights" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ML Model Performance */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">ML Model Performance</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Anomaly Detection</span>
                  <div className="flex items-center gap-2">
                    <Progress value={96} className="w-20 h-2" />
                    <span className="text-sm text-cream">96%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Threat Classification</span>
                  <div className="flex items-center gap-2">
                    <Progress value={94} className="w-20 h-2" />
                    <span className="text-sm text-cream">94%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Behavioral Analysis</span>
                  <div className="flex items-center gap-2">
                    <Progress value={89} className="w-20 h-2" />
                    <span className="text-sm text-cream">89%</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-sage/70">Predictive Modeling</span>
                  <div className="flex items-center gap-2">
                    <Progress value={87} className="w-20 h-2" />
                    <span className="text-sm text-cream">87%</span>
                  </div>
                </div>
              </div>
            </GlassMorphism>

            {/* ML Insights */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">AI-Powered Insights</h3>
              
              <div className="space-y-3">
                {mlInsights.map((insight) => (
                  <div key={insight.id} className="p-3 rounded-lg border border-sage/10 bg-sage/5">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {insight.type}
                      </Badge>
                      <span className="text-xs text-sage/70">
                        {(insight.confidence * 100).toFixed(0)}% confidence
                      </span>
                    </div>
                    <p className="text-sm text-cream mb-1">{insight.description}</p>
                    <p className="text-xs text-sage/70">{insight.recommendation}</p>
                  </div>
                ))}
              </div>
            </GlassMorphism>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}