import { NextRequest, NextResponse } from 'next/server';

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  url: string;
  sessionId: string;
  acknowledged: boolean;
  resolvedAt?: number;
  description: string;
}

// In-memory storage for demo (use database in production)
const alertsStorage = new Map<string, Alert>();
const alertHistory: Alert[] = [];

function shouldSendNotification(alert: Alert): boolean {
  // Check if we should send external notifications based on severity
  return alert.severity === 'critical' || alert.severity === 'high';
}

async function sendExternalNotifications(alert: Alert): Promise<void> {
  try {
    // Example: Send to Slack webhook
    if (process.env.SLACK_WEBHOOK_URL && shouldSendNotification(alert)) {
      const slackPayload = {
        text: `🚨 Performance Alert: ${alert.ruleName}`,
        attachments: [
          {
            color: alert.severity === 'critical' ? 'danger' : 'warning',
            fields: [
              { title: 'Metric', value: alert.metric, short: true },
              { title: 'Value', value: alert.value.toString(), short: true },
              { title: 'Threshold', value: alert.threshold.toString(), short: true },
              { title: 'Severity', value: alert.severity, short: true },
              { title: 'URL', value: alert.url, short: false },
              { title: 'Description', value: alert.description, short: false }
            ],
            ts: Math.floor(alert.timestamp / 1000)
          }
        ]
      };

      await fetch(process.env.SLACK_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload)
      });
    }

    // Example: Send email for critical alerts
    if (process.env.ALERT_EMAIL_ENDPOINT && alert.severity === 'critical') {
      const emailPayload = {
        to: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
        subject: `🚨 Critical Performance Alert: ${alert.ruleName}`,
        html: `
          <h2>Performance Alert</h2>
          <table border="1" cellpadding="10">
            <tr><td><strong>Alert Rule</strong></td><td>${alert.ruleName}</td></tr>
            <tr><td><strong>Metric</strong></td><td>${alert.metric}</td></tr>
            <tr><td><strong>Value</strong></td><td>${alert.value}</td></tr>
            <tr><td><strong>Threshold</strong></td><td>${alert.threshold}</td></tr>
            <tr><td><strong>Severity</strong></td><td>${alert.severity.toUpperCase()}</td></tr>
            <tr><td><strong>URL</strong></td><td><a href="${alert.url}">${alert.url}</a></td></tr>
            <tr><td><strong>Session ID</strong></td><td>${alert.sessionId}</td></tr>
            <tr><td><strong>Timestamp</strong></td><td>${new Date(alert.timestamp).toISOString()}</td></tr>
          </table>
          <p><strong>Description:</strong> ${alert.description}</p>
          <p>This alert was generated automatically by the performance monitoring system.</p>
        `
      };

      await fetch(process.env.ALERT_EMAIL_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emailPayload)
      });
    }

    // Log successful notification
    console.log(`📧 External notifications sent for alert: ${alert.id}`);

  } catch (error) {
    console.error('Failed to send external notifications:', error);
  }
}

