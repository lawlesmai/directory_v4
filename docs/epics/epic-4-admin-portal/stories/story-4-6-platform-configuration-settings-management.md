# Story 4.6: Platform Configuration & Settings Management

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a platform administrator, I want comprehensive platform configuration and settings management tools so that I can efficiently manage platform features, policies, and operational parameters.

**Assignee:** Backend Architect Agent  
**Priority:** P1  
**Story Points:** 21  
**Sprint:** 3

## Detailed Acceptance Criteria

### System Configuration Management

**Given** the need for flexible platform configuration  
**When** managing system settings  
**Then** provide comprehensive configuration tools:

**Feature Flag Management:**
- Feature flag creation and management interface
- Rollout percentage controls for gradual feature deployment
- User segment targeting for feature flags (premium users, geographic)
- A/B testing integration with feature flag system
- Feature flag scheduling for time-based releases
- Rollback capabilities for problematic feature releases
- Feature usage analytics and impact measurement

**Platform Policy Configuration:**
- Community guidelines and terms of service management
- Content moderation rules and threshold configuration
- Business verification requirements customization
- Subscription tier features and limitations management
- Geographic restrictions and availability settings
- Age restrictions and compliance requirement management
- Platform fee structures and commission rate settings

### Business Rules & Parameters

**Given** platform operational requirements  
**When** configuring business rules  
**Then** implement flexible rule management:

**Search & Ranking Configuration:**
- Search algorithm parameter tuning
- Business listing ranking factor weights
- Premium listing boost configuration
- Geographic bias settings for local search
- Seasonal ranking adjustments
- Category-specific ranking customization
- Search result diversity controls

**User Engagement Rules:**
- Review submission rate limits and cooling periods
- User interaction limits and spam prevention
- Account verification requirements by user type
- Notification frequency limits and user preferences
- Content submission guidelines and automatic approval thresholds
- User reputation scoring configuration
- Community reward and incentive program settings

### Third-Party Integration Management

**Given** various third-party service integrations  
**When** managing external service configurations  
**Then** provide integration management tools:

**API Integration Configuration:**
- Payment processor settings and webhook management
- Email service provider configuration and template management
- Social media platform integration settings
- Analytics service configuration and data sharing settings
- Map service provider settings and API key management
- SMS service provider configuration for notifications
- Cloud storage and CDN configuration management

**Service Monitoring & Health Checks:**
- Third-party service health monitoring
- API rate limit tracking and alerting
- Service uptime monitoring and failover configuration
- Cost tracking and budget alerts for paid services
- Performance monitoring for external service calls
- Service dependency mapping and impact analysis
- Automated service status communication to users

### Configuration Change Management

**Given** the critical nature of configuration changes  
**When** implementing configuration changes  
**Then** provide change management controls:

**Change Approval & Deployment:**
- Configuration change approval workflows
- Staging environment testing for configuration changes
- Rollback capabilities for configuration modifications
- Change impact assessment and user communication
- Scheduled configuration deployments
- Emergency configuration change procedures
- Configuration version control and history tracking

## Frontend Implementation

### Platform Configuration Dashboard

