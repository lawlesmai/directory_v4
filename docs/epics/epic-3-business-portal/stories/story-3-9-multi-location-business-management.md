# Story 3.9: Multi-Location Business Management

**Epic:** Epic 3 - Full-Featured Business Portal  
**Story ID:** 3.9  
**Priority:** P1 (Enterprise Features)  
**Points:** 34  
**Sprint:** 4  
**Assignee:** Frontend Developer Agent

## User Story

**As an Elite tier business owner with multiple locations,** I want comprehensive tools to manage all my business locations from a single dashboard, **so that** I can efficiently oversee my entire business operation, maintain brand consistency, and optimize performance across all locations.

## Background & Context

Multi-Location Business Management is an Elite tier feature designed for business chains, franchises, and enterprises with multiple physical locations. This story creates a centralized management system that allows business owners to coordinate operations, marketing, and analytics across all locations while maintaining individual location customization.

The system must handle complex hierarchical data relationships, role-based access control for different management levels, and consolidated reporting while maintaining performance and user experience.

## Acceptance Criteria

### AC 3.9.1: Multi-Location Dashboard Overview
**Given** a business with multiple locations  
**When** accessing the multi-location dashboard  
**Then** provide centralized management capabilities:

#### Location Portfolio Overview:
- Visual map showing all business locations with performance indicators
- Performance comparison cards for each location
- Consolidated analytics across all locations
- Quick action buttons for common multi-location tasks
- Location status indicators (active, pending, closed, maintenance)
- New location addition workflow with setup wizard
- Location hierarchy management (regional managers, districts)

#### Centralized Profile Management:
- Master profile template for consistent branding
- Location-specific customization capabilities
- Bulk profile updates across selected locations
- Brand consistency enforcement tools
- Centralized photo and media library with shared assets
- Template-based content distribution system

### AC 3.9.2: Individual Location Management
**Given** specific location management needs  
**When** managing individual locations  
**Then** provide location-specific tools:

#### Location-Specific Profiles:
- Individual address and contact information
- Location-specific business hours and availability
- Local manager and staff information management
- Location-specific services and offerings
- Local pricing and promotional variations
- Location-specific customer reviews and responses
- Custom location messaging and announcements

#### Performance Analytics by Location:
- Individual location performance metrics dashboard
- Cross-location performance comparisons and rankings
- Best/worst performing location identification with insights
- Location-specific customer demographics and behavior
- Regional market analysis and opportunities
- Location efficiency and profitability metrics
- Competitive analysis by location market

### AC 3.9.3: Team & Access Management (Elite Feature)
**Given** multi-location team management needs  
**When** managing staff access and permissions  
**Then** implement comprehensive team management:

#### Role-Based Access Control:
- Location managers with location-specific access permissions
- Regional managers with multi-location oversight capabilities
- Corporate admins with full access across all locations
- Staff members with limited operational access
- Custom role creation with granular permission settings
- Access audit trails and activity monitoring
- Temporary access for contractors and seasonal staff

#### Team Communication Tools:
- Internal messaging system between locations and management
- Announcement distribution to selected locations or roles
- Best practice sharing between locations with rating system
- Training material distribution and completion tracking
- Performance benchmarking and recognition programs
- Team collaboration features for marketing campaigns
- Emergency communication channels

### AC 3.9.4: Multi-Location Interface Design
**Given** complex multi-location management needs  
**When** implementing the management interface  
**Then** create intuitive multi-location tools:

