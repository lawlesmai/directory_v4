/**
 * EPIC 5 STORY 5.10: Payment Security & Compliance
 * Security Incident Management API Endpoints
 * 
 * Provides incident management, response coordination,
 * and incident reporting capabilities.
 */

import { NextRequest, NextResponse } from 'next/server';
import securityMonitor, { IncidentStatus, ResponseActionType } from '@/lib/payments/security-monitor';
import paymentSecurity from '@/lib/payments/security-middleware';
import { SecuritySeverity } from '@/lib/payments/security-framework';
import { z } from 'zod';

// =============================================
// REQUEST VALIDATION SCHEMAS
// =============================================

const UpdateIncidentSchema = z.object({
  status: z.nativeEnum(IncidentStatus).optional(),
  assignedTo: z.string().optional(),
  notes: z.string().max(1000).optional(),
  responseActions: z.array(z.nativeEnum(ResponseActionType)).optional(),
  resolution: z.string().max(2000).optional(),
  lessonsLearned: z.string().max(2000).optional()
});

const CreateIncidentCommentSchema = z.object({
  comment: z.string().min(1).max(1000),
  internal: z.boolean().default(true)
});

const BulkIncidentActionSchema = z.object({
  incidentIds: z.array(z.string()).min(1).max(50),
  action: z.enum(['assign', 'close', 'escalate', 'update_status']),
  parameters: z.object({
    assignedTo: z.string().optional(),
    status: z.nativeEnum(IncidentStatus).optional(),
    notes: z.string().max(500).optional()
  }).optional()
});

const IncidentSearchSchema = z.object({
  status: z.array(z.nativeEnum(IncidentStatus)).optional(),
  severity: z.array(z.nativeEnum(SecuritySeverity)).optional(),
  assignedTo: z.string().optional(),
  dateRange: z.object({
    startDate: z.string().refine((date) => !isNaN(Date.parse(date))),
    endDate: z.string().refine((date) => !isNaN(Date.parse(date)))
  }).optional(),
  limit: z.number().min(1).max(100).default(25),
  offset: z.number().min(0).default(0)
});

// =============================================
// GET - List Incidents with Filtering
// =============================================

export async function GET(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_analyst', 'incident_responder'],
      false
    );

    if (response) {
      return response;
    }

    const url = new URL(request.url);
    const searchParams = Object.fromEntries(url.searchParams);

    // Parse and validate search parameters
    const searchData: any = {
      limit: searchParams.limit ? parseInt(searchParams.limit) : 25,
      offset: searchParams.offset ? parseInt(searchParams.offset) : 0
    };

    if (searchParams.status) {
      searchData.status = searchParams.status.split(',');
    }
    if (searchParams.severity) {
      searchData.severity = searchParams.severity.split(',');
    }
    if (searchParams.assignedTo) {
      searchData.assignedTo = searchParams.assignedTo;
    }
    if (searchParams.startDate && searchParams.endDate) {
      searchData.dateRange = {
        startDate: searchParams.startDate,
        endDate: searchParams.endDate
      };
    }

    const validation = IncidentSearchSchema.safeParse(searchData);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const validatedParams = validation.data;

    // Get incidents based on search criteria
    const incidents = await searchIncidents(validatedParams);
    const totalCount = await getIncidentCount(validatedParams);

    // Get incident statistics
    const statistics = await getIncidentStatistics();

    const response_data = {
      incidents: incidents.map(incident => ({
        incidentId: incident.incidentId,
        severity: incident.severity,
        status: incident.status,
        title: incident.title,
        description: incident.description,
        assignedTo: incident.assignedTo,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        responseTime: incident.responseTime,
        resolutionTime: incident.resolutionTime,
        tags: incident.tags || [],
        relatedEvents: incident.relatedEvents?.length || 0
      })),
      pagination: {
        total: totalCount,
        limit: validatedParams.limit,
        offset: validatedParams.offset,
        hasNext: (validatedParams.offset + validatedParams.limit) < totalCount,
        hasPrev: validatedParams.offset > 0
      },
      statistics
    };

    // Log successful request
    await paymentSecurity.logPaymentEvent(
      context,
      'incidents_retrieved',
      'incident_api',
      true,
      { 
        searchParams: validatedParams,
        resultCount: incidents.length
      }
    );

    return NextResponse.json(response_data, { 
      status: 200,
      headers: {
        'X-Total-Count': totalCount.toString(),
        'Cache-Control': 'private, no-cache'
      }
    });
  } catch (error) {
    console.error('Incident listing API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Incident retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// POST - Update Incident (by ID in URL path)
// =============================================

export async function POST(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_analyst', 'incident_responder'],
      false
    );

    if (response) {
      return response;
    }

    // Extract incident ID from URL
    const url = new URL(request.url);
    const incidentId = url.searchParams.get('incidentId');

    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = UpdateIncidentSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'incident_update_validation_error',
        'incident_api',
        false,
        { incidentId, errors: validation.error.errors },
        'Invalid incident update data'
      );

      return NextResponse.json(
        { error: 'Invalid update data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updateData = validation.data;

    // Get existing incident
    const incident = await getIncidentById(incidentId);
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Check permissions for the specific incident
    const canModify = await checkIncidentModifyPermission(context, incident);
    if (!canModify) {
      return NextResponse.json(
        { error: 'Insufficient permissions to modify this incident' },
        { status: 403 }
      );
    }

    // Update incident
    const updatedIncident = await updateIncident(incidentId, updateData, context.userId);

    // Execute response actions if specified
    if (updateData.responseActions && updateData.responseActions.length > 0) {
      await securityMonitor.executeIncidentResponse(incidentId, updateData.responseActions);
    }

    // Log successful update
    await paymentSecurity.logPaymentEvent(
      context,
      'incident_updated',
      'incident_api',
      true,
      { 
        incidentId,
        changes: updateData,
        previousStatus: incident.status,
        newStatus: updateData.status || incident.status
      }
    );

    return NextResponse.json(
      {
        incidentId: updatedIncident.incidentId,
        status: updatedIncident.status,
        severity: updatedIncident.severity,
        assignedTo: updatedIncident.assignedTo,
        updatedAt: updatedIncident.updatedAt,
        timeline: updatedIncident.timeline.slice(-5), // Last 5 timeline entries
        responseActions: updatedIncident.containmentActions?.map(action => ({
          action: action.action,
          executedAt: action.executedAt,
          success: action.success
        })) || []
      },
      { 
        status: 200,
        headers: {
          'X-Incident-Status': updatedIncident.status,
          'X-Last-Modified': updatedIncident.updatedAt.toISOString()
        }
      }
    );
  } catch (error) {
    console.error('Incident update API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Incident update failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// PUT - Bulk Incident Operations
// =============================================

export async function PUT(request: NextRequest) {
  try {
    // Validate security permissions - only admins and senior analysts can perform bulk operations
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_lead'],
      false
    );

    if (response) {
      return response;
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = BulkIncidentActionSchema.safeParse(body);
    if (!validation.success) {
      await paymentSecurity.logPaymentEvent(
        context,
        'bulk_incident_action_validation_error',
        'incident_api',
        false,
        { errors: validation.error.errors },
        'Invalid bulk action data'
      );

      return NextResponse.json(
        { error: 'Invalid bulk action data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const actionData = validation.data;

    // Validate all incident IDs exist and user has permission
    const incidents = await getIncidentsByIds(actionData.incidentIds);
    const accessibleIncidents = [];
    const inaccessibleIncidents = [];

    for (const incident of incidents) {
      const canModify = await checkIncidentModifyPermission(context, incident);
      if (canModify) {
        accessibleIncidents.push(incident);
      } else {
        inaccessibleIncidents.push(incident.incidentId);
      }
    }

    if (accessibleIncidents.length === 0) {
      return NextResponse.json(
        { error: 'No accessible incidents found' },
        { status: 404 }
      );
    }

    // Perform bulk action
    const results = await executeBulkIncidentAction(
      accessibleIncidents,
      actionData.action,
      actionData.parameters,
      context.userId
    );

    // Log bulk action
    await paymentSecurity.logPaymentEvent(
      context,
      'bulk_incident_action_executed',
      'incident_api',
      true,
      { 
        action: actionData.action,
        incidentCount: accessibleIncidents.length,
        successCount: results.successful.length,
        failureCount: results.failed.length
      }
    );

    return NextResponse.json(
      {
        action: actionData.action,
        totalRequested: actionData.incidentIds.length,
        accessible: accessibleIncidents.length,
        inaccessible: inaccessibleIncidents,
        results: {
          successful: results.successful,
          failed: results.failed
        },
        summary: {
          successCount: results.successful.length,
          failureCount: results.failed.length,
          inaccessibleCount: inaccessibleIncidents.length
        }
      },
      { 
        status: 200,
        headers: {
          'X-Bulk-Action': actionData.action,
          'X-Success-Count': results.successful.length.toString()
        }
      }
    );
  } catch (error) {
    console.error('Bulk incident action API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Bulk incident action failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// PATCH - Add Comment to Incident
// =============================================

export async function PATCH(request: NextRequest) {
  try {
    // Validate security permissions
    const { context, response } = await paymentSecurity.validatePaymentRequest(
      request,
      ['admin', 'security_analyst', 'incident_responder'],
      false
    );

    if (response) {
      return response;
    }

    // Extract incident ID from URL
    const url = new URL(request.url);
    const incidentId = url.searchParams.get('incidentId');

    if (!incidentId) {
      return NextResponse.json(
        { error: 'Incident ID is required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = CreateIncidentCommentSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid comment data', details: validation.error.errors },
        { status: 400 }
      );
    }

    const commentData = validation.data;

    // Check if incident exists
    const incident = await getIncidentById(incidentId);
    if (!incident) {
      return NextResponse.json(
        { error: 'Incident not found' },
        { status: 404 }
      );
    }

    // Add comment to incident
    const comment = await addIncidentComment(
      incidentId,
      commentData.comment,
      context.userId,
      commentData.internal
    );

    // Log comment addition
    await paymentSecurity.logPaymentEvent(
      context,
      'incident_comment_added',
      'incident_api',
      true,
      { 
        incidentId,
        commentId: comment.id,
        internal: commentData.internal
      }
    );

    return NextResponse.json(
      {
        commentId: comment.id,
        incidentId,
        comment: comment.text,
        author: comment.author,
        createdAt: comment.createdAt,
        internal: comment.internal
      },
      { 
        status: 201,
        headers: {
          'X-Comment-ID': comment.id
        }
      }
    );
  } catch (error) {
    console.error('Incident comment API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Adding comment failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// =============================================
// HELPER FUNCTIONS
// =============================================

async function searchIncidents(params: any): Promise<any[]> {
  // Mock implementation - would query database with filters
  return [
    {
      incidentId: 'inc_001',
      severity: SecuritySeverity.HIGH,
      status: IncidentStatus.INVESTIGATING,
      title: 'Suspicious payment pattern detected',
      description: 'Multiple failed payment attempts from same IP',
      assignedTo: 'security-team',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000),
      responseTime: 15, // minutes
      tags: ['fraud', 'payments'],
      relatedEvents: ['evt_001', 'evt_002']
    },
    {
      incidentId: 'inc_002',
      severity: SecuritySeverity.MEDIUM,
      status: IncidentStatus.CONTAINED,
      title: 'Rate limiting violation',
      description: 'API rate limits exceeded by automated system',
      assignedTo: 'ops-team',
      createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      responseTime: 45, // minutes
      resolutionTime: 120, // minutes
      tags: ['rate-limiting', 'api'],
      relatedEvents: ['evt_003']
    }
  ].filter(incident => {
    // Apply filters
    if (params.status && !params.status.includes(incident.status)) return false;
    if (params.severity && !params.severity.includes(incident.severity)) return false;
    if (params.assignedTo && incident.assignedTo !== params.assignedTo) return false;
    return true;
  }).slice(params.offset, params.offset + params.limit);
}

async function getIncidentCount(params: any): Promise<number> {
  // Mock implementation - would count filtered incidents
  return 47;
}

async function getIncidentStatistics(): Promise<any> {
  return {
    total: 47,
    byStatus: {
      [IncidentStatus.OPEN]: 8,
      [IncidentStatus.INVESTIGATING]: 12,
      [IncidentStatus.CONTAINED]: 15,
      [IncidentStatus.RESOLVED]: 10,
      [IncidentStatus.CLOSED]: 2
    },
    bySeverity: {
      [SecuritySeverity.CRITICAL]: 3,
      [SecuritySeverity.HIGH]: 8,
      [SecuritySeverity.MEDIUM]: 24,
      [SecuritySeverity.LOW]: 12
    },
    averageResponseTime: 28, // minutes
    averageResolutionTime: 145, // minutes
    thisWeek: 12,
    thisMonth: 47
  };
}

async function getIncidentById(incidentId: string): Promise<any | null> {
  // Mock implementation - would query specific incident
  if (incidentId === 'inc_001') {
    return {
      incidentId: 'inc_001',
      severity: SecuritySeverity.HIGH,
      status: IncidentStatus.INVESTIGATING,
      title: 'Suspicious payment pattern detected',
      description: 'Multiple failed payment attempts from same IP',
      assignedTo: 'security-team',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - 30 * 60 * 1000)
    };
  }
  return null;
}

async function getIncidentsByIds(incidentIds: string[]): Promise<any[]> {
  // Mock implementation - would query multiple incidents
  return incidentIds.map(id => ({
    incidentId: id,
    severity: SecuritySeverity.MEDIUM,
    status: IncidentStatus.OPEN,
    assignedTo: null
  }));
}

async function checkIncidentModifyPermission(context: any, incident: any): Promise<boolean> {
  // Check if user can modify this specific incident
  if (context.isAdmin) return true;
  if (incident.assignedTo === context.userId) return true;
  if (context.userRole === 'security_lead') return true;
  return false;
}

async function updateIncident(incidentId: string, updateData: any, userId: string): Promise<any> {
  // Mock implementation - would update incident in database
  return {
    incidentId,
    status: updateData.status || IncidentStatus.INVESTIGATING,
    severity: SecuritySeverity.HIGH,
    assignedTo: updateData.assignedTo || 'security-team',
    updatedAt: new Date(),
    timeline: [
      {
        timestamp: new Date(),
        action: 'incident_updated',
        description: `Incident updated by ${userId}`,
        performedBy: userId
      }
    ]
  };
}

async function executeBulkIncidentAction(incidents: any[], action: string, parameters: any, userId: string): Promise<{ successful: string[], failed: { id: string, error: string }[] }> {
  const successful: string[] = [];
  const failed: { id: string, error: string }[] = [];

  for (const incident of incidents) {
    try {
      // Execute action on incident
      await updateIncident(incident.incidentId, parameters || {}, userId);
      successful.push(incident.incidentId);
    } catch (error) {
      failed.push({
        id: incident.incidentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return { successful, failed };
}

async function addIncidentComment(incidentId: string, comment: string, userId: string, internal: boolean): Promise<any> {
  // Mock implementation - would add comment to incident
  return {
    id: `comment_${Date.now()}`,
    text: comment,
    author: userId,
    createdAt: new Date(),
    internal
  };
}