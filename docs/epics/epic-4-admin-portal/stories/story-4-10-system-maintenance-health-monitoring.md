# Story 4.10: System Maintenance & Health Monitoring

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a DevOps administrator, I want comprehensive system health monitoring and maintenance tools so that I can ensure platform reliability, performance, and proactive issue resolution.

**Assignee:** DevOps Automator Agent  
**Priority:** P1  
**Story Points:** 17  
**Sprint:** 4

## Detailed Acceptance Criteria

### System Health Monitoring Dashboard

**Given** the need for comprehensive system monitoring  
**When** monitoring platform health  
**Then** provide real-time system insights:

**Infrastructure Monitoring:**
- Server performance metrics (CPU, memory, disk, network)
- Database performance and connection pool monitoring
- CDN performance and cache hit rate tracking
- Load balancer health and traffic distribution
- SSL certificate expiration monitoring and alerts
- DNS resolution time and availability monitoring
- Third-party service dependency health tracking

**Application Performance Monitoring:**
- API endpoint response times and error rates
- Application memory usage and garbage collection metrics
- Database query performance and slow query identification
- Background job queue health and processing times
- Session management and user connection monitoring
- Feature flag performance impact analysis
- Real user monitoring (RUM) for performance insights

### Automated Maintenance Systems

**Given** routine maintenance requirements  
**When** performing system maintenance  
**Then** implement automated maintenance procedures:

**Scheduled Maintenance Tasks:**
- Database maintenance (backups, index optimization, cleanup)
- Log rotation and archival with retention policies
- Cache clearing and optimization schedules
- SSL certificate renewal automation
- Security patch deployment scheduling
- Performance optimization script execution
- Data cleanup and archival processes

**Proactive Issue Detection:**
- Predictive analytics for capacity planning
- Anomaly detection for unusual system behavior
- Performance degradation early warning system
- Resource utilization trend analysis and alerting
- Dependency failure prediction and mitigation
- Security vulnerability scanning and assessment
- Business continuity and disaster recovery testing

### Incident Management & Response

**Given** system incidents requiring immediate response  
**When** handling system incidents  
**Then** provide comprehensive incident management:

**Incident Detection & Alerting:**
- Multi-level alerting system (email, SMS, Slack)
- On-call rotation management with escalation procedures
- Incident severity classification and response protocols
- Automated incident response for common issues
- Status page integration for customer communication
- Incident timeline tracking and documentation
- Post-incident review and improvement processes

**System Recovery Procedures:**
- Automated failover and recovery systems
- Database backup and restoration procedures
- Traffic rerouting and load balancing adjustments
- Service rollback and deployment reversion
- Data integrity verification and correction
- Customer communication during incidents
- Recovery time and impact measurement

### Capacity Planning & Optimization

**Given** growing platform usage requirements  
**When** planning for capacity and growth  
**Then** provide capacity management tools:

**Resource Planning:**
- Traffic growth prediction and capacity forecasting
- Resource utilization trend analysis
- Cost optimization recommendations
- Scalability bottleneck identification
- Performance benchmark tracking and comparison
- Infrastructure cost analysis and optimization
- Growth scenario modeling and planning

## Frontend Implementation

### System Health Dashboard

