'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Database,
  Shield,
  Activity,
  AlertTriangle,
  TrendingUp,
  Clock,
  Globe,
  CheckCircle,
  XCircle,
  Zap,
  Eye,
  BarChart3,
  DollarSign
} from 'lucide-react';
import { AdminDashboardLayout } from '@/components/admin/AdminDashboardLayout';
import { GlassMorphism } from '@/components/GlassMorphism';
import { cn } from '@/lib/utils';

// Mock data for dashboard
const dashboardStats = {
  users: {
    total: 12453,
    active: 8921,
    newToday: 47,
    growth: 5.2
  },
  businesses: {
    total: 3247,
    verified: 2891,
    pendingVerification: 156,
    growth: 3.8
  },
  revenue: {
    total: 248750,
    monthly: 89420,
    growth: 12.3
  },
  security: {
    failedLogins: 23,
    suspiciousActivity: 5,
    blockedIPs: 12
  }
};

const recentActivities = [
  {
    id: '1',
    type: 'user_suspended',
    admin: 'admin@lawlessdirectory.com',
    description: 'Suspended user account due to policy violation',
    timestamp: new Date(Date.now() - 5 * 60 * 1000),
    severity: 'high' as const
  },
  {
    id: '2',
    type: 'business_verified',
    admin: 'platform@lawlessdirectory.com',
    description: 'Verified business: Acme Corporation',
    timestamp: new Date(Date.now() - 15 * 60 * 1000),
    severity: 'medium' as const
  },
  {
    id: '3',
    type: 'security_alert',
    admin: 'system',
    description: 'Multiple failed login attempts detected',
    timestamp: new Date(Date.now() - 30 * 60 * 1000),
    severity: 'high' as const
  },
  {
    id: '4',
    type: 'content_flagged',
    admin: 'moderator@lawlessdirectory.com',
    description: 'Flagged inappropriate review content',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    severity: 'low' as const
  },
  {
    id: '5',
    type: 'settings_updated',
    admin: 'admin@lawlessdirectory.com',
    description: 'Updated security settings: session timeout',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    severity: 'medium' as const
  }
];

const systemHealth = [
  { name: 'API Response Time', value: 145, unit: 'ms', status: 'good' as const },
  { name: 'Database Performance', value: 98.5, unit: '%', status: 'excellent' as const },
  { name: 'Server Load', value: 23, unit: '%', status: 'good' as const },
  { name: 'Memory Usage', value: 67, unit: '%', status: 'warning' as const },
  { name: 'Disk Space', value: 34, unit: '%', status: 'good' as const },
  { name: 'Error Rate', value: 0.02, unit: '%', status: 'excellent' as const }
];

const StatCard: React.FC<{
  title: string;
  value: string | number;
  change: number;
  icon: React.ComponentType<any>;
  color: string;
}> = ({ title, value, change, icon: Icon, color }) => {
  const isPositive = change > 0;
  
  return (
    <GlassMorphism variant="medium" className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-sage/60 mb-1">{title}</p>
          <p className="text-3xl font-bold text-cream mb-2">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          <div className={cn('flex items-center gap-1 text-sm', isPositive ? 'text-green-400' : 'text-red-400')}>
            <TrendingUp className={cn('w-4 h-4', !isPositive && 'rotate-180')} />
            <span>{Math.abs(change)}% from last month</span>
          </div>
        </div>
        <div className={cn('p-3 rounded-lg', color)}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </GlassMorphism>
  );
};

