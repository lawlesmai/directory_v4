# Story 4.2: Admin Dashboard & Platform Overview

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a platform administrator, I want a comprehensive dashboard that provides real-time platform insights, key performance indicators, and system health monitoring so that I can effectively oversee platform operations.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 1

## Detailed Acceptance Criteria

### Platform Performance Dashboard

**Given** the need for real-time platform oversight  
**When** accessing the admin dashboard  
**Then** display comprehensive platform metrics:

**Key Performance Indicators (KPIs):**
- Total registered users with growth trends (daily, weekly, monthly)
- Active businesses and verified business owners
- Total reviews and average platform rating
- Revenue metrics (MRR, ARR, conversion rates)
- Geographic distribution of users and businesses
- Platform engagement metrics (session duration, page views)
- Support ticket volume and resolution rates

**Real-Time System Health:**
- Server performance metrics (CPU, memory, disk usage)
- Database performance and query response times
- API endpoint health and response times
- CDN performance and cache hit rates
- Error rates and exception monitoring
- Uptime monitoring with historical trends
- Background job queue status and processing times

### User Activity & Engagement Analytics

**Given** the importance of user engagement tracking  
**When** monitoring user activity  
**Then** provide detailed engagement insights:

**User Behavior Analytics:**
- Daily/monthly active users with trend analysis
- New user registration rates and conversion funnels
- User retention rates and cohort analysis
- Feature adoption rates across different user segments
- Geographic user distribution and growth patterns
- Device and browser usage analytics
- Peak usage hours and seasonal patterns

**Business Owner Engagement:**
- Business portal daily active users
- Profile completion rates and optimization metrics
- Subscription tier distribution and conversion rates
- Review response rates and customer engagement
- Marketing tool usage and effectiveness
- Business verification completion rates
- Support interaction frequency and satisfaction

### Revenue & Financial Metrics

**Given** the subscription-based revenue model  
**When** tracking financial performance  
**Then** display comprehensive revenue analytics:

**Subscription Analytics:**
- Monthly Recurring Revenue (MRR) with growth trends
- Annual Recurring Revenue (ARR) projections
- Customer Acquisition Cost (CAC) by channel
- Customer Lifetime Value (CLV) analysis
- Churn rates by subscription tier and cohort
- Revenue per user and average deal size
- Subscription upgrade/downgrade patterns

**Financial Health Indicators:**
- Payment success rates and failed payment recovery
- Refund rates and dispute resolution
- Revenue forecasting with confidence intervals
- Unit economics and profitability analysis
- Market penetration and competitive positioning
- Seasonal revenue patterns and predictions

## Technical Implementation Notes

**Real-Time Data Architecture:**
- WebSocket connections for live dashboard updates
- Efficient data aggregation and caching strategies
- Background processing for heavy analytical calculations
- Alert system integration for critical metric thresholds

**Data Visualization:**
- Interactive charts with drill-down capabilities
- Time-series data visualization with zoom and pan
- Geographic maps for user and business distribution
- Customizable dashboard widgets and layouts

**Performance Optimization:**
- Lazy loading of dashboard components
- Data caching for frequently accessed metrics
- Efficient database queries with proper indexing
- Progressive loading for complex visualizations

## Frontend Implementation

### Admin Dashboard Layout