```typescript
// components/admin/system/SystemHealthDashboard.tsx
export const SystemHealthDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'overview' | 'infrastructure' | 'performance' | 'maintenance' | 'incidents'>('overview')
  const [timeRange, setTimeRange] = useState<TimeRange>('6h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  
  const {
    data: systemData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['system-health', activeView, timeRange],
    queryFn: () => adminApi.getSystemHealth({ view: activeView, timeRange }),
    keepPreviousData: true,
    refetchInterval: autoRefresh ? 30000 : false // 30 seconds
  })

  // Real-time system alerts
  useEffect(() => {
    const ws = new WebSocket('/api/admin/system/alerts/live')
    
    ws.onmessage = (event) => {
      const alert = JSON.parse(event.data)
      
      // Show critical alerts immediately
      if (alert.severity === 'critical') {
        toast.error(`Critical System Alert: ${alert.message}`, {
          duration: Infinity,
          action: {
            label: 'Investigate',
            onClick: () => setActiveView('incidents')
          }
        })
      }
      
      // Update system data
      queryClient.setQueryData(['system-health'], (old: any) => ({
        ...old,
        alerts: [alert, ...(old?.alerts || [])].slice(0, 50)
      }))
    }

    return () => ws.close()
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* System Health Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            System Health & Monitoring
          </h1>
          <p className="text-sage/70 mt-1">
            Monitor system performance, manage maintenance, and ensure platform reliability
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <SystemStatusBadge status={systemData?.overallStatus} />
          <TimeRangeSelector
            value={timeRange}
            onChange={setTimeRange}
            options={['1h', '6h', '24h', '7d', '30d']}
          />
          <div className="flex items-center gap-2">
            <Toggle
              checked={autoRefresh}
              onChange={setAutoRefresh}
            />
            <span className="text-sm text-sage/70">Auto-refresh</span>
          </div>
        </div>
      </div>

      {/* System Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SystemMetricCard
          title="System Uptime"
          value={`${systemData?.metrics.uptimePercentage || 0}%`}
          subtitle={`${systemData?.metrics.uptimeDays || 0} days`}
          status={systemData?.metrics.uptimeStatus}
          icon={Activity}
        />
        <SystemMetricCard
          title="Response Time"
          value={`${systemData?.metrics.avgResponseTime || 0}ms`}
          change={systemData?.metrics.responseTimeChange}
          icon={Zap}
          color="blue"
        />
        <SystemMetricCard
          title="Error Rate"
          value={`${systemData?.metrics.errorRate || 0}%`}
          change={systemData?.metrics.errorRateChange}
          icon={AlertTriangle}
          color="red"
        />
        <SystemMetricCard
          title="Active Incidents"
          value={systemData?.metrics.activeIncidents || 0}
          urgent={systemData?.metrics.criticalIncidents > 0}
          icon={Bell}
          color="orange"
        />
      </div>

      {/* Critical Alerts Banner */}
      <AnimatePresence>
        {systemData?.criticalIssues && systemData.criticalIssues.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassMorphism variant="medium" className="p-4 bg-red-error/20 border-red-error/30">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-error animate-pulse" />
                <div className="flex-1">
                  <p className="font-medium text-red-error">
                    {systemData.criticalIssues.length} Critical System Issue(s) Detected
                  </p>
                  <p className="text-sm text-sage/70">
                    Immediate attention required - System performance may be impacted
                  </p>
                </div>
                <button
                  onClick={() => setActiveView('incidents')}
                  className="px-4 py-2 bg-red-error text-cream rounded-lg hover:bg-red-critical transition-colors"
                >
                  View Issues
                </button>
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>

      {/* System Navigation */}
      <GlassMorphism variant="subtle" className="p-2">
        <nav className="flex space-x-1">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'infrastructure', label: 'Infrastructure', icon: Server },
            { id: 'performance', label: 'Performance', icon: Zap },
            { id: 'maintenance', label: 'Maintenance', icon: Settings },
            { id: 'incidents', label: 'Incidents', icon: AlertTriangle, count: systemData?.metrics.activeIncidents }
          ].map((view) => {
            const Icon = view.icon
            return (
              <button
                key={view.id}
                onClick={() => setActiveView(view.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors relative',
                  activeView === view.id
                    ? 'bg-teal-primary text-navy-dark'
                    : 'text-sage/70 hover:text-sage hover:bg-sage/10'
                )}
              >
                <Icon className="w-4 h-4" />
                {view.label}
                {view.count && view.count > 0 && (
                  <span className="absolute -top-2 -right-2 bg-red-error text-cream text-xs w-5 h-5 rounded-full flex items-center justify-center">
                    {view.count > 99 ? '99+' : view.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </GlassMorphism>

      {/* System Content */}
      <div className="space-y-6">
        {isLoading ? (
          <SystemHealthSkeleton />
        ) : error ? (
          <ErrorState
            title="Failed to load system health data"
            description={error.message}
            action={{ label: 'Retry', onClick: () => refetch() }}
          />
        ) : (
          <>
            {activeView === 'overview' && (
              <SystemOverview
                data={systemData}
                timeRange={timeRange}
              />
            )}
            
            {activeView === 'infrastructure' && (
              <InfrastructureMonitoring
                infrastructure={systemData?.infrastructure || {}}
                timeRange={timeRange}
              />
            )}
            
            {activeView === 'performance' && (
              <PerformanceMonitoring
                performance={systemData?.performance || {}}
                timeRange={timeRange}
              />
            )}
            
            {activeView === 'maintenance' && (
              <MaintenanceScheduler
                maintenance={systemData?.maintenance || {}}
                onSchedule={(task) => {/* Schedule maintenance task */}}
              />
            )}
            
            {activeView === 'incidents' && (
              <IncidentManager
                incidents={systemData?.incidents || []}
                onIncidentUpdate={(id, update) => {/* Update incident */}}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

### Infrastructure Monitoring Interface

```typescript
// components/admin/system/InfrastructureMonitoring.tsx
interface InfrastructureMonitoringProps {
  infrastructure: InfrastructureData
  timeRange: TimeRange
}

