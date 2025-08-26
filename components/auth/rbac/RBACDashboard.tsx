'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Shield, Users, AlertTriangle, TrendingUp, TrendingDown,
  Activity, Clock, Eye, Download, RefreshCw, Filter, Search,
  CheckCircle, XCircle, AlertCircle, Info, Crown, Building2,
  Tool, Zap, Star, Award, Target, Gauge, Calendar, MapPin
} from 'lucide-react';
import { GlassMorphism } from '../../GlassMorphism';
import { cn } from '@/lib/utils';
import type { 
  RBACDashboardProps, 
  RBACAnalytics, 
  RBACEvent 
} from './types';

// Role icons
const roleIcons = {
  customer: Users,
  business_owner: Building2,
  service_provider: Tool,
  moderator: Shield,
  admin: Crown,
  super_admin: Zap
} as const;

// Event type icons
const eventTypeIcons = {
  role_assigned: Shield,
  role_revoked: XCircle,
  permission_granted: CheckCircle,
  permission_revoked: XCircle,
  role_created: Star,
  role_updated: AlertCircle,
  role_deleted: XCircle,
  permission_test: Eye,
  bulk_operation: Users,
  security_violation: AlertTriangle
} as const;

// Severity colors
const severityColors = {
  low: 'text-sage',
  medium: 'text-teal-primary',
  high: 'text-gold-primary',
  critical: 'text-red-error'
} as const;