```typescript
const MultiLocationDashboard: React.FC = () => {
  const { locations, selectedLocationIds, setSelectedLocations } = useMultiLocationStore()
  const [viewMode, setViewMode] = useState<'map' | 'grid' | 'table'>('grid')
  const [filterCriteria, setFilterCriteria] = useState<LocationFilters>({})
  
  return (
    <div className="space-y-6">
      {/* Multi-Location Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Multi-Location Management
          </h1>
          <p className="text-sage/70 mt-1">
            {locations.length} locations • {getActiveLocationsCount(locations)} active
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <LocationViewToggle value={viewMode} onChange={setViewMode} />
          <LocationFilters
            criteria={filterCriteria}
            onChange={setFilterCriteria}
            locations={locations}
          />
          <Button onClick={addNewLocation}>
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MultiLocationMetricCard
          title="Total Revenue"
          value={calculateTotalRevenue(locations)}
          change={calculateRevenueChange(locations)}
          format="currency"
          icon={DollarSign}
        />
        <MultiLocationMetricCard
          title="Best Performer"
          value={getBestPerformingLocation(locations)?.name}
          subValue={`+${getBestPerformingLocation(locations)?.growthRate}%`}
          icon={TrendingUp}
        />
        <MultiLocationMetricCard
          title="Needs Attention"
          value={getNeedsAttentionCount(locations)}
          subValue={`${locations.length - getNeedsAttentionCount(locations)} performing well`}
          icon={AlertTriangle}
        />
        <MultiLocationMetricCard
          title="Team Members"
          value={getTotalTeamMembers(locations)}
          subValue={`Across ${getActiveLocationsCount(locations)} locations`}
          icon={Users}
        />
      </div>

      {/* Location Management Views */}
      <GlassMorphism variant="subtle" className="p-6">
        {viewMode === 'map' && (
          <LocationMapView
            locations={locations}
            selectedIds={selectedLocationIds}
            onSelectionChange={setSelectedLocations}
            onLocationClick={navigateToLocation}
          />
        )}
        
        {viewMode === 'grid' && (
          <LocationGridView
            locations={filteredLocations}
            selectedIds={selectedLocationIds}
            onSelectionChange={setSelectedLocations}
            onLocationAction={handleLocationAction}
          />
        )}
        
        {viewMode === 'table' && (
          <LocationTableView
            locations={filteredLocations}
            selectedIds={selectedLocationIds}
            onSelectionChange={setSelectedLocations}
            sortConfig={sortConfig}
            onSort={setSortConfig}
          />
        )}
        
        {/* Bulk Actions */}
        {selectedLocationIds.length > 0 && (
          <div className="mt-6 pt-4 border-t border-sage/20">
            <BulkLocationActions
              selectedCount={selectedLocationIds.length}
              onBulkUpdate={handleBulkUpdate}
              onBulkExport={handleBulkExport}
              onBulkDelete={handleBulkDelete}
            />
          </div>
        )}
      </GlassMorphism>

      {/* Cross-Location Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LocationPerformanceChart
          locations={locations}
          timeRange={selectedTimeRange}
          metric="revenue"
        />
        <LocationComparisonChart
          locations={locations}
          metrics={['revenue', 'customers', 'reviews']}
        />
      </div>
    </div>
  )
}

const LocationCard: React.FC<LocationCardProps> = ({
  location,
  selected,
  onSelect,
  onAction
}) => {
  const statusColor = {
    active: 'text-sage',
    maintenance: 'text-gold-primary', 
    closed: 'text-red-error'
  }[location.status]

  return (
    <GlassMorphism 
      variant="subtle" 
      className={cn(
        'p-4 transition-all duration-200 hover:bg-navy-50/30',
        selected && 'ring-2 ring-teal-primary'
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={selected}
            onChange={onSelect}
          />
          <div className="flex-1">
            <h3 className="font-medium text-cream">{location.name}</h3>
            <p className="text-sm text-sage/70">{location.address}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className={cn('w-2 h-2 rounded-full', statusColor)} />
              <span className="text-xs text-sage/70 capitalize">
                {location.status}
              </span>
            </div>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onAction('edit', location.id)}>
              Edit Location
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('analytics', location.id)}>
              View Analytics
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onAction('team', location.id)}>
              Manage Team
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onAction('duplicate', location.id)}
              className="text-sage"
            >
              Duplicate Location
            </DropdownMenuItem>
            {location.status === 'active' ? (
              <DropdownMenuItem 
                onClick={() => onAction('deactivate', location.id)}
                className="text-gold-primary"
              >
                Set Maintenance
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem 
                onClick={() => onAction('activate', location.id)}
                className="text-sage"
              >
                Activate Location
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onAction('delete', location.id)}
              className="text-red-error"
            >
              Delete Location
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-cream">
            {location.metrics.revenue.toLocaleString()}
          </div>
          <div className="text-xs text-sage/70">Revenue</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-cream">
            {location.metrics.customers}
          </div>
          <div className="text-xs text-sage/70">Customers</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-cream">
            {location.metrics.rating.toFixed(1)}
          </div>
          <div className="text-xs text-sage/70">Rating</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={() => onAction('view', location.id)}
        >
          View Details
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAction('analytics', location.id)}
        >
          <BarChart3 className="w-4 h-4" />
        </Button>
      </div>
    </GlassMorphism>
  )
}
```

### AC 3.9.5: Centralized Marketing & Brand Management
**Given** multi-location marketing coordination needs  
**When** running marketing campaigns  
**Then** provide centralized marketing tools:

#### Campaign Distribution:
- Corporate-wide campaign creation and distribution
- Location-specific campaign customization options
- Regional campaign targeting capabilities
- Campaign performance tracking across locations
- Budget allocation and ROI tracking by location
- A/B testing across different locations for optimization

#### Brand Consistency Management:
- Brand guideline enforcement across all locations
- Template library for marketing materials and communications
- Approval workflows for location-specific content
- Brand compliance monitoring and reporting
- Social media coordination across locations
- Review response coordination and consistency

## Technical Requirements

### Database Schema
```sql
-- Business groups for multi-location management
CREATE TABLE business_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Group configuration
  billing_consolidated BOOLEAN DEFAULT TRUE,
  analytics_consolidated BOOLEAN DEFAULT TRUE,
  
  -- Subscription (group-level for Elite tier)
  subscription_id UUID REFERENCES subscriptions(id),
  
  -- Branding and templates
  brand_guidelines JSONB DEFAULT '{}',
  shared_assets JSONB DEFAULT '[]',
  
  -- Settings
  settings JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link businesses to groups with hierarchy
ALTER TABLE businesses ADD COLUMN group_id UUID REFERENCES business_groups(id);
ALTER TABLE businesses ADD COLUMN is_headquarters BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN location_tier VARCHAR(20) DEFAULT 'standard';

-- Team permissions for multi-location access
CREATE TABLE location_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  business_group_id UUID REFERENCES business_groups(id),
  business_id UUID REFERENCES businesses(id), -- NULL for group-level access
  
  -- Permission levels
  role VARCHAR(50) NOT NULL, -- 'admin', 'manager', 'staff', 'viewer'
  permissions JSONB DEFAULT '{}',
  
  -- Access scope
  can_edit_profiles BOOLEAN DEFAULT FALSE,
  can_manage_hours BOOLEAN DEFAULT FALSE,
  can_respond_reviews BOOLEAN DEFAULT FALSE,
  can_view_analytics BOOLEAN DEFAULT FALSE,
  can_manage_team BOOLEAN DEFAULT FALSE,
  can_manage_campaigns BOOLEAN DEFAULT FALSE,
  
  granted_by UUID REFERENCES auth.users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  UNIQUE(user_id, business_id, business_group_id)
);
```

### Performance Requirements
- Multi-location dashboard load: < 3 seconds for 50 locations
- Cross-location analytics: < 2 seconds aggregation
- Bulk operations: Handle 100+ locations efficiently
- Real-time updates: < 30 seconds across locations
- Map rendering: < 1 second for location display

## Dependencies

### Must Complete First:
- Story 3.3: Elite tier subscription requirement
- Story 3.4: Analytics system for multi-location reporting
- Epic 2 Story 2.8: RBAC system for team management

### External Dependencies:
- Mapping service for location visualization
- Bulk data processing capabilities
- Advanced caching for performance
- Team communication infrastructure

## Definition of Done

### Functional Requirements ✓
- [ ] Multi-location dashboard with centralized overview
- [ ] Individual location management capabilities
- [ ] Team and access management system for Elite tier
- [ ] Centralized marketing and brand consistency tools
- [ ] Performance analytics across all locations

### Technical Requirements ✓
- [ ] Database optimization for multi-location queries
- [ ] Real-time data synchronization across locations
- [ ] Security and access control for team members
- [ ] Bulk operations and template management
- [ ] Performance optimization for large datasets

### User Experience ✓
- [ ] Intuitive multi-location navigation and management
- [ ] Clear location hierarchy and organization
- [ ] Mobile-responsive multi-location interface
- [ ] Efficient bulk operation workflows
- [ ] Comprehensive help system for complex features

## Success Metrics

### Elite Tier Adoption
- Multi-location feature usage: > 70% of Elite subscribers
- Average locations per group: > 5
- Team member invitations: > 3 per location group
- Location management efficiency: +60% time savings

### Business Value
- Cross-location insights effectiveness: Measured by user surveys
- Brand consistency improvement: +40% compliance score
- Marketing campaign coordination: +35% efficiency
- Revenue optimization across locations: +20% improvement

## Risk Assessment

### Technical Risks
- **High Risk:** Complex data relationships may impact performance
  - *Mitigation:* Comprehensive testing with large datasets
- **Medium Risk:** Team management complexity
  - *Mitigation:* Clear permission models and audit trails

### Business Risks
- **Medium Risk:** Feature complexity may overwhelm users
  - *Mitigation:* Progressive disclosure and comprehensive onboarding