```typescript
// components/admin/AdminDashboard.tsx
interface AdminDashboardProps {
  user: AdminUser
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds
  
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-dashboard', timeRange],
    queryFn: () => adminApi.getDashboardData({ timeRange }),
    refetchInterval: refreshInterval,
    keepPreviousData: true
  })

  // Real-time updates via WebSocket
  useEffect(() => {
    const ws = new WebSocket('/api/admin/dashboard/live')
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)
      // Update specific dashboard sections
      queryClient.setQueryData(['admin-dashboard', timeRange], (old: any) => ({
        ...old,
        ...update
      }))
    }

    return () => ws.close()
  }, [timeRange])

  return (
    <div className="space-y-6 p-6">
      {/* Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Platform Overview
          </h1>
          <p className="text-sage/70 mt-1">
            Real-time insights and system health monitoring
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
          />
          <RefreshControl
            interval={refreshInterval}
            onIntervalChange={setRefreshInterval}
            onRefresh={refetch}
          />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={dashboardData?.metrics.totalUsers}
          change={dashboardData?.metrics.totalUsersChange}
          trend={dashboardData?.metrics.totalUsersTrend}
          icon={Users}
          color="blue"
        />
        <MetricCard
          title="Active Businesses"
          value={dashboardData?.metrics.activeBusinesses}
          change={dashboardData?.metrics.activeBusinessesChange}
          trend={dashboardData?.metrics.activeBusinessesTrend}
          icon={Building}
          color="green"
        />
        <MetricCard
          title="Monthly Revenue"
          value={dashboardData?.metrics.monthlyRevenue}
          change={dashboardData?.metrics.monthlyRevenueChange}
          trend={dashboardData?.metrics.monthlyRevenueTrend}
          icon={DollarSign}
          color="gold"
          format="currency"
        />
        <MetricCard
          title="System Health"
          value={dashboardData?.metrics.systemHealth}
          status={dashboardData?.metrics.systemHealthStatus}
          icon={Activity}
          color="teal"
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <GlassMorphism variant="subtle" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-semibold text-cream">
              User Growth
            </h3>
            <ChartControls />
          </div>
          <UserGrowthChart
            data={dashboardData?.charts.userGrowth}
            timeRange={timeRange}
            height={300}
          />
        </GlassMorphism>

        {/* Revenue Analytics */}
        <GlassMorphism variant="subtle" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-semibold text-cream">
              Revenue Analytics
            </h3>
            <ChartControls />
          </div>
          <RevenueChart
            data={dashboardData?.charts.revenue}
            timeRange={timeRange}
            height={300}
          />
        </GlassMorphism>
      </div>

      {/* System Health Monitoring */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-heading font-semibold text-cream">
            System Health Monitoring
          </h3>
          <SystemHealthControls />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SystemMetricCard
            title="Server Performance"
            metrics={dashboardData?.systemHealth.server}
            icon={Server}
          />
          <SystemMetricCard
            title="Database Performance"
            metrics={dashboardData?.systemHealth.database}
            icon={Database}
          />
          <SystemMetricCard
            title="API Performance"
            metrics={dashboardData?.systemHealth.api}
            icon={Zap}
          />
        </div>
      </GlassMorphism>

      {/* Geographic Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GlassMorphism variant="subtle" className="p-6">
            <h3 className="text-lg font-heading font-semibold text-cream mb-4">
              Geographic Distribution
            </h3>
            <GeographicMap
              userData={dashboardData?.geographic.users}
              businessData={dashboardData?.geographic.businesses}
              height={400}
            />
          </GlassMorphism>
        </div>
        
        <div className="space-y-6">
          <GlassMorphism variant="subtle" className="p-6">
            <h3 className="text-lg font-heading font-semibold text-cream mb-4">
              Top Regions
            </h3>
            <TopRegionsList
              regions={dashboardData?.geographic.topRegions}
            />
          </GlassMorphism>
          
          <GlassMorphism variant="subtle" className="p-6">
            <h3 className="text-lg font-heading font-semibold text-cream mb-4">
              Recent Activity
            </h3>
            <RecentActivityFeed
              activities={dashboardData?.recentActivity}
            />
          </GlassMorphism>
        </div>
      </div>
    </div>
  )
}
```

### Real-Time Metric Cards

