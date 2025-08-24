# Frontend Epic 6: Developer Portal & API Documentation Interface - Comprehensive Implementation Stories

**Date:** 2024-08-23  
**Epic Lead:** Frontend Developer Agent  
**Priority:** P1 (Platform Expansion & Developer Experience)  
**Duration:** 4 Sprints (12 weeks)  
**Story Points Total:** 151 points

## Epic Mission Statement

Create a world-class developer portal and API documentation interface that enables third-party developers to integrate with The Lawless Directory platform effectively. The portal should provide comprehensive documentation, interactive API exploration, SDK resources, and developer tools while maintaining the premium aesthetic and user experience standards of the main platform.

## Developer Portal Architecture Context

**Developer Experience Requirements:**
- Comprehensive API documentation with interactive examples
- Multiple authentication methods (API keys, OAuth 2.0, JWT)
- SDK generation and distribution for multiple languages
- API playground with real-time testing capabilities
- Usage analytics and monitoring for developers
- Developer onboarding and certification programs
- Community features for developer support and collaboration

**Technical Documentation Needs:**
- RESTful API endpoint documentation with OpenAPI/Swagger
- GraphQL schema explorer with query builder
- WebSocket event documentation and testing
- Webhook configuration and testing tools
- Rate limiting and quota management interfaces
- Error code reference and troubleshooting guides
- Integration examples and use case tutorials

**Developer Tools Integration:**
- Code generation for multiple programming languages
- Postman collection export and synchronization
- CLI tools for API management and testing
- Integration with popular development environments
- Version management and change log tracking
- Performance monitoring and debugging tools

**Community & Support Features:**
- Developer forums and discussion boards
- Support ticket system integration
- Community-contributed examples and plugins
- Developer showcase and success stories
- Regular developer webinars and tutorials
- Certification programs and badging system

**Performance & Accessibility:**
- Fast loading documentation with search capabilities
- Mobile-optimized developer experience
- Offline documentation access capabilities
- Multi-language documentation support
- Accessibility compliance for all developer tools

---

## Story F6.1: Developer Portal Foundation & Navigation Architecture

**User Story:** As a frontend developer, I want to create a comprehensive developer portal foundation with intuitive navigation, search capabilities, and responsive design that provides developers with easy access to all API resources and documentation.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 22  
**Sprint:** 1

### Detailed Acceptance Criteria

**Developer Portal Layout:**
- **Given** developer portal requirements
- **When** implementing portal foundation
- **Then** create:

```typescript
// components/developer/DeveloperPortalLayout.tsx
interface DeveloperPortalLayoutProps {
  children: React.ReactNode
  user?: DeveloperUser
}

export const DeveloperPortalLayout: React.FC<DeveloperPortalLayoutProps> = ({ 
  children, 
  user 
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const isMobile = useMediaQuery('(max-width: 768px)')
  
  const {
    data: navigationData,
    isLoading: navLoading
  } = useQuery({
    queryKey: ['developer-navigation'],
    queryFn: developerApi.getNavigationStructure
  })

  // Global search functionality
  const debouncedSearch = useDebounce(searchQuery, 300)
  
  const { data: searchData } = useQuery({
    queryKey: ['developer-search', debouncedSearch],
    queryFn: () => developerApi.searchDocumentation(debouncedSearch),
    enabled: debouncedSearch.length >= 2
  })

  useEffect(() => {
    if (searchData) {
      setSearchResults(searchData.results)
    }
  }, [searchData])

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-dark via-teal-primary/5 to-navy-dark">
      {/* Developer Portal Header */}
      <header className="sticky top-0 z-40 bg-navy-90/80 backdrop-blur-xl border-b border-sage/20">
        <div className="max-w-screen-2xl mx-auto">
          <div className="flex items-center justify-between px-4 lg:px-8 py-4">
            {/* Logo & Title */}
            <div className="flex items-center gap-4">
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-navy-50/20 rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5 text-sage" />
                </button>
              )}
              
              <Link href="/developers" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-teal-primary to-sage rounded-lg flex items-center justify-center">
                  <Code2 className="w-6 h-6 text-cream" />
                </div>
                <div>
                  <h1 className="text-xl font-heading font-bold text-cream">
                    Developer Portal
                  </h1>
                  <p className="text-xs text-sage/70 hidden sm:block">
                    Build with The Lawless Directory API
                  </p>
                </div>
              </Link>
            </div>

            {/* Global Search */}
            <div className="flex-1 max-w-2xl mx-8 relative hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search documentation, endpoints, examples..."
                  className="w-full pl-10 pr-4 py-2 bg-navy-50/20 border border-sage/20 rounded-lg text-cream placeholder-sage/50 focus:outline-none focus:ring-2 focus:ring-teal-primary/50 transition-colors"
                />
              </div>
              
              {/* Search Results Dropdown */}
              {searchQuery.length >= 2 && searchResults.length > 0 && (
                <GlobalSearchResults 
                  results={searchResults}
                  onClose={() => setSearchQuery('')}
                />
              )}
            </div>

            {/* User Actions */}
            <div className="flex items-center gap-4">
              {/* API Status */}
              <APIStatusIndicator />
              
              {/* User Menu */}
              {user ? (
                <DeveloperUserMenu user={user} />
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/developers/login"
                    className="px-4 py-2 text-sage hover:text-cream transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/developers/register"
                    className="px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors"
                  >
                    Get API Key
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Navigation */}
        <AnimatePresence>
          {(!isMobile || sidebarOpen) && (
            <motion.aside
              initial={isMobile ? { x: '-100%' } : { x: 0 }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                'bg-navy-90/60 backdrop-blur-xl border-r border-sage/20',
                isMobile 
                  ? 'fixed inset-y-0 left-0 z-30 w-80 top-[73px]' 
                  : 'sticky top-[73px] w-80 h-[calc(100vh-73px)] overflow-y-auto'
              )}
            >
              <DeveloperSidebar
                navigation={navigationData}
                loading={navLoading}
                onClose={() => setSidebarOpen(false)}
                showCloseButton={isMobile}
              />
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Mobile Overlay */}
        {isMobile && sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-navy-dark/80 backdrop-blur-sm z-20 top-[73px]"
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <ErrorBoundary>
            <Suspense fallback={<DeveloperPageSkeleton />}>
              {children}
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Mobile Search Modal */}
      <MobileSearchModal
        open={isMobile && searchQuery.length >= 2}
        query={searchQuery}
        results={searchResults}
        onQueryChange={setSearchQuery}
        onClose={() => setSearchQuery('')}
      />
    </div>
  )
}

// Developer Sidebar Navigation
const DeveloperSidebar: React.FC<DeveloperSidebarProps> = ({
  navigation,
  loading,
  onClose,
  showCloseButton
}) => {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<string[]>(['getting-started'])

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(sectionId)
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId]
    )
  }

  if (loading) {
    return <NavigationSkeleton />
  }

  const renderNavigationItem = (item: NavigationItem, level = 0) => {
    const isActive = pathname === item.href
    const isExpanded = expandedSections.includes(item.id)
    const hasChildren = item.children && item.children.length > 0
    const Icon = item.icon

    return (
      <div key={item.id}>
        <div
          className={cn(
            'group flex items-center gap-3 px-4 py-2.5 transition-colors cursor-pointer',
            level === 0 ? 'text-base' : 'text-sm ml-4',
            isActive && 'bg-teal-primary/20 text-teal-primary border-r-2 border-teal-primary',
            !isActive && 'text-sage/80 hover:text-cream hover:bg-navy-50/20'
          )}
          onClick={() => {
            if (hasChildren) {
              toggleSection(item.id)
            } else if (item.href) {
              onClose?.()
            }
          }}
        >
          {item.href && !hasChildren ? (
            <Link href={item.href} className="flex items-center gap-3 flex-1">
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span className="font-medium">{item.label}</span>
            </Link>
          ) : (
            <>
              {Icon && <Icon className="w-4 h-4 flex-shrink-0" />}
              <span className="font-medium flex-1">{item.label}</span>
              {hasChildren && (
                <ChevronRight className={cn(
                  'w-4 h-4 transition-transform',
                  isExpanded && 'rotate-90'
                )} />
              )}
            </>
          )}
          
          {item.badge && (
            <span className="px-2 py-1 text-xs bg-gold-primary text-navy-dark rounded-full font-medium">
              {item.badge}
            </span>
          )}
        </div>

        {/* Children */}
        {hasChildren && (
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
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
    <div className="h-full flex flex-col">
      {/* Close Button (Mobile) */}
      {showCloseButton && (
        <div className="flex items-center justify-between p-4 border-b border-sage/20">
          <span className="font-medium text-cream">Documentation</span>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-navy-50/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-sage" />
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {navigation?.sections.map(section => (
          <div key={section.id} className="mb-6">
            <div className="px-4 mb-2">
              <h3 className="text-xs font-semibold text-sage/50 uppercase tracking-wider">
                {section.title}
              </h3>
            </div>
            <div className="space-y-1">
              {section.items.map(item => renderNavigationItem(item))}
            </div>
          </div>
        ))}
      </nav>

      {/* API Version Selector */}
      <div className="p-4 border-t border-sage/20">
        <APIVersionSelector />
      </div>
    </div>
  )
}

// API Status Indicator
const APIStatusIndicator: React.FC = () => {
  const { data: apiStatus } = useQuery({
    queryKey: ['api-status'],
    queryFn: developerApi.getAPIStatus,
    refetchInterval: 60000 // 1 minute
  })

  const statusConfig = {
    operational: { color: 'text-sage', bg: 'bg-sage/20', label: 'Operational' },
    degraded: { color: 'text-gold-primary', bg: 'bg-gold-primary/20', label: 'Degraded' },
    down: { color: 'text-red-error', bg: 'bg-red-error/20', label: 'Down' }
  }

  const status = apiStatus?.status || 'operational'
  const config = statusConfig[status as keyof typeof statusConfig]

  return (
    <div className="flex items-center gap-2">
      <div className={cn('w-2 h-2 rounded-full', config.bg)}>
        <div className={cn('w-full h-full rounded-full animate-pulse', config.color.replace('text-', 'bg-'))} />
      </div>
      <span className={cn('text-sm font-medium hidden sm:block', config.color)}>
        {config.label}
      </span>
    </div>
  )
}

// Global Search Results
const GlobalSearchResults: React.FC<{
  results: SearchResult[]
  onClose: () => void
}> = ({ results, onClose }) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev => (prev + 1) % results.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev => prev === 0 ? results.length - 1 : prev - 1)
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            window.location.href = results[selectedIndex].href
          }
          break
        case 'Escape':
          onClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [results, selectedIndex, onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="absolute top-full left-0 right-0 mt-2 bg-navy-90/95 backdrop-blur-xl border border-sage/20 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
    >
      <div className="p-2">
        {results.map((result, index) => (
          <Link
            key={result.id}
            href={result.href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 p-3 rounded-lg transition-colors',
              index === selectedIndex ? 'bg-teal-primary/20' : 'hover:bg-navy-50/20'
            )}
          >
            <div className={cn(
              'w-8 h-8 rounded-lg flex items-center justify-center',
              result.type === 'endpoint' && 'bg-teal-primary/20 text-teal-primary',
              result.type === 'guide' && 'bg-sage/20 text-sage',
              result.type === 'example' && 'bg-gold-primary/20 text-gold-primary'
            )}>
              {result.type === 'endpoint' && <Zap className="w-4 h-4" />}
              {result.type === 'guide' && <Book className="w-4 h-4" />}
              {result.type === 'example' && <Code className="w-4 h-4" />}
            </div>
            
            <div className="flex-1">
              <p className="font-medium text-cream">{result.title}</p>
              <p className="text-sm text-sage/70 truncate">{result.description}</p>
            </div>
            
            <span className="text-xs text-sage/50 px-2 py-1 bg-navy-50/20 rounded">
              {result.category}
            </span>
          </Link>
        ))}
      </div>
      
      <div className="px-4 py-2 border-t border-sage/20 text-xs text-sage/60">
        Use ↑↓ to navigate, Enter to select, Esc to close
      </div>
    </motion.div>
  )
}
```

**Developer Portal Navigation Structure:**
- **Given** comprehensive documentation navigation needs
- **When** implementing navigation architecture
- **Then** create hierarchical navigation with:
  - Getting Started section with quick setup guides
  - API Reference with all endpoints organized by resource
  - Authentication documentation with multiple auth methods
  - SDK documentation and download links
  - Integration examples and tutorials
  - Webhook documentation and testing tools
  - Rate limiting and quota information
  - Status page and system health metrics

### Technical Implementation Requirements

**Search and Discovery:**
- Full-text search across all documentation
- Auto-complete suggestions for API endpoints
- Contextual search results with relevance scoring
- Search analytics to improve content discoverability

**Mobile-First Design:**
- Responsive navigation with collapsible sidebar
- Touch-optimized interface elements
- Offline documentation caching capabilities
- Progressive web app features for mobile developers

### Testing Requirements

**Developer Portal Foundation Testing:**
- Navigation structure and hierarchy validation
- Search functionality accuracy and performance
- Mobile responsiveness across all devices
- Accessibility compliance for developer tools

---

## Story F6.2: Interactive API Documentation & OpenAPI Integration

**User Story:** As a frontend developer, I want to create interactive API documentation with live examples, request/response visualization, and comprehensive endpoint coverage that enables developers to understand and test the API effectively.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 25  
**Sprint:** 1

### Detailed Acceptance Criteria

**Interactive API Documentation:**
- **Given** comprehensive API documentation requirements
- **When** implementing interactive documentation
- **Then** create:

```typescript
// components/developer/documentation/APIDocumentation.tsx
interface APIEndpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  summary: string
  description: string
  tags: string[]
  parameters: APIParameter[]
  requestBody?: RequestBodySchema
  responses: APIResponse[]
  examples: APIExample[]
  deprecated?: boolean
  rateLimit: {
    requests: number
    window: string
  }
}

export const APIDocumentation: React.FC<{ endpoint: APIEndpoint }> = ({ endpoint }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'parameters' | 'examples' | 'responses'>('overview')
  const [selectedExample, setSelectedExample] = useState(0)
  const [testRequest, setTestRequest] = useState<any>({})
  const [testResponse, setTestResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleTestRequest = async () => {
    setIsLoading(true)
    try {
      const response = await apiTester.sendRequest({
        method: endpoint.method,
        path: endpoint.path,
        parameters: testRequest.parameters,
        body: testRequest.body,
        headers: testRequest.headers
      })
      setTestResponse(response)
    } catch (error) {
      setTestResponse({
        error: true,
        message: error.message,
        status: error.status
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Endpoint Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <HTTPMethodBadge method={endpoint.method} />
          <code className="text-lg font-mono text-cream bg-navy-50/20 px-3 py-1 rounded">
            {endpoint.path}
          </code>
          {endpoint.deprecated && (
            <span className="px-2 py-1 text-xs bg-red-error/20 text-red-error rounded font-medium">
              DEPRECATED
            </span>
          )}
        </div>
        
        <div>
          <h1 className="text-2xl font-heading font-bold text-cream mb-2">
            {endpoint.summary}
          </h1>
          <p className="text-sage/80 leading-relaxed">
            {endpoint.description}
          </p>
        </div>

        {/* Tags and Rate Limit */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {endpoint.tags.map(tag => (
              <span key={tag} className="px-2 py-1 text-xs bg-teal-primary/20 text-teal-primary rounded">
                {tag}
              </span>
            ))}
          </div>
          
          <div className="flex items-center gap-2 text-sm text-sage/70">
            <Clock className="w-4 h-4" />
            <span>
              Rate limit: {endpoint.rateLimit.requests} requests per {endpoint.rateLimit.window}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-sage/20">
        <nav className="flex space-x-8">
          {(['overview', 'parameters', 'examples', 'responses'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'py-2 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab
                  ? 'border-teal-primary text-teal-primary'
                  : 'border-transparent text-sage/70 hover:text-sage hover:border-sage/30'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'overview' && (
          <EndpointOverview endpoint={endpoint} />
        )}

        {activeTab === 'parameters' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-heading font-semibold text-cream mb-4">
                Parameters
              </h3>
              <ParametersTable 
                parameters={endpoint.parameters}
                onParameterChange={(param, value) => {
                  setTestRequest(prev => ({
                    ...prev,
                    parameters: {
                      ...prev.parameters,
                      [param.name]: value
                    }
                  }))
                }}
              />
              
              {endpoint.requestBody && (
                <div className="mt-6">
                  <h3 className="text-lg font-heading font-semibold text-cream mb-4">
                    Request Body
                  </h3>
                  <RequestBodyEditor
                    schema={endpoint.requestBody}
                    value={testRequest.body}
                    onChange={(body) => {
                      setTestRequest(prev => ({ ...prev, body }))
                    }}
                  />
                </div>
              )}
            </div>

            {/* Live API Tester */}
            <div className="xl:sticky xl:top-4">
              <GlassMorphism variant="medium" className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading font-semibold text-cream">
                    Test API
                  </h3>
                  <APIKeyIndicator />
                </div>
                
                <div className="space-y-4">
                  {/* Request Preview */}
                  <div>
                    <h4 className="font-medium text-cream mb-2">Request</h4>
                    <CodeBlock
                      code={generateRequestCode(endpoint, testRequest)}
                      language="http"
                      compact
                    />
                  </div>

                  {/* Test Button */}
                  <button
                    onClick={handleTestRequest}
                    disabled={isLoading}
                    className={cn(
                      'w-full px-4 py-2 bg-teal-primary hover:bg-teal-secondary text-cream rounded-lg transition-colors',
                      'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
                      isLoading && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <LoadingSpinner size="sm" />
                        <span>Sending...</span>
                      </div>
                    ) : (
                      'Send Request'
                    )}
                  </button>

                  {/* Response */}
                  {testResponse && (
                    <div>
                      <h4 className="font-medium text-cream mb-2">Response</h4>
                      <ResponseViewer response={testResponse} />
                    </div>
                  )}
                </div>
              </GlassMorphism>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-heading font-semibold text-cream">
                Examples
              </h3>
              <select
                value={selectedExample}
                onChange={(e) => setSelectedExample(Number(e.target.value))}
                className="px-3 py-1.5 bg-navy-50/20 border border-sage/20 rounded text-cream text-sm focus:outline-none focus:ring-2 focus:ring-teal-primary/50"
              >
                {endpoint.examples.map((example, index) => (
                  <option key={index} value={index}>
                    {example.name}
                  </option>
                ))}
              </select>
            </div>
            
            <ExampleViewer 
              example={endpoint.examples[selectedExample]}
              onTryExample={(exampleData) => {
                setTestRequest(exampleData)
                setActiveTab('parameters')
              }}
            />
          </div>
        )}

        {activeTab === 'responses' && (
          <ResponsesDocumentation responses={endpoint.responses} />
        )}
      </div>
    </div>
  )
}

// Parameters Table Component
const ParametersTable: React.FC<{
  parameters: APIParameter[]
  onParameterChange: (parameter: APIParameter, value: any) => void
}> = ({ parameters, onParameterChange }) => {
  const [parameterValues, setParameterValues] = useState<Record<string, any>>({})

  const handleValueChange = (parameter: APIParameter, value: any) => {
    setParameterValues(prev => ({ ...prev, [parameter.name]: value }))
    onParameterChange(parameter, value)
  }

  if (parameters.length === 0) {
    return (
      <div className="text-center py-8 text-sage/70">
        This endpoint doesn't require any parameters.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {parameters.map((parameter) => (
        <GlassMorphism key={parameter.name} variant="subtle" className="p-4">
          <div className="space-y-3">
            {/* Parameter Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <code className="font-mono text-teal-primary">
                  {parameter.name}
                </code>
                <span className={cn(
                  'px-2 py-1 text-xs rounded font-medium',
                  parameter.required 
                    ? 'bg-red-error/20 text-red-error'
                    : 'bg-sage/20 text-sage'
                )}>
                  {parameter.required ? 'required' : 'optional'}
                </span>
                <span className="px-2 py-1 text-xs bg-navy-50/20 text-sage/70 rounded">
                  {parameter.type}
                </span>
              </div>
              
              <div className="text-sm text-sage/70">
                in: {parameter.in}
              </div>
            </div>

            {/* Parameter Description */}
            <p className="text-sm text-sage/80">
              {parameter.description}
            </p>

            {/* Parameter Input */}
            <div className="space-y-2">
              <ParameterInput
                parameter={parameter}
                value={parameterValues[parameter.name]}
                onChange={(value) => handleValueChange(parameter, value)}
              />
              
              {parameter.example && (
                <div className="text-xs text-sage/60">
                  Example: <code className="font-mono">{parameter.example}</code>
                </div>
              )}
            </div>
          </div>
        </GlassMorphism>
      ))}
    </div>
  )
}

// Example Viewer Component  
const ExampleViewer: React.FC<{
  example: APIExample
  onTryExample: (data: any) => void
}> = ({ example, onTryExample }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('curl')
  
  const languages = ['curl', 'javascript', 'python', 'php', 'ruby']

  return (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium text-cream mb-2">{example.name}</h4>
        <p className="text-sage/70 text-sm">{example.description}</p>
      </div>

      {/* Language Selector */}
      <div className="flex items-center gap-2">
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => setSelectedLanguage(lang)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded transition-colors',
              selectedLanguage === lang
                ? 'bg-teal-primary text-cream'
                : 'text-sage/70 hover:text-sage hover:bg-navy-50/20'
            )}
          >
            {lang.charAt(0).toUpperCase() + lang.slice(1)}
          </button>
        ))}
      </div>

      {/* Code Example */}
      <div className="space-y-4">
        <CodeBlock
          code={example.code[selectedLanguage]}
          language={selectedLanguage}
          showLineNumbers
          copyable
        />

        {/* Try Example Button */}
        <button
          onClick={() => onTryExample(example.requestData)}
          className="flex items-center gap-2 px-4 py-2 bg-sage/20 hover:bg-sage/30 text-sage rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          <span>Try this example</span>
        </button>
      </div>

      {/* Expected Response */}
      {example.response && (
        <div>
          <h5 className="font-medium text-cream mb-3">Expected Response</h5>
          <CodeBlock
            code={JSON.stringify(example.response, null, 2)}
            language="json"
            compact
          />
        </div>
      )}
    </div>
  )
}
```

### Technical Implementation Requirements

**OpenAPI Integration:**
- Automatic documentation generation from OpenAPI/Swagger specs
- Real-time schema validation for API testing
- Support for OpenAPI 3.0+ specifications
- Automated code generation for multiple languages

**Live API Testing:**
- Secure API key management and authentication
- Real-time request/response testing
- Request history and session management
- Error handling and debugging information

### Testing Requirements

**API Documentation Testing:**
- Documentation accuracy against actual API behavior
- Interactive testing functionality validation
- Code generation accuracy verification
- Cross-browser compatibility for all interactive features

---

## Story F6.3: API Authentication & Key Management Interface

**User Story:** As a frontend developer, I want to create a comprehensive API authentication and key management system that allows developers to securely generate, manage, and monitor their API keys with proper scope and permission controls.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 20  
**Sprint:** 2

### Detailed Acceptance Criteria

**API Key Management Dashboard:**
- **Given** API key management requirements
- **When** implementing key management interface
- **Then** create comprehensive key lifecycle management with scoping and monitoring

### Testing Requirements

**Authentication Interface Testing:**
- API key generation and validation testing
- Permission scope enforcement validation
- OAuth flow implementation verification
- Security token handling accuracy testing

---

## Story F6.4: SDK Generation & Code Examples System

**User Story:** As a frontend developer, I want to create an automated SDK generation system with comprehensive code examples that enables developers to quickly integrate with the API using their preferred programming languages and frameworks.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 24  
**Sprint:** 2

### Detailed Acceptance Criteria

**SDK Generation Interface:**
- **Given** multi-language SDK requirements  
- **When** implementing SDK generation system
- **Then** create automated SDK generation with download capabilities and integration examples

### Testing Requirements

**SDK Generation Testing:**
- Generated code compilation and functionality validation
- Multi-language example accuracy verification
- SDK documentation completeness testing
- Integration example effectiveness validation

---

## Story F6.5: API Playground & Interactive Testing Environment

**User Story:** As a frontend developer, I want to create an advanced API playground that allows developers to construct, test, and debug API requests with comprehensive request/response inspection and collaborative features.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 21  
**Sprint:** 3

### Detailed Acceptance Criteria

**Interactive API Playground:**
- **Given** API testing and exploration requirements
- **When** implementing interactive playground
- **Then** create comprehensive testing environment with request building, response analysis, and collaboration features

### Testing Requirements

**API Playground Testing:**
- Request construction and validation testing
- Response parsing and visualization verification
- Collaborative features functionality validation
- Performance testing with complex API scenarios

---

## Story F6.6: Developer Analytics & Usage Monitoring

**User Story:** As a frontend developer, I want to create comprehensive developer analytics and usage monitoring interfaces that provide insights into API usage patterns, performance metrics, and integration health.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 18  
**Sprint:** 3

### Detailed Acceptance Criteria

**Developer Analytics Dashboard:**
- **Given** API usage monitoring requirements
- **When** implementing analytics interface
- **Then** create comprehensive usage tracking with performance insights and optimization recommendations

### Testing Requirements

**Analytics Interface Testing:**
- Usage data accuracy and visualization validation
- Performance metrics calculation verification
- Alert system functionality testing
- Analytics export and reporting validation

---

## Story F6.7: Community Features & Developer Support

**User Story:** As a frontend developer, I want to create community features including forums, support systems, and collaborative tools that enable developers to share knowledge, get help, and contribute to the platform ecosystem.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 19  
**Sprint:** 4

### Detailed Acceptance Criteria

**Developer Community Platform:**
- **Given** community engagement requirements
- **When** implementing community features
- **Then** create comprehensive community platform with forums, support ticketing, and knowledge sharing

### Testing Requirements

**Community Features Testing:**
- Forum functionality and moderation testing
- Support ticket system workflow validation  
- Knowledge base search and organization verification
- Community interaction and notification testing

---

## Story F6.8: Developer Onboarding & Certification System

**User Story:** As a frontend developer, I want to create an interactive onboarding and certification system that guides new developers through API integration while providing achievement tracking and skill validation.

**Assignee:** Frontend Developer Agent  
**Priority:** P1  
**Story Points:** 16  
**Sprint:** 4

### Detailed Acceptance Criteria

**Developer Onboarding Experience:**
- **Given** developer education and certification requirements
- **When** implementing onboarding system
- **Then** create comprehensive learning path with interactive tutorials and certification validation

### Testing Requirements

**Onboarding System Testing:**
- Tutorial completion flow validation
- Interactive exercise functionality verification
- Certification assessment accuracy testing
- Progress tracking and achievement system validation

---

## Epic 6 Summary & Success Metrics

### Completion Criteria

**Technical Deliverables:**
- ✅ Comprehensive developer portal with intuitive navigation and search
- ✅ Interactive API documentation with live testing capabilities
- ✅ Secure API authentication and key management system
- ✅ Multi-language SDK generation and code examples
- ✅ Advanced API playground with collaborative features
- ✅ Developer analytics and usage monitoring dashboards
- ✅ Community platform with forums and support integration
- ✅ Interactive onboarding and certification system

**Developer Experience Standards:**
- Documentation completeness score > 95%
- API testing success rate > 98%
- Developer onboarding completion rate > 80%
- Time to first successful API call < 10 minutes
- Developer satisfaction score > 4.5/5

**Platform Integration:**
- Seamless authentication with main platform
- Consistent design language and user experience
- Real-time API status and performance monitoring
- Automated documentation updates from API changes

**Community Engagement:**
- Developer forum active participation > 60%
- Knowledge base article helpfulness score > 85%
- Community-contributed examples and plugins > 50
- Developer webinar attendance > 200 per session

**Technical Performance:**
- Documentation site load time < 2s
- API playground response time < 500ms
- Search query response time < 200ms
- SDK download success rate > 99%

**Business Impact:**
- Developer registrations > 1,000 within 6 months
- API usage growth > 200% quarter-over-quarter
- Third-party integrations > 100 active applications
- API revenue contribution > $50K MRR

**Testing Coverage:**
- Unit test coverage > 90% for all developer tools
- Integration testing for all API playground features
- User experience testing with real developers
- Performance benchmarking under high usage loads
- Accessibility compliance (WCAG 2.1 AA) throughout

This comprehensive frontend Epic 6 creates a world-class developer experience that enables third-party developers to integrate effectively with The Lawless Directory platform while maintaining the high standards of design and usability established throughout the platform. The developer portal serves as a growth driver for platform adoption and ecosystem expansion.

**File Path:** `/Users/michaellawless/Documents/Vibe/Repo/directory_v4/docs/planning/frontend-epic-6-stories.md`