```typescript
// components/admin/config/PlatformConfigDashboard.tsx
export const PlatformConfigDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'features' | 'policies' | 'integrations' | 'rules'>('features')
  const [pendingChanges, setPendingChanges] = useState<ConfigChange[]>([])
  
  const {
    data: configData,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['platform-config'],
    queryFn: () => adminApi.getPlatformConfig()
  })

  const configMutation = useMutation({
    mutationFn: adminApi.updatePlatformConfig,
    onSuccess: () => {
      refetch()
      toast.success('Configuration updated successfully')
    }
  })

  const handleConfigChange = (section: string, key: string, value: any) => {
    setPendingChanges(prev => [
      ...prev.filter(c => !(c.section === section && c.key === key)),
      { section, key, value, timestamp: Date.now() }
    ])
  }

  const applyChanges = async () => {
    if (pendingChanges.length === 0) return
    
    const confirmed = await confirmDialog({
      title: 'Apply Configuration Changes',
      description: `You have ${pendingChanges.length} pending changes. Apply them now?`,
      confirmText: 'Apply Changes'
    })
    
    if (confirmed) {
      configMutation.mutate(pendingChanges)
      setPendingChanges([])
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Platform Configuration
          </h1>
          <p className="text-sage/70 mt-1">
            Manage platform settings, features, and operational parameters
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <ConfigHistoryButton />
          <ConfigExportButton />
          {pendingChanges.length > 0 && (
            <button
              onClick={applyChanges}
              className="px-4 py-2 bg-teal-primary text-navy-dark rounded-lg hover:bg-teal-accent transition-colors"
            >
              Apply {pendingChanges.length} Change(s)
            </button>
          )}
        </div>
      </div>

      {/* Configuration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Active Features"
          value={configData?.stats.activeFeatures}
          icon={ToggleLeft}
          color="green"
        />
        <StatCard
          title="Policy Updates"
          value={configData?.stats.policyUpdates}
          icon={FileText}
          color="blue"
        />
        <StatCard
          title="Active Integrations"
          value={configData?.stats.activeIntegrations}
          icon={Zap}
          color="teal"
        />
        <StatCard
          title="Config Health"
          value={`${configData?.stats.configHealth}%`}
          icon={Activity}
          color="gold"
        />
      </div>

      {/* Section Navigation */}
      <GlassMorphism variant="subtle" className="p-2">
        <nav className="flex space-x-1">
          {[
            { id: 'features', label: 'Feature Flags', icon: Flag },
            { id: 'policies', label: 'Policies & Rules', icon: FileText },
            { id: 'integrations', label: 'Integrations', icon: Zap },
            { id: 'rules', label: 'Business Rules', icon: Settings }
          ].map((section) => {
            const Icon = section.icon
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  activeSection === section.id
                    ? 'bg-teal-primary text-navy-dark'
                    : 'text-sage/70 hover:text-sage hover:bg-sage/10'
                )}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            )
          })}
        </nav>
      </GlassMorphism>

      {/* Configuration Content */}
      <div className="space-y-6">
        {activeSection === 'features' && (
          <FeatureFlagManagement
            flags={configData?.features || []}
            onChange={(key, value) => handleConfigChange('features', key, value)}
            pendingChanges={pendingChanges.filter(c => c.section === 'features')}
          />
        )}
        
        {activeSection === 'policies' && (
          <PolicyConfiguration
            policies={configData?.policies || {}}
            onChange={(key, value) => handleConfigChange('policies', key, value)}
            pendingChanges={pendingChanges.filter(c => c.section === 'policies')}
          />
        )}
        
        {activeSection === 'integrations' && (
          <IntegrationManagement
            integrations={configData?.integrations || []}
            onChange={(key, value) => handleConfigChange('integrations', key, value)}
            pendingChanges={pendingChanges.filter(c => c.section === 'integrations')}
          />
        )}
        
        {activeSection === 'rules' && (
          <BusinessRulesConfiguration
            rules={configData?.businessRules || {}}
            onChange={(key, value) => handleConfigChange('rules', key, value)}
            pendingChanges={pendingChanges.filter(c => c.section === 'rules')}
          />
        )}
      </div>

      {/* Pending Changes Summary */}
      <AnimatePresence>
        {pendingChanges.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 max-w-sm"
          >
            <GlassMorphism variant="medium" className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-cream">Pending Changes</span>
                <span className="text-teal-primary">{pendingChanges.length}</span>
              </div>
              
              <div className="space-y-1 mb-4">
                {pendingChanges.slice(0, 3).map((change, index) => (
                  <div key={index} className="text-sm text-sage/70">
                    {change.section}.{change.key}
                  </div>
                ))}
                {pendingChanges.length > 3 && (
                  <div className="text-sm text-sage/60">
                    +{pendingChanges.length - 3} more...
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={applyChanges}
                  className="flex-1 px-3 py-1.5 bg-teal-primary text-navy-dark rounded text-sm hover:bg-teal-accent transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => setPendingChanges([])}
                  className="px-3 py-1.5 text-sage/70 hover:text-sage rounded text-sm transition-colors"
                >
                  Discard
                </button>
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

### Feature Flag Management Interface

```typescript
// components/admin/config/FeatureFlagManagement.tsx
interface FeatureFlagManagementProps {
  flags: FeatureFlag[]
  onChange: (key: string, value: any) => void
  pendingChanges: ConfigChange[]
}

