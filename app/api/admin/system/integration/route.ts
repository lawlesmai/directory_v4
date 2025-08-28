import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth, AdminPermissionChecker, logAdminAction } from '@/lib/auth/admin-middleware';
import { 
  migrateAdminUsers, 
  syncPermissions, 
  validateSystemIntegrity 
} from '@/lib/auth/admin-integration';

// GET /api/admin/system/integration - Get integration status and health
export const GET = requireAdminAuth(async (request, context) => {
  // Check permissions - only super admins can view system integration status
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasAdminLevel('super_admin')) {
    return NextResponse.json({
      error: 'Only super admins can view system integration status'
    }, { status: 403 });
  }

  try {
    // Validate system integrity
    const integrity = await validateSystemIntegrity();
    
    // Log the access
    await logAdminAction(context, 'system_integration_status_viewed', 'system_config', {
      success: true,
      newValues: {
        integrityCheck: {
          success: integrity.success,
          issuesCount: integrity.issues.length,
          stats: integrity.stats
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        integrity,
        lastChecked: new Date().toISOString(),
        systemHealth: integrity.success ? 'healthy' : 'issues_detected'
      }
    });

  } catch (error) {
    console.error('Integration status error:', error);
    
    await logAdminAction(context, 'system_integration_status_failed', 'system_config', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      error: 'Failed to retrieve integration status'
    }, { status: 500 });
  }
}, {
  requiredAdminLevel: 'super_admin',
  requireFreshAuth: true,
  maxSessionAge: 30
});

// POST /api/admin/system/integration - Perform integration operations
export const POST = requireAdminAuth(async (request, context) => {
  // Check permissions - only super admins can perform system integration operations
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasAdminLevel('super_admin')) {
    return NextResponse.json({
      error: 'Only super admins can perform system integration operations'
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { operation } = body;

    let result: any;
    let operationName: string;

    switch (operation) {
      case 'migrate_admin_users':
        operationName = 'Admin User Migration';
        result = await migrateAdminUsers();
        break;

      case 'sync_permissions':
        operationName = 'Permission Synchronization';
        result = await syncPermissions();
        break;

      case 'validate_integrity':
        operationName = 'System Integrity Validation';
        result = await validateSystemIntegrity();
        break;

      case 'full_sync':
        operationName = 'Full System Synchronization';
        
        // Perform all operations in sequence
        const migrationResult = await migrateAdminUsers();
        const syncResult = await syncPermissions();
        const integrityResult = await validateSystemIntegrity();
        
        result = {
          migration: migrationResult,
          sync: syncResult,
          integrity: integrityResult,
          success: migrationResult.success && syncResult.success && integrityResult.success,
          summary: {
            totalMigrated: migrationResult.migrated,
            totalSynced: syncResult.synced,
            totalErrors: migrationResult.errors.length + syncResult.errors.length,
            integrityIssues: integrityResult.issues.length
          }
        };
        break;

      default:
        return NextResponse.json({
          error: 'Invalid operation',
          validOperations: ['migrate_admin_users', 'sync_permissions', 'validate_integrity', 'full_sync']
        }, { status: 400 });
    }

    // Log the operation
    await logAdminAction(context, `system_integration_${operation}`, 'system_config', {
      success: result.success,
      newValues: {
        operation,
        operationName,
        result: {
          success: result.success,
          migrated: result.migrated || result.summary?.totalMigrated || 0,
          synced: result.synced || result.summary?.totalSynced || 0,
          errors: result.errors || [],
          issues: result.issues || []
        }
      },
      errorMessage: result.success ? undefined : `${operationName} failed`
    });

    const responseData = {
      success: result.success,
      operation,
      operationName,
      result,
      completedAt: new Date().toISOString()
    };

    return NextResponse.json(responseData, {
      status: result.success ? 200 : 207 // 207 Multi-Status for partial success
    });

  } catch (error) {
    console.error('Integration operation error:', error);
    
    await logAdminAction(context, 'system_integration_operation_failed', 'system_config', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      error: 'Integration operation failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}, {
  requiredAdminLevel: 'super_admin',
  requireFreshAuth: true,
  maxSessionAge: 15 // Very fresh auth required for system operations
});

// PUT /api/admin/system/integration - Update integration settings
export const PUT = requireAdminAuth(async (request, context) => {
  // Check permissions
  const permissions = new AdminPermissionChecker(context);
  if (!permissions.hasAdminLevel('super_admin')) {
    return NextResponse.json({
      error: 'Only super admins can update integration settings'
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { 
      autoMigration, 
      autoSync, 
      integrityCheckInterval,
      notificationThreshold 
    } = body;

    // In a real implementation, these would be stored in a system configuration table
    const integrationSettings = {
      autoMigration: autoMigration || false,
      autoSync: autoSync || false,
      integrityCheckInterval: integrityCheckInterval || 24, // hours
      notificationThreshold: notificationThreshold || 'high',
      updatedAt: new Date().toISOString(),
      updatedBy: context.user!.id
    };

    // Log the settings update
    await logAdminAction(context, 'system_integration_settings_updated', 'system_config', {
      success: true,
      newValues: integrationSettings
    });

    return NextResponse.json({
      success: true,
      settings: integrationSettings,
      message: 'Integration settings updated successfully'
    });

  } catch (error) {
    console.error('Integration settings update error:', error);
    
    await logAdminAction(context, 'system_integration_settings_failed', 'system_config', {
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });

    return NextResponse.json({
      error: 'Failed to update integration settings'
    }, { status: 500 });
  }
}, {
  requiredAdminLevel: 'super_admin',
  requireFreshAuth: true,
  maxSessionAge: 30
});