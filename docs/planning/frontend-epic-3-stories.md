# Frontend Epic 3: Business Portal Dashboard & Data Visualization - Comprehensive Implementation Stories

**Date:** 2024-08-23  
**Epic Lead:** Frontend Developer Agent  
**Priority:** P0 (Core Business Value)  
**Duration:** 5 Sprints (15 weeks)  
**Story Points Total:** 172 points

## Epic Mission Statement

Create a sophisticated business portal dashboard that provides comprehensive data visualization, analytics insights, review management, and business optimization tools. The interface should maintain premium aesthetics while delivering actionable business intelligence through interactive charts, real-time metrics, and intuitive management workflows.

## Business Portal Architecture Context

**Dashboard Requirements:**
- Real-time business analytics and performance metrics
- Interactive data visualizations with drill-down capabilities
- Review management system with sentiment analysis
- Business profile management with media handling
- Marketing tools and promotional campaign management
- Multi-location business support and coordination
- Subscription tier feature gating and upgrade flows

**Technical Architecture:**
- React 18 with concurrent features for smooth interactions
- D3.js and Recharts for advanced data visualizations
- React Query for real-time data synchronization
- Zustand for complex dashboard state management
- Framer Motion for sophisticated micro-interactions
- React Hook Form for complex business data forms
- WebSocket integration for real-time notifications

**Performance Targets:**
- Dashboard initial load < 2s
- Chart rendering < 500ms
- Real-time updates < 100ms latency
- Data export generation < 3s
- File upload progress accuracy 99%+
- Mobile dashboard usability score > 85%

---

## Story F3.1: Business Dashboard Foundation & Navigation Architecture

**User Story:** As a frontend developer, I want to create a flexible dashboard foundation with sophisticated navigation, layout management, and state synchronization that serves as the base for all business portal functionality.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 1

### Detailed Acceptance Criteria

**Dashboard Layout System:**
- **Given** business dashboard requirements
- **When** implementing dashboard foundation
- **Then** create:

```typescript
// components/business/dashboard/DashboardLayout.tsx
interface DashboardLayoutProps {
  children: React.ReactNode
  user: BusinessUser
  selectedLocation?: BusinessLocation
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  user,
  selectedLocation
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { businesses, selectedBusinessId, setSelectedBusiness } = useBusinessStore()
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const currentBusiness = businesses.find(b => b.id === selectedBusinessId)
  
  useEffect(() => {
    if (isMobile) {
      setSidebarCollapsed(true)
    }
  }, [isMobile])

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary/10 to-navy-dark">
      {/* Mobile Header */}
      {isMobile && (
        <MobileHeader
          business={currentBusiness}
          onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          onBusinessSwitch={setSelectedBusiness}
        />
      )}

      <div className="flex h-screen">
        {/* Sidebar */}
        <AnimatePresence>
          <motion.aside
            initial={isMobile ? { x: '-100%' } : { width: 280 }}
            animate={{
              x: mobileMenuOpen || !isMobile ? 0 : '-100%',
              width: !isMobile ? (sidebarCollapsed ? 64 : 280) : 280
            }}
            transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className={cn(
              'relative flex flex-col',
              'bg-navy-90/80 backdrop-blur-xl border-r border-sage/20',
              isMobile ? 'fixed inset-y-0 left-0 z-40 w-80' : ''
            )}
          >
            <DashboardSidebar
              collapsed={sidebarCollapsed && !isMobile}
              businesses={businesses}
              currentBusiness={currentBusiness}
              selectedLocation={selectedLocation}
              onBusinessSelect={setSelectedBusiness}
              onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </motion.aside>
        </AnimatePresence>

        {/* Mobile Overlay */}
        {isMobile && mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-30"
          />
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Desktop Header */}
          {!isMobile && (
            <DashboardHeader
              business={currentBusiness}
              user={user}
              onBusinessSwitch={setSelectedBusiness}
            />
          )}

          {/* Content Area */}
          <main className="flex-1 overflow-auto">
            <div className="h-full">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Real-time Notifications */}
      <NotificationCenter businessId={selectedBusinessId} />
      
      {/* Quick Actions Fab (Mobile) */}
      {isMobile && (
        <QuickActionsFab business={currentBusiness} />
      )}
    </div>
  )
}
```

**Sidebar Navigation Component:**
- **Given** dashboard navigation requirements
- **When** implementing sidebar navigation
- **Then** create:

