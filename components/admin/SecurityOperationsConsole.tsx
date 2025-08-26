/**
 * Security Operations Console
 * Epic 2 Story 2.10: Security Monitoring & Compliance Infrastructure
 * 
 * Administrative interface for security operations including:
 * - Incident management and response
 * - Threat investigation and analysis
 * - Compliance violation handling
 * - Security configuration and policies
 * - User behavior monitoring
 * - ML model management
 */

'use client'

import React, { useState, useEffect } from 'react'
import { 
  Shield, 
  AlertTriangle, 
  Users, 
  Settings, 
  Activity, 
  FileText, 
  Search,
  Filter,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Bell,
  BellOff,
  Download,
  Upload,
  Database,
  Brain,
  MapPin,
  Zap
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import GlassMorphism from '@/components/GlassMorphism'
import { cn } from '@/lib/utils'

// Interface definitions
interface SecurityIncident {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'new' | 'acknowledged' | 'investigating' | 'contained' | 'resolved' | 'closed'
  category: string
  assignedTo?: string
  detectedAt: Date
  acknowledgedAt?: Date
  resolvedAt?: Date
  affectedUsers: number
  slaStatus: 'on_time' | 'at_risk' | 'overdue'
}

interface ComplianceViolation {
  id: string
  framework: string
  type: string
  severity: 'minor' | 'major' | 'critical'
  description: string
  affectedRecords: number
  discoveredAt: Date
  status: 'open' | 'remediated' | 'resolved'
  reportingRequired: boolean
  deadline?: Date
}

interface ThreatDetection {
  id: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  description: string
  ipAddress?: string
  userId?: string
  detectedAt: Date
  status: 'detected' | 'investigating' | 'mitigated' | 'false_positive'
}

interface UserRiskProfile {
  userId: string
  username: string
  email: string
  riskScore: number
  trustScore: number
  recentAnomalies: number
  lastActivity: Date
  status: 'normal' | 'monitored' | 'restricted' | 'blocked'
}

/**
 * Security Operations Console Component
 */
export default function SecurityOperationsConsole() {
  // State management
  const [activeTab, setActiveTab] = useState('incidents')
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null)
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Mock data (in production, this would come from APIs)
  const [incidents] = useState<SecurityIncident[]>([
    {
      id: 'INC-001',
      title: 'Multiple Failed Login Attempts Detected',
      description: 'Brute force attack detected from IP 192.168.1.100 targeting 15 user accounts',
      severity: 'high',
      status: 'investigating',
      category: 'brute_force',
      assignedTo: 'John Doe',
      detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      acknowledgedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
      affectedUsers: 15,
      slaStatus: 'on_time'
    },
    {
      id: 'INC-002',
      title: 'Impossible Travel Pattern Detected',
      description: 'User login detected from New York and London within 2 hours',
      severity: 'critical',
      status: 'new',
      category: 'impossible_travel',
      detectedAt: new Date(Date.now() - 30 * 60 * 1000),
      affectedUsers: 1,
      slaStatus: 'at_risk'
    },
    {
      id: 'INC-003',
      title: 'Suspicious Device Registration',
      description: 'Multiple new device registrations from same IP address',
      severity: 'medium',
      status: 'contained',
      category: 'device_anomaly',
      assignedTo: 'Jane Smith',
      detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
      acknowledgedAt: new Date(Date.now() - 5.5 * 60 * 60 * 1000),
      affectedUsers: 8,
      slaStatus: 'on_time'
    }
  ])

  const [violations] = useState<ComplianceViolation[]>([
    {
      id: 'VIO-001',
      framework: 'GDPR',
      type: 'data_retention_violation',
      severity: 'major',
      description: 'Personal data retained beyond required retention period',
      affectedRecords: 1250,
      discoveredAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      status: 'open',
      reportingRequired: true,
      deadline: new Date(Date.now() + 68 * 60 * 60 * 1000) // 72 hours minus 4 hours
    },
    {
      id: 'VIO-002',
      framework: 'CCPA',
      type: 'missing_privacy_notice',
      severity: 'major',
      description: 'California resident data collected without proper disclosure',
      affectedRecords: 45,
      discoveredAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
      status: 'remediated',
      reportingRequired: false
    }
  ])

  const [threats] = useState<ThreatDetection[]>([
    {
      id: 'THR-001',
      type: 'credential_stuffing',
      severity: 'high',
      confidence: 0.92,
      description: 'Automated credential testing detected',
      ipAddress: '203.0.113.45',
      detectedAt: new Date(Date.now() - 45 * 60 * 1000),
      status: 'mitigated'
    },
    {
      id: 'THR-002',
      type: 'account_takeover',
      severity: 'critical',
      confidence: 0.89,
      description: 'Suspected account takeover based on behavior analysis',
      userId: 'user_12345',
      detectedAt: new Date(Date.now() - 15 * 60 * 1000),
      status: 'investigating'
    }
  ])

  const [userRisks] = useState<UserRiskProfile[]>([
    {
      userId: 'user_12345',
      username: 'alice.johnson',
      email: 'alice.johnson@company.com',
      riskScore: 0.85,
      trustScore: 0.45,
      recentAnomalies: 3,
      lastActivity: new Date(Date.now() - 10 * 60 * 1000),
      status: 'monitored'
    },
    {
      userId: 'user_67890',
      username: 'bob.smith',
      email: 'bob.smith@company.com',
      riskScore: 0.72,
      trustScore: 0.68,
      recentAnomalies: 1,
      lastActivity: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'normal'
    }
  ])

  // Helper functions
  const getSeverityColor = (severity: string) => {
    const colors = {
      low: 'text-green-400 bg-green-400/10 border-green-400/20',
      medium: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      high: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      critical: 'text-red-400 bg-red-400/10 border-red-400/20',
      minor: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      major: 'text-orange-400 bg-orange-400/10 border-orange-400/20'
    }
    return colors[severity as keyof typeof colors] || colors.medium
  }

  const getStatusColor = (status: string) => {
    const colors = {
      new: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
      acknowledged: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
      investigating: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      contained: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
      resolved: 'text-green-400 bg-green-400/10 border-green-400/20',
      closed: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
      open: 'text-red-400 bg-red-400/10 border-red-400/20',
      remediated: 'text-green-400 bg-green-400/10 border-green-400/20',
      detected: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
      mitigated: 'text-green-400 bg-green-400/10 border-green-400/20',
      false_positive: 'text-gray-400 bg-gray-400/10 border-gray-400/20'
    }
    return colors[status as keyof typeof colors] || colors.open
  }

  const getSLAStatusIcon = (slaStatus: string) => {
    switch (slaStatus) {
      case 'on_time':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'at_risk':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'overdue':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}d ago`
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-semibold text-cream">
            Security Operations Console
          </h1>
          <p className="text-sage/70 mt-1">
            Comprehensive security incident management and threat response
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm">
            <Bell className="w-4 h-4" />
            Alerts
          </Button>
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Active Incidents</p>
              <p className="text-2xl font-semibold text-cream">
                {incidents.filter(i => !['resolved', 'closed'].includes(i.status)).length}
              </p>
            </div>
            <div className="p-3 rounded-full bg-red-400/10">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-red-400">
              {incidents.filter(i => i.severity === 'critical').length} Critical
            </span>
            <span className="text-sage/70 ml-2">
              • {incidents.filter(i => i.slaStatus === 'overdue').length} Overdue
            </span>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Open Violations</p>
              <p className="text-2xl font-semibold text-cream">
                {violations.filter(v => v.status === 'open').length}
              </p>
            </div>
            <div className="p-3 rounded-full bg-orange-400/10">
              <FileText className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-orange-400">
              {violations.filter(v => v.reportingRequired).length} Require Reporting
            </span>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">Active Threats</p>
              <p className="text-2xl font-semibold text-cream">
                {threats.filter(t => ['detected', 'investigating'].includes(t.status)).length}
              </p>
            </div>
            <div className="p-3 rounded-full bg-purple-400/10">
              <Shield className="w-6 h-6 text-purple-400" />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-purple-400">
              {(threats.reduce((sum, t) => sum + t.confidence, 0) / threats.length * 100).toFixed(0)}% Avg Confidence
            </span>
          </div>
        </GlassMorphism>

        <GlassMorphism variant="medium" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-sage/70">High Risk Users</p>
              <p className="text-2xl font-semibold text-cream">
                {userRisks.filter(u => u.riskScore > 0.7).length}
              </p>
            </div>
            <div className="p-3 rounded-full bg-yellow-400/10">
              <Users className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <div className="mt-2 text-sm">
            <span className="text-yellow-400">
              {userRisks.filter(u => u.status === 'monitored').length} Under Monitoring
            </span>
          </div>
        </GlassMorphism>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="incidents">Incidents</TabsTrigger>
          <TabsTrigger value="threats">Threats</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="users">User Risk</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* Incidents Tab */}
        <TabsContent value="incidents" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-sage/50" />
                <Input
                  placeholder="Search incidents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64"
                />
              </div>
              
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="contained">Contained</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severity</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button>
              <AlertTriangle className="w-4 h-4 mr-2" />
              New Incident
            </Button>
          </div>

          <GlassMorphism variant="medium" className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Affected Users</TableHead>
                  <TableHead>SLA</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {incidents.map((incident) => (
                  <TableRow key={incident.id}>
                    <TableCell className="font-mono text-sm">{incident.id}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-cream">{incident.title}</p>
                        <p className="text-xs text-sage/70 mt-1">{incident.category}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getSeverityColor(incident.severity)}>
                        {incident.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(incident.status)}>
                        {incident.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {incident.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-400/20 flex items-center justify-center">
                            <span className="text-xs text-teal-400">
                              {incident.assignedTo.charAt(0)}
                            </span>
                          </div>
                          <span className="text-sm text-cream">{incident.assignedTo}</span>
                        </div>
                      ) : (
                        <span className="text-sage/50">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>{incident.affectedUsers}</TableCell>
                    <TableCell>{getSLAStatusIcon(incident.slaStatus)}</TableCell>
                    <TableCell className="text-sm text-sage/70">
                      {formatTimeAgo(incident.detectedAt)}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl">
                          <DialogHeader>
                            <DialogTitle>Incident Details: {incident.id}</DialogTitle>
                            <DialogDescription>{incident.title}</DialogDescription>
                          </DialogHeader>
                          
                          <div className="grid grid-cols-2 gap-6 py-4">
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-sage/70">Description</label>
                                <p className="mt-1 text-sm text-cream">{incident.description}</p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-sage/70">Severity</label>
                                  <div className="mt-1">
                                    <Badge className={getSeverityColor(incident.severity)}>
                                      {incident.severity}
                                    </Badge>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-sage/70">Status</label>
                                  <div className="mt-1">
                                    <Badge className={getStatusColor(incident.status)}>
                                      {incident.status}
                                    </Badge>
                                  </div>
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium text-sage/70">Assigned To</label>
                                <Select>
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder={incident.assignedTo || "Select assignee"} />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="john">John Doe</SelectItem>
                                    <SelectItem value="jane">Jane Smith</SelectItem>
                                    <SelectItem value="bob">Bob Johnson</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            
                            <div className="space-y-4">
                              <div>
                                <label className="text-sm font-medium text-sage/70">Timeline</label>
                                <div className="mt-2 space-y-2">
                                  <div className="flex items-center gap-2 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                                    <span className="text-cream">Detected:</span>
                                    <span className="text-sage/70">{incident.detectedAt.toLocaleString()}</span>
                                  </div>
                                  {incident.acknowledgedAt && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                                      <span className="text-cream">Acknowledged:</span>
                                      <span className="text-sage/70">{incident.acknowledgedAt.toLocaleString()}</span>
                                    </div>
                                  )}
                                  {incident.resolvedAt && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <div className="w-2 h-2 rounded-full bg-green-400"></div>
                                      <span className="text-cream">Resolved:</span>
                                      <span className="text-sage/70">{incident.resolvedAt.toLocaleString()}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium text-sage/70">Response Actions</label>
                                <div className="mt-2 space-y-2">
                                  <Button size="sm" className="w-full">
                                    Block IP Address
                                  </Button>
                                  <Button size="sm" variant="outline" className="w-full">
                                    Quarantine User Account
                                  </Button>
                                  <Button size="sm" variant="outline" className="w-full">
                                    Send Security Alert
                                  </Button>
                                </div>
                              </div>
                              
                              <div>
                                <label className="text-sm font-medium text-sage/70">Investigation Notes</label>
                                <Textarea
                                  placeholder="Add investigation notes..."
                                  className="mt-1 min-h-[100px]"
                                />
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <Button variant="outline">Close</Button>
                            <Button>Update Incident</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </GlassMorphism>
        </TabsContent>

        {/* Threats Tab */}
        <TabsContent value="threats" className="space-y-6">
          <GlassMorphism variant="medium" className="p-6">
            <h3 className="text-lg font-heading text-cream mb-4">Active Threat Detections</h3>
            
            <div className="space-y-4">
              {threats.map((threat) => (
                <div key={threat.id} className="flex items-start gap-4 p-4 rounded-lg border border-sage/10 bg-sage/5">
                  <div className={cn(
                    "p-2 rounded-full border",
                    getSeverityColor(threat.severity)
                  )}>
                    <Zap className="w-4 h-4" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-cream">{threat.type.replace(/_/g, ' ').toUpperCase()}</h4>
                      <div className="flex items-center gap-2">
                        <Badge className={getSeverityColor(threat.severity)}>
                          {threat.severity}
                        </Badge>
                        <Badge className={getStatusColor(threat.status)}>
                          {threat.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-sage/70 mt-1">{threat.description}</p>
                    
                    <div className="flex items-center gap-4 mt-2 text-xs text-sage/50">
                      <span>ID: {threat.id}</span>
                      <span>Confidence: {(threat.confidence * 100).toFixed(0)}%</span>
                      {threat.ipAddress && <span>IP: {threat.ipAddress}</span>}
                      {threat.userId && <span>User: {threat.userId}</span>}
                      <span>Detected: {formatTimeAgo(threat.detectedAt)}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                      Investigate
                    </Button>
                    <Button variant="outline" size="sm">
                      Block
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </GlassMorphism>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Violations List */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Compliance Violations</h3>
              
              <div className="space-y-3">
                {violations.map((violation) => (
                  <div key={violation.id} className="p-4 rounded-lg border border-sage/10 bg-sage/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {violation.framework}
                        </Badge>
                        <Badge className={getSeverityColor(violation.severity)}>
                          {violation.severity}
                        </Badge>
                      </div>
                      <Badge className={getStatusColor(violation.status)}>
                        {violation.status}
                      </Badge>
                    </div>
                    
                    <h4 className="font-medium text-cream">{violation.type.replace(/_/g, ' ')}</h4>
                    <p className="text-sm text-sage/70 mt-1">{violation.description}</p>
                    
                    <div className="flex items-center justify-between mt-3 text-xs text-sage/50">
                      <span>Affected: {violation.affectedRecords} records</span>
                      <span>Discovered: {formatTimeAgo(violation.discoveredAt)}</span>
                    </div>
                    
                    {violation.reportingRequired && violation.deadline && (
                      <div className="mt-2 p-2 rounded bg-orange-400/10 border border-orange-400/20">
                        <div className="flex items-center gap-2 text-orange-400 text-xs">
                          <Clock className="w-3 h-3" />
                          Regulatory notification due: {violation.deadline.toLocaleDateString()}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </GlassMorphism>

            {/* Compliance Status */}
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Framework Compliance</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cream">GDPR</span>
                    <span className="text-sm text-green-400">98.5%</span>
                  </div>
                  <Progress value={98.5} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cream">CCPA</span>
                    <span className="text-sm text-yellow-400">92.1%</span>
                  </div>
                  <Progress value={92.1} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cream">SOX</span>
                    <span className="text-sm text-green-400">96.8%</span>
                  </div>
                  <Progress value={96.8} className="h-2" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-cream">PCI DSS</span>
                    <span className="text-sm text-green-400">100%</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
              </div>
            </GlassMorphism>
          </div>
        </TabsContent>

        {/* User Risk Tab */}
        <TabsContent value="users" className="space-y-6">
          <GlassMorphism variant="medium" className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading text-cream">High Risk User Profiles</h3>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search users..."
                  className="w-48"
                />
                <Button variant="outline" size="sm">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <div className="space-y-4">
              {userRisks.map((user) => (
                <div key={user.userId} className="flex items-center justify-between p-4 rounded-lg border border-sage/10 bg-sage/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-teal-400/20 flex items-center justify-center">
                      <span className="text-sm font-medium text-teal-400">
                        {user.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-cream">{user.username}</h4>
                      <p className="text-sm text-sage/70">{user.email}</p>
                      <p className="text-xs text-sage/50">Last activity: {formatTimeAgo(user.lastActivity)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-sage/70">Risk Score</p>
                      <p className={cn(
                        "text-sm font-medium",
                        user.riskScore > 0.8 ? "text-red-400" :
                        user.riskScore > 0.6 ? "text-orange-400" :
                        user.riskScore > 0.4 ? "text-yellow-400" : "text-green-400"
                      )}>
                        {(user.riskScore * 100).toFixed(0)}%
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-xs text-sage/70">Trust Score</p>
                      <p className={cn(
                        "text-sm font-medium",
                        user.trustScore > 0.8 ? "text-green-400" :
                        user.trustScore > 0.6 ? "text-yellow-400" :
                        user.trustScore > 0.4 ? "text-orange-400" : "text-red-400"
                      )}>
                        {(user.trustScore * 100).toFixed(0)}%
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <p className="text-xs text-sage/70">Anomalies</p>
                      <p className="text-sm font-medium text-cream">{user.recentAnomalies}</p>
                    </div>
                    
                    <Badge className={getStatusColor(user.status)}>
                      {user.status}
                    </Badge>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        {user.status === 'blocked' ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassMorphism>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Security Trends</h3>
              <div className="h-64 bg-sage/5 rounded-lg flex items-center justify-center border border-sage/10">
                <div className="text-center">
                  <Activity className="w-12 h-12 text-sage/30 mx-auto mb-2" />
                  <p className="text-sm text-sage/70">Security trend charts would be displayed here</p>
                </div>
              </div>
            </GlassMorphism>

            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">ML Model Performance</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-sage/5 border border-sage/10">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-teal-400" />
                    <span className="text-sm text-cream">Anomaly Detection</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-400">96.2%</span>
                    <ArrowUp className="w-4 h-4 text-green-400" />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-sage/5 border border-sage/10">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-teal-400" />
                    <span className="text-sm text-cream">Threat Classification</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-green-400">94.8%</span>
                    <ArrowUp className="w-4 h-4 text-green-400" />
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg bg-sage/5 border border-sage/10">
                  <div className="flex items-center gap-3">
                    <Brain className="w-5 h-5 text-teal-400" />
                    <span className="text-sm text-cream">Behavioral Analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-yellow-400">89.3%</span>
                    <ArrowDown className="w-4 h-4 text-yellow-400" />
                  </div>
                </div>
              </div>
            </GlassMorphism>
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">Security Configuration</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">Automatic Threat Response</span>
                  <Button variant="outline" size="sm">
                    Enabled
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">Real-time Monitoring</span>
                  <Button variant="outline" size="sm">
                    Enabled
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">Compliance Alerts</span>
                  <Button variant="outline" size="sm">
                    Enabled
                  </Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">ML Model Updates</span>
                  <Button variant="outline" size="sm">
                    Auto
                  </Button>
                </div>
              </div>
            </GlassMorphism>

            <GlassMorphism variant="medium" className="p-6">
              <h3 className="text-lg font-heading text-cream mb-4">System Health</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">Event Processing Queue</span>
                  <span className="text-sm text-green-400">Healthy</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">ML Pipeline Status</span>
                  <span className="text-sm text-green-400">Online</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">Database Performance</span>
                  <span className="text-sm text-yellow-400">Monitoring</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream">Alert Delivery</span>
                  <span className="text-sm text-green-400">Active</span>
                </div>
              </div>
            </GlassMorphism>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}