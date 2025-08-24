# Story 3.7: Marketing Tools & Promotional Features

**Epic:** Epic 3 - Full-Featured Business Portal  
**Story ID:** 3.7  
**Priority:** P0 (Revenue Growth)  
**Points:** 34  
**Sprint:** 3  
**Assignee:** Frontend Developer Agent

## User Story

**As a business owner,** I want powerful marketing and promotional tools integrated into my business portal, **so that** I can attract new customers, promote special offers, and grow my business effectively through data-driven marketing campaigns.

## Background & Context

Marketing Tools & Promotional Features are essential for business growth and customer acquisition. This story creates a comprehensive marketing suite that enables business owners to create, manage, and track promotional campaigns, special offers, and customer outreach efforts.

The marketing system must integrate seamlessly with the business portal while providing sophisticated campaign management, performance tracking, and automated optimization features that help businesses maximize their marketing ROI.

## Acceptance Criteria

### AC 3.7.1: Promotional Campaign Management
**Given** business owners wanting to promote their services  
**When** creating marketing campaigns  
**Then** provide comprehensive promotional tools:

#### Special Offers & Deals:
- Limited-time offer creation with start/end dates
- Percentage or fixed-amount discount management
- Promo code generation and tracking
- Customer segment targeting (new vs. returning customers)
- Offer visibility controls (public, private, member-only)
- Bulk offer management for multiple services
- A/B testing capabilities for different offer presentations

#### Event Promotion:
- Special event creation and promotion tools
- Event calendar integration with business profile
- Event RSVP tracking and customer management
- Social media event promotion automation
- Event photo and video upload capabilities
- Recurring event setup (weekly classes, monthly sales)
- Event reminder system for interested customers

### AC 3.7.2: Content Marketing Tools (Premium+ Features)
**Given** Premium or Elite subscription holders  
**When** creating marketing content  
**Then** provide advanced content tools:

#### Business Updates & Announcements:
- News and update posting system
- Rich media support (photos, videos, documents)
- Update scheduling for optimal posting times
- Customer engagement tracking (views, clicks, shares)
- Update categories (news, products, services, achievements)
- Archive and historical update management

#### Social Media Integration:
- Automatic posting to connected social media accounts
- Social media content calendar and scheduling
- Cross-platform content optimization
- Social media performance analytics
- Hashtag suggestions based on business category
- Social media contest and giveaway management

### AC 3.7.3: Customer Outreach & Communication
**Given** the need for direct customer engagement  
**When** communicating with customers  
**Then** implement outreach tools:

#### Email Marketing Integration:
- Customer email list building and management
- Email template library for different business types
- Newsletter creation with drag-and-drop editor
- Email campaign performance analytics
- Automated email sequences (welcome series, follow-ups)
- GDPR-compliant email consent management

#### Customer Loyalty Programs:
- Points-based loyalty program setup
- Digital loyalty card creation
- Reward tier management and customer progression
- Loyalty program analytics and engagement tracking
- Automated reward notifications and redemption
- Integration with POS systems (future enhancement)

### AC 3.7.4: Marketing Campaign Interface
**Given** campaign management requirements  
**When** implementing the marketing interface  
**Then** create intuitive campaign tools:

```typescript
const MarketingDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'promotions' | 'social' | 'email'>('campaigns')
  const { campaigns, isLoading } = useMarketingCampaigns()
  
  return (
    <div className="space-y-6">
      {/* Marketing Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MarketingMetricCard
          title="Active Campaigns"
          value={campaigns.filter(c => c.status === 'active').length}
          change={+15}
          icon={Target}
        />
        <MarketingMetricCard
          title="Total Reach"
          value={campaigns.reduce((sum, c) => sum + c.reach, 0)}
          change={+28}
          icon={Users}
          format="number"
        />
        <MarketingMetricCard
          title="Conversion Rate"
          value={calculateOverallConversionRate(campaigns)}
          change={-3}
          icon={TrendingUp}
          format="percentage"
        />
        <MarketingMetricCard
          title="ROI"
          value={calculateROI(campaigns)}
          change={+42}
          icon={DollarSign}
          format="currency"
        />
      </div>

      {/* Marketing Tools Tabs */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-1">
            {[
              { id: 'campaigns', label: 'Campaigns', icon: Target },
              { id: 'promotions', label: 'Promotions', icon: Tag },
              { id: 'social', label: 'Social Media', icon: Share2, premium: true },
              { id: 'email', label: 'Email Marketing', icon: Mail, premium: true }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
                  activeTab === tab.id
                    ? 'bg-teal-primary text-cream'
                    : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
                )}
              >
                <tab.icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.premium && <Lock className="w-3 h-3" />}
              </button>
            ))}
          </div>
          
          <Button onClick={() => createNewCampaign()}>
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {activeTab === 'campaigns' && <CampaignManagement />}
          {activeTab === 'promotions' && <PromotionManagement />}
          {activeTab === 'social' && <SocialMediaManagement />}
          {activeTab === 'email' && <EmailMarketingManagement />}
        </div>
      </GlassMorphism>
    </div>
  )
}

const CampaignCreator: React.FC = () => {
  const [campaignType, setCampaignType] = useState<'promotion' | 'event' | 'announcement'>('promotion')
  const [campaign, setCampaign] = useState<CreateCampaignData>(initialCampaignData)
  const [isPreviewMode, setIsPreviewMode] = useState(false)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Campaign Type Selection */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            type: 'promotion',
            title: 'Special Promotion',
            description: 'Create discount offers and deals',
            icon: Tag,
            color: 'teal'
          },
          {
            type: 'event',
            title: 'Event Promotion',
            description: 'Promote events and special occasions',
            icon: Calendar,
            color: 'gold'
          },
          {
            type: 'announcement',
            title: 'Business Update',
            description: 'Share news and announcements',
            icon: Megaphone,
            color: 'sage'
          }
        ].map((option) => (
          <CampaignTypeCard
            key={option.type}
            selected={campaignType === option.type}
            onClick={() => setCampaignType(option.type as any)}
            {...option}
          />
        ))}
      </div>

      {/* Campaign Configuration */}
      <GlassMorphism variant="medium" className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Campaign Details */}
          <div className="space-y-6">
            <FormSection title="Campaign Details">
              <FormField label="Campaign Name" required>
                <Input
                  value={campaign.name}
                  onChange={(value) => setCampaign({...campaign, name: value})}
                  placeholder="Summer Sale 2024"
                />
              </FormField>

              <FormField label="Description">
                <RichTextEditor
                  value={campaign.description}
                  onChange={(value) => setCampaign({...campaign, description: value})}
                  placeholder="Describe your campaign..."
                  maxLength={500}
                />
              </FormField>

              <FormField label="Campaign Duration">
                <DateRangePicker
                  value={campaign.dateRange}
                  onChange={(range) => setCampaign({...campaign, dateRange: range})}
                />
              </FormField>
            </FormSection>

            {/* Campaign-Specific Configuration */}
            {campaignType === 'promotion' && (
              <PromotionConfiguration
                promotion={campaign.promotion}
                onChange={(promotion) => setCampaign({...campaign, promotion})}
              />
            )}

            {campaignType === 'event' && (
              <EventConfiguration
                event={campaign.event}
                onChange={(event) => setCampaign({...campaign, event})}
              />
            )}
          </div>

          {/* Targeting & Budget */}
          <div className="space-y-6">
            <FormSection title="Audience Targeting">
              <CustomerSegmentSelector
                selectedSegments={campaign.targetSegments}
                onChange={(segments) => setCampaign({...campaign, targetSegments: segments})}
              />
              
              <LocationTargeting
                locations={campaign.targetLocations}
                onChange={(locations) => setCampaign({...campaign, targetLocations: locations})}
              />
            </FormSection>

            <FormSection title="Budget & Goals" premium>
              <FormField label="Campaign Budget (Optional)">
                <div className="grid grid-cols-2 gap-2">
                  <CurrencyInput
                    value={campaign.budget?.amount}
                    onChange={(amount) => setCampaign({
                      ...campaign, 
                      budget: {...campaign.budget, amount}
                    })}
                    placeholder="0.00"
                  />
                  <Select
                    value={campaign.budget?.period}
                    onChange={(period) => setCampaign({
                      ...campaign,
                      budget: {...campaign.budget, period}
                    })}
                  >
                    <SelectOption value="total">Total Budget</SelectOption>
                    <SelectOption value="daily">Per Day</SelectOption>
                    <SelectOption value="weekly">Per Week</SelectOption>
                  </Select>
                </div>
              </FormField>

              <FormField label="Success Goals">
                <CampaignGoals
                  goals={campaign.goals}
                  onChange={(goals) => setCampaign({...campaign, goals})}
                />
              </FormField>
            </FormSection>
          </div>
        </div>

        {/* Campaign Preview */}
        {isPreviewMode && (
          <div className="mt-8 pt-6 border-t border-sage/20">
            <h3 className="text-lg font-medium text-cream mb-4">Campaign Preview</h3>
            <CampaignPreview campaign={campaign} type={campaignType} />
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-sage/20">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
            >
              {isPreviewMode ? 'Edit' : 'Preview'}
            </Button>
            <Button variant="ghost" onClick={saveDraft}>
              Save Draft
            </Button>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={() => launchCampaign(campaign)}>
              Launch Campaign
            </Button>
          </div>
        </div>
      </GlassMorphism>
    </div>
  )
}

const PromotionConfiguration: React.FC<PromotionConfigProps> = ({
  promotion,
  onChange
}) => {
  return (
    <FormSection title="Promotion Details">
      <FormField label="Discount Type">
        <Select value={promotion.type} onChange={(type) => onChange({...promotion, type})}>
          <SelectOption value="percentage">Percentage Off</SelectOption>
          <SelectOption value="fixed">Fixed Amount Off</SelectOption>
          <SelectOption value="bogo">Buy One Get One</SelectOption>
          <SelectOption value="free_item">Free Item/Service</SelectOption>
        </Select>
      </FormField>

      {(promotion.type === 'percentage' || promotion.type === 'fixed') && (
        <FormField label="Discount Value">
          <div className="grid grid-cols-2 gap-2">
            {promotion.type === 'percentage' ? (
              <NumberInput
                value={promotion.value}
                onChange={(value) => onChange({...promotion, value})}
                placeholder="25"
                suffix="%"
                max={100}
              />
            ) : (
              <CurrencyInput
                value={promotion.value}
                onChange={(value) => onChange({...promotion, value})}
                placeholder="10.00"
              />
            )}
            <CurrencyInput
              value={promotion.minimumPurchase}
              onChange={(value) => onChange({...promotion, minimumPurchase: value})}
              placeholder="Minimum purchase"
            />
          </div>
        </FormField>
      )}

      <FormField label="Promo Code (Optional)">
        <div className="flex gap-2">
          <Input
            value={promotion.promoCode}
            onChange={(value) => onChange({...promotion, promoCode: value})}
            placeholder="SUMMER2024"
          />
          <Button
            variant="outline"
            onClick={() => generatePromoCode(onChange)}
            size="sm"
          >
            Generate
          </Button>
        </div>
      </FormField>

      <FormField label="Usage Limits">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            value={promotion.maxRedemptions}
            onChange={(value) => onChange({...promotion, maxRedemptions: value})}
            placeholder="Total uses"
          />
          <NumberInput
            value={promotion.maxPerCustomer}
            onChange={(value) => onChange({...promotion, maxPerCustomer: value})}
            placeholder="Per customer"
          />
        </div>
      </FormField>
    </FormSection>
  )
}
```