```typescript
// components/business/dashboard/DashboardSidebar.tsx
interface NavigationItem {
  id: string
  label: string
  icon: React.ComponentType<any>
  href?: string
  badge?: number
  children?: NavigationItem[]
  subscription?: SubscriptionTier[]
  disabled?: boolean
}

const navigationItems: NavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BarChart3,
    href: '/dashboard'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: TrendingUp,
    href: '/dashboard/analytics',
    subscription: ['premium', 'elite']
  },
  {
    id: 'reviews',
    label: 'Reviews',
    icon: MessageSquare,
    href: '/dashboard/reviews',
    badge: 5 // Dynamic from store
  },
  {
    id: 'profile',
    label: 'Business Profile',
    icon: Building,
    href: '/dashboard/profile'
  },
  {
    id: 'marketing',
    label: 'Marketing',
    icon: Megaphone,
    href: '/dashboard/marketing',
    subscription: ['premium', 'elite'],
    children: [
      {
        id: 'campaigns',
        label: 'Campaigns',
        icon: Target,
        href: '/dashboard/marketing/campaigns'
      },
      {
        id: 'promotions',
        label: 'Promotions',
        icon: Tag,
        href: '/dashboard/marketing/promotions'
      }
    ]
  },
  {
    id: 'locations',
    label: 'Locations',
    icon: MapPin,
    href: '/dashboard/locations'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/dashboard/settings'
  }
]

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  collapsed,
  businesses,
  currentBusiness,
  onBusinessSelect,
  onToggleCollapse
}) => {
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const { unreadReviewsCount, subscription } = useBusinessStore()

  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const isItemAccessible = (item: NavigationItem) => {
    if (!item.subscription) return true
    return item.subscription.includes(subscription?.tier || 'basic')
  }

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const isActive = pathname === item.href
    const isExpanded = expandedItems.includes(item.id)
    const hasChildren = item.children && item.children.length > 0
    const accessible = isItemAccessible(item)
    const Icon = item.icon

    return (
      <div key={item.id}>
        <Tooltip 
          content={item.label} 
          disabled={!collapsed}
          side="right"
        >
          <div
            className={cn(
              'group relative flex items-center gap-3 rounded-lg transition-all duration-200',
              level === 0 ? 'px-3 py-2 mx-2' : 'px-3 py-1.5 mx-2 ml-8',
              isActive && 'bg-teal-primary/20 text-teal-primary',
              !isActive && accessible && 'text-sage/80 hover:bg-navy-50/20 hover:text-cream',
              !accessible && 'text-sage/40 cursor-not-allowed'
            )}
          >
            {item.href && accessible ? (
              <Link href={item.href} className="flex items-center gap-3 flex-1 min-w-0">
                <Icon className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isActive ? 'text-teal-primary' : 'text-current'
                )} />
                
                {!collapsed && (
                  <span className="font-medium truncate">
                    {item.label}
                  </span>
                )}
              </Link>
            ) : (
              <div 
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => hasChildren && accessible && toggleExpanded(item.id)}
              >
                <Icon className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isActive ? 'text-teal-primary' : 'text-current'
                )} />
                
                {!collapsed && (
                  <span className="font-medium truncate">
                    {item.label}
                  </span>
                )}
              </div>
            )}

            {/* Badge */}
            {!collapsed && item.badge && item.badge > 0 && (
              <span className="flex items-center justify-center min-w-[20px] h-5 bg-red-error text-cream text-xs rounded-full px-1.5">
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            )}

            {/* Premium Lock Icon */}
            {!collapsed && !accessible && (
              <Lock className="w-4 h-4 text-sage/40" />
            )}

            {/* Expand/Collapse Icon */}
            {!collapsed && hasChildren && accessible && (
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-sage/60 transition-transform duration-200',
                  isExpanded && 'rotate-90'
                )}
              />
            )}
          </div>
        </Tooltip>

        {/* Children */}
        {!collapsed && hasChildren && accessible && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="py-1">
                  {item.children!.map(child => renderNavigationItem(child, level + 1))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className={cn(
        'flex items-center gap-3 p-4 border-b border-sage/20',
        collapsed && 'justify-center px-2'
      )}>
        {!collapsed && (
          <>
            <Logo className="w-8 h-8" />
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-semibold text-cream truncate">
                Business Portal
              </h2>
            </div>
          </>
        )}
        
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg hover:bg-navy-50/20 transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <PanelRightOpen className="w-5 h-5 text-sage/70" />
          ) : (
            <PanelRightClose className="w-5 h-5 text-sage/70" />
          )}
        </button>
      </div>

      {/* Business Selector */}
      {!collapsed && businesses.length > 1 && (
        <div className="p-4 border-b border-sage/20">
          <BusinessSelector
            businesses={businesses}
            currentBusiness={currentBusiness}
            onSelect={onBusinessSelect}
          />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {navigationItems.map(item => renderNavigationItem(item))}
      </nav>

      {/* Subscription Upgrade CTA */}
      {!collapsed && subscription?.tier === 'basic' && (
        <div className="p-4 border-t border-sage/20">
          <SubscriptionUpgradeCTA compact />
        </div>
      )}
    </>
  )
}
```

