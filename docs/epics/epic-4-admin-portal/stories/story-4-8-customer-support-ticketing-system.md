# Story 4.8: Customer Support & Ticketing System

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a support administrator, I want a comprehensive customer support and ticketing system integrated with the admin portal so that I can efficiently manage customer inquiries and provide excellent support experiences.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 25  
**Sprint:** 3

## Detailed Acceptance Criteria

### Ticket Management System

**Given** customer support inquiries requiring systematic management  
**When** managing support tickets  
**Then** provide comprehensive ticket management:

**Ticket Creation & Categorization:**
- Multi-channel ticket creation (email, web form, in-app)
- Automatic ticket categorization using AI classification
- Priority assignment based on issue type and customer tier
- User information pre-population from platform data
- Business owner ticket identification and prioritization
- Escalation rules for urgent or complex issues
- Duplicate ticket detection and merging capabilities

**Ticket Queue Management:**
- Agent assignment based on expertise and workload
- SLA tracking with countdown timers and alerts
- Ticket status workflow (new, assigned, in progress, resolved, closed)
- Priority queues with visual indicators
- Bulk ticket operations for efficient management
- Ticket transfer between agents and departments
- Workload balancing and capacity management

### Customer Communication Interface

**Given** the need for effective customer communication  
**When** communicating with customers  
**Then** provide comprehensive communication tools:

**Multi-Channel Communication:**
- Email integration with ticket thread preservation
- In-app messaging with real-time notifications
- Phone call logging and notes integration
- Video call scheduling and recording capabilities
- SMS communication for urgent notifications
- Social media integration for public support
- Screen sharing and remote assistance tools

**Communication Templates & Automation:**
- Response templates for common issues
- Automated acknowledgment and status update emails
- Escalation notification templates
- Customer satisfaction survey automation
- Follow-up email scheduling and automation
- Multi-language support for international customers
- Personalization tokens for customized communication

### Knowledge Base Integration

**Given** the need for consistent support information  
**When** providing support resources  
**Then** integrate comprehensive knowledge management:

**Internal Knowledge Base:**
- Searchable knowledge base for support agents
- Step-by-step troubleshooting guides
- Common issue resolution workflows
- Platform feature documentation for support staff
- Business process documentation and procedures
- Escalation procedures and contact information
- Training materials and onboarding resources

**Customer Self-Service Portal:**
- Public knowledge base with search functionality
- FAQ sections organized by topic and user type
- Video tutorials and step-by-step guides
- Community forums for user-to-user support
- Ticket status checking for customers
- Support request submission forms
- Feedback and rating system for knowledge base articles

### Support Analytics & Performance

**Given** support quality and efficiency requirements  
**When** measuring support performance  
**Then** provide support analytics:

**Performance Metrics:**
- First response time and resolution time tracking
- Customer satisfaction scores and feedback analysis
- Agent performance metrics and efficiency tracking
- Ticket volume trends and seasonal patterns
- Resolution rate and escalation frequency analysis
- Knowledge base usage and article effectiveness
- Cost per ticket and support ROI analysis

## Frontend Implementation

### Support Dashboard Interface