```typescript
// components/admin/dashboard/MetricCard.tsx
interface MetricCardProps {
  title: string
  value: number | string
  change?: number
  trend?: 'up' | 'down' | 'stable'
  icon: LucideIcon
  color: 'blue' | 'green' | 'gold' | 'teal' | 'red'
  format?: 'number' | 'currency' | 'percentage'
  status?: 'healthy' | 'warning' | 'critical'
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  trend,
  icon: Icon,
  color,
  format = 'number',
  status
}) => {
  const formatValue = (val: number | string) => {
    if (typeof val === 'string') return val
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(val)
      case 'percentage':
        return `${val}%`
      default:
        return new Intl.NumberFormat('en-US').format(val)
    }
  }

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
      green: 'from-green-500/20 to-green-600/20 border-green-500/30',
      gold: 'from-gold-primary/20 to-gold-accent/20 border-gold-primary/30',
      teal: 'from-teal-primary/20 to-teal-accent/20 border-teal-primary/30',
      red: 'from-red-error/20 to-red-critical/20 border-red-error/30'
    }
    return colors[color] || colors.blue
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="w-4 h-4 text-green-400" />
      case 'down':
        return <TrendingDown className="w-4 h-4 text-red-400" />
      default:
        return <Minus className="w-4 h-4 text-sage/60" />
    }
  }

  return (
    <GlassMorphism
      variant="medium"
      className={cn(
        'p-6 bg-gradient-to-br border',
        getColorClasses(color)
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn(
          'p-2 rounded-lg',
          `bg-${color}-500/20`
        )}>
          <Icon className={cn('w-6 h-6', `text-${color}-400`)} />
        </div>
        
        {status && (
          <div className={cn(
            'w-3 h-3 rounded-full',
            status === 'healthy' && 'bg-green-400',
            status === 'warning' && 'bg-yellow-400',
            status === 'critical' && 'bg-red-400 animate-pulse'
          )} />
        )}
      </div>
      
      <div>
        <p className="text-sage/70 text-sm font-medium mb-1">{title}</p>
        <p className="text-2xl font-heading font-bold text-cream">
          {formatValue(value)}
        </p>
        
        {change !== undefined && (
          <div className="flex items-center gap-1 mt-2">
            {getTrendIcon()}
            <span className={cn(
              'text-sm font-medium',
              trend === 'up' && 'text-green-400',
              trend === 'down' && 'text-red-400',
              trend === 'stable' && 'text-sage/60'
            )}>
              {change > 0 ? '+' : ''}{change}%
            </span>
            <span className="text-sage/60 text-sm">vs last period</span>
          </div>
        )}
      </div>
    </GlassMorphism>
  )
}
```

## Dependencies

- Story 4.1 (Admin portal foundation and access control)
- Epic 3 Story 3.4 (Analytics infrastructure for business metrics)

## Testing Requirements

**Dashboard Functionality Tests:**
- Real-time data update accuracy and performance tests
- Chart rendering and interaction functionality tests
- Dashboard responsiveness and load time tests
- Data accuracy and calculation validation tests

**Analytics Accuracy Tests:**
- KPI calculation accuracy validation
- Revenue metric calculation and reporting tests
- User engagement tracking accuracy tests
- System health monitoring accuracy validation

**Performance Tests:**
- Dashboard load time optimization tests
- Large dataset visualization performance tests
- Real-time update performance and efficiency tests
- Concurrent admin user dashboard performance tests

## Definition of Done

- [ ] Comprehensive admin dashboard with real-time KPIs
- [ ] User activity and engagement analytics functional
- [ ] Revenue and financial metrics tracking operational
- [ ] System health monitoring with alerting
- [ ] Interactive data visualizations implemented
- [ ] Mobile-responsive admin dashboard design
- [ ] Real-time data updates without performance degradation
- [ ] Customizable dashboard widgets and layouts
- [ ] Performance optimization for large datasets
- [ ] All dashboard functionality tests passing

## Risk Assessment

- **Medium Risk:** Real-time dashboard may impact database performance
- **Low Risk:** Data visualization implementation complexity
- **Mitigation:** Query optimization and efficient caching strategies