**Dashboard State Management:**
- **Given** complex dashboard state requirements
- **When** implementing state management
- **Then** create:

```typescript
// stores/useDashboardStore.ts
interface DashboardState {
  selectedBusinessId: string | null
  selectedLocationId: string | null
  selectedDateRange: DateRange
  dashboardLayout: DashboardWidget[]
  realtimeEnabled: boolean
  notifications: DashboardNotification[]
  quickStats: BusinessQuickStats | null
  isLoading: boolean
  error: string | null
}

interface DashboardActions {
  setSelectedBusiness: (businessId: string) => void
  setSelectedLocation: (locationId: string | null) => void
  setDateRange: (dateRange: DateRange) => void
  updateLayout: (layout: DashboardWidget[]) => void
  toggleRealtime: () => void
  addNotification: (notification: DashboardNotification) => void
  removeNotification: (notificationId: string) => void
  updateQuickStats: (stats: BusinessQuickStats) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useDashboardStore = create<DashboardState & DashboardActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        selectedBusinessId: null,
        selectedLocationId: null,
        selectedDateRange: {
          from: subDays(new Date(), 30),
          to: new Date()
        },
        dashboardLayout: defaultDashboardLayout,
        realtimeEnabled: true,
        notifications: [],
        quickStats: null,
        isLoading: false,
        error: null,

        // Actions
        setSelectedBusiness: (businessId) =>
          set({ selectedBusinessId: businessId }, false, 'setSelectedBusiness'),

        setSelectedLocation: (locationId) =>
          set({ selectedLocationId: locationId }, false, 'setSelectedLocation'),

        setDateRange: (dateRange) =>
          set({ selectedDateRange: dateRange }, false, 'setDateRange'),

        updateLayout: (layout) =>
          set({ dashboardLayout: layout }, false, 'updateLayout'),

        toggleRealtime: () =>
          set((state) => ({ 
            realtimeEnabled: !state.realtimeEnabled 
          }), false, 'toggleRealtime'),

        addNotification: (notification) =>
          set((state) => ({
            notifications: [notification, ...state.notifications]
          }), false, 'addNotification'),

        removeNotification: (notificationId) =>
          set((state) => ({
            notifications: state.notifications.filter(n => n.id !== notificationId)
          }), false, 'removeNotification'),

        updateQuickStats: (stats) =>
          set({ quickStats: stats }, false, 'updateQuickStats'),

        setLoading: (loading) =>
          set({ isLoading: loading }, false, 'setLoading'),

        setError: (error) =>
          set({ error }, false, 'setError')
      }),
      {
        name: 'dashboard-store',
        partialize: (state) => ({
          selectedBusinessId: state.selectedBusinessId,
          selectedLocationId: state.selectedLocationId,
          selectedDateRange: state.selectedDateRange,
          dashboardLayout: state.dashboardLayout,
          realtimeEnabled: state.realtimeEnabled
        })
      }
    ),
    { name: 'DashboardStore' }
  )
)
```

### Technical Implementation Requirements

**Responsive Dashboard Framework:**
- Automatic layout adaptation for mobile devices
- Touch-friendly navigation and controls
- Collapsible sidebar with gesture support
- Optimized loading states for mobile networks

**Real-time Data Integration:**
- WebSocket connection management
- Automatic reconnection on network issues
- Optimistic updates for immediate feedback
- Background sync for offline/online transitions

### Testing Requirements

**Dashboard Foundation Testing:**
- Navigation state persistence testing
- Responsive layout validation
- Real-time connection stability testing
- Performance benchmarking for layout transitions

---

## Story F3.2: Interactive Data Visualization & Chart Components

**User Story:** As a frontend developer, I want to create sophisticated interactive data visualization components using D3.js and Recharts that provide business owners with actionable insights through beautiful, responsive charts and graphs.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 25  
**Sprint:** 1

### Detailed Acceptance Criteria

**Chart Component Library:**
- **Given** data visualization requirements
- **When** implementing chart components
- **Then** create:

```typescript
// components/business/analytics/ChartComponents.tsx
interface BaseChartProps {
  data: any[]
  className?: string
  height?: number
  loading?: boolean
  error?: string | null
  onDataPointClick?: (data: any) => void
}

// Revenue Trend Chart
export const RevenueTrendChart: React.FC<BaseChartProps & {
  dateRange: DateRange
  interval: 'daily' | 'weekly' | 'monthly'
}> = ({ 
  data, 
  dateRange, 
  interval, 
  height = 400, 
  className, 
  loading, 
  error,
  onDataPointClick 
}) => {
  const [hoveredPoint, setHoveredPoint] = useState<any>(null)
  const [selectedMetric, setSelectedMetric] = useState<'revenue' | 'orders' | 'customers'>('revenue')

  if (loading) {
    return (
      <div className={cn('w-full bg-navy-50/20 rounded-lg animate-pulse', className)} style={{ height }}>
        <div className="flex items-center justify-center h-full">
          <LoadingSpinner size="lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn('w-full bg-red-error/10 border border-red-error/20 rounded-lg p-8 text-center', className)} style={{ height }}>
        <AlertTriangle className="w-8 h-8 text-red-error mx-auto mb-4" />
        <p className="text-red-error">{error}</p>
      </div>
    )
  }

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case 'revenue':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value)
      case 'orders':
        return value.toLocaleString()
      case 'customers':
        return value.toLocaleString()
      default:
        return value.toString()
    }
  }

  return (
    <GlassMorphism variant="subtle" className={cn('p-6', className)}>
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-heading font-semibold text-cream">
            Revenue Trends
          </h3>
          <p className="text-sm text-sage/70">
            {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {(['revenue', 'orders', 'customers'] as const).map((metric) => (
            <button
              key={metric}
              onClick={() => setSelectedMetric(metric)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                selectedMetric === metric
                  ? 'bg-teal-primary text-cream'
                  : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
              )}
            >
              {metric.charAt(0).toUpperCase() + metric.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: height - 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0A9396" stopOpacity={0.8} />
                <stop offset="100%" stopColor="#0A9396" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94D2BD', fontSize: 12 }}
              tickFormatter={(value) => format(new Date(value), 'MMM d')}
            />
            
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94D2BD', fontSize: 12 }}
              tickFormatter={formatValue}
            />
            
            <CartesianGrid strokeDasharray="3 3" stroke="#94D2BD" opacity={0.2} />
            
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                
                return (
                  <GlassMorphism variant="strong" className="p-4 min-w-[200px]">
                    <p className="text-cream font-medium mb-2">
                      {format(new Date(label), 'MMM d, yyyy')}
                    </p>
                    {payload.map((entry, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sage/70 text-sm">
                          {entry.name}:
                        </span>
                        <span className="text-cream font-medium ml-2">
                          {formatValue(entry.value as number)}
                        </span>
                      </div>
                    ))}
                  </GlassMorphism>
                )
              }}
            />
            
            <Area
              type="monotone"
              dataKey={selectedMetric}
              stroke="#0A9396"
              strokeWidth={2}
              fill="url(#revenueGradient)"
              dot={{ fill: '#0A9396', strokeWidth: 2, r: 4 }}
              activeDot={{
                r: 6,
                stroke: '#0A9396',
                strokeWidth: 2,
                fill: '#E9D8A6'
              }}
              onClick={onDataPointClick}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassMorphism>
  )
}

// Performance Metrics Donut Chart
export const PerformanceDonutChart: React.FC<BaseChartProps & {
  metrics: PerformanceMetric[]
}> = ({ metrics, height = 300, className, loading, error }) => {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)

  if (loading) {
    return <ChartSkeleton height={height} className={className} />
  }

  if (error) {
    return <ChartError error={error} height={height} className={className} />
  }

  const total = metrics.reduce((sum, metric) => sum + metric.value, 0)
  const colors = ['#0A9396', '#94D2BD', '#EE9B00', '#CA6702', '#005F73']

  return (
    <GlassMorphism variant="subtle" className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-heading font-semibold text-cream">
          Performance Breakdown
        </h3>
      </div>

      <div className="flex items-center gap-8">
        {/* Chart */}
        <div style={{ width: height - 120, height: height - 120 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={metrics}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                onMouseEnter={(_, index) => setSelectedSegment(metrics[index].id)}
                onMouseLeave={() => setSelectedSegment(null)}
              >
                {metrics.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                    stroke={selectedSegment === entry.id ? '#E9D8A6' : 'none'}
                    strokeWidth={selectedSegment === entry.id ? 2 : 0}
                  />
                ))}
              </Pie>
              
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const data = payload[0].payload
                  
                  return (
                    <GlassMorphism variant="strong" className="p-3">
                      <p className="text-cream font-medium">{data.label}</p>
                      <p className="text-sage/70 text-sm">
                        {data.value.toLocaleString()} ({((data.value / total) * 100).toFixed(1)}%)
                      </p>
                    </GlassMorphism>
                  )
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-3">
          {metrics.map((metric, index) => (
            <div
              key={metric.id}
              className={cn(
                'flex items-center gap-3 p-2 rounded-lg transition-colors cursor-pointer',
                selectedSegment === metric.id && 'bg-navy-50/20'
              )}
              onMouseEnter={() => setSelectedSegment(metric.id)}
              onMouseLeave={() => setSelectedSegment(null)}
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <div className="flex-1">
                <p className="text-cream text-sm font-medium">{metric.label}</p>
                <p className="text-sage/70 text-xs">
                  {metric.value.toLocaleString()} ({((metric.value / total) * 100).toFixed(1)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </GlassMorphism>
  )
}

// Heatmap Chart for Location/Time Analysis
export const BusinessHeatmapChart: React.FC<BaseChartProps & {
  heatmapData: HeatmapDataPoint[]
  xAxisLabel: string
  yAxisLabel: string
}> = ({ 
  heatmapData, 
  xAxisLabel, 
  yAxisLabel, 
  height = 400, 
  className, 
  loading, 
  error 
}) => {
  if (loading) return <ChartSkeleton height={height} className={className} />
  if (error) return <ChartError error={error} height={height} className={className} />

  return (
    <GlassMorphism variant="subtle" className={cn('p-6', className)}>
      <div className="mb-6">
        <h3 className="text-lg font-heading font-semibold text-cream mb-2">
          Activity Heatmap
        </h3>
        <div className="flex items-center gap-4">
          <span className="text-sm text-sage/70">{yAxisLabel}</span>
          <div className="flex-1 border-t border-sage/20" />
          <span className="text-sm text-sage/70">{xAxisLabel}</span>
        </div>
      </div>

      <div style={{ height: height - 120 }}>
        <HeatmapVisualization 
          data={heatmapData}
          colorScale={['#001219', '#005F73', '#0A9396', '#94D2BD', '#E9D8A6']}
        />
      </div>
    </GlassMorphism>
  )
}
```

