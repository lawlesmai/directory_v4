# Story 4.7: Analytics & Reporting Dashboard

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a platform administrator, I want comprehensive analytics and reporting capabilities so that I can make data-driven decisions about platform operations, user engagement, and business performance.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 30  
**Sprint:** 3

## Detailed Acceptance Criteria

### Comprehensive Platform Analytics

**Given** the need for detailed platform insights  
**When** accessing analytics and reporting  
**Then** provide comprehensive analytical dashboards:

**User Engagement Analytics:**
- Daily, weekly, and monthly active user trends
- User acquisition channels and conversion funnel analysis
- User retention and churn analysis with cohort tracking
- Feature adoption rates and usage patterns
- Geographic user distribution and growth patterns
- Device and platform usage analytics
- Session duration and engagement depth analysis

**Business Performance Analytics:**
- Business listing growth and verification rates
- Business owner engagement and portal usage
- Subscription conversion rates and revenue trends
- Business category performance and market penetration
- Review volume and sentiment trends
- Business listing quality and completeness metrics
- Marketing tool usage and effectiveness measurement

### Financial & Revenue Reporting

**Given** subscription-based revenue model tracking needs  
**When** analyzing financial performance  
**Then** provide detailed financial analytics:

**Revenue Analytics:**
- Monthly Recurring Revenue (MRR) trends and projections
- Customer Acquisition Cost (CAC) by marketing channel
- Customer Lifetime Value (CLV) analysis and segmentation
- Revenue churn and expansion revenue tracking
- Subscription tier performance and upgrade patterns
- Payment success rates and failed payment recovery
- Geographic revenue distribution and market opportunity

**Financial Health Metrics:**
- Unit economics and profitability analysis
- Cash flow forecasting and burn rate tracking
- Customer payback period and ROI analysis
- Pricing optimization analysis and recommendations
- Revenue forecasting with confidence intervals
- Competitive benchmarking and market positioning
- Cost structure analysis and optimization opportunities

### Operational Performance Reporting

**Given** platform operational efficiency requirements  
**When** monitoring operational metrics  
**Then** provide operational insights:

**System Performance Analytics:**
- Platform uptime and availability tracking
- Page load times and performance optimization opportunities
- API response times and error rate analysis
- Database performance and query optimization insights
- CDN performance and content delivery efficiency
- Search performance and result relevancy metrics
- Mobile vs desktop performance comparison

**Support & Customer Success Metrics:**
- Support ticket volume and resolution time analysis
- Customer satisfaction scores and feedback trends
- User onboarding completion rates and optimization
- Business verification processing times and efficiency
- Content moderation volume and accuracy metrics
- Platform usage help and documentation effectiveness
- Community engagement and user-generated content metrics

### Custom Reporting & Data Export

**Given** diverse reporting needs for different stakeholders  
**When** creating custom reports and exports  
**Then** provide flexible reporting capabilities:

**Report Builder Interface:**
- Drag-and-drop report creation with visual builder
- Custom date range selection and comparison periods
- Filter and segmentation options for detailed analysis
- Chart type selection (line, bar, pie, heat maps) with customization
- Automated report scheduling and email delivery
- Report sharing and collaboration features
- Template library for common report types

**Data Export & Integration:**
- CSV, Excel, and PDF export options for all reports
- API access for custom data integrations
- Real-time data feeds for business intelligence tools
- Data warehouse integration preparation
- GDPR-compliant data handling for exports
- Audit trail for data access and export activities
- Integration with popular BI tools (Tableau, Power BI)

## Frontend Implementation

### Analytics Dashboard Interface