```typescript
// components/admin/support/SupportDashboard.tsx
export const SupportDashboard: React.FC = () => {
  const [activeView, setActiveView] = useState<'tickets' | 'chat' | 'knowledge' | 'analytics'>('tickets')
  const [filters, setFilters] = useState<SupportFilters>({
    status: 'open',
    priority: 'all',
    assignee: 'all'
  })
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])
  
  const { user: currentAgent } = useAdminAuth()
  const {
    data: supportData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['support-dashboard', filters],
    queryFn: () => adminApi.getSupportData(filters),
    keepPreviousData: true,
    refetchInterval: 30000 // 30 seconds
  })

  const ticketMutation = useMutation({
    mutationFn: adminApi.updateTicket,
    onSuccess: () => {
      refetch()
      toast.success('Ticket updated successfully')
    }
  })

  return (
    <div className="space-y-6 p-6">
      {/* Support Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Customer Support
          </h1>
          <p className="text-sage/70 mt-1">
            Manage customer inquiries and provide excellent support experiences
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <SupportAnalyticsButton />
          <CreateTicketButton />
          <AgentStatusToggle agent={currentAgent} />
        </div>
      </div>

      {/* Support Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Open Tickets"
          value={supportData?.stats.openTickets}
          urgent={supportData?.stats.urgentTickets > 0}
          icon={Ticket}
          color="red"
        />
        <StatCard
          title="Avg Response Time"
          value={`${supportData?.stats.avgResponseTime}m`}
          change={supportData?.stats.responseTimeChange}
          icon={Clock}
          color="blue"
        />
        <StatCard
          title="Resolution Rate"
          value={`${supportData?.stats.resolutionRate}%`}
          change={supportData?.stats.resolutionRateChange}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Customer Satisfaction"
          value={`${supportData?.stats.satisfactionScore}/5`}
          icon={Star}
          color="gold"
        />
      </div>

      {/* Support Navigation */}
      <GlassMorphism variant="subtle" className="p-2">
        <nav className="flex space-x-1">
          {[
            { id: 'tickets', label: 'Tickets', icon: Ticket, count: supportData?.stats.openTickets },
            { id: 'chat', label: 'Live Chat', icon: MessageSquare, count: supportData?.stats.activeChatSessions },
            { id: 'knowledge', label: 'Knowledge Base', icon: Book },
            { id: 'analytics', label: 'Analytics', icon: BarChart3 }
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

      {/* Support Content */}
      <div className="space-y-6">
        {activeView === 'tickets' && (
          <TicketManagement
            tickets={supportData?.tickets || []}
            filters={filters}
            onFiltersChange={setFilters}
            selectedTickets={selectedTickets}
            onSelectionChange={setSelectedTickets}
            onTicketUpdate={(id, update) => ticketMutation.mutate({ id, update })}
          />
        )}
        
        {activeView === 'chat' && (
          <LiveChatInterface
            sessions={supportData?.chatSessions || []}
            agent={currentAgent}
          />
        )}
        
        {activeView === 'knowledge' && (
          <KnowledgeBaseManagement
            articles={supportData?.knowledgeBase || []}
          />
        )}
        
        {activeView === 'analytics' && (
          <SupportAnalytics
            data={supportData?.analytics}
            timeRange="30d"
          />
        )}
      </div>
    </div>
  )
}
```

### Advanced Ticket Management