**Advanced Chart Interactions:**
- **Given** interactive visualization requirements
- **When** implementing chart interactions
- **Then** create:
  - Drill-down capabilities for detailed views
  - Brush selection for time range filtering
  - Tooltip system with contextual information
  - Export functionality for charts and data
  - Real-time data streaming capabilities

**Chart Performance Optimization:**
- **Given** large dataset rendering requirements
- **When** optimizing chart performance
- **Then** implement:
  - Data virtualization for large datasets
  - Progressive loading with pagination
  - Canvas rendering for high-performance scenarios
  - Memoization for expensive calculations
  - Debounced interactions to prevent lag

### Testing Requirements

**Chart Component Testing:**
- Data rendering accuracy testing
- Interactive features functionality testing
- Responsive behavior validation
- Performance benchmarking with large datasets
- Accessibility compliance testing

---

## Story F3.3: Business Analytics Dashboard & KPI Tracking

**User Story:** As a frontend developer, I want to create a comprehensive analytics dashboard that displays key business metrics, performance indicators, and actionable insights in an intuitive and visually appealing interface.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 23  
**Sprint:** 2

### Detailed Acceptance Criteria

**Analytics Dashboard Overview:**
- **Given** business analytics requirements
- **When** implementing analytics dashboard
- **Then** create:

