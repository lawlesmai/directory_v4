# Story 4.4: Business Verification & Moderation Workflows

**Epic:** Epic 4 - Platform Admin Portal  
**User Story:** As a platform administrator, I want efficient business verification and content moderation workflows so that I can maintain platform quality and ensure business listing authenticity.

**Assignee:** Frontend Developer Agent  
**Priority:** P0  
**Story Points:** 30  
**Sprint:** 2

## Detailed Acceptance Criteria

### Business Verification Workflow Management

**Given** businesses requiring verification for platform listing  
**When** managing the verification process  
**Then** provide comprehensive verification workflows:

**Verification Queue Management:**
- Prioritized verification queue with urgency indicators
- Automated verification routing based on business type and complexity
- Verification time tracking and SLA monitoring
- Bulk verification operations for efficient processing
- Verification status tracking with detailed progress indicators
- Assignment system for verification specialists
- Workload balancing across verification team members

**Verification Document Review:**
- Document viewer with zoom, annotation, and markup tools
- Document type recognition and validation checklists
- OCR integration for automatic data extraction and verification
- Document fraud detection using AI analysis
- Document retention and secure storage management
- Version control for document updates and corrections
- Integration with third-party verification services

### Business Information Verification

**Given** business data requiring validation  
**When** verifying business information  
**Then** implement comprehensive verification processes:

**Business Data Validation:**
- Business name verification against public databases
- Address verification using postal service APIs
- Phone number validation with call verification system
- Website verification and domain ownership validation
- License verification through government databases
- Tax ID verification and business registration validation
- Cross-reference verification with existing business directories

**Owner Verification Process:**
- Identity document verification with OCR processing
- Business ownership proof validation
- Authorized representative verification
- Multi-factor business owner authentication
- Business relationship verification for claimed listings
- Power of attorney validation for representative claims
- Corporate structure verification for complex businesses

### Content Moderation System

**Given** user-generated content requiring moderation  
**When** moderating platform content  
**Then** provide efficient moderation tools:

**Automated Content Screening:**
- AI-powered inappropriate content detection
- Spam and fake content identification algorithms
- Hate speech and offensive language detection
- Copyright infringement detection for images and text
- Duplicate content identification and management
- Suspicious review pattern detection
- Automated content flagging with confidence scores

**Manual Moderation Interface:**
- Content review queue with priority sorting
- Side-by-side comparison tools for duplicate content
- Context preservation for moderation decisions
- Moderation decision templates and guidelines
- Appeal review process for contested decisions
- Moderation history tracking for consistency
- Team collaboration tools for complex moderation cases

### Quality Control & Compliance

**Given** platform quality standards and legal compliance  
**When** ensuring content and business quality  
**Then** implement quality control measures:

**Quality Assurance Workflows:**
- Random quality audits of verified businesses
- Customer complaint tracking and investigation
- Business listing accuracy verification
- Review authenticity validation
- Platform guideline compliance monitoring
- Regular quality score assessment for businesses
- Corrective action workflows for quality issues

**Compliance Management:**
- Legal compliance checking for business types
- Industry-specific regulation compliance
- Local licensing requirement verification
- International business compliance for global expansion
- Regulatory change impact assessment
- Compliance documentation and record keeping
- Legal team escalation for compliance issues

## Frontend Implementation

### Business Verification Dashboard

```typescript
// components/admin/verification/BusinessVerificationDashboard.tsx
export const BusinessVerificationDashboard: React.FC = () => {
  const [filters, setFilters] = useState<VerificationFilters>(defaultFilters)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [activeView, setActiveView] = useState<'queue' | 'documents' | 'analytics'>('queue')
  
  const {
    data: verificationData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['business-verification', filters],
    queryFn: () => adminApi.getVerificationQueue(filters),
    keepPreviousData: true
  })

  const verificationMutation = useMutation({
    mutationFn: adminApi.processVerification,
    onSuccess: () => {
      refetch()
      toast.success('Verification processed successfully')
    }
  })

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Business Verification
          </h1>
          <p className="text-sage/70 mt-1">
            Manage business verification workflows and document review
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <VerificationAnalyticsButton />
          <BulkProcessingButton
            selectedItems={selectedItems}
            onProcess={(action) => handleBulkProcess(action)}
          />
        </div>
      </div>

      {/* Verification Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Verification"
          value={verificationData?.stats.pendingCount}
          urgent={verificationData?.stats.pendingOverdue > 0}
          icon={Clock}
        />
        <StatCard
          title="Verified Today"
          value={verificationData?.stats.verifiedToday}
          change={verificationData?.stats.verifiedTodayChange}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Average Processing Time"
          value={`${verificationData?.stats.avgProcessingTime}h`}
          icon={Timer}
          color="blue"
        />
        <StatCard
          title="Quality Score"
          value={`${verificationData?.stats.qualityScore}%`}
          icon={Award}
          color="gold"
        />
      </div>

      {/* View Toggle and Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ViewTabs
            value={activeView}
            onChange={setActiveView}
            options={[
              { value: 'queue', label: 'Verification Queue', icon: List },
              { value: 'documents', label: 'Document Review', icon: FileText },
              { value: 'analytics', label: 'Analytics', icon: BarChart3 }
            ]}
          />
        </div>
        
        <VerificationFilters
          filters={filters}
          onChange={setFilters}
        />
      </div>

      {/* Main Content */}
      <div className="space-y-6">
        {activeView === 'queue' && (
          <VerificationQueue
            items={verificationData?.queue || []}
            selectedItems={selectedItems}
            onSelectionChange={setSelectedItems}
            onProcess={(id, decision) => 
              verificationMutation.mutate({ id, decision })
            }
            isLoading={isLoading}
          />
        )}
        
        {activeView === 'documents' && (
          <DocumentReviewInterface
            documents={verificationData?.documents || []}
            onDocumentVerify={(id, status) => 
              verificationMutation.mutate({ id, status })
            }
          />
        )}
        
        {activeView === 'analytics' && (
          <VerificationAnalytics
            data={verificationData?.analytics}
            timeRange="30d"
          />
        )}
      </div>
    </div>
  )
}
```

### Advanced Document Viewer

```typescript
// components/admin/verification/DocumentViewer.tsx
interface DocumentViewerProps {
  document: VerificationDocument
  onAnnotate: (annotation: Annotation) => void
  onVerify: (status: 'approved' | 'rejected', reason?: string) => void
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({
  document,
  onAnnotate,
  onVerify
}) => {
  const [zoom, setZoom] = useState(1)
  const [annotations, setAnnotations] = useState<Annotation[]>(document.annotations || [])
  const [showOcrResults, setShowOcrResults] = useState(false)
  const [verificationChecklist, setVerificationChecklist] = useState<VerificationChecklist>({})
  
  const { data: ocrData } = useQuery({
    queryKey: ['document-ocr', document.id],
    queryFn: () => adminApi.processOCR(document.id),
    enabled: document.type === 'identity' || document.type === 'business_license'
  })

  const handleAnnotation = (annotation: Annotation) => {
    setAnnotations(prev => [...prev, annotation])
    onAnnotate(annotation)
  }

  const validateDocument = () => {
    const checklistItems = getVerificationChecklist(document.type)
    return checklistItems.every(item => verificationChecklist[item.id] === true)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
      {/* Document Display */}
      <div className="lg:col-span-2">
        <GlassMorphism variant="subtle" className="h-full">
          <div className="flex items-center justify-between p-4 border-b border-sage/20">
            <div className="flex items-center gap-4">
              <DocumentTypeIcon type={document.type} />
              <div>
                <h3 className="font-medium text-cream">{document.name}</h3>
                <p className="text-sm text-sage/70">
                  Uploaded {formatDistanceToNow(document.uploadedAt)} ago
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOcrResults(!showOcrResults)}
                className={cn(
                  'px-3 py-1 rounded text-sm transition-colors',
                  showOcrResults 
                    ? 'bg-teal-primary text-navy-dark' 
                    : 'text-teal-primary hover:bg-teal-primary/20'
                )}
                disabled={!ocrData}
              >
                OCR Results
              </button>
              
              <ZoomControls
                zoom={zoom}
                onZoomChange={setZoom}
                min={0.25}
                max={3}
                step={0.25}
              />
            </div>
          </div>
          
          <div className="relative flex-1 overflow-auto p-4">
            <AnnotatableImage
              src={document.url}
              zoom={zoom}
              annotations={annotations}
              onAnnotate={handleAnnotation}
              className="w-full h-auto"
            />
            
            {showOcrResults && ocrData && (
              <OCRResultsOverlay
                results={ocrData}
                onClose={() => setShowOcrResults(false)}
              />
            )}
          </div>
        </GlassMorphism>
      </div>

      {/* Verification Panel */}
      <div className="space-y-6">
        {/* Verification Checklist */}
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Verification Checklist
          </h3>
          
          <VerificationChecklist
            type={document.type}
            checklist={verificationChecklist}
            onChange={setVerificationChecklist}
            ocrData={ocrData}
          />
          
          <div className="mt-6 pt-6 border-t border-sage/20">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium text-cream">
                Completion: {Math.round(getChecklistCompletion(verificationChecklist) * 100)}%
              </span>
              
              <div className={cn(
                'w-3 h-3 rounded-full',
                validateDocument() 
                  ? 'bg-green-400' 
                  : 'bg-yellow-400'
              )} />
            </div>
            
            <ProgressBar
              value={getChecklistCompletion(verificationChecklist)}
              className="mb-6"
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => onVerify('approved')}
                disabled={!validateDocument()}
                className="flex-1 px-4 py-2 bg-green-600 text-cream rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve
              </button>
              
              <button
                onClick={() => setShowRejectionDialog(true)}
                className="flex-1 px-4 py-2 bg-red-error text-cream rounded-lg hover:bg-red-critical transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </GlassMorphism>

        {/* Document Information */}
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Document Information
          </h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sage/70">Type</span>
              <span className="text-cream">{formatDocumentType(document.type)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sage/70">Size</span>
              <span className="text-cream">{formatBytes(document.size)}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sage/70">Format</span>
              <span className="text-cream">{document.format.toUpperCase()}</span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-sage/70">Security Scan</span>
              <SecurityScanStatus status={document.securityScan} />
            </div>
          </div>
          
          {ocrData && (
            <div className="mt-6 pt-6 border-t border-sage/20">
              <h4 className="font-medium text-cream mb-3">Extracted Data</h4>
              <ExtractedDataDisplay data={ocrData} />
            </div>
          )}
        </GlassMorphism>

        {/* Previous Annotations */}
        <GlassMorphism variant="subtle" className="p-6">
          <h3 className="text-lg font-heading font-semibold text-cream mb-4">
            Annotations ({annotations.length})
          </h3>
          
          <AnnotationsList
            annotations={annotations}
            onAnnotationClick={(annotation) => {
              // Focus on annotation in document viewer
            }}
          />
        </GlassMorphism>
      </div>
    </div>
  )
}
```

### Moderation Queue Interface

```typescript
// components/admin/moderation/ModerationQueue.tsx
export const ModerationQueue: React.FC = () => {
  const [filters, setFilters] = useState<ModerationFilters>({
    status: 'pending',
    type: 'all',
    priority: 'all'
  })
  
  const {
    data: moderationData,
    isLoading,
    refetch
  } = useQuery({
    queryKey: ['moderation-queue', filters],
    queryFn: () => adminApi.getModerationQueue(filters)
  })

  const moderationMutation = useMutation({
    mutationFn: adminApi.moderateContent,
    onSuccess: () => {
      refetch()
      toast.success('Content moderated successfully')
    }
  })

  return (
    <div className="space-y-6 p-6">
      {/* Queue Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-semibold text-cream">
            Content Moderation Queue
          </h1>
          <p className="text-sage/70 mt-1">
            Review and moderate platform content for quality and safety
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <ModerationFilters
            filters={filters}
            onChange={setFilters}
          />
          <AutoModeratorToggle />
        </div>
      </div>

      {/* Moderation Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Pending Review"
          value={moderationData?.stats.pendingCount}
          urgent={moderationData?.stats.highPriorityCount > 0}
          icon={AlertTriangle}
        />
        <StatCard
          title="Approved Today"
          value={moderationData?.stats.approvedToday}
          icon={CheckCircle}
          color="green"
        />
        <StatCard
          title="Rejected Today"
          value={moderationData?.stats.rejectedToday}
          icon={XCircle}
          color="red"
        />
        <StatCard
          title="Auto-Moderated"
          value={moderationData?.stats.autoModerated}
          icon={Bot}
          color="blue"
        />
      </div>

      {/* Moderation Items */}
      <GlassMorphism variant="subtle" className="overflow-hidden">
        {isLoading ? (
          <ModerationQueueSkeleton />
        ) : (
          <div className="divide-y divide-sage/10">
            {moderationData?.items.map((item) => (
              <ModerationItem
                key={item.id}
                item={item}
                onModerate={(decision, reason) => 
                  moderationMutation.mutate({
                    id: item.id,
                    decision,
                    reason
                  })
                }
              />
            ))}
          </div>
        )}
      </GlassMorphism>
    </div>
  )
}
```

## Technical Implementation Notes

**Workflow Engine Implementation:**
- State machine design for verification and moderation workflows
- Automated workflow routing and task assignment
- SLA tracking and alerting for workflow stages
- Integration with external verification services and APIs

**Document Management System:**
- Secure document storage with encryption
- Document indexing and search capabilities
- Version control and audit trails for documents
- Integration with OCR and AI analysis services

**AI Integration for Automation:**
- Machine learning models for content classification
- Natural language processing for review analysis
- Computer vision for image content moderation
- Continuous model improvement with human feedback

## Dependencies

- Epic 2 Story 2.9 (Business verification foundation)
- Story 4.3 (User management for business owner verification)

## Testing Requirements

**Verification Workflow Tests:**
- Complete verification process validation tests
- Document processing and OCR accuracy tests
- Automated verification service integration tests
- Verification time and SLA compliance tests

**Content Moderation Tests:**
- AI content detection accuracy and false positive tests
- Manual moderation interface functionality tests
- Appeal and escalation process workflow tests
- Moderation consistency and quality assurance tests

**Quality Control Tests:**
- Business data accuracy validation tests
- Compliance checking effectiveness tests
- Quality audit process and documentation tests
- Legal compliance verification accuracy tests

## Definition of Done

- [ ] Business verification workflow management system complete
- [ ] Document review and verification tools operational
- [ ] Automated content screening with AI integration
- [ ] Manual moderation interface with collaboration tools
- [ ] Quality control and compliance management system
- [ ] Integration with external verification services
- [ ] Performance optimization for large verification queues
- [ ] Mobile-responsive moderation interface
- [ ] All verification and moderation accuracy tests passing
- [ ] Documentation complete for verification and moderation procedures

## Risk Assessment

- **High Risk:** AI moderation system may have accuracy issues requiring human oversight
- **Medium Risk:** Complex verification workflows may impact processing speed
- **Mitigation:** Human-in-the-loop AI systems and workflow optimization