function logAlert(alert: Alert): void {
  const severityEmojis = {
    low: '🟡',
    medium: '🟠',
    high: '🔴',
    critical: '🚨'
  };

  const logLevel = alert.severity === 'critical' ? 'error' : 
                   alert.severity === 'high' ? 'warn' : 'log';

  console[logLevel](
    `${severityEmojis[alert.severity]} Performance Alert Received:`,
    {
      id: alert.id,
      rule: alert.ruleName,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity,
      url: alert.url,
      sessionId: alert.sessionId,
      timestamp: new Date(alert.timestamp).toISOString()
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate alert structure
    if (!body.id || !body.ruleId || !body.metric || typeof body.value !== 'number') {
      return NextResponse.json(
        { error: 'Invalid alert payload' },
        { status: 400 }
      );
    }

    const alert: Alert = {
      id: body.id,
      ruleId: body.ruleId,
      ruleName: body.ruleName || 'Unknown Rule',
      metric: body.metric,
      value: body.value,
      threshold: body.threshold || 0,
      severity: body.severity || 'medium',
      timestamp: body.timestamp || Date.now(),
      url: body.url || 'unknown',
      sessionId: body.sessionId || 'unknown',
      acknowledged: false,
      description: body.description || 'Performance threshold exceeded'
    };

    // Store alert
    alertsStorage.set(alert.id, alert);
    alertHistory.push(alert);

    // Log alert
    logAlert(alert);

    // Send external notifications for critical/high severity alerts
    if (shouldSendNotification(alert)) {
      // Don't await external notifications to avoid blocking the response
      sendExternalNotifications(alert).catch(error => {
        console.error('External notification failed:', error);
      });
    }

    // Limit history size to prevent memory issues
    if (alertHistory.length > 10000) {
      alertHistory.splice(0, alertHistory.length - 10000);
    }

    return NextResponse.json({
      success: true,
      alertId: alert.id,
      acknowledged: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Alerts API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const severity = searchParams.get('severity');
    const acknowledged = searchParams.get('acknowledged');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get all alerts from storage and history
    let allAlerts = Array.from(alertsStorage.values()).concat(alertHistory);

    // Remove duplicates (prefer storage version over history)
    const uniqueAlerts = Array.from(
      new Map(allAlerts.map(alert => [alert.id, alert])).values()
    );

    // Apply filters
    let filteredAlerts = uniqueAlerts;

    if (severity) {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    if (acknowledged !== null) {
      const isAcknowledged = acknowledged === 'true';
      filteredAlerts = filteredAlerts.filter(alert => alert.acknowledged === isAcknowledged);
    }

    // Sort by timestamp (most recent first)
    filteredAlerts.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const paginatedAlerts = filteredAlerts.slice(offset, offset + limit);

    // Calculate summary statistics
    const summary = {
      total: filteredAlerts.length,
      active: filteredAlerts.filter(a => !a.acknowledged).length,
      acknowledged: filteredAlerts.filter(a => a.acknowledged).length,
      bySeverity: {
        critical: filteredAlerts.filter(a => a.severity === 'critical').length,
        high: filteredAlerts.filter(a => a.severity === 'high').length,
        medium: filteredAlerts.filter(a => a.severity === 'medium').length,
        low: filteredAlerts.filter(a => a.severity === 'low').length
      },
      lastHour: filteredAlerts.filter(a => Date.now() - a.timestamp < 3600000).length,
      last24Hours: filteredAlerts.filter(a => Date.now() - a.timestamp < 86400000).length
    };

    return NextResponse.json({
      success: true,
      alerts: paginatedAlerts,
      summary,
      pagination: {
        limit,
        offset,
        total: filteredAlerts.length,
        hasMore: offset + limit < filteredAlerts.length
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Alerts API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('id');
    
    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const alert = alertsStorage.get(alertId);
    
    if (!alert) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Update alert properties
    if (typeof body.acknowledged === 'boolean') {
      alert.acknowledged = body.acknowledged;
      if (body.acknowledged && !alert.resolvedAt) {
        alert.resolvedAt = Date.now();
      }
    }

    alertsStorage.set(alertId, alert);

    // Log acknowledgment
    console.log(`✅ Alert acknowledged: ${alertId} - ${alert.ruleName}`);

    return NextResponse.json({
      success: true,
      alert,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Alerts API PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const alertId = searchParams.get('id');
    const clearAll = searchParams.get('clearAll') === 'true';
    
    if (clearAll) {
      // Clear all acknowledged alerts
      const deletedCount = alertsStorage.size;
      alertsStorage.clear();
      alertHistory.length = 0;
      
      console.log(`🗑️  Cleared ${deletedCount} alerts`);
      
      return NextResponse.json({
        success: true,
        deletedCount,
        timestamp: Date.now()
      });
    }

    if (!alertId) {
      return NextResponse.json(
        { error: 'Alert ID is required' },
        { status: 400 }
      );
    }

    const deleted = alertsStorage.delete(alertId);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'Alert not found' },
        { status: 404 }
      );
    }

    // Also remove from history
    const historyIndex = alertHistory.findIndex(a => a.id === alertId);
    if (historyIndex !== -1) {
      alertHistory.splice(historyIndex, 1);
    }

    console.log(`🗑️  Alert deleted: ${alertId}`);

    return NextResponse.json({
      success: true,
      deletedId: alertId,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('Alerts API DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}