```typescript
// components/business/analytics/AnalyticsDashboard.tsx
export const AnalyticsDashboard: React.FC = () => {
  const { selectedBusinessId, selectedDateRange } = useDashboardStore()
  const [selectedKPIs, setSelectedKPIs] = useState<KPIType[]>(defaultKPIs)
  const [comparisonPeriod, setComparisonPeriod] = useState<ComparisonPeriod>('previous')
  
  const {
    data: analytics,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['business-analytics', selectedBusinessId, selectedDateRange, selectedKPIs],
    queryFn: () => analyticsApi.getBusinessAnalytics({
      businessId: selectedBusinessId!,
      dateRange: selectedDateRange,
      kpis: selectedKPIs,
      comparison: comparisonPeriod
    }),
    enabled: !!selectedBusinessId,
    refetchInterval: 5 * 60 * 1000, // 5 minutes
    staleTime: 2 * 60 * 1000 // 2 minutes
  })

  if (isLoading) {
    return <AnalyticsDashboardSkeleton />
  }

  if (error) {
    return (
      <ErrorState
        title="Unable to load analytics"
        description="We're having trouble loading your analytics data. Please try again."
        action={{
          label: 'Retry',
          onClick: () => refetch()
        }}
      />
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Dashboard Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Business Analytics
          </h1>
          <p className="text-sage/70 mt-1">
            Insights and performance metrics for your business
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <DateRangePicker
            value={selectedDateRange}
            onChange={(range) => useDashboardStore.getState().setDateRange(range)}
            presets={[
              { label: 'Last 7 days', days: 7 },
              { label: 'Last 30 days', days: 30 },
              { label: 'Last 90 days', days: 90 },
              { label: 'Last year', days: 365 }
            ]}
          />
          
          <KPISelector
            selected={selectedKPIs}
            onChange={setSelectedKPIs}
            available={availableKPIs}
          />
          
          <AnalyticsExportButton
            businessId={selectedBusinessId}
            dateRange={selectedDateRange}
            analytics={analytics}
          />
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {analytics?.kpis.map((kpi) => (
          <KPICard
            key={kpi.id}
            kpi={kpi}
            comparison={kpi.comparison}
            onClick={() => handleKPIClick(kpi)}
          />
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue Trends */}
        <RevenueTrendChart
          data={analytics?.revenueData || []}
          dateRange={selectedDateRange}
          interval={getOptimalInterval(selectedDateRange)}
          onDataPointClick={handleRevenuePointClick}
        />

        {/* Customer Acquisition */}
        <CustomerAcquisitionChart
          data={analytics?.customerData || []}
          dateRange={selectedDateRange}
        />

        {/* Review Sentiment Analysis */}
        <SentimentAnalysisChart
          data={analytics?.sentimentData || []}
          dateRange={selectedDateRange}
        />

        {/* Traffic Sources */}
        <TrafficSourcesChart
          data={analytics?.trafficData || []}
        />
      </div>

      {/* Detailed Analytics Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Performing Content */}
        <TopContentSection
          content={analytics?.topContent || []}
          onContentClick={handleContentClick}
        />

        {/* Peak Hours Analysis */}
        <PeakHoursHeatmap
          data={analytics?.peakHoursData || []}
          timezone={analytics?.business.timezone}
        />

        {/* Competitive Insights */}
        <CompetitiveInsights
          data={analytics?.competitiveData}
          businessCategory={analytics?.business.category}
        />
      </div>

      {/* AI-Powered Insights */}
      <AIInsightsSection
        insights={analytics?.aiInsights || []}
        onInsightAction={handleInsightAction}
      />
    </div>
  )
}

// KPI Card Component
interface KPICardProps {
  kpi: BusinessKPI
  comparison?: KPIComparison
  onClick: () => void
}

const KPICard: React.FC<KPICardProps> = ({ kpi, comparison, onClick }) => {
  const isPositive = comparison && comparison.change > 0
  const isNegative = comparison && comparison.change < 0
  const changePercentage = comparison ? Math.abs(comparison.change) : 0

  return (
    <GlassMorphism
      variant="subtle"
      className="p-6 cursor-pointer hover:bg-navy-50/30 transition-all duration-200 hover:scale-[1.02]"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <kpi.icon className="w-5 h-5 text-sage/70" />
            <h3 className="text-sm font-medium text-sage/70 uppercase tracking-wide">
              {kpi.label}
            </h3>
          </div>
          
          <div className="mb-3">
            <span className="text-2xl font-heading font-bold text-cream">
              {kpi.formatValue(kpi.value)}
            </span>
            {kpi.unit && (
              <span className="text-sm text-sage/70 ml-1">
                {kpi.unit}
              </span>
            )}
          </div>

          {comparison && (
            <div className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                isPositive && 'bg-sage/20 text-sage',
                isNegative && 'bg-red-error/20 text-red-error',
                !isPositive && !isNegative && 'bg-sage/10 text-sage/70'
              )}>
                {isPositive && <TrendingUp className="w-3 h-3" />}
                {isNegative && <TrendingDown className="w-3 h-3" />}
                {!isPositive && !isNegative && <Minus className="w-3 h-3" />}
                
                <span>
                  {changePercentage.toFixed(1)}%
                </span>
              </div>
              
              <span className="text-xs text-sage/60">
                vs {comparison.period}
              </span>
            </div>
          )}
        </div>

        {/* Mini Trend Chart */}
        {kpi.trendData && (
          <div className="w-20 h-12">
            <MiniTrendChart
              data={kpi.trendData}
              positive={isPositive}
              color={isPositive ? '#94D2BD' : '#AE2012'}
            />
          </div>
        )}
      </div>
    </GlassMorphism>
  )
}

// AI Insights Section
const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({ 
  insights, 
  onInsightAction 
}) => {
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null)

  return (
    <GlassMorphism variant="medium" className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-gradient-to-r from-teal-primary to-sage rounded-lg flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-cream" />
        </div>
        <div>
          <h3 className="text-lg font-heading font-semibold text-cream">
            AI-Powered Insights
          </h3>
          <p className="text-sm text-sage/70">
            Personalized recommendations to grow your business
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="border border-sage/20 rounded-lg overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer hover:bg-navy-50/20 transition-colors"
              onClick={() => setExpandedInsight(
                expandedInsight === insight.id ? null : insight.id
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                    insight.priority === 'high' && 'bg-red-error/20',
                    insight.priority === 'medium' && 'bg-gold-primary/20',
                    insight.priority === 'low' && 'bg-sage/20'
                  )}>
                    <insight.icon className={cn(
                      'w-3 h-3',
                      insight.priority === 'high' && 'text-red-error',
                      insight.priority === 'medium' && 'text-gold-primary',
                      insight.priority === 'low' && 'text-sage'
                    )} />
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-cream">
                      {insight.title}
                    </h4>
                    <p className="text-sm text-sage/70 mt-1">
                      {insight.summary}
                    </p>
                  </div>
                </div>
                
                <ChevronDown className={cn(
                  'w-4 h-4 text-sage/70 transition-transform',
                  expandedInsight === insight.id && 'rotate-180'
                )} />
              </div>
            </div>

            <AnimatePresence>
              {expandedInsight === insight.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="border-t border-sage/20 overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    <p className="text-sage/80 text-sm leading-relaxed">
                      {insight.description}
                    </p>
                    
                    {insight.metrics && (
                      <div className="grid grid-cols-2 gap-4">
                        {insight.metrics.map((metric, index) => (
                          <div key={index} className="text-center p-3 bg-navy-50/20 rounded-lg">
                            <div className="text-lg font-semibold text-cream">
                              {metric.value}
                            </div>
                            <div className="text-xs text-sage/70">
                              {metric.label}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {insight.actions && insight.actions.length > 0 && (
                      <div className="flex gap-2">
                        {insight.actions.map((action, index) => (
                          <button
                            key={index}
                            onClick={() => onInsightAction(insight.id, action.id)}
                            className={cn(
                              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                              action.primary
                                ? 'bg-teal-primary hover:bg-teal-secondary text-cream'
                                : 'border border-sage/20 text-sage hover:bg-navy-50/20'
                            )}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </GlassMorphism>
  )
}
```

