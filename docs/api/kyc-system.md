# KYC System API Documentation

## Overview

The KYC (Know Your Customer) System provides comprehensive business owner verification and compliance monitoring for The Lawless Directory. This system ensures regulatory compliance while providing excellent user experience for legitimate business owners.

### Core Features

- **Identity Verification**: Government ID verification with OCR and fraud detection
- **Business Verification**: Business license and registration document validation
- **Document Processing**: Automated OCR, validation, and quality scoring
- **Risk Assessment**: ML-powered fraud detection and risk scoring
- **Compliance Monitoring**: AML, sanctions, and PEP screening
- **Appeals Management**: Comprehensive appeal and escalation process
- **Administrative Review**: Queue management and manual review interfaces

## Authentication & Authorization

All KYC endpoints require authentication and follow the enhanced RBAC system:

- **Users** can manage their own verifications
- **Business Owners** can manage verifications for their businesses
- **Reviewers** can access verification queues and perform reviews
- **Admins** have full system access

### Required Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-CSRF-Token: <csrf_token>
```

## API Endpoints

### 1. Initiate KYC Verification

**Endpoint:** `POST /api/kyc/verification/initiate`

Initiates a new KYC verification process for a user and optionally their business.

#### Request Body

```json
{
  "userId": "uuid",
  "businessId": "uuid", // Optional
  "verificationType": "personal_identity" | "business_owner" | "business_entity" | "enhanced_due_diligence",
  "verificationLevel": "basic" | "enhanced" | "premium" | "institutional",
  "csrfToken": "string"
}
```

#### Response

```json
{
  "success": true,
  "verificationId": "uuid",
  "status": "initiated",
  "nextSteps": [
    "Upload government-issued ID (driver's license, passport, or state ID)",
    "Upload business license or registration documents",
    "Upload tax documents (EIN letter or business tax returns)",
    "Upload address verification (utility bill or bank statement)"
  ],
  "estimatedCompletion": "2023-08-26T00:00:00Z"
}
```

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_REQUEST | Invalid request data or parameters |
| 401 | AUTHENTICATION_REQUIRED | User not authenticated |
| 403 | INSUFFICIENT_PERMISSIONS | User cannot initiate KYC for target user/business |
| 404 | BUSINESS_NOT_FOUND | Business ID not found |
| 409 | VERIFICATION_IN_PROGRESS | Active verification already exists |
| 429 | RATE_LIMIT_EXCEEDED | Too many initiation attempts |

#### Rate Limits

- 3 requests per hour per IP address
- 2 active verifications per user at a time

### 2. Upload KYC Document

**Endpoint:** `POST /api/kyc/documents/upload`

Uploads and processes a document for KYC verification.

#### Request (Multipart Form)

```
verificationId: uuid
documentType: string (document type code)
documentSide: "front" | "back" | "both" | "single"
file: File (PDF, JPG, PNG, TIFF up to 10MB)
csrfToken: string
```

#### Response

```json
{
  "success": true,
  "documentId": "uuid",
  "status": "uploaded",
  "processingStatus": "pending" | "processing" | "completed" | "failed",
  "message": "Document uploaded successfully. Processing will begin shortly."
}
```

#### Supported Document Types

| Type Code | Display Name | Category | Max Size | Formats |
|-----------|--------------|----------|----------|---------|
| `drivers_license` | Driver's License | identity | 10MB | PDF, JPG, PNG, TIFF |
| `passport` | Passport | identity | 10MB | PDF, JPG, PNG, TIFF |
| `state_id` | State ID Card | identity | 10MB | PDF, JPG, PNG, TIFF |
| `business_license` | Business License | business_license | 10MB | PDF, JPG, PNG, TIFF |
| `ein_letter` | EIN Confirmation Letter | tax_document | 10MB | PDF, JPG, PNG |
| `utility_bill` | Utility Bill | address_verification | 10MB | PDF, JPG, PNG |
| `bank_statement` | Bank Statement | address_verification | 10MB | PDF, JPG, PNG |

#### Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | INVALID_FILE_TYPE | File format not supported |
| 400 | MISSING_FILE | No file provided |
| 404 | VERIFICATION_NOT_FOUND | Verification ID not found |
| 409 | DUPLICATE_DOCUMENT | Document already exists in system |
| 413 | FILE_TOO_LARGE | File exceeds size limit |
| 429 | RATE_LIMIT_EXCEEDED | Too many upload attempts |

#### Rate Limits

- 10 uploads per hour per IP address
- 20 documents per verification

### 3. Get Verification Status

**Endpoint:** `GET /api/kyc/verification/status`

Retrieves detailed status information for a KYC verification.

#### Query Parameters

```
verificationId: uuid (required)
includeDocuments: boolean (default: false)
includeRiskAssessment: boolean (default: false)
includeWorkflow: boolean (default: true)
```

#### Response

```json
{
  "success": true,
  "verification": {
    "id": "uuid",
    "userId": "uuid",
    "businessId": "uuid",
    "verificationType": "business_owner",
    "verificationLevel": "basic",
    "status": "under_review",
    "decision": null | "approved" | "rejected",
    "decisionConfidence": 85.5,
    "riskLevel": "low" | "medium" | "high" | "critical",
    "riskScore": 25.5,
    "initiatedAt": "2023-08-26T00:00:00Z",
    "submittedAt": "2023-08-26T01:00:00Z",
    "reviewedAt": null,
    "decidedAt": null,
    "expiresAt": "2023-09-26T00:00:00Z",
    "assignedReviewer": "reviewer@example.com",
    "estimatedCompletion": "2023-08-28T00:00:00Z",
    "documents": [
      {
        "id": "uuid",
        "documentType": "Driver's License",
        "fileName": "dl_front.jpg",
        "uploadedAt": "2023-08-26T02:00:00Z",
        "ocrStatus": "completed",
        "validationStatus": "valid",
        "reviewStatus": "approved",
        "qualityScore": 85
      }
    ],
    "workflow": {
      "id": "uuid",
      "currentStep": "business_license",
      "progressPercentage": 50.0,
      "completedSteps": 2,
      "totalSteps": 4,
      "requirements": {
        "identityVerification": { "required": true, "completed": true },
        "businessLicense": { "required": true, "completed": false },
        "taxVerification": { "required": true, "completed": false },
        "addressVerification": { "required": true, "completed": false }
      }
    },
    "riskAssessment": {
      "id": "uuid",
      "overallScore": 25.5,
      "riskCategory": "low",
      "identityScore": 15.0,
      "documentScore": 20.0,
      "businessScore": 30.0,
      "riskIndicators": [
        {
          "type": "new_business",
          "impact": 15,
          "description": "Business created within 30 days"
        }
      ],
      "assessedAt": "2023-08-26T03:00:00Z"
    }
  }
}
```

#### Verification Status Values

| Status | Description |
|--------|-------------|
| `initiated` | Verification started, awaiting documents |
| `documents_required` | Additional documents needed |
| `documents_uploaded` | All required documents submitted |
| `under_review` | Manual review in progress |
| `verification_pending` | Awaiting external verification |
| `additional_info_required` | More information requested |
| `approved` | Verification approved |
| `rejected` | Verification rejected |
| `expired` | Verification expired |
| `appealed` | Decision is being appealed |

### 4. Administrative Review

**Endpoint:** `POST /api/kyc/admin/review`

Processes administrative review decisions for KYC verifications.

#### Required Permissions

- `businesses:verify` permission
- Assigned reviewer or admin role

#### Request Body

```json
{
  "verificationId": "uuid",
  "decision": "approved" | "rejected" | "pending",
  "reviewNotes": "Detailed review notes (min 10 characters)",
  "decisionReason": "Reason for decision (min 5 characters)",
  "requiresAdditionalDocuments": false,
  "additionalDocumentsRequired": ["document_type_1", "document_type_2"],
  "escalateToSeniorReviewer": false,
  "flagForCompliance": false,
  "complianceNotes": "Optional compliance notes",
  "csrfToken": "string"
}
```

#### Response

```json
{
  "success": true,
  "verificationId": "uuid",
  "decision": "approved",
  "status": "approved",
  "message": "Review completed successfully. Decision: approved",
  "nextActions": [
    "Business owner role will be automatically assigned",
    "Business verification status will be updated to verified",
    "Business listing will be marked as verified"
  ]
}
```

### 5. Get Review Queue

**Endpoint:** `GET /api/kyc/admin/review`

Retrieves the administrative review queue for KYC verifications.

#### Query Parameters

```
queueType: "all" | "standard" | "priority" | "high_risk" | "appeal" | "escalated"
assignedToMe: boolean (default: false)
limit: number (1-100, default: 50)
offset: number (default: 0)
```

#### Response

```json
{
  "success": true,
  "queue": [
    {
      "id": "uuid",
      "verification_id": "uuid",
      "queue_type": "standard",
      "priority_score": 50,
      "status": "queued",
      "assigned_to": null,
      "assigned_at": null,
      "deadline": "2023-08-27T00:00:00Z",
      "is_overdue": false,
      "created_at": "2023-08-26T00:00:00Z",
      "kyc_verifications": {
        "id": "uuid",
        "user_id": "uuid",
        "business_id": "uuid",
        "verification_type": "business_owner",
        "verification_level": "basic",
        "status": "under_review",
        "risk_level": "medium",
        "risk_score": 45.5,
        "initiated_at": "2023-08-26T00:00:00Z",
        "auth_users": {
          "email": "user@example.com"
        },
        "businesses": {
          "name": "Example Business LLC"
        }
      }
    }
  ],
  "pagination": {
    "offset": 0,
    "limit": 50,
    "total": 25
  }
}
```

### 6. Submit Appeal

**Endpoint:** `POST /api/kyc/appeals`

Submits an appeal for a rejected KYC verification.

#### Request Body

```json
{
  "verificationId": "uuid",
  "appealReason": "document_quality" | "processing_error" | "incorrect_rejection" | "technical_issue" | "discrimination_claim" | "data_accuracy" | "other",
  "appealDescription": "Detailed description (min 20 characters)",
  "supportingEvidence": [
    {
      "type": "additional_document",
      "description": "Higher quality scan of driver's license",
      "fileUrl": "https://storage.example.com/evidence/doc1.pdf"
    }
  ],
  "contactPreference": "email" | "phone" | "portal",
  "csrfToken": "string"
}
```

#### Response

```json
{
  "success": true,
  "appeal": {
    "id": "uuid",
    "verificationId": "uuid",
    "status": "submitted",
    "submittedAt": "2023-08-26T00:00:00Z",
    "estimatedResolution": "2023-08-28T00:00:00Z"
  }
}
```

#### Appeal Constraints

- Appeals must be submitted within 30 days of rejection
- Only one active appeal per verification
- Maximum 2 appeals per day per IP address

### 7. Get User Appeals

**Endpoint:** `GET /api/kyc/appeals`

Retrieves appeals submitted by the authenticated user.

#### Query Parameters

```
status: "submitted" | "under_review" | "additional_info_requested" | "upheld" | "overturned" | "dismissed"
verificationId: uuid
page: number (default: 1)
limit: number (1-50, default: 10)
```

#### Response

```json
{
  "success": true,
  "appeals": [
    {
      "id": "uuid",
      "verificationId": "uuid",
      "appealReason": "incorrect_rejection",
      "status": "under_review",
      "submittedAt": "2023-08-26T00:00:00Z",
      "reviewedAt": "2023-08-26T12:00:00Z",
      "decision": null,
      "resolutionDeadline": "2023-08-28T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1
  }
}
```

## Document Processing Pipeline

### 1. Upload & Storage

- **Secure Upload**: Documents encrypted during transit and at rest
- **File Validation**: Format, size, and content type validation
- **Duplicate Detection**: SHA256 hash comparison prevents duplicate submissions
- **Metadata Extraction**: File properties and upload context captured

### 2. OCR Processing

- **Automated OCR**: Extract text and data from documents
- **Confidence Scoring**: OCR results include confidence metrics
- **Data Extraction**: Structured data extraction (names, dates, numbers)
- **Multi-format Support**: PDF, image formats with different qualities

### 3. Validation & Verification

- **Document Authenticity**: Security features and tampering detection
- **Data Consistency**: Cross-reference information across documents
- **Expiration Checking**: Validate document expiry dates
- **Format Compliance**: Ensure documents meet regulatory requirements

### 4. Fraud Detection

- **ML-Powered Analysis**: Advanced algorithms detect suspicious patterns
- **Risk Indicators**: Document quality, consistency, and behavioral analysis
- **Watchlist Screening**: Check against fraud databases
- **Velocity Monitoring**: Detect unusual submission patterns

## Risk Assessment System

### Risk Scoring Components

| Component | Weight | Description |
|-----------|---------|-------------|
| Identity | 25% | Account age, verification history, consistency |
| Document | 35% | Quality, authenticity, completeness |
| Business | 20% | Business age, registration status, completeness |
| Behavioral | 10% | Submission patterns, interaction history |
| Geographic | 10% | Location-based risk factors |

### Risk Categories

- **Low (0-25)**: Auto-approval eligible, minimal review required
- **Medium (26-60)**: Standard manual review process
- **High (61-80)**: Enhanced review, senior reviewer required
- **Critical (81-100)**: Escalated review, compliance investigation

### Fraud Indicators

| Indicator | Severity | Auto-Action |
|-----------|----------|-------------|
| Duplicate Documents | High | Manual Review |
| Synthetic Identity | Critical | Immediate Escalation |
| Document Tampering | High | Manual Review |
| Velocity Abuse | Medium | Rate Limiting |
| Inconsistent Data | High | Manual Review |

## Compliance & Regulatory Features

### AML Compliance

- **Customer Due Diligence**: Enhanced verification for high-risk entities
- **Ongoing Monitoring**: Continuous screening against watchlists
- **Suspicious Activity Reporting**: Automated SAR generation
- **Record Keeping**: Complete audit trails for regulatory compliance

### Sanctions Screening

- **OFAC Lists**: Office of Foreign Assets Control screening
- **EU Sanctions**: European Union consolidated list
- **UN Sanctions**: United Nations Security Council lists
- **Real-time Updates**: Automated list updates and re-screening

### PEP Screening

- **Politically Exposed Persons**: Enhanced due diligence requirements
- **Family Associates**: Extended screening for related parties
- **Risk-based Approach**: Graduated response based on exposure level

### Data Protection

- **GDPR Compliance**: European data protection requirements
- **CCPA Compliance**: California consumer privacy rights
- **Data Minimization**: Collect only necessary information
- **Right to Erasure**: Automated data deletion capabilities

## Webhook Notifications

The KYC system supports webhook notifications for real-time updates:

### Supported Events

- `kyc.verification.initiated`
- `kyc.verification.completed`
- `kyc.verification.approved`
- `kyc.verification.rejected`
- `kyc.document.uploaded`
- `kyc.document.processed`
- `kyc.appeal.submitted`
- `kyc.appeal.resolved`

### Webhook Payload

```json
{
  "event": "kyc.verification.approved",
  "timestamp": "2023-08-26T00:00:00Z",
  "data": {
    "verificationId": "uuid",
    "userId": "uuid",
    "businessId": "uuid",
    "status": "approved",
    "decision": "approved",
    "riskScore": 15.5
  },
  "signature": "sha256=..."
}
```

## Error Handling

### Standard Error Response

```json
{
  "success": false,
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": {
    "field": "Specific field error details"
  }
}
```

### Common Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `AUTHENTICATION_REQUIRED` | User not authenticated | Login required |
| `INSUFFICIENT_PERMISSIONS` | User lacks required permissions | Contact administrator |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Retry after delay |
| `INVALID_REQUEST` | Malformed request data | Fix request format |
| `VERIFICATION_NOT_FOUND` | Verification ID not found | Check verification ID |
| `DOCUMENT_TOO_LARGE` | File exceeds size limit | Reduce file size |
| `DUPLICATE_DOCUMENT` | Document already exists | Use different document |

## Rate Limiting

| Endpoint | Limit | Window | Scope |
|----------|--------|---------|--------|
| Initiate Verification | 3 | 1 hour | IP Address |
| Upload Document | 10 | 1 hour | IP Address |
| Status Check | 60 | 1 hour | IP Address |
| Submit Appeal | 2 | 24 hours | IP Address |
| Admin Review | 20 | 1 hour | IP Address |

## Testing & Validation

### Test Environment

- **Sandbox API**: `https://sandbox-api.lawlessdirectory.com/kyc`
- **Test Documents**: Predefined test documents for various scenarios
- **Mock Responses**: Configurable responses for testing different flows
- **Rate Limit Bypass**: Testing tokens that bypass rate limits

### Test Scenarios

1. **Happy Path**: Complete verification with all valid documents
2. **Document Rejection**: Invalid or expired documents
3. **High Risk**: Triggers manual review and escalation
4. **Appeals Process**: Rejection, appeal submission, and resolution
5. **Compliance Screening**: Hits against various watchlists

## Monitoring & Analytics

### Key Metrics

- **Processing Time**: Average time from initiation to decision
- **Approval Rate**: Percentage of verifications approved
- **Document Quality**: Average quality scores and rejection rates
- **Risk Distribution**: Breakdown of risk levels
- **SLA Compliance**: Meeting review and processing deadlines

### Dashboards

- **Operations Dashboard**: Real-time queue status and processing metrics
- **Compliance Dashboard**: Regulatory reporting and risk monitoring
- **Performance Dashboard**: System performance and error rates
- **Business Intelligence**: Trends, patterns, and insights

## Support & Contact

For technical support or questions about the KYC API:

- **Documentation**: [https://docs.lawlessdirectory.com/kyc](https://docs.lawlessdirectory.com/kyc)
- **API Status**: [https://status.lawlessdirectory.com](https://status.lawlessdirectory.com)
- **Developer Support**: [developers@lawlessdirectory.com](mailto:developers@lawlessdirectory.com)
- **Compliance Questions**: [compliance@lawlessdirectory.com](mailto:compliance@lawlessdirectory.com)