```typescript
// components/admin/analytics/AnalyticsDashboard.tsx
export const AnalyticsDashboard: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('30d')
  const [activeView, setActiveView] = useState<'overview' | 'users' | 'business' | 'financial' | 'operational'>('overview')
  const [customFilters, setCustomFilters] = useState<AnalyticsFilters>({})
  
  const {
    data: analyticsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['analytics-dashboard', selectedTimeRange, activeView, customFilters],
    queryFn: () => adminApi.getAnalytics({ 
      timeRange: selectedTimeRange, 
      view: activeView, 
      filters: customFilters 
    }),
    keepPreviousData: true,
    refetchInterval: 300000 // 5 minutes
  })

  const exportMutation = useMutation({
    mutationFn: adminApi.exportAnalyticsReport,
    onSuccess: (data) => {
      downloadFile(data.url, data.filename)
      toast.success('Report exported successfully')
    }
  })

  return (
    <div className="space-y-6 p-6">
      {/* Analytics Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Platform Analytics
          </h1>
          <p className="text-sage/70 mt-1">
            Comprehensive insights and business intelligence reporting
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <TimeRangeSelector
            value={selectedTimeRange}
            onChange={setSelectedTimeRange}
            options={['7d', '30d', '90d', '1y', 'custom']}
          />
          
          <AnalyticsExportButton
            onExport={(format, config) => exportMutation.mutate({ format, config, view: activeView })}
            isLoading={exportMutation.isLoading}
          />
          
          <CustomReportBuilder />
        </div>
      </div>

      {/* Analytics Navigation */}
      <GlassMorphism variant="subtle" className="p-2">
        <nav className="flex space-x-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'users', label: 'User Analytics', icon: Users },
            { id: 'business', label: 'Business Performance', icon: Building },
            { id: 'financial', label: 'Financial Reports', icon: DollarSign },
            { id: 'operational', label: 'Operations', icon: Activity }
          ].map((view) => {
            const Icon = view.icon
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  activeView === view.id
                    ? 'bg-teal-primary text-navy-dark'
                    : 'text-sage/70 hover:text-sage hover:bg-sage/10'
                )}
              >
                <Icon className="w-4 h-4" />
                {view.label}
              </button>
            )
          })}
        </nav>
      </GlassMorphism>

      {/* Analytics Content */}
      <div className="space-y-6">
        {isLoading ? (
          <AnalyticsSkeleton />
        ) : error ? (
          <ErrorState
            title="Failed to load analytics"
            description={error.message}
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        ) : (
          <>
            {activeView === 'overview' && (
              <AnalyticsOverview
                data={analyticsData}
                timeRange={selectedTimeRange}
              />
            )}
            
            {activeView === 'users' && (
              <UserAnalytics
                data={analyticsData?.user || {}}
                timeRange={selectedTimeRange}
                filters={customFilters}
                onFiltersChange={setCustomFilters}
              />
            )}
            
            {activeView === 'business' && (
              <BusinessAnalytics
                data={analyticsData?.business || {}}
                timeRange={selectedTimeRange}
                filters={customFilters}
                onFiltersChange={setCustomFilters}
              />
            )}
            
            {activeView === 'financial' && (
              <FinancialAnalytics
                data={analyticsData?.financial || {}}
                timeRange={selectedTimeRange}
                filters={customFilters}
                onFiltersChange={setCustomFilters}
              />
            )}
            
            {activeView === 'operational' && (
              <OperationalAnalytics
                data={analyticsData?.operational || {}}
                timeRange={selectedTimeRange}
                filters={customFilters}
                onFiltersChange={setCustomFilters}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

### Advanced Chart Components

```typescript
// components/admin/analytics/charts/InteractiveChart.tsx
interface InteractiveChartProps {
  data: ChartData[]
  type: 'line' | 'bar' | 'area' | 'pie' | 'heatmap'
  title: string
  description?: string
  height?: number
  interactive?: boolean
  drillDownEnabled?: boolean
  onDrillDown?: (dataPoint: ChartDataPoint) => void
}