### Testing Requirements

**Analytics Dashboard Testing:**
- KPI calculation accuracy validation
- Chart data synchronization testing
- Real-time update functionality testing
- Export functionality validation
- Performance testing with large datasets

---

## Story F3.4: Review Management Interface & Sentiment Analysis

**User Story:** As a frontend developer, I want to create a comprehensive review management system that allows business owners to view, respond to, and analyze customer reviews with sentiment analysis and automated insights.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 20  
**Sprint:** 2

### Detailed Acceptance Criteria

**Review Management Dashboard:**
- **Given** review management requirements
- **When** implementing review interface
- **Then** create comprehensive review handling with sentiment analysis, response templates, and bulk actions

**Review Response Editor:**
- **Given** review response needs
- **When** implementing response system
- **Then** include rich text editing, template suggestions, and approval workflows

### Testing Requirements

**Review Management Testing:**
- Review data accuracy and real-time updates
- Sentiment analysis accuracy validation
- Response submission and approval testing
- Bulk action functionality testing

---

## Story F3.5: Business Profile Management & Media Handling

**User Story:** As a frontend developer, I want to create an intuitive business profile management interface with advanced media handling, SEO optimization, and multi-location support.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 22  
**Sprint:** 3

### Detailed Acceptance Criteria

**Profile Management Interface:**
- **Given** business profile editing requirements
- **When** implementing profile management
- **Then** create comprehensive editing capabilities with real-time preview and SEO optimization

**Media Management System:**
- **Given** business media requirements
- **When** implementing media handling
- **Then** support image/video upload, compression, gallery management, and CDN optimization

### Testing Requirements

**Profile Management Testing:**
- Form validation and data persistence testing
- Media upload and compression validation
- SEO optimization effectiveness testing
- Multi-location data synchronization testing

---

## Story F3.6: Marketing Tools & Campaign Management

**User Story:** As a frontend developer, I want to create marketing tools that allow business owners to create and manage promotional campaigns, track performance, and optimize marketing efforts.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 25  
**Sprint:** 3

### Detailed Acceptance Criteria

**Campaign Management Interface:**
- **Given** marketing campaign requirements
- **When** implementing campaign tools
- **Then** create campaign creation, scheduling, and performance tracking capabilities