export const FeatureFlagManagement: React.FC<FeatureFlagManagementProps> = ({
  flags,
  onChange,
  pendingChanges
}) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'enabled' | 'disabled'>('all')
  
  const filteredFlags = flags.filter(flag => {
    const matchesSearch = flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flag.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'enabled' && flag.enabled) ||
                         (filterStatus === 'disabled' && !flag.enabled)
    return matchesSearch && matchesStatus
  })

  const createFlag = async () => {
    const result = await createFeatureFlagDialog()
    if (result) {
      onChange('new_flag', result)
    }
  }

  return (
    <div className="space-y-6">
      {/* Feature Flags Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-semibold text-cream">
            Feature Flags
          </h2>
          <p className="text-sage/70 mt-1">
            Control feature rollouts and A/B testing
          </p>
        </div>
        
        <button
          onClick={createFlag}
          className="px-4 py-2 bg-teal-primary text-navy-dark rounded-lg hover:bg-teal-accent transition-colors"
        >
          Create Flag
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <SearchInput
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search feature flags..."
          />
        </div>
        
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream"
        >
          <option value="all">All Flags</option>
          <option value="enabled">Enabled</option>
          <option value="disabled">Disabled</option>
        </select>
      </div>

      {/* Feature Flags List */}
      <div className="space-y-4">
        {filteredFlags.map((flag) => {
          const hasPendingChange = pendingChanges.some(c => c.key === flag.key)
          
          return (
            <GlassMorphism
              key={flag.key}
              variant="subtle"
              className={cn(
                'p-6 transition-all duration-200',
                hasPendingChange && 'ring-2 ring-teal-primary/50'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-medium text-cream">
                      {flag.name}
                    </h3>
                    
                    <FeatureFlagStatusBadge
                      enabled={flag.enabled}
                      rolloutPercentage={flag.rolloutPercentage}
                    />
                    
                    {hasPendingChange && (
                      <span className="px-2 py-1 bg-teal-primary/20 text-teal-primary text-xs rounded">
                        Pending
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sage/70 mb-4">{flag.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Status
                      </label>
                      <Toggle
                        checked={flag.enabled}
                        onChange={(enabled) => onChange(flag.key, { ...flag, enabled })}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Rollout Percentage
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={flag.rolloutPercentage}
                          onChange={(e) => onChange(flag.key, {
                            ...flag,
                            rolloutPercentage: parseInt(e.target.value)
                          })}
                          className="flex-1"
                          disabled={!flag.enabled}
                        />
                        <span className="text-sm text-cream w-12">
                          {flag.rolloutPercentage}%
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-cream mb-2">
                        Target Segments
                      </label>
                      <FeatureFlagTargeting
                        segments={flag.targetSegments}
                        onChange={(segments) => onChange(flag.key, {
                          ...flag,
                          targetSegments: segments
                        })}
                      />
                    </div>
                  </div>
                  
                  {flag.enabled && flag.analytics && (
                    <div className="mt-6 pt-6 border-t border-sage/20">
                      <h4 className="font-medium text-cream mb-3">Performance Impact</h4>
                      <FeatureFlagAnalytics analytics={flag.analytics} />
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <FeatureFlagMenu
                    flag={flag}
                    onEdit={() => {/* Open edit dialog */}}
                    onDelete={() => onChange(flag.key, null)}
                    onDuplicate={() => {/* Duplicate flag */}}
                  />
                </div>
              </div>
            </GlassMorphism>
          )
        })}
      </div>
      
      {filteredFlags.length === 0 && (
        <EmptyState
          title="No feature flags found"
          description="Create your first feature flag to start controlling feature rollouts"
          action={{
            label: 'Create Flag',
            onClick: createFlag
          }}
        />
      )}
    </div>
  )
}
```

### Integration Management Interface

```typescript
// components/admin/config/IntegrationManagement.tsx
export const IntegrationManagement: React.FC<IntegrationManagementProps> = ({
  integrations,
  onChange,
  pendingChanges
}) => {
  const [activeIntegration, setActiveIntegration] = useState<Integration | null>(null)
  
  const integrationCategories = [
    { id: 'payment', label: 'Payment Processing', icon: CreditCard },
    { id: 'email', label: 'Email Services', icon: Mail },
    { id: 'sms', label: 'SMS & Messaging', icon: MessageSquare },
    { id: 'analytics', label: 'Analytics & Tracking', icon: BarChart3 },
    { id: 'storage', label: 'Cloud Storage', icon: Cloud },
    { id: 'maps', label: 'Maps & Location', icon: MapPin }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-semibold text-cream">
            Third-Party Integrations
          </h2>
          <p className="text-sage/70 mt-1">
            Manage external service integrations and API configurations
          </p>
        </div>
        
        <AddIntegrationButton
          onAdd={(integration) => onChange('new_integration', integration)}
        />
      </div>

      {/* Integration Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {integrationCategories.map((category) => {
          const categoryIntegrations = integrations.filter(i => i.category === category.id)
          const Icon = category.icon
          
          return (
            <GlassMorphism key={category.id} variant="subtle" className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-teal-primary/20 rounded-lg">
                  <Icon className="w-5 h-5 text-teal-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-cream">{category.label}</h3>
                  <p className="text-sm text-sage/70">
                    {categoryIntegrations.length} integration(s)
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {categoryIntegrations.map((integration) => (
                  <IntegrationCard
                    key={integration.id}
                    integration={integration}
                    hasPendingChanges={pendingChanges.some(c => c.key === integration.id)}
                    onClick={() => setActiveIntegration(integration)}
                  />
                ))}
                
                {categoryIntegrations.length === 0 && (
                  <div className="text-center py-4 text-sage/60 text-sm">
                    No integrations configured
                  </div>
                )}
              </div>
            </GlassMorphism>
          )
        })}
      </div>

      {/* Integration Configuration Modal */}
      <IntegrationConfigurationModal
        integration={activeIntegration}
        onClose={() => setActiveIntegration(null)}
        onSave={(config) => {
          if (activeIntegration) {
            onChange(activeIntegration.id, { ...activeIntegration, config })
            setActiveIntegration(null)
          }
        }}
      />
    </div>
  )
}
```

## Technical Implementation Notes

**Configuration Storage & Management:**
- Database schema for flexible configuration storage
- Configuration caching for performance optimization
- Real-time configuration updates without system restart
- Configuration validation and safety checks

**Feature Flag Implementation:**
- Integration with feature flag service (LaunchDarkly, Flagsmith)
- Local feature flag fallbacks for service outages
- Feature flag analytics and usage tracking
- A/B testing framework integration

**Change Management System:**
- Configuration change audit logging
- Automated testing for configuration changes
- Rollback automation for failed deployments
- Change notification system for administrators

## Dependencies

- Story 4.1 (Admin portal foundation for configuration access)
- Epic 3 Story 3.3 (Subscription system configuration)

## Testing Requirements

**Configuration Management Tests:**
- Feature flag functionality and rollout tests
- Platform policy enforcement and validation tests
- Business rule configuration and impact tests
- Configuration change approval and rollback tests

**Integration Management Tests:**
- Third-party service integration configuration tests
- Service health monitoring and alerting tests
- API integration failover and error handling tests
- Configuration change impact assessment tests

**System Stability Tests:**
- Configuration change impact on system performance
- Real-time configuration update effectiveness tests
- Configuration caching and invalidation tests
- Emergency configuration change procedure tests

## Definition of Done

- [ ] Comprehensive system configuration management interface
- [ ] Feature flag management with rollout controls
- [ ] Platform policy and business rule configuration
- [ ] Third-party integration management tools
- [ ] Configuration change management with approval workflows
- [ ] Service monitoring and health check systems
- [ ] Mobile-responsive configuration management interface
- [ ] Configuration validation and safety checks
- [ ] All configuration management tests passing
- [ ] Documentation complete for platform configuration procedures

## Risk Assessment

- **High Risk:** Incorrect configuration changes could destabilize platform
- **Low Risk:** Feature flag implementation complexity
- **Mitigation:** Comprehensive testing, approval workflows, and rollback capabilities