export const InfrastructureMonitoring: React.FC<InfrastructureMonitoringProps> = ({
  infrastructure,
  timeRange
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(null)
  
  const getHealthColor = (health: number) => {
    if (health >= 95) return 'text-green-400'
    if (health >= 85) return 'text-yellow-400'
    if (health >= 70) return 'text-orange-400'
    return 'text-red-error'
  }

  const getHealthStatus = (health: number) => {
    if (health >= 95) return 'Healthy'
    if (health >= 85) return 'Warning'
    if (health >= 70) return 'Degraded'
    return 'Critical'
  }

  return (
    <div className="space-y-6">
      {/* Infrastructure Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Servers */}
        <GlassMorphism variant="subtle" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Server className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-medium text-cream">Servers</h3>
                <p className="text-sm text-sage/70">
                  {infrastructure.servers?.active || 0} active
                </p>
              </div>
            </div>
            <div className={cn(
              'text-right',
              getHealthColor(infrastructure.servers?.health || 0)
            )}>
              <p className="font-bold text-lg">
                {infrastructure.servers?.health || 0}%
              </p>
              <p className="text-xs">
                {getHealthStatus(infrastructure.servers?.health || 0)}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">CPU Usage</span>
              <span className="text-cream">{infrastructure.servers?.cpuUsage || 0}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Memory Usage</span>
              <span className="text-cream">{infrastructure.servers?.memoryUsage || 0}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Disk Usage</span>
              <span className="text-cream">{infrastructure.servers?.diskUsage || 0}%</span>
            </div>
          </div>
        </GlassMorphism>

        {/* Database */}
        <GlassMorphism variant="subtle" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Database className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-medium text-cream">Database</h3>
                <p className="text-sm text-sage/70">
                  PostgreSQL Primary
                </p>
              </div>
            </div>
            <div className={cn(
              'text-right',
              getHealthColor(infrastructure.database?.health || 0)
            )}>
              <p className="font-bold text-lg">
                {infrastructure.database?.health || 0}%
              </p>
              <p className="text-xs">
                {getHealthStatus(infrastructure.database?.health || 0)}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Connections</span>
              <span className="text-cream">
                {infrastructure.database?.activeConnections || 0}/{infrastructure.database?.maxConnections || 0}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Query Time</span>
              <span className="text-cream">{infrastructure.database?.avgQueryTime || 0}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Cache Hit</span>
              <span className="text-cream">{infrastructure.database?.cacheHitRate || 0}%</span>
            </div>
          </div>
        </GlassMorphism>

        {/* CDN & Caching */}
        <GlassMorphism variant="subtle" className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-primary/20 rounded-lg">
                <Cloud className="w-5 h-5 text-teal-primary" />
              </div>
              <div>
                <h3 className="font-medium text-cream">CDN & Cache</h3>
                <p className="text-sm text-sage/70">
                  Global Edge Network
                </p>
              </div>
            </div>
            <div className={cn(
              'text-right',
              getHealthColor(infrastructure.cdn?.health || 0)
            )}>
              <p className="font-bold text-lg">
                {infrastructure.cdn?.health || 0}%
              </p>
              <p className="text-xs">
                {getHealthStatus(infrastructure.cdn?.health || 0)}
              </p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Cache Hit Rate</span>
              <span className="text-cream">{infrastructure.cdn?.cacheHitRate || 0}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Bandwidth</span>
              <span className="text-cream">{infrastructure.cdn?.bandwidth || '0 GB'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sage/70">Edge Locations</span>
              <span className="text-cream">{infrastructure.cdn?.edgeLocations || 0} active</span>
            </div>
          </div>
        </GlassMorphism>
      </div>

      {/* Service Status Grid */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-heading font-semibold text-cream">
            Service Status
          </h3>
          <ServiceStatusLegend />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {infrastructure.services?.map((service) => (
            <div
              key={service.name}
              className={cn(
                'p-4 rounded-lg border cursor-pointer transition-all duration-200',
                service.status === 'healthy' && 'bg-green-400/10 border-green-400/30',
                service.status === 'warning' && 'bg-yellow-400/10 border-yellow-400/30',
                service.status === 'critical' && 'bg-red-error/10 border-red-error/30',
                selectedService === service.name && 'ring-2 ring-teal-primary/50'
              )}
              onClick={() => setSelectedService(service.name)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-cream">{service.name}</span>
                <div className={cn(
                  'w-3 h-3 rounded-full',
                  service.status === 'healthy' && 'bg-green-400',
                  service.status === 'warning' && 'bg-yellow-400',
                  service.status === 'critical' && 'bg-red-error animate-pulse'
                )} />
              </div>
              
              <div className="text-sm text-sage/70">
                <p>Uptime: {service.uptime}%</p>
                <p>Response: {service.responseTime}ms</p>
              </div>
              
              {service.lastIncident && (
                <div className="mt-2 pt-2 border-t border-sage/20">
                  <p className="text-xs text-sage/60">
                    Last issue: {formatDistanceToNow(service.lastIncident)} ago
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassMorphism>

      {/* Infrastructure Metrics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Server Performance
          </h3>
          <InfrastructureChart
            data={infrastructure.serverMetrics || []}
            type="line"
            metrics={['cpu', 'memory', 'disk']}
            height={300}
          />
        </GlassMorphism>
        
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Database Performance
          </h3>
          <InfrastructureChart
            data={infrastructure.databaseMetrics || []}
            type="area"
            metrics={['connections', 'queryTime', 'throughput']}
            height={300}
          />
        </GlassMorphism>
      </div>

      {/* Service Detail Modal */}
      <ServiceDetailModal
        service={selectedService ? infrastructure.services?.find(s => s.name === selectedService) : null}
        onClose={() => setSelectedService(null)}
      />
    </div>
  )
}
```

### Automated Maintenance Scheduler

```typescript
// components/admin/system/MaintenanceScheduler.tsx
export const MaintenanceScheduler: React.FC<MaintenanceSchedulerProps> = ({
  maintenance,
  onSchedule
}) => {
  const [showScheduleDialog, setShowScheduleDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<MaintenanceTask | null>(null)
  
  const maintenanceTypes = [
    { id: 'database_backup', name: 'Database Backup', icon: Database, frequency: 'daily' },
    { id: 'log_rotation', name: 'Log Rotation', icon: FileText, frequency: 'weekly' },
    { id: 'cache_cleanup', name: 'Cache Cleanup', icon: Trash2, frequency: 'daily' },
    { id: 'ssl_renewal', name: 'SSL Certificate Renewal', icon: Lock, frequency: 'monthly' },
    { id: 'security_scan', name: 'Security Vulnerability Scan', icon: Shield, frequency: 'weekly' },
    { id: 'performance_optimization', name: 'Performance Optimization', icon: Zap, frequency: 'monthly' }
  ]

  return (
    <div className="space-y-6">
      {/* Scheduled Maintenance Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-semibold text-cream">
            Maintenance Scheduler
          </h2>
          <p className="text-sage/70 mt-1">
            Automated system maintenance and optimization tasks
          </p>
        </div>
        
        <button
          onClick={() => setShowScheduleDialog(true)}
          className="px-4 py-2 bg-teal-primary text-navy-dark rounded-lg hover:bg-teal-accent transition-colors"
        >
          Schedule Task
        </button>
      </div>

      {/* Maintenance Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="Scheduled Tasks"
          value={maintenance.scheduledTasks || 0}
          icon={Calendar}
          color="blue"
        />
        <StatCard
          title="Running Tasks"
          value={maintenance.runningTasks || 0}
          icon={Play}
          color="green"
        />
        <StatCard
          title="Completed Today"
          value={maintenance.completedToday || 0}
          icon={CheckCircle}
          color="teal"
        />
        <StatCard
          title="Failed Tasks"
          value={maintenance.failedTasks || 0}
          icon={XCircle}
          color="red"
        />
      </div>

      {/* Maintenance Calendar */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-heading font-semibold text-cream">
            Maintenance Calendar
          </h3>
          <MaintenanceCalendarControls />
        </div>
        
        <MaintenanceCalendar
          tasks={maintenance.scheduledTasks || []}
          onTaskClick={setSelectedTask}
        />
      </GlassMorphism>

      {/* Active Maintenance Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Running Tasks
          </h3>
          
          <div className="space-y-4">
            {maintenance.activeTasks?.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-navy-dark/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <div>
                    <p className="font-medium text-cream">{task.name}</p>
                    <p className="text-sm text-sage/70">
                      Started {formatDistanceToNow(task.startTime)} ago
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="text-sm text-cream">{task.progress}%</p>
                  <ProgressBar value={task.progress} className="w-24" />
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-sage/70">
                No maintenance tasks currently running
              </div>
            )}
          </div>
        </GlassMorphism>

        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Recent Completions
          </h3>
          
          <div className="space-y-4">
            {maintenance.recentCompletions?.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 bg-navy-dark/50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-2 h-2 rounded-full',
                    task.status === 'completed' ? 'bg-green-400' : 'bg-red-error'
                  )} />
                  <div>
                    <p className="font-medium text-cream">{task.name}</p>
                    <p className="text-sm text-sage/70">
                      {formatDistanceToNow(task.completedAt)} ago
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className={cn(
                    'px-2 py-1 rounded text-xs font-medium',
                    task.status === 'completed' 
                      ? 'bg-green-400/20 text-green-400'
                      : 'bg-red-error/20 text-red-error'
                  )}>
                    {task.status.toUpperCase()}
                  </span>
                </div>
              </div>
            )) || (
              <div className="text-center py-8 text-sage/70">
                No recent maintenance completions
              </div>
            )}
          </div>
        </GlassMorphism>
      </div>

      {/* Maintenance Types */}
      <GlassMorphism variant="subtle" className="p-6">
        <h3 className="text-lg font-heading font-semibold text-cream mb-6">
          Available Maintenance Tasks
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {maintenanceTypes.map((type) => {
            const Icon = type.icon
            return (
              <div
                key={type.id}
                className="p-4 bg-navy-dark/50 rounded-lg border border-sage/20 hover:border-sage/40 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedTask({ type: type.id, name: type.name })
                  setShowScheduleDialog(true)
                }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-teal-primary/20 rounded-lg">
                    <Icon className="w-5 h-5 text-teal-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-cream">{type.name}</p>
                    <p className="text-sm text-sage/70">
                      Frequency: {type.frequency}
                    </p>
                  </div>
                </div>
                
                <div className="text-sm text-sage/70">
                  <p>Last run: {maintenance.lastRun?.[type.id] || 'Never'}</p>
                  <p>Next scheduled: {maintenance.nextScheduled?.[type.id] || 'Not scheduled'}</p>
                </div>
              </div>
            )
          })}
        </div>
      </GlassMorphism>

      {/* Schedule Maintenance Dialog */}
      <ScheduleMaintenanceDialog
        open={showScheduleDialog}
        onClose={() => setShowScheduleDialog(false)}
        task={selectedTask}
        onSchedule={onSchedule}
      />
    </div>
  )
}
```

## Technical Implementation Notes

**Monitoring Stack:**
- Integration with monitoring services (DataDog, New Relic, or Prometheus/Grafana)
- Custom metrics collection for business-specific indicators
- Log aggregation and analysis for system insights
- Real-time alerting and notification systems

**Automation Framework:**
- Infrastructure as Code (IaC) for consistent deployments
- Automated testing and deployment pipelines
- Configuration management and version control
- Backup and recovery automation

**Performance Optimization:**
- Query optimization and database tuning
- Caching strategy implementation and optimization
- CDN configuration and performance tuning
- Application performance profiling and optimization

## Dependencies

- Epic 1 Story 1.10 (Production deployment foundation)
- Story 4.2 (Admin dashboard for health monitoring integration)

## Testing Requirements

**System Monitoring Tests:**
- Monitoring system accuracy and alert reliability tests
- Performance monitoring effectiveness validation
- Incident detection and response time tests
- Automated maintenance procedure validation

**Disaster Recovery Tests:**
- Backup and restoration procedure testing
- Failover system functionality and timing tests
- Business continuity plan execution and validation
- Data integrity verification during recovery

**Performance Tests:**
- System performance under various load conditions
- Capacity planning model accuracy validation
- Resource utilization optimization effectiveness
- Response time and availability target achievement

## Definition of Done

- [ ] Comprehensive system health monitoring dashboard
- [ ] Automated maintenance systems and scheduling
- [ ] Incident management and response procedures
- [ ] Capacity planning and optimization tools
- [ ] Real-time alerting and notification systems
- [ ] Disaster recovery and business continuity procedures
- [ ] Performance optimization and monitoring
- [ ] Integration with external monitoring services
- [ ] All system monitoring and maintenance tests passing
- [ ] Documentation complete for system administration procedures

## Risk Assessment

- **Medium Risk:** Complex monitoring systems may generate false alerts
- **Low Risk:** Automated maintenance implementation
- **Mitigation:** Careful alert threshold tuning and comprehensive testing