```typescript
// components/admin/support/TicketManagement.tsx
interface TicketManagementProps {
  tickets: SupportTicket[]
  filters: SupportFilters
  onFiltersChange: (filters: SupportFilters) => void
  selectedTickets: string[]
  onSelectionChange: (tickets: string[]) => void
  onTicketUpdate: (id: string, update: TicketUpdate) => void
}

export const TicketManagement: React.FC<TicketManagementProps> = ({
  tickets,
  filters,
  onFiltersChange,
  selectedTickets,
  onSelectionChange,
  onTicketUpdate
}) => {
  const [viewMode, setViewMode] = useState<'list' | 'board'>('list')
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  
  const priorityColors = {
    low: 'text-green-400 bg-green-400/20',
    medium: 'text-yellow-400 bg-yellow-400/20',
    high: 'text-orange-400 bg-orange-400/20',
    urgent: 'text-red-error bg-red-error/20'
  }

  const statusColors = {
    new: 'text-blue-400 bg-blue-400/20',
    assigned: 'text-yellow-400 bg-yellow-400/20',
    in_progress: 'text-orange-400 bg-orange-400/20',
    resolved: 'text-green-400 bg-green-400/20',
    closed: 'text-sage/60 bg-sage/20'
  }

  return (
    <div className="space-y-6">
      {/* Ticket Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex-1">
          <SearchInput
            value={filters.search || ''}
            onChange={(search) => onFiltersChange({ ...filters, search })}
            placeholder="Search tickets by ID, customer, or subject..."
          />
        </div>
        
        <div className="flex items-center gap-4">
          <select
            value={filters.status}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value })}
            className="px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="new">New</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          
          <select
            value={filters.priority}
            onChange={(e) => onFiltersChange({ ...filters, priority: e.target.value })}
            className="px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          
          <ViewToggle
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'list', icon: List },
              { value: 'board', icon: LayoutGrid }
            ]}
          />
        </div>
      </div>

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectedTickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <GlassMorphism variant="medium" className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-cream font-medium">
                  {selectedTickets.length} ticket(s) selected
                </span>
                
                <div className="flex items-center gap-2">
                  <BulkActionButton
                    action="assign"
                    onClick={() => {/* Bulk assign */}}
                  >
                    Assign
                  </BulkActionButton>
                  
                  <BulkActionButton
                    action="close"
                    onClick={() => {/* Bulk close */}}
                    variant="warning"
                  >
                    Close
                  </BulkActionButton>
                  
                  <button
                    onClick={() => onSelectionChange([])}
                    className="px-3 py-1.5 text-sage/70 hover:text-sage transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </GlassMorphism>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tickets Display */}
      {viewMode === 'list' ? (
        <GlassMorphism variant="subtle" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-navy-50/10 border-b border-sage/20">
                <tr>
                  <th className="w-12 p-4">
                    <Checkbox
                      checked={selectedTickets.length === tickets.length}
                      indeterminate={selectedTickets.length > 0 && selectedTickets.length < tickets.length}
                      onChange={(checked) => 
                        onSelectionChange(checked ? tickets.map(t => t.id) : [])
                      }
                    />
                  </th>
                  <th className="text-left p-4">Ticket</th>
                  <th className="text-left p-4">Customer</th>
                  <th className="text-left p-4">Subject</th>
                  <th className="text-left p-4">Priority</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-left p-4">Assignee</th>
                  <th className="text-left p-4">Created</th>
                  <th className="w-32 p-4">Actions</th>
                </tr>
              </thead>
              
              <tbody>
                {tickets.map((ticket) => (
                  <motion.tr
                    key={ticket.id}
                    className={cn(
                      'border-b border-sage/10 hover:bg-navy-50/5 transition-colors cursor-pointer',
                      selectedTickets.includes(ticket.id) && 'bg-teal-primary/10'
                    )}
                    onClick={() => setSelectedTicket(ticket)}
                    whileHover={{ backgroundColor: 'rgba(148, 210, 189, 0.05)' }}
                  >
                    <td className="p-4">
                      <Checkbox
                        checked={selectedTickets.includes(ticket.id)}
                        onChange={(checked) => {
                          onSelectionChange(
                            checked 
                              ? [...selectedTickets, ticket.id]
                              : selectedTickets.filter(id => id !== ticket.id)
                          )
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    
                    <td className="p-4">
                      <div className="font-mono text-sm text-teal-primary">
                        #{ticket.id.slice(-8)}
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={ticket.customer.avatar}
                          alt={ticket.customer.name}
                          size="sm"
                          fallback={ticket.customer.name.charAt(0)}
                        />
                        <div>
                          <p className="font-medium text-cream">{ticket.customer.name}</p>
                          <p className="text-sm text-sage/70">{ticket.customer.email}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <p className="text-cream font-medium truncate max-w-xs">
                        {ticket.subject}
                      </p>
                      <p className="text-sm text-sage/70">
                        {ticket.category}
                      </p>
                    </td>
                    
                    <td className="p-4">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        priorityColors[ticket.priority]
                      )}>
                        {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                      </span>
                    </td>
                    
                    <td className="p-4">
                      <span className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        statusColors[ticket.status]
                      )}>
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    
                    <td className="p-4">
                      {ticket.assignee ? (
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={ticket.assignee.avatar}
                            alt={ticket.assignee.name}
                            size="xs"
                            fallback={ticket.assignee.name.charAt(0)}
                          />
                          <span className="text-sm text-cream">{ticket.assignee.name}</span>
                        </div>
                      ) : (
                        <span className="text-sage/70 text-sm">Unassigned</span>
                      )}
                    </td>
                    
                    <td className="p-4 text-sage/70 text-sm">
                      <RelativeTime date={ticket.createdAt} />
                    </td>
                    
                    <td className="p-4">
                      <TicketActionsDropdown
                        ticket={ticket}
                        onUpdate={(update) => onTicketUpdate(ticket.id, update)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassMorphism>
      ) : (
        <TicketBoard
          tickets={tickets}
          onTicketUpdate={onTicketUpdate}
          onTicketSelect={setSelectedTicket}
        />
      )}

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={(update) => {
          if (selectedTicket) {
            onTicketUpdate(selectedTicket.id, update)
          }
        }}
      />
    </div>
  )
}
```

### Live Chat Interface