**Promotional Tools:**
- **Given** business promotion needs
- **When** implementing promotional features
- **Then** include discount management, special offers, and event promotion tools

### Testing Requirements

**Marketing Tools Testing:**
- Campaign creation and scheduling validation
- Performance tracking accuracy testing
- Promotional code generation and validation
- A/B testing functionality verification

---

## Story F3.7: Subscription Management & Feature Gating

**User Story:** As a frontend developer, I want to implement sophisticated subscription management with feature gating, upgrade flows, and usage tracking that encourages conversions while maintaining user experience.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 17  
**Sprint:** 4

### Detailed Acceptance Criteria

**Feature Gating System:**
- **Given** subscription tier requirements
- **When** implementing feature access control
- **Then** create elegant feature limitation with upgrade prompts

**Subscription Upgrade Flows:**
- **Given** conversion optimization needs
- **When** implementing upgrade interfaces
- **Then** create compelling upgrade experiences with clear value propositions

### Testing Requirements

**Subscription Management Testing:**
- Feature access control validation
- Upgrade flow completion testing
- Billing integration accuracy testing
- Usage tracking and limits validation

---

## Story F3.8: Multi-Location Business Support

**User Story:** As a frontend developer, I want to create multi-location business management capabilities that allow owners to manage multiple locations, coordinate marketing efforts, and analyze performance across all locations.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 19  
**Sprint:** 4

### Detailed Acceptance Criteria

**Location Management Interface:**
- **Given** multi-location business requirements
- **When** implementing location management
- **Then** create location selection, individual management, and consolidated analytics

**Cross-Location Analytics:**
- **Given** multi-location analytics needs
- **When** implementing consolidated reporting
- **Then** provide comparative analysis and location performance tracking

### Testing Requirements

**Multi-Location Testing:**
- Location data isolation and security testing
- Cross-location analytics accuracy validation
- Location switching functionality testing
- Permission management validation

---

## Story F3.9: Real-Time Notifications & Activity Feed

**User Story:** As a frontend developer, I want to implement a real-time notification system and activity feed that keeps business owners informed of important events and customer interactions.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 16  
**Sprint:** 5

### Detailed Acceptance Criteria

**Notification System:**
- **Given** real-time notification requirements
- **When** implementing notification system
- **Then** create WebSocket-based real-time updates with intelligent prioritization

**Activity Feed:**
- **Given** business activity tracking needs
- **When** implementing activity feed
- **Then** provide comprehensive activity timeline with filtering and search capabilities

### Testing Requirements

**Real-Time System Testing:**
- WebSocket connection stability testing
- Notification delivery accuracy validation
- Activity feed real-time update testing
- Performance testing under high notification volume

---

## Epic 3 Summary & Success Metrics

### Completion Criteria

**Technical Deliverables:**
- ✅ Comprehensive business dashboard with flexible layout system
- ✅ Advanced data visualization components with D3.js integration
- ✅ Complete analytics dashboard with KPI tracking and AI insights
- ✅ Review management system with sentiment analysis
- ✅ Business profile management with advanced media handling
- ✅ Marketing tools and campaign management capabilities
- ✅ Subscription management with elegant feature gating
- ✅ Multi-location business support and coordination
- ✅ Real-time notifications and activity feed system

**Performance Standards:**
- Dashboard initial load time < 2s
- Chart rendering performance < 500ms
- Real-time notification delivery < 100ms
- Media upload success rate > 99%
- Analytics query response time < 1s

**User Experience Standards:**
- Mobile dashboard usability score > 85%
- Interactive chart responsiveness across all devices
- Intuitive navigation with minimal learning curve
- Comprehensive help system and onboarding flows
- Accessibility compliance (WCAG 2.1 AA) throughout

**Business Value Metrics:**
- Business owner daily engagement > 60%
- Feature adoption rate > 75% for core features
- Time to complete key tasks reduced by 50%
- Subscription upgrade conversion > 25%
- Customer satisfaction score > 4.5/5

**Testing Coverage:**
- Unit test coverage > 85% for all business logic
- Integration testing for all dashboard features
- Performance benchmarking for large datasets
- Cross-browser compatibility validation
- Mobile responsiveness testing across devices

This comprehensive frontend Epic 3 creates the complete business portal experience that provides real business value while maintaining the sophisticated user experience established in the previous epics. The dashboard system serves as the central hub for business owners to manage their online presence and grow their businesses effectively.

**File Path:** `/Users/michaellawless/Documents/Vibe/Repo/directory_v4/docs/planning/frontend-epic-3-stories.md`