interface MetricCardProps {
  title: string;
  value: number | string;
  change?: number;
  icon: React.ComponentType<any>;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color = 'from-teal-primary/20 to-sage/20',
  trend,
  subtitle,
  onClick
}) => {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Activity;
  const trendColor = trend === 'up' ? 'text-sage' : trend === 'down' ? 'text-red-error' : 'text-sage/50';

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.02, y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={cn(
        'p-4 rounded-lg border transition-all duration-200',
        `bg-gradient-to-br ${color} border-sage/20`,
        onClick && 'cursor-pointer hover:shadow-lg hover:border-sage/30'
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-sage/70 mb-1">{title}</p>
          <p className="text-2xl font-bold text-cream mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-sage/60">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="p-2 bg-white/10 rounded-full">
            <Icon className="w-5 h-5 text-sage" />
          </div>
          {change !== undefined && (
            <div className={cn('flex items-center gap-1 text-xs', trendColor)}>
              <TrendIcon className="w-3 h-3" />
              <span>{Math.abs(change)}%</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface ChartProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title: string;
  type?: 'bar' | 'donut';
}

const SimpleChart: React.FC<ChartProps> = ({ data, title, type = 'bar' }) => {
  const maxValue = Math.max(...data.map(d => d.value));

  if (type === 'donut') {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    let currentAngle = 0;

    return (
      <div className="flex items-center justify-center h-32">
        <div className="relative">
          <svg width="100" height="100" className="transform -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
            />
            {data.map((item, index) => {
              const percentage = (item.value / total) * 100;
              const strokeDasharray = `${percentage * 2.51} 251`;
              const strokeDashoffset = -currentAngle * 2.51;
              currentAngle += percentage;
              
              return (
                <circle
                  key={index}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={item.color || '#4FD1C7'}
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-bold text-cream">{total}</p>
              <p className="text-xs text-sage/70">Total</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-cream truncate">{item.label}</span>
            <span className="text-sage/70">{item.value}</span>
          </div>
          <div className="w-full bg-navy-50/20 rounded-full h-2 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / maxValue) * 100}%` }}
              transition={{ duration: 1, delay: index * 0.1 }}
              className={cn(
                'h-full rounded-full',
                item.color ? `bg-gradient-to-r ${item.color}` : 'bg-gradient-to-r from-teal-primary to-sage'
              )}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

interface RecentEventProps {
  event: RBACEvent;
  onViewDetails: () => void;
}

const RecentEventItem: React.FC<RecentEventProps> = ({ event, onViewDetails }) => {
  const EventIcon = eventTypeIcons[event.eventType] || Activity;
  
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore >= 80) return 'text-red-error';
    if (riskScore >= 60) return 'text-gold-primary';
    if (riskScore >= 40) return 'text-teal-primary';
    return 'text-sage';
  };

  const getEventColor = () => {
    if (event.eventType === 'security_violation') return 'border-red-error/30 bg-red-error/5';
    if (event.riskScore >= 70) return 'border-gold-primary/30 bg-gold-primary/5';
    return 'border-sage/20 bg-navy-50/5';
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -1 }}
      onClick={onViewDetails}
      className={cn(
        'p-3 rounded-lg border cursor-pointer transition-all duration-200',
        getEventColor()
      )}
    >
      <div className="flex items-start gap-3">
        <div className="p-1.5 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
          <EventIcon className="w-4 h-4 text-sage" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-cream capitalize">
              {event.eventType.replace('_', ' ')}
            </p>
            <div className={cn('w-2 h-2 rounded-full', getRiskColor(event.riskScore).replace('text-', 'bg-'))} />
          </div>
          <p className="text-xs text-sage/70 mt-1">
            Resource: {event.resourceType} • Risk: {event.riskScore}/100
          </p>
          {event.details.reason && (
            <p className="text-xs text-sage/60 mt-1 truncate">
              {event.details.reason}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-sage/50">
            <span>{formatTimeAgo(event.timestamp)}</span>
            {event.metadata.ipAddress && (
              <>
                <span>•</span>
                <span>{event.metadata.ipAddress}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

interface ComplianceIssueProps {
  issue: {
    type: 'orphaned_permission' | 'excessive_privileges' | 'inactive_role' | 'expired_assignment';
    count: number;
    severity: 'low' | 'medium' | 'high';
  };
  onViewDetails: () => void;
}

const ComplianceIssueItem: React.FC<ComplianceIssueProps> = ({ issue, onViewDetails }) => {
  const severityColor = severityColors[issue.severity];
  const SeverityIcon = issue.severity === 'high' ? AlertTriangle : 
                      issue.severity === 'medium' ? Info : CheckCircle;

  const getIssueTitle = (type: string) => {
    const titles = {
      orphaned_permission: 'Orphaned Permissions',
      excessive_privileges: 'Excessive Privileges',
      inactive_role: 'Inactive Roles',
      expired_assignment: 'Expired Assignments'
    };
    return titles[type as keyof typeof titles] || type;
  };

  const getIssueDescription = (type: string) => {
    const descriptions = {
      orphaned_permission: 'Permissions not assigned to any role',
      excessive_privileges: 'Users with unnecessary high-level access',
      inactive_role: 'Roles not currently in use',
      expired_assignment: 'Role assignments that have expired'
    };
    return descriptions[type as keyof typeof descriptions] || type;
  };

  return (
    <motion.div
      whileHover={{ scale: 1.01, y: -1 }}
      onClick={onViewDetails}
      className="p-3 rounded-lg border border-sage/20 bg-navy-50/5 hover:bg-navy-50/10 
                 cursor-pointer transition-all duration-200"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn('p-1.5 rounded-full', severityColor.replace('text-', 'bg-') + '/20')}>
            <SeverityIcon className={cn('w-4 h-4', severityColor)} />
          </div>
          <div>
            <p className="text-sm font-medium text-cream">{getIssueTitle(issue.type)}</p>
            <p className="text-xs text-sage/70">{getIssueDescription(issue.type)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-cream">{issue.count}</p>
          <p className={cn('text-xs font-medium capitalize', severityColor)}>
            {issue.severity}
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export const RBACDashboard: React.FC<RBACDashboardProps> = ({
  analytics,
  recentEvents,
  onRefresh,
  onExportData,
  onViewDetails,
  className = ''
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'roles' | 'security'>('overview');

  // Calculate derived metrics
  const derivedMetrics = useMemo(() => {
    const totalUsers = analytics.userCount.total;
    const activeUsers = analytics.userCount.active;
    const inactiveUsers = analytics.userCount.inactive;
    
    const totalViolations = analytics.violations.count;
    const complianceScore = analytics.compliance.score;
    const criticalIssues = analytics.compliance.issues.filter(i => i.severity === 'high').length;
    
    // Calculate trends (mock data for demo)
    const userGrowth = Math.round((activeUsers / totalUsers) * 100);
    const securityTrend = totalViolations < 10 ? 'up' : totalViolations < 50 ? 'stable' : 'down';
    const complianceTrend = complianceScore >= 80 ? 'up' : complianceScore >= 60 ? 'stable' : 'down';

    return {
      userGrowth,
      securityTrend,
      complianceTrend,
      criticalIssues,
      activePercentage: Math.round((activeUsers / totalUsers) * 100)
    };
  }, [analytics]);

  // Prepare chart data
  const usersByRoleData = useMemo(() => {
    return Object.entries(analytics.userCount.byRole).map(([role, count]) => ({
      label: role.replace('_', ' '),
      value: count,
      color: role === 'super_admin' ? 'from-red-error to-red-warning' :
             role === 'admin' ? 'from-gold-primary to-gold-secondary' :
             role === 'moderator' ? 'from-teal-primary to-teal-secondary' :
             'from-sage to-teal-primary'
    }));
  }, [analytics.userCount.byRole]);

  const roleUsageData = useMemo(() => {
    return analytics.roleUsage.mostUsed.slice(0, 5).map(item => ({
      label: `Role ${item.roleId.slice(0, 8)}`,
      value: item.count,
      color: 'from-teal-primary to-sage'
    }));
  }, [analytics.roleUsage.mostUsed]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      console.error('Failed to refresh dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExport = async (type: 'users' | 'roles' | 'permissions' | 'audit') => {
    try {
      await onExportData(type);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  return (
    <GlassMorphism
      variant="medium"
      className={cn('w-full p-6', className)}
      animated
      border
      shadow
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-teal-primary/20 to-sage/20 rounded-full">
            <BarChart3 className="w-6 h-6 text-sage" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-cream">RBAC Dashboard</h2>
            <p className="text-sm text-sage/70">
              Monitor roles, permissions, and security across your organization
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-3 py-2 bg-navy-dark/50 border border-sage/30 rounded text-cream text-sm
                       focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>

          {/* Export Menu */}
          <div className="relative group">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-1 px-3 py-2 text-sage/70 hover:text-cream hover:bg-sage/20 
                         rounded transition-colors"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </motion.button>
            <div className="absolute right-0 top-full mt-1 w-48 bg-navy-dark/90 backdrop-blur-sm border 
                           border-sage/20 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 
                           group-hover:visible transition-all z-10">
              <div className="p-2 space-y-1">
                {(['users', 'roles', 'permissions', 'audit'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => handleExport(type)}
                    className="w-full text-left px-3 py-2 text-sm text-sage/70 hover:text-cream 
                               hover:bg-sage/20 rounded capitalize transition-colors"
                  >
                    Export {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1 px-3 py-2 bg-gradient-to-r from-teal-primary to-teal-secondary
                       text-cream rounded hover:shadow-lg transition-all disabled:opacity-50"
          >
            <motion.div
              animate={refreshing ? { rotate: 360 } : {}}
              transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            >
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            <span className="hidden sm:inline">
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </motion.button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-1 p-1 bg-navy-50/20 rounded-lg mb-6">
        {[
          { key: 'overview' as const, label: 'Overview', icon: BarChart3 },
          { key: 'users' as const, label: 'Users', icon: Users },
          { key: 'roles' as const, label: 'Roles', icon: Shield },
          { key: 'security' as const, label: 'Security', icon: AlertTriangle }
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveSection(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium',
              'transition-all duration-200',
              activeSection === key
                ? 'bg-gradient-to-r from-teal-primary/30 to-sage/30 text-cream'
                : 'text-sage/70 hover:text-cream hover:bg-navy-50/20'
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Dashboard Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeSection === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Total Users"
                  value={analytics.userCount.total}
                  change={derivedMetrics.userGrowth}
                  trend="up"
                  icon={Users}
                  color="from-teal-primary/20 to-sage/20"
                  subtitle={`${derivedMetrics.activePercentage}% active`}
                  onClick={() => onViewDetails('usage', { type: 'users' })}
                />
                <MetricCard
                  title="Active Roles"
                  value={analytics.roleUsage.mostUsed.length}
                  icon={Shield}
                  color="from-sage/20 to-teal-primary/20"
                  subtitle="Currently in use"
                  onClick={() => onViewDetails('usage', { type: 'roles' })}
                />
                <MetricCard
                  title="Compliance Score"
                  value={`${analytics.compliance.score}%`}
                  change={analytics.compliance.score >= 80 ? 5 : -3}
                  trend={derivedMetrics.complianceTrend}
                  icon={Award}
                  color="from-gold-primary/20 to-gold-secondary/20"
                  onClick={() => onViewDetails('compliance')}
                />
                <MetricCard
                  title="Security Violations"
                  value={analytics.violations.count}
                  change={-12}
                  trend={derivedMetrics.securityTrend}
                  icon={AlertTriangle}
                  color="from-red-error/20 to-red-warning/20"
                  onClick={() => onViewDetails('violations')}
                />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassMorphism variant="subtle" className="p-4" border>
                  <h3 className="text-lg font-semibold text-cream mb-4">Users by Role</h3>
                  <SimpleChart
                    data={usersByRoleData}
                    title="Users by Role"
                    type="bar"
                  />
                </GlassMorphism>

                <GlassMorphism variant="subtle" className="p-4" border>
                  <h3 className="text-lg font-semibold text-cream mb-4">Role Usage</h3>
                  <SimpleChart
                    data={roleUsageData}
                    title="Most Used Roles"
                    type="bar"
                  />
                </GlassMorphism>
              </div>

              {/* Recent Activity & Compliance Issues */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassMorphism variant="subtle" className="p-4" border>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-cream">Recent Activity</h3>
                    <button
                      onClick={() => onViewDetails('usage', { type: 'activity' })}
                      className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {recentEvents.slice(0, 5).map(event => (
                      <RecentEventItem
                        key={event.id}
                        event={event}
                        onViewDetails={() => onViewDetails('usage', { eventId: event.id })}
                      />
                    ))}
                  </div>
                </GlassMorphism>

                <GlassMorphism variant="subtle" className="p-4" border>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-cream">Compliance Issues</h3>
                    <button
                      onClick={() => onViewDetails('compliance')}
                      className="text-sm text-teal-primary hover:text-teal-secondary transition-colors"
                    >
                      View All
                    </button>
                  </div>
                  <div className="space-y-3">
                    {analytics.compliance.issues.slice(0, 4).map((issue, index) => (
                      <ComplianceIssueItem
                        key={index}
                        issue={issue}
                        onViewDetails={() => onViewDetails('compliance', { issue: issue.type })}
                      />
                    ))}
                  </div>
                </GlassMorphism>
              </div>
            </div>
          )}

          {activeSection === 'users' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <MetricCard
                  title="Total Users"
                  value={analytics.userCount.total}
                  icon={Users}
                  subtitle="Registered users"
                />
                <MetricCard
                  title="Active Users"
                  value={analytics.userCount.active}
                  icon={CheckCircle}
                  color="from-sage/20 to-teal-primary/20"
                  subtitle="Currently active"
                />
                <MetricCard
                  title="Inactive Users"
                  value={analytics.userCount.inactive}
                  icon={XCircle}
                  color="from-red-error/20 to-red-warning/20"
                  subtitle="Inactive accounts"
                />
              </div>

              <GlassMorphism variant="subtle" className="p-4" border>
                <h3 className="text-lg font-semibold text-cream mb-4">User Distribution by Role</h3>
                <div className="grid grid-cols-2 gap-6">
                  <SimpleChart
                    data={usersByRoleData}
                    title="Users by Role"
                    type="bar"
                  />
                  <SimpleChart
                    data={usersByRoleData}
                    title="Role Distribution"
                    type="donut"
                  />
                </div>
              </GlassMorphism>
            </div>
          )}

          {activeSection === 'roles' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <MetricCard
                  title="Most Used Roles"
                  value={analytics.roleUsage.mostUsed.length}
                  icon={Star}
                  color="from-gold-primary/20 to-gold-secondary/20"
                />
                <MetricCard
                  title="Trending Roles"
                  value={analytics.roleUsage.trending.length}
                  icon={TrendingUp}
                  color="from-teal-primary/20 to-sage/20"
                />
                <MetricCard
                  title="Least Used"
                  value={analytics.roleUsage.leastUsed.length}
                  icon={TrendingDown}
                  color="from-red-error/20 to-red-warning/20"
                />
              </div>

              <GlassMorphism variant="subtle" className="p-4" border>
                <h3 className="text-lg font-semibold text-cream mb-4">Role Usage Analytics</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-cream mb-3">Most Used Roles</h4>
                    <SimpleChart
                      data={roleUsageData}
                      title="Most Used"
                      type="bar"
                    />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-cream mb-3">Permission Distribution</h4>
                    <SimpleChart
                      data={analytics.permissionUsage.mostGranted.slice(0, 5).map(p => ({
                        label: p.permission.replace(':', ' '),
                        value: p.count,
                        color: 'from-sage to-teal-primary'
                      }))}
                      title="Top Permissions"
                      type="bar"
                    />
                  </div>
                </div>
              </GlassMorphism>
            </div>
          )}

          {activeSection === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  title="Compliance Score"
                  value={`${analytics.compliance.score}%`}
                  icon={Gauge}
                  color="from-gold-primary/20 to-gold-secondary/20"
                />
                <MetricCard
                  title="Violations"
                  value={analytics.violations.count}
                  icon={AlertTriangle}
                  color="from-red-error/20 to-red-warning/20"
                />
                <MetricCard
                  title="Critical Issues"
                  value={derivedMetrics.criticalIssues}
                  icon={AlertCircle}
                  color="from-red-error/20 to-red-warning/20"
                />
                <MetricCard
                  title="Risk Score"
                  value={analytics.permissionUsage.riskiest[0]?.riskScore || 0}
                  icon={Target}
                  color="from-gold-primary/20 to-gold-secondary/20"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassMorphism variant="subtle" className="p-4" border>
                  <h3 className="text-lg font-semibold text-cream mb-4">Security Violations</h3>
                  <div className="space-y-3">
                    {analytics.violations.recent.slice(0, 5).map(event => (
                      <RecentEventItem
                        key={event.id}
                        event={event}
                        onViewDetails={() => onViewDetails('violations', { eventId: event.id })}
                      />
                    ))}
                  </div>
                </GlassMorphism>

                <GlassMorphism variant="subtle" className="p-4" border>
                  <h3 className="text-lg font-semibold text-cream mb-4">High-Risk Permissions</h3>
                  <div className="space-y-3">
                    {analytics.permissionUsage.riskiest.slice(0, 5).map((item, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-navy-50/10 rounded">
                        <div>
                          <p className="text-sm font-medium text-cream">{item.permission}</p>
                          <p className="text-xs text-sage/70">High-risk permission</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-red-error">{item.riskScore}</p>
                          <p className="text-xs text-sage/50">Risk Score</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassMorphism>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Footer Stats */}
      <div className="mt-6 pt-4 border-t border-sage/10">
        <div className="flex items-center justify-between text-sm text-sage/70">
          <div className="flex items-center gap-6">
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
            <span>Data range: {selectedTimeRange}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-sage rounded-full" />
              <span>Healthy</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-gold-primary rounded-full" />
              <span>Needs Attention</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-red-error rounded-full" />
              <span>Critical</span>
            </div>
          </div>
        </div>
      </div>
    </GlassMorphism>
  );
};

export default RBACDashboard;