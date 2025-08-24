# Story 3.6: Business Hours & Availability Management

**Epic:** Epic 3 - Full-Featured Business Portal  
**Story ID:** 3.6  
**Priority:** P1 (Customer Experience)  
**Points:** 17  
**Sprint:** 3  
**Assignee:** Frontend Developer Agent

## User Story

**As a business owner,** I want flexible tools to manage my business hours, special schedules, and availability, **so that** customers always have accurate information about when they can visit or contact my business.

## Background & Context

Business Hours & Availability Management is essential for customer satisfaction and operational efficiency. This story provides businesses with sophisticated scheduling tools that handle complex operating patterns, seasonal variations, special events, and multiple service types.

The system must balance simplicity for basic use cases with flexibility for complex scheduling needs, while ensuring customer-facing information is always accurate and up-to-date.

## Acceptance Criteria

### AC 3.6.1: Comprehensive Hours Management Interface
**Given** varying business operation schedules  
**When** setting up business hours  
**Then** provide flexible scheduling tools:

#### Standard Operating Hours:
- Weekly schedule with individual day customization
- Multiple time slots per day (e.g., lunch break splits)
- Different hours for different services or departments
- 24/7 operation support with proper display
- "By appointment only" scheduling options
- Closed day designation with custom messages

#### Special Hours & Exceptions:
- Holiday hours with pre-configured holiday templates
- Seasonal schedule adjustments (summer/winter hours)
- Special event hours with date ranges
- Emergency closures with immediate updates
- Vacation scheduling with advance notice
- Temporary hour changes with automatic reversion

### AC 3.6.2: Real-Time Status Display System
**Given** current business hours settings  
**When** customers view business information  
**Then** display accurate availability:
- "Open Now" / "Closed" status with next opening time
- "Closing Soon" alerts (within 1 hour of closing)
- "Opens in X hours/minutes" countdown display
- Special status messages for holidays or events
- Time zone handling for multi-location businesses
- Mobile-specific status display optimization

### AC 3.6.3: Advanced Availability Features (Premium+ Tiers)
**Given** Premium or Elite subscription holders  
**When** managing complex scheduling needs  
**Then** provide advanced features:

#### Service-Specific Hours:
- Different hours for different services offered
- Department-specific scheduling (sales vs. service)
- Staff-specific availability (appointment-based businesses)
- Resource availability (meeting rooms, equipment)
- Capacity-based scheduling (maximum customers per time slot)
- Online booking integration with availability sync

#### Automated Management:
- Recurring schedule templates (monthly patterns)
- Automatic holiday schedule application
- Weather-based hour adjustments (outdoor businesses)
- Integration with staff scheduling systems
- Bulk schedule updates across date ranges
- Schedule approval workflow for team-managed accounts

### AC 3.6.4: Customer Communication Features
**Given** schedule changes affecting customers  
**When** updating business hours  
**Then** implement communication features:
- Automatic customer notifications for schedule changes
- Social media integration for hour announcements
- Website widget with current hours display
- Email signature integration with current status
- Google My Business automatic sync
- Customer FAQ integration for common hour questions

### AC 3.6.5: Hours Management Interface Design
**Given** the need for intuitive scheduling  
**When** implementing the hours management UI  
**Then** create user-friendly interfaces:

```typescript
const BusinessHoursManager: React.FC = () => {
  const [scheduleType, setScheduleType] = useState<'standard' | 'advanced'>('standard')
  const [currentSchedule, setCurrentSchedule] = useState<WeeklySchedule>(defaultSchedule)
  const [specialHours, setSpecialHours] = useState<SpecialHour[]>([])
  const [previewDate, setPreviewDate] = useState(new Date())

  return (
    <div className="space-y-6">
      {/* Schedule Type Selector */}
      <div className="flex items-center gap-4">
        <ScheduleTypeToggle
          value={scheduleType}
          onChange={setScheduleType}
          options={[
            { value: 'standard', label: 'Standard Hours', icon: Clock },
            { value: 'advanced', label: 'Advanced Scheduling', icon: Calendar, premium: true }
          ]}
        />
      </div>

      {/* Weekly Schedule Editor */}
      <GlassMorphism variant="subtle" className="p-6">
        <h3 className="text-lg font-heading font-semibold text-cream mb-4">
          Weekly Operating Hours
        </h3>
        
        <div className="space-y-4">
          {DAYS_OF_WEEK.map((day) => (
            <DayScheduleEditor
              key={day}
              day={day}
              schedule={currentSchedule[day]}
              onChange={(schedule) => updateDaySchedule(day, schedule)}
              allowMultipleSlots={scheduleType === 'advanced'}
            />
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 mt-6 pt-4 border-t border-sage/20">
          <Button variant="outline" size="sm" onClick={applyToAllDays}>
            Apply to All Days
          </Button>
          <Button variant="outline" size="sm" onClick={copyBusinessWeek}>
            Copy Business Week (Mon-Fri)
          </Button>
          <Button variant="outline" size="sm" onClick={setWeekendHours}>
            Set Weekend Hours
          </Button>
        </div>
      </GlassMorphism>

      {/* Special Hours & Exceptions */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-cream">
            Special Hours & Exceptions
          </h3>
          <Button onClick={addSpecialHours}>
            <Plus className="w-4 h-4 mr-2" />
            Add Exception
          </Button>
        </div>

        <div className="space-y-3">
          {specialHours.map((specialHour) => (
            <SpecialHourCard
              key={specialHour.id}
              specialHour={specialHour}
              onEdit={editSpecialHour}
              onDelete={deleteSpecialHour}
            />
          ))}
          
          {specialHours.length === 0 && (
            <EmptyState
              icon={Calendar}
              title="No special hours set"
              description="Add holiday hours, seasonal changes, or special events"
            />
          )}
        </div>
      </GlassMorphism>

      {/* Schedule Preview */}
      <GlassMorphism variant="subtle" className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-heading font-semibold text-cream">
            Schedule Preview
          </h3>
          <DatePicker
            value={previewDate}
            onChange={setPreviewDate}
            placeholder="Select date to preview"
          />
        </div>

        <SchedulePreview
          date={previewDate}
          schedule={currentSchedule}
          specialHours={specialHours}
          timezone={business.timezone}
        />
      </GlassMorphism>

      {/* Status Display Settings */}
      <GlassMorphism variant="subtle" className="p-6">
        <h3 className="text-lg font-heading font-semibold text-cream mb-4">
          Status Display Settings
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <FormField
              label="Closing Soon Warning"
              description="Show 'closing soon' when closing within:"
            >
              <Select value={closingSoonMinutes} onChange={setClosingSoonMinutes}>
                <SelectOption value={30}>30 minutes</SelectOption>
                <SelectOption value={60}>1 hour</SelectOption>
                <SelectOption value={120}>2 hours</SelectOption>
              </Select>
            </FormField>

            <FormField
              label="Custom Closed Message"
              description="Message to show when closed"
            >
              <Input
                value={closedMessage}
                onChange={setClosedMessage}
                placeholder="We're currently closed. See you soon!"
              />
            </FormField>
          </div>

          <div className="space-y-4">
            <FormField label="Status Display Preview">
              <BusinessStatusPreview
                isOpen={isCurrentlyOpen(currentSchedule, specialHours)}
                nextChange={getNextScheduleChange(currentSchedule, specialHours)}
                closedMessage={closedMessage}
                closingSoonMinutes={closingSoonMinutes}
              />
            </FormField>
          </div>
        </div>
      </GlassMorphism>
    </div>
  )
}

const DayScheduleEditor: React.FC<DayScheduleEditorProps> = ({
  day,
  schedule,
  onChange,
  allowMultipleSlots = false
}) => {
  const [isClosed, setIsClosed] = useState(schedule.closed)
  const [timeSlots, setTimeSlots] = useState(schedule.timeSlots || [defaultTimeSlot])

  return (
    <div className="flex items-center gap-4 p-4 bg-navy-50/10 rounded-lg">
      <div className="w-20">
        <span className="text-sm font-medium text-cream">{day}</span>
      </div>

      <div className="flex items-center gap-2">
        <Switch
          checked={!isClosed}
          onChange={(open) => {
            setIsClosed(!open)
            if (!open) {
              onChange({ closed: true, timeSlots: [] })
            }
          }}
        />
        <span className="text-sm text-sage/70">
          {isClosed ? 'Closed' : 'Open'}
        </span>
      </div>

      {!isClosed && (
        <div className="flex-1 space-y-2">
          {timeSlots.map((slot, index) => (
            <div key={index} className="flex items-center gap-2">
              <TimeInput
                value={slot.open}
                onChange={(time) => updateTimeSlot(index, 'open', time)}
                placeholder="9:00 AM"
              />
              <span className="text-sage/70">to</span>
              <TimeInput
                value={slot.close}
                onChange={(time) => updateTimeSlot(index, 'close', time)}
                placeholder="5:00 PM"
              />
              
              {allowMultipleSlots && timeSlots.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTimeSlot(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
          
          {allowMultipleSlots && (
            <Button
              variant="outline"
              size="sm"
              onClick={addTimeSlot}
              className="text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add Time Slot
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
```

## Technical Requirements

### Database Schema
```sql
-- Business hours schema
CREATE TABLE business_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Schedule configuration
  schedule_type VARCHAR(20) DEFAULT 'standard' CHECK (schedule_type IN ('standard', 'advanced')),
  timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  
  -- Standard weekly hours (JSONB)
  weekly_schedule JSONB DEFAULT '{}',
  
  -- Display settings
  closing_soon_minutes INTEGER DEFAULT 60,
  closed_message TEXT DEFAULT 'We''re currently closed. See you soon!',
  
  -- Status flags
  is_24_7 BOOLEAN DEFAULT FALSE,
  by_appointment_only BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Special hours and exceptions
CREATE TABLE business_special_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- Exception details
  exception_type VARCHAR(50) NOT NULL, -- 'holiday', 'seasonal', 'event', 'closure'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Date range
  start_date DATE NOT NULL,
  end_date DATE,
  
  -- Time configuration
  is_closed BOOLEAN DEFAULT FALSE,
  custom_hours JSONB, -- Time slots for the exception
  
  -- Recurrence (for seasonal/recurring exceptions)
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern JSONB, -- Yearly, monthly patterns
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Real-Time Status Calculation
```typescript
interface BusinessStatus {
  isOpen: boolean
  status: 'open' | 'closed' | 'closing_soon'
  message: string
  nextChange: {
    action: 'opens' | 'closes'
    time: Date
    timeString: string
  } | null
}

export const calculateBusinessStatus = (
  schedule: WeeklySchedule,
  specialHours: SpecialHour[],
  timezone: string,
  closingSoonMinutes: number = 60
): BusinessStatus => {
  const now = new Date()
  const localTime = convertToTimezone(now, timezone)
  
  // Check for special hours that override regular schedule
  const activeSpecialHour = findActiveSpecialHour(specialHours, localTime)
  if (activeSpecialHour) {
    return calculateSpecialHourStatus(activeSpecialHour, localTime, closingSoonMinutes)
  }
  
  // Calculate based on regular schedule
  const dayOfWeek = format(localTime, 'EEEE').toLowerCase()
  const daySchedule = schedule[dayOfWeek]
  
  if (!daySchedule || daySchedule.closed) {
    return {
      isOpen: false,
      status: 'closed',
      message: 'Currently closed',
      nextChange: findNextOpening(schedule, localTime, timezone)
    }
  }
  
  const currentTime = format(localTime, 'HH:mm')
  const isCurrentlyOpen = daySchedule.timeSlots.some(slot => 
    currentTime >= slot.open && currentTime < slot.close
  )
  
  if (isCurrentlyOpen) {
    const nextClosing = findNextClosing(daySchedule, currentTime)
    const minutesToClose = getMinutesUntil(nextClosing, currentTime)
    
    if (minutesToClose <= closingSoonMinutes) {
      return {
        isOpen: true,
        status: 'closing_soon',
        message: `Closing in ${formatDuration(minutesToClose)}`,
        nextChange: {
          action: 'closes',
          time: parseTime(nextClosing),
          timeString: formatTime(nextClosing)
        }
      }
    }
    
    return {
      isOpen: true,
      status: 'open',
      message: 'Currently open',
      nextChange: {
        action: 'closes',
        time: parseTime(nextClosing),
        timeString: formatTime(nextClosing)
      }
    }
  }
  
  return {
    isOpen: false,
    status: 'closed',
    message: 'Currently closed',
    nextChange: findNextOpening(schedule, localTime, timezone)
  }
}
```

### Performance Requirements
- Schedule calculation: < 50ms
- Real-time status updates: < 100ms
- UI responsiveness: < 200ms for schedule changes
- Database queries: < 100ms for schedule data
- Mobile interface: Smooth scrolling and interactions

## Dependencies

### Must Complete First:
- Story 3.2: Business profile management for hours integration
- Story 3.3: Subscription tiers for advanced features

### External Dependencies:
- Google My Business API for hour synchronization
- Timezone handling library (e.g., date-fns-tz)
- Calendar integration APIs (optional)

## Testing Strategy

### Unit Tests
- Schedule calculation accuracy
- Timezone conversion logic
- Special hours handling
- Status display logic
- Time validation functions

### Integration Tests
- Database schedule storage and retrieval
- Real-time status calculation
- External API synchronization
- Customer-facing status display
- Schedule change notifications

### E2E Tests
- Complete hours management workflow
- Customer schedule viewing experience
- Mobile schedule management
- Multi-timezone business handling
- Schedule exception handling

### Performance Tests
- Schedule calculation under load
- Real-time status update efficiency
- Large number of schedule exceptions
- Mobile interface responsiveness

## Definition of Done

### Functional Requirements ✓
- [ ] Comprehensive business hours management system implemented
- [ ] Real-time status display working correctly
- [ ] Special hours and exception handling functional
- [ ] Advanced availability features for Premium+ tiers
- [ ] Customer communication features operational

### Technical Requirements ✓
- [ ] Integration with external platforms working
- [ ] Mobile-responsive hours management interface
- [ ] Timezone handling properly implemented
- [ ] Performance optimization for status calculations
- [ ] Database schema optimized for queries

### User Experience ✓
- [ ] Intuitive hours management workflow
- [ ] Clear customer-facing status display
- [ ] Mobile schedule management optimized
- [ ] Help system and guidance complete
- [ ] Error handling and validation

### Business Value ✓
- [ ] Customer satisfaction with accurate hours
- [ ] Reduced customer service inquiries about hours
- [ ] Improved business visibility through accurate status
- [ ] Premium feature adoption for advanced scheduling
- [ ] Integration benefits validated

## Success Metrics

### Customer Experience
- Reduced hours-related customer inquiries: -40%
- Customer satisfaction with hour accuracy: > 95%
- Mobile hours viewing usage: > 60%
- "Open Now" accuracy rate: > 99%

### Business Owner Adoption
- Hours completion rate: > 95%
- Special hours usage: > 40% of businesses
- Advanced scheduling adoption (Premium): > 30%
- Schedule update frequency: > 2 times per month

### Technical Performance
- Status calculation accuracy: > 99.9%
- Real-time update latency: < 1 minute
- Mobile interface usability: > 90% satisfaction
- Integration sync success: > 98%

### Business Impact
- Visibility improvement with accurate hours: +15%
- Customer visit conversion with status display: +10%
- Premium upgrade driven by scheduling: > 12%
- Reduced operational confusion: -50%

## Risk Assessment

### Technical Risks
- **Low Risk:** Standard hours management implementation
- **Medium Risk:** Complex timezone handling across multiple locations
  - *Mitigation:* Comprehensive testing with various timezone scenarios
- **Medium Risk:** Real-time status calculation performance
  - *Mitigation:* Efficient algorithms and caching strategies

### Business Risks
- **Low Risk:** User confusion with complex scheduling options
  - *Mitigation:* Progressive disclosure and clear UI design
- **Low Risk:** Integration reliability with external platforms
  - *Mitigation:* Fallback mechanisms and error handling

## Notes

### Design Considerations
- Progressive disclosure from simple to advanced features
- Clear visual feedback for schedule changes
- Mobile-first design for on-the-go management
- Timezone awareness throughout the interface

### Future Enhancements (Post-MVP)
- Integration with appointment booking systems
- Advanced recurring pattern support
- Staff schedule coordination
- Automated holiday detection
- Weather-based schedule adjustments
- Customer preference learning

### API Endpoints Required
- `GET /api/business/:id/hours` - Retrieve business hours
- `PUT /api/business/:id/hours` - Update business hours
- `POST /api/business/:id/special-hours` - Add special hours
- `GET /api/business/:id/status` - Current business status
- `PUT /api/business/:id/hours/sync` - Sync with external platforms