export const InteractiveChart: React.FC<InteractiveChartProps> = ({
  data,
  type,
  title,
  description,
  height = 400,
  interactive = true,
  drillDownEnabled = false,
  onDrillDown
}) => {
  const [selectedDataPoint, setSelectedDataPoint] = useState<ChartDataPoint | null>(null)
  const [zoom, setZoom] = useState({ start: 0, end: 100 })
  const [showTooltip, setShowTooltip] = useState(false)
  
  const chartConfig = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#94D2BD', // sage color
          font: {
            family: 'Inter, sans-serif',
          }
        }
      },
      tooltip: {
        enabled: interactive,
        backgroundColor: 'rgba(15, 23, 42, 0.95)', // navy-dark
        titleColor: '#F8F8FF', // cream
        bodyColor: '#94D2BD', // sage
        borderColor: '#94D2BD',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (context: any) => {
            return context[0]?.label || ''
          },
          label: (context: any) => {
            const value = context.parsed.y || context.parsed
            return `${context.dataset.label}: ${formatChartValue(value, type)}`
          }
        }
      }
    },
    scales: type !== 'pie' ? {
      x: {
        grid: {
          color: 'rgba(148, 210, 189, 0.1)', // sage/10
        },
        ticks: {
          color: '#94D2BD', // sage
          font: {
            family: 'Inter, sans-serif',
            size: 12
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(148, 210, 189, 0.1)', // sage/10
        },
        ticks: {
          color: '#94D2BD', // sage
          font: {
            family: 'Inter, sans-serif',
            size: 12
          },
          callback: (value: any) => formatChartValue(value, type)
        }
      }
    } : {},
    onClick: (event: any, elements: any[]) => {
      if (!interactive || !drillDownEnabled || elements.length === 0) return
      
      const element = elements[0]
      const dataPoint = data[element.index]
      
      if (dataPoint && onDrillDown) {
        onDrillDown(dataPoint)
      }
    }
  }), [data, type, interactive, drillDownEnabled, onDrillDown])

  return (
    <GlassMorphism variant="subtle" className="p-6">
      {/* Chart Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-heading font-semibold text-cream">
            {title}
          </h3>
          {description && (
            <p className="text-sage/70 text-sm mt-1">{description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {interactive && (
            <>
              <ChartViewOptions
                type={type}
                onTypeChange={(newType) => {/* Handle type change */}}
              />
              
              <ChartExportButton
                data={data}
                title={title}
                type={type}
              />
            </>
          )}
          
          <button
            onClick={() => {/* Toggle fullscreen */}}
            className="p-2 rounded-lg hover:bg-sage/10 transition-colors"
            aria-label="Toggle fullscreen"
          >
            <Expand className="w-4 h-4 text-sage/70" />
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div 
        className="relative"
        style={{ height: `${height}px` }}
      >
        {type === 'line' && (
          <Line
            data={formatChartData(data, type)}
            options={chartConfig}
            height={height}
          />
        )}
        
        {type === 'bar' && (
          <Bar
            data={formatChartData(data, type)}
            options={chartConfig}
            height={height}
          />
        )}
        
        {type === 'area' && (
          <Line
            data={formatChartData(data, type, { fill: true })}
            options={chartConfig}
            height={height}
          />
        )}
        
        {type === 'pie' && (
          <Pie
            data={formatChartData(data, type)}
            options={chartConfig}
            height={height}
          />
        )}
        
        {type === 'heatmap' && (
          <HeatmapChart
            data={data}
            height={height}
            config={chartConfig}
          />
        )}
      </div>

      {/* Chart Controls */}
      {interactive && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-sage/20">
          <div className="flex items-center gap-4">
            {type !== 'pie' && (
              <ZoomControls
                zoom={zoom}
                onZoomChange={setZoom}
                onReset={() => setZoom({ start: 0, end: 100 })}
              />
            )}
            
            <DataTableToggle
              data={data}
              title={title}
            />
          </div>
          
          <div className="flex items-center gap-2 text-sm text-sage/70">
            {drillDownEnabled && (
              <span>Click data points to drill down</span>
            )}
            <span>Last updated: {formatDistanceToNow(new Date())} ago</span>
          </div>
        </div>
      )}
    </GlassMorphism>
  )
}
```

### Custom Report Builder

```typescript
// components/admin/analytics/CustomReportBuilder.tsx
export const CustomReportBuilder: React.FC = () => {
  const [showBuilder, setShowBuilder] = useState(false)
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    name: '',
    description: '',
    metrics: [],
    dimensions: [],
    filters: {},
    visualization: 'table',
    schedule: null
  })
  
  const [availableMetrics] = useState<Metric[]>([
    { id: 'users_total', name: 'Total Users', category: 'user', type: 'count' },
    { id: 'users_active', name: 'Active Users', category: 'user', type: 'count' },
    { id: 'revenue_mrr', name: 'Monthly Recurring Revenue', category: 'financial', type: 'currency' },
    { id: 'businesses_verified', name: 'Verified Businesses', category: 'business', type: 'count' },
    // ... more metrics
  ])
  
  const [availableDimensions] = useState<Dimension[]>([
    { id: 'date', name: 'Date', type: 'date' },
    { id: 'user_type', name: 'User Type', type: 'category' },
    { id: 'subscription_tier', name: 'Subscription Tier', type: 'category' },
    { id: 'geographic_region', name: 'Geographic Region', type: 'category' },
    // ... more dimensions
  ])

  const createReport = async () => {
    try {
      const result = await adminApi.createCustomReport(reportConfig)
      toast.success('Custom report created successfully')
      setShowBuilder(false)
      setReportConfig({
        name: '',
        description: '',
        metrics: [],
        dimensions: [],
        filters: {},
        visualization: 'table',
        schedule: null
      })
    } catch (error) {
      toast.error('Failed to create report')
    }
  }

  return (
    <>
      <button
        onClick={() => setShowBuilder(true)}
        className="px-4 py-2 bg-teal-primary text-navy-dark rounded-lg hover:bg-teal-accent transition-colors"
      >
        Create Custom Report
      </button>

      <Dialog open={showBuilder} onOpenChange={setShowBuilder}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Custom Report Builder</DialogTitle>
            <DialogDescription>
              Create custom analytics reports with your preferred metrics and visualizations
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Report Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-cream mb-2">
                  Report Name *
                </label>
                <input
                  type="text"
                  value={reportConfig.name}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream"
                  placeholder="Enter report name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-cream mb-2">
                  Visualization Type
                </label>
                <select
                  value={reportConfig.visualization}
                  onChange={(e) => setReportConfig(prev => ({ ...prev, visualization: e.target.value as any }))}
                  className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream"
                >
                  <option value="table">Data Table</option>
                  <option value="line">Line Chart</option>
                  <option value="bar">Bar Chart</option>
                  <option value="pie">Pie Chart</option>
                  <option value="area">Area Chart</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-cream mb-2">
                Description
              </label>
              <textarea
                value={reportConfig.description}
                onChange={(e) => setReportConfig(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream resize-none"
                rows={3}
                placeholder="Describe what this report shows"
              />
            </div>

            {/* Metrics Selection */}
            <div>
              <label className="block text-sm font-medium text-cream mb-3">
                Select Metrics *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                {availableMetrics.map((metric) => (
                  <div
                    key={metric.id}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors',
                      reportConfig.metrics.includes(metric.id)
                        ? 'bg-teal-primary/20 border-teal-primary text-teal-primary'
                        : 'bg-navy-dark border-sage/30 text-sage/70 hover:border-sage/50'
                    )}
                    onClick={() => {
                      setReportConfig(prev => ({
                        ...prev,
                        metrics: prev.metrics.includes(metric.id)
                          ? prev.metrics.filter(id => id !== metric.id)
                          : [...prev.metrics, metric.id]
                      }))
                    }}
                  >
                    <div className="font-medium">{metric.name}</div>
                    <div className="text-xs opacity-70">{metric.category}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dimensions Selection */}
            <div>
              <label className="block text-sm font-medium text-cream mb-3">
                Group By (Dimensions)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {availableDimensions.map((dimension) => (
                  <div
                    key={dimension.id}
                    className={cn(
                      'p-3 rounded-lg border cursor-pointer transition-colors',
                      reportConfig.dimensions.includes(dimension.id)
                        ? 'bg-teal-primary/20 border-teal-primary text-teal-primary'
                        : 'bg-navy-dark border-sage/30 text-sage/70 hover:border-sage/50'
                    )}
                    onClick={() => {
                      setReportConfig(prev => ({
                        ...prev,
                        dimensions: prev.dimensions.includes(dimension.id)
                          ? prev.dimensions.filter(id => id !== dimension.id)
                          : [...prev.dimensions, dimension.id]
                      }))
                    }}
                  >
                    <div className="font-medium">{dimension.name}</div>
                    <div className="text-xs opacity-70">{dimension.type}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Report Scheduling */}
            <div>
              <label className="block text-sm font-medium text-cream mb-3">
                Schedule (Optional)
              </label>
              <ReportScheduleBuilder
                schedule={reportConfig.schedule}
                onChange={(schedule) => setReportConfig(prev => ({ ...prev, schedule }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <button
              onClick={() => setShowBuilder(false)}
              className="px-4 py-2 text-sage/70 hover:text-sage transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={createReport}
              disabled={!reportConfig.name || reportConfig.metrics.length === 0}
              className="px-4 py-2 bg-teal-primary text-navy-dark rounded-lg hover:bg-teal-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Report
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

## Technical Implementation Notes

**Real-Time Data Pipeline:**
- Real-time data processing for live analytics
- Data aggregation and pre-computation for complex metrics
- Efficient database queries with proper indexing
- Data caching strategies for frequently accessed reports

**Visualization Framework:**
- Interactive charting library with drill-down capabilities
- Responsive design for mobile analytics viewing
- Real-time chart updates for live data
- Export capabilities for charts and visualizations

**Performance Optimization:**
- Background processing for heavy analytical calculations
- Progressive loading for complex reports
- Data sampling for large datasets
- Query optimization for analytical workloads

## Dependencies

- Story 4.2 (Admin dashboard foundation)
- Epic 3 Story 3.4 (Business analytics infrastructure)

## Testing Requirements

**Analytics Accuracy Tests:**
- Data aggregation and calculation accuracy validation
- Report generation accuracy and consistency tests
- Real-time analytics update effectiveness tests
- Custom report builder functionality tests

**Performance Tests:**
- Large dataset analytics processing performance
- Complex report generation time optimization
- Real-time analytics update performance impact
- Concurrent report generation performance tests

**Integration Tests:**
- Data export functionality and format validation
- BI tool integration and data accuracy tests
- Automated report delivery and scheduling tests
- API access for custom integrations validation

## Definition of Done

- [ ] Comprehensive platform analytics dashboard operational
- [ ] Financial and revenue reporting system complete
- [ ] Operational performance reporting functional
- [ ] Custom report builder with export capabilities
- [ ] Real-time analytics with live data updates
- [ ] Mobile-responsive analytics interface
- [ ] Integration with external BI tools prepared
- [ ] Performance optimization for large datasets
- [ ] All analytics accuracy and performance tests passing
- [ ] Documentation complete for analytics and reporting procedures

## Risk Assessment

- **Medium Risk:** Complex analytics calculations may impact database performance
- **Low Risk:** Reporting interface implementation
- **Mitigation:** Query optimization and background processing for heavy calculations