### AC 3.7.5: Campaign Analytics & Performance Tracking
**Given** marketing campaigns and promotions  
**When** measuring campaign effectiveness  
**Then** provide comprehensive analytics:
- Campaign performance metrics (reach, engagement, conversions)
- ROI calculation for promotional spending
- Customer acquisition cost analysis
- Promotional code usage tracking and analytics
- Social media engagement and growth metrics
- Email marketing performance (open rates, click rates, conversions)

## Technical Requirements

### Backend Integration
```sql
-- Marketing campaigns
CREATE TABLE marketing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Campaign details
  campaign_name VARCHAR(255) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL, -- 'promotion', 'event', 'announcement'
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'canceled')),
  
  -- Content
  description TEXT,
  content_html TEXT,
  call_to_action VARCHAR(255),
  landing_url TEXT,
  
  -- Targeting
  target_audience JSONB DEFAULT '{}',
  target_locations GEOGRAPHY(POLYGON, 4326),
  target_segments TEXT[],
  
  -- Schedule and budget
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  budget_amount DECIMAL(10,2),
  budget_period VARCHAR(20),
  
  -- Performance tracking
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  spent_amount DECIMAL(10,2) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Promotions and special offers
CREATE TABLE business_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  
  -- Promotion details
  promotion_type VARCHAR(50) NOT NULL, -- 'percentage', 'fixed', 'bogo', 'free_item'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Discount configuration
  discount_value DECIMAL(10,2),
  minimum_purchase DECIMAL(10,2),
  
  -- Usage and redemption
  promo_code VARCHAR(50) UNIQUE,
  max_redemptions INTEGER,
  current_redemptions INTEGER DEFAULT 0,
  max_per_customer INTEGER DEFAULT 1,
  
  -- Validity period
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ NOT NULL,
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email marketing lists and campaigns
CREATE TABLE email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES marketing_campaigns(id),
  
  -- Email details
  subject_line VARCHAR(255) NOT NULL,
  email_content_html TEXT,
  email_content_text TEXT,
  
  -- Sending configuration
  recipient_list_id UUID,
  send_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  
  -- Performance metrics
  recipients_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  unsubscribed_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Campaign Performance Analytics
```typescript
interface CampaignAnalytics {
  campaign: MarketingCampaign
  metrics: {
    reach: number
    impressions: number
    clicks: number
    conversions: number
    conversionRate: number
    costPerClick: number
    costPerAcquisition: number
    roi: number
  }
  timeline: Array<{
    date: Date
    impressions: number
    clicks: number
    conversions: number
    spend: number
  }>
  demographics: {
    ageGroups: Array<{age: string, percentage: number}>
    locations: Array<{location: string, count: number}>
    devices: Array<{device: string, percentage: number}>
  }
}

export const calculateCampaignROI = (campaign: MarketingCampaign): number => {
  const totalRevenue = campaign.conversions * (campaign.averageOrderValue || 0)
  const totalSpend = campaign.spentAmount
  
  if (totalSpend === 0) return 0
  return ((totalRevenue - totalSpend) / totalSpend) * 100
}

export const getCampaignInsights = (analytics: CampaignAnalytics): CampaignInsight[] => {
  const insights: CampaignInsight[] = []
  
  // Performance insights
  if (analytics.metrics.conversionRate > 0.05) {
    insights.push({
      type: 'success',
      title: 'High Conversion Rate',
      message: `Your campaign is converting ${(analytics.metrics.conversionRate * 100).toFixed(1)}% of clicks`,
      action: 'Consider increasing budget for this high-performing campaign'
    })
  }
  
  // Optimization suggestions
  if (analytics.metrics.costPerClick > industryAverage.costPerClick) {
    insights.push({
      type: 'warning',
      title: 'High Cost Per Click',
      message: 'Your CPC is above industry average',
      action: 'Review targeting and ad content to improve relevance'
    })
  }
  
  return insights
}
```

### Performance Requirements
- Campaign creation: < 2 seconds
- Analytics dashboard load: < 1.5 seconds
- Real-time metrics update: < 30 seconds
- Campaign launch: < 5 seconds
- Email campaign delivery: < 10 minutes

## Dependencies

### Must Complete First:
- Story 3.4: Analytics system for marketing performance tracking
- Story 3.3: Subscription tiers for premium marketing features
- Story 3.1: Dashboard foundation for marketing interface

### External Dependencies:
- Email marketing service integration (SendGrid, Mailchimp)
- Social media API integrations (Facebook, Instagram, Twitter)
- Payment processing for campaign budgets
- Analytics tracking implementation

## Testing Strategy

### Unit Tests
- Campaign creation and validation logic
- Promotion code generation and validation
- Email template rendering
- Analytics calculation accuracy
- ROI computation validation

### Integration Tests
- Email campaign delivery testing
- Social media posting functionality
- Campaign performance tracking
- External service integrations
- Database campaign storage

### E2E Tests
- Complete campaign creation workflow
- Customer redemption of promotions
- Email campaign subscriber journey
- Analytics dashboard functionality
- Mobile marketing interface

### Performance Tests
- Campaign creation under load
- Email delivery performance
- Analytics query optimization
- Large campaign dataset handling

## Definition of Done

### Functional Requirements ✓
- [ ] Comprehensive promotional campaign management system
- [ ] Social media integration with major platforms
- [ ] Email marketing tools and customer outreach features
- [ ] Customer loyalty program functionality
- [ ] Marketing performance analytics and reporting

### Technical Requirements ✓
- [ ] Campaign automation and scheduling capabilities
- [ ] Integration with external marketing platforms
- [ ] Mobile-responsive marketing interface
- [ ] GDPR compliance for customer communication
- [ ] Performance optimization for campaign operations

### User Experience ✓
- [ ] Intuitive campaign creation workflow
- [ ] Clear performance analytics presentation
- [ ] Mobile marketing management optimized
- [ ] Help system and best practices guidance
- [ ] Professional marketing asset creation

### Business Value ✓
- [ ] ROI tracking and optimization working
- [ ] Customer acquisition improvement measurable
- [ ] Premium feature adoption for marketing tools
- [ ] Business growth correlation with marketing usage
- [ ] Customer engagement improvement validated

## Success Metrics

### Campaign Performance
- Campaign creation rate: > 60% of Premium+ subscribers
- Average campaign ROI: > 300%
- Email campaign open rate: > 25%
- Social media engagement increase: +40%

### Business Impact
- Customer acquisition cost reduction: -30%
- Revenue increase from promotions: +45%
- Customer retention improvement: +25%
- Marketing efficiency improvement: +50%

### User Adoption
- Marketing tools usage: > 70% of Premium subscribers
- Campaign completion rate: > 85%
- Email list growth rate: > 15% monthly
- Social media posting consistency: > 80%

### Technical Performance
- Campaign launch success rate: > 99%
- Email delivery rate: > 98%
- Analytics accuracy: > 99.5%
- Mobile interface usability: > 90%

## Risk Assessment

### Technical Risks
- **High Risk:** Complex social media API integrations may be unreliable
  - *Mitigation:* Robust API error handling and multiple platform support
- **Medium Risk:** Email marketing system compliance and deliverability
  - *Mitigation:* Partner with established email service providers

### Business Risks
- **Medium Risk:** Marketing campaign effectiveness varies by industry
  - *Mitigation:* Industry-specific templates and best practices
- **Low Risk:** Customer privacy concerns with marketing automation
  - *Mitigation:* Clear opt-in processes and privacy controls

## Notes

### Compliance Considerations
- CAN-SPAM Act compliance for email marketing
- GDPR compliance for customer data and consent
- Platform advertising policies compliance
- FTC disclosure requirements for promotions

### Future Enhancements (Post-MVP)
- Advanced A/B testing for campaigns
- Integration with advertising platforms (Google Ads, Facebook Ads)
- Customer journey mapping and automation
- Advanced segmentation and personalization
- Video marketing tools and management
- Influencer collaboration platform

### API Endpoints Required
- `GET /api/marketing/campaigns/:businessId` - Retrieve campaigns
- `POST /api/marketing/campaigns` - Create new campaign
- `PUT /api/marketing/campaigns/:id/launch` - Launch campaign
- `GET /api/marketing/analytics/:campaignId` - Campaign analytics
- `POST /api/marketing/email/send` - Send email campaign
- `GET /api/marketing/promotions/:businessId` - Active promotions