const ActivityItem: React.FC<{ activity: typeof recentActivities[0] }> = ({ activity }) => {
  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
    }
  };

  const getActivityIcon = (type: string) => {
    if (type.includes('user')) return Users;
    if (type.includes('business')) return Database;
    if (type.includes('security')) return Shield;
    if (type.includes('content')) return Eye;
    if (type.includes('settings')) return Activity;
    return Activity;
  };

  const Icon = getActivityIcon(activity.type);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 p-3 hover:bg-navy-dark/30 rounded-lg transition-colors"
    >
      <div className="p-2 bg-teal-primary/10 rounded-lg">
        <Icon className="w-4 h-4 text-teal-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-cream font-medium">{activity.description}</p>
        <div className="flex items-center gap-2 mt-1 text-xs text-sage/60">
          <span>{activity.admin}</span>
          <span>•</span>
          <span>{formatTimeAgo(activity.timestamp)}</span>
          <span>•</span>
          <span className={getSeverityColor(activity.severity)}>
            {activity.severity.toUpperCase()}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const HealthIndicator: React.FC<{ metric: typeof systemHealth[0] }> = ({ metric }) => {
  const getStatusColor = (status: 'excellent' | 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
    }
  };

  const getStatusIcon = (status: 'excellent' | 'good' | 'warning' | 'critical') => {
    switch (status) {
      case 'excellent':
      case 'good':
        return CheckCircle;
      case 'warning':
        return AlertTriangle;
      case 'critical':
        return XCircle;
    }
  };

  const StatusIcon = getStatusIcon(metric.status);

  return (
    <div className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg">
      <div>
        <p className="text-sm text-cream font-medium">{metric.name}</p>
        <p className="text-xs text-sage/60 mt-1">
          {metric.value}{metric.unit}
        </p>
      </div>
      <div className={cn('flex items-center gap-1', getStatusColor(metric.status))}>
        <StatusIcon className="w-4 h-4" />
        <span className="text-xs font-medium capitalize">{metric.status}</span>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  return (
    <AdminDashboardLayout>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-cream">Admin Dashboard</h1>
            <p className="text-sage/70 mt-2">
              Welcome to the Lawless Directory admin portal. Monitor platform activity and manage operations.
            </p>
          </div>
          <div className="flex items-center gap-2 text-teal-primary">
            <Zap className="w-5 h-5" />
            <span className="text-sm font-medium">Real-time</span>
          </div>
        </div>

        {/* Key Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={dashboardStats.users.total}
            change={dashboardStats.users.growth}
            icon={Users}
            color="bg-blue-500/10 text-blue-400"
          />
          
          <StatCard
            title="Active Businesses"
            value={dashboardStats.businesses.total}
            change={dashboardStats.businesses.growth}
            icon={Database}
            color="bg-green-500/10 text-green-400"
          />
          
          <StatCard
            title="Monthly Revenue"
            value={`$${(dashboardStats.revenue.monthly / 1000).toFixed(0)}k`}
            change={dashboardStats.revenue.growth}
            icon={DollarSign}
            color="bg-purple-500/10 text-purple-400"
          />
          
          <StatCard
            title="Security Alerts"
            value={dashboardStats.security.failedLogins + dashboardStats.security.suspiciousActivity}
            change={-15.2}
            icon={Shield}
            color="bg-red-500/10 text-red-400"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Activity */}
          <div className="lg:col-span-2">
            <GlassMorphism variant="medium" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-cream">Recent Activity</h2>
                <button className="text-teal-primary hover:text-teal-secondary transition-colors">
                  <span className="text-sm">View All</span>
                </button>
              </div>
              
              <div className="space-y-1">
                {recentActivities.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </GlassMorphism>
          </div>

          {/* System Health */}
          <div>
            <GlassMorphism variant="medium" className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-cream">System Health</h2>
                <div className="flex items-center gap-1 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-xs font-medium">Operational</span>
                </div>
              </div>
              
              <div className="space-y-3">
                {systemHealth.map((metric, index) => (
                  <HealthIndicator key={index} metric={metric} />
                ))}
              </div>
            </GlassMorphism>
          </div>
        </div>

        {/* Quick Actions & Insights */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Quick Actions */}
          <GlassMorphism variant="medium" className="p-6">
            <h2 className="text-xl font-bold text-cream mb-6">Quick Actions</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center gap-2 p-4 bg-navy-dark/30 rounded-lg hover:bg-teal-primary/10 transition-colors group">
                <Users className="w-8 h-8 text-sage/60 group-hover:text-teal-primary transition-colors" />
                <span className="text-sm text-cream">Manage Users</span>
              </button>
              
              <button className="flex flex-col items-center gap-2 p-4 bg-navy-dark/30 rounded-lg hover:bg-teal-primary/10 transition-colors group">
                <Database className="w-8 h-8 text-sage/60 group-hover:text-teal-primary transition-colors" />
                <span className="text-sm text-cream">Business Review</span>
              </button>
              
              <button className="flex flex-col items-center gap-2 p-4 bg-navy-dark/30 rounded-lg hover:bg-teal-primary/10 transition-colors group">
                <Shield className="w-8 h-8 text-sage/60 group-hover:text-teal-primary transition-colors" />
                <span className="text-sm text-cream">Security Center</span>
              </button>
              
              <button className="flex flex-col items-center gap-2 p-4 bg-navy-dark/30 rounded-lg hover:bg-teal-primary/10 transition-colors group">
                <BarChart3 className="w-8 h-8 text-sage/60 group-hover:text-teal-primary transition-colors" />
                <span className="text-sm text-cream">Analytics</span>
              </button>
            </div>
          </GlassMorphism>

          {/* Platform Insights */}
          <GlassMorphism variant="medium" className="p-6">
            <h2 className="text-xl font-bold text-cream mb-6">Platform Insights</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-cream">Peak Usage Hours</p>
                  <p className="text-xs text-sage/60">2:00 PM - 5:00 PM EST</p>
                </div>
                <Clock className="w-5 h-5 text-teal-primary" />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-cream">Top Geographic Region</p>
                  <p className="text-xs text-sage/60">California, USA (34%)</p>
                </div>
                <Globe className="w-5 h-5 text-teal-primary" />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-cream">New Users Today</p>
                  <p className="text-xs text-sage/60">{dashboardStats.users.newToday} registrations</p>
                </div>
                <Users className="w-5 h-5 text-teal-primary" />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-navy-dark/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-cream">Pending Verifications</p>
                  <p className="text-xs text-sage/60">{dashboardStats.businesses.pendingVerification} businesses</p>
                </div>
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </GlassMorphism>
        </div>
      </div>
    </AdminDashboardLayout>
  );
}