```typescript
// components/admin/support/LiveChatInterface.tsx
export const LiveChatInterface: React.FC<{ sessions: ChatSession[], agent: AdminUser }> = ({
  sessions,
  agent
}) => {
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null)
  const [message, setMessage] = useState('')
  const [agentStatus, setAgentStatus] = useState<'available' | 'busy' | 'offline'>('available')
  
  const sendMessage = async () => {
    if (!message.trim() || !activeSession) return
    
    try {
      await adminApi.sendChatMessage({
        sessionId: activeSession.id,
        message: message.trim(),
        agentId: agent.id
      })
      
      setMessage('')
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Chat Sessions List */}
      <div className="lg:col-span-1">
        <GlassMorphism variant="subtle" className="h-full flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-sage/20">
            <h3 className="font-medium text-cream">Active Sessions</h3>
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                agentStatus === 'available' && 'bg-green-400',
                agentStatus === 'busy' && 'bg-yellow-400',
                agentStatus === 'offline' && 'bg-red-400'
              )} />
              <select
                value={agentStatus}
                onChange={(e) => setAgentStatus(e.target.value as any)}
                className="text-sm bg-transparent border-none text-cream"
              >
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'p-4 border-b border-sage/10 cursor-pointer hover:bg-sage/5 transition-colors',
                  activeSession?.id === session.id && 'bg-teal-primary/20'
                )}
                onClick={() => setActiveSession(session)}
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    src={session.customer.avatar}
                    alt={session.customer.name}
                    size="sm"
                    fallback={session.customer.name.charAt(0)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-cream truncate">
                      {session.customer.name}
                    </p>
                    <p className="text-sm text-sage/70 truncate">
                      {session.lastMessage.content}
                    </p>
                  </div>
                  <div className="text-xs text-sage/60">
                    {formatDistanceToNow(session.lastMessage.timestamp)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassMorphism>
      </div>

      {/* Chat Interface */}
      <div className="lg:col-span-2">
        {activeSession ? (
          <GlassMorphism variant="subtle" className="h-full flex flex-col">
            {/* Chat Header */}
            <div className="flex items-center justify-between p-4 border-b border-sage/20">
              <div className="flex items-center gap-3">
                <Avatar
                  src={activeSession.customer.avatar}
                  alt={activeSession.customer.name}
                  size="md"
                  fallback={activeSession.customer.name.charAt(0)}
                />
                <div>
                  <h3 className="font-medium text-cream">
                    {activeSession.customer.name}
                  </h3>
                  <p className="text-sm text-sage/70">
                    {activeSession.customer.email}
                  </p>
                </div>
              </div>
              
              <ChatSessionActions
                session={activeSession}
                onTransfer={() => {/* Transfer chat */}}
                onEscalate={() => {/* Escalate to ticket */}}
                onEnd={() => {/* End session */}}
              />
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeSession.messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isAgent={msg.senderId === agent.id}
                />
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-sage/20">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type your message..."
                    className="w-full px-3 py-2 bg-navy-dark border border-sage/30 rounded-lg text-cream resize-none"
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        sendMessage()
                      }
                    }}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim()}
                    className="px-4 py-2 bg-teal-primary text-navy-dark rounded-lg hover:bg-teal-accent transition-colors disabled:opacity-50"
                  >
                    Send
                  </button>
                  
                  <ChatTemplatesDropdown
                    onSelectTemplate={(template) => setMessage(template.content)}
                  />
                </div>
              </div>
            </div>
          </GlassMorphism>
        ) : (
          <GlassMorphism variant="subtle" className="h-full flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-sage/40 mx-auto mb-4" />
              <p className="text-sage/70">Select a chat session to start messaging</p>
            </div>
          </GlassMorphism>
        )}
      </div>
    </div>
  )
}
```

## Technical Implementation Notes

**Ticket System Architecture:**
- Database design for ticket management and history
- Integration with email systems for seamless communication
- Real-time updates using WebSocket connections
- API integrations for third-party support tools

**Communication Integration:**
- Email parsing and thread reconstruction
- Multi-channel message synchronization
- Notification system for agents and customers
- Integration with communication service providers

**Knowledge Base System:**
- Search indexing and relevancy scoring
- Content versioning and approval workflows
- Analytics for knowledge base usage and effectiveness
- Integration with ticket system for suggested articles

## Dependencies

- Story 4.3 (User management for customer profile access)
- Story 4.1 (Admin portal foundation for support interface)

## Testing Requirements

**Support System Tests:**
- Ticket creation and management workflow tests
- Multi-channel communication integration tests
- SLA tracking and alert system functionality tests
- Knowledge base search and content delivery tests

**Performance Tests:**
- High-volume ticket handling performance tests
- Real-time communication performance validation
- Search performance for knowledge base queries
- Concurrent agent usage performance tests

**User Experience Tests:**
- Support workflow efficiency and usability testing
- Customer communication experience validation
- Knowledge base usability and effectiveness testing
- Mobile support interface functionality tests

## Definition of Done

- [ ] Comprehensive ticket management system operational
- [ ] Multi-channel customer communication interface
- [ ] Knowledge base integration for agents and customers
- [ ] Support analytics and performance tracking
- [ ] SLA monitoring and alerting system
- [ ] Mobile-responsive support interface
- [ ] Integration with email and communication platforms
- [ ] Self-service portal for customer support
- [ ] All support system functionality tests passing
- [ ] Documentation complete for support procedures and workflows

## Risk Assessment

- **Medium Risk:** Complex multi-channel integration may have reliability issues
- **Low Risk:** Ticket management system implementation
- **Mitigation:** Robust integration testing and fallback communication methods