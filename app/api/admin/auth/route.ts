/**
 * Admin Authentication API Route
 * Secure server-side authentication operations using service role
 * Fixes Critical Security Issue: Service role key exposure
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/auth/server'
import { hashPassword, verifyPassword, validatePasswordStrength, createSecurityEvent, getClientIP } from '@/lib/security/server'
import { sanitizeInput } from '@/lib/security'
import { logAuthEvent } from '@/lib/auth/server'

/**
 * POST /api/admin/auth - Admin authentication operations
 * Handles password hashing, user management, and role assignments
 * Requires admin privileges
 */
export async function POST(request: NextRequest) {
  try {
    const { action, ...data } = await request.json()
    const ip = getClientIP(request)
    
    // Validate request format
    if (!action || typeof action !== 'string') {
      return NextResponse.json(
        { error: 'Invalid action parameter' },
        { status: 400 }
      )
    }
    
    // Create service role client (server-side only)
    const supabase = createServiceRoleClient()
    
    switch (action) {
      case 'create_user_with_password': {
        const { email, password, metadata = {}, role = 'user' } = data
        
        // Validate inputs
        if (!email || !password) {
          return NextResponse.json(
            { error: 'Email and password are required' },
            { status: 400 }
          )
        }
        
        const sanitizedEmail = sanitizeInput(email)
        
        // Validate password strength
        const passwordValidation = validatePasswordStrength(password)
        if (!passwordValidation.isValid) {
          await logAuthEvent('user_registration_failed', null, false, {
            reason: 'weak_password',
            errors: passwordValidation.errors,
            ip_address: ip,
            user_agent: request.headers.get('user-agent')
          })
          
          return NextResponse.json(
            { 
              error: 'Password does not meet security requirements',
              details: passwordValidation.errors
            },
            { status: 400 }
          )
        }
        
        // Hash password with Argon2id
        const hashedPassword = await hashPassword(password)
        
        // Create user with service role client
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: sanitizedEmail,
          password: hashedPassword,
          user_metadata: {
            ...metadata,
            password_hashed_with: 'argon2id',
            created_by_admin: true,
            created_at: new Date().toISOString()
          },
          email_confirm: true
        })
        
        if (authError) {
          await logAuthEvent('user_registration_failed', null, false, {
            reason: 'supabase_error',
            error: authError.message,
            ip_address: ip,
            user_agent: request.headers.get('user-agent')
          })
          
          return NextResponse.json(
            { error: authError.message },
            { status: 400 }
          )
        }
        
        // Create user profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.user.id,
            email: sanitizedEmail,
            email_verified: true,
            account_status: 'active',
            security_settings: {
              password_last_changed: new Date().toISOString(),
              mfa_enabled: false,
              login_attempts: 0
            },
            created_at: new Date().toISOString()
          })
        
        if (profileError) {
          // Rollback user creation
          await supabase.auth.admin.deleteUser(authUser.user.id)
          
          return NextResponse.json(
            { error: 'Failed to create user profile' },
            { status: 500 }
          )
        }
        
        // Assign role
        if (role !== 'user') {
          const { data: roleData } = await supabase
            .from('roles')
            .select('id')
            .eq('name', role)
            .single()
          
          if (roleData) {
            await supabase
              .from('user_roles')
              .insert({
                user_id: authUser.user.id,
                role_id: roleData.id,
                assigned_by: 'admin',
                is_active: true
              })
          }
        }
        
        // Log successful user creation
        await logAuthEvent('user_registration', authUser.user.id, true, {
          method: 'admin_creation',
          role: role,
          ip_address: ip,
          user_agent: request.headers.get('user-agent')
        })
        
        return NextResponse.json({
          success: true,
          user: {
            id: authUser.user.id,
            email: authUser.user.email,
            role: role,
            created_at: authUser.user.created_at
          }
        })
      }
      
      case 'update_user_password': {
        const { userId, newPassword, requirePasswordChange = false } = data
        
        if (!userId || !newPassword) {
          return NextResponse.json(
            { error: 'User ID and new password are required' },
            { status: 400 }
          )
        }
        
        // Validate password strength
        const passwordValidation = validatePasswordStrength(newPassword)
        if (!passwordValidation.isValid) {
          return NextResponse.json(
            { 
              error: 'Password does not meet security requirements',
              details: passwordValidation.errors
            },
            { status: 400 }
          )
        }
        
        // Hash new password
        const hashedPassword = await hashPassword(newPassword)
        
        // Update user password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userId,
          { 
            password: hashedPassword,
            user_metadata: {
              password_hashed_with: 'argon2id',
              password_changed_by_admin: true,
              password_changed_at: new Date().toISOString(),
              require_password_change: requirePasswordChange
            }
          }
        )
        
        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 400 }
          )
        }
        
        // Update profile security settings
        await supabase
          .from('profiles')
          .update({
            security_settings: {
              password_last_changed: new Date().toISOString(),
              login_attempts: 0,
              account_locked_until: null
            }
          })
          .eq('id', userId)
        
        // Log password change
        await logAuthEvent('password_changed', userId, true, {
          method: 'admin_update',
          require_change: requirePasswordChange,
          ip_address: ip,
          user_agent: request.headers.get('user-agent')
        })
        
        return NextResponse.json({ success: true })
      }
      
      case 'assign_role': {
        const { userId, roleName } = data
        
        if (!userId || !roleName) {
          return NextResponse.json(
            { error: 'User ID and role name are required' },
            { status: 400 }
          )
        }
        
        // Get role ID
        const { data: roleData, error: roleError } = await supabase
          .from('roles')
          .select('id')
          .eq('name', roleName)
          .single()
        
        if (roleError || !roleData) {
          return NextResponse.json(
            { error: 'Invalid role name' },
            { status: 400 }
          )
        }
        
        // Check if user already has this role
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role_id', roleData.id)
          .eq('is_active', true)
          .single()
        
        if (existingRole) {
          return NextResponse.json(
            { error: 'User already has this role' },
            { status: 400 }
          )
        }
        
        // Assign role
        const { error: assignError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role_id: roleData.id,
            assigned_by: 'admin',
            is_active: true
          })
        
        if (assignError) {
          return NextResponse.json(
            { error: 'Failed to assign role' },
            { status: 500 }
          )
        }
        
        // Log role assignment
        await logAuthEvent('role_assigned', userId, true, {
          role: roleName,
          assigned_by: 'admin',
          ip_address: ip,
          user_agent: request.headers.get('user-agent')
        })
        
        return NextResponse.json({ success: true })
      }
      
      case 'revoke_role': {
        const { userId, roleName } = data
        
        if (!userId || !roleName) {
          return NextResponse.json(
            { error: 'User ID and role name are required' },
            { status: 400 }
          )
        }
        
        // Get role ID and revoke
        const { data: roleData } = await supabase
          .from('roles')
          .select('id')
          .eq('name', roleName)
          .single()
        
        if (!roleData) {
          return NextResponse.json(
            { error: 'Invalid role name' },
            { status: 400 }
          )
        }
        
        const { error: revokeError } = await supabase
          .from('user_roles')
          .update({ 
            is_active: false,
            revoked_at: new Date().toISOString(),
            revoked_by: 'admin'
          })
          .eq('user_id', userId)
          .eq('role_id', roleData.id)
          .eq('is_active', true)
        
        if (revokeError) {
          return NextResponse.json(
            { error: 'Failed to revoke role' },
            { status: 500 }
          )
        }
        
        // Log role revocation
        await logAuthEvent('role_revoked', userId, true, {
          role: roleName,
          revoked_by: 'admin',
          ip_address: ip,
          user_agent: request.headers.get('user-agent')
        })
        
        return NextResponse.json({ success: true })
      }
      
      case 'force_password_reset': {
        const { userId } = data
        
        if (!userId) {
          return NextResponse.json(
            { error: 'User ID is required' },
            { status: 400 }
          )
        }
        
        // Update user to require password change
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          userId,
          {
            user_metadata: {
              require_password_change: true,
              password_reset_required_by: 'admin',
              password_reset_required_at: new Date().toISOString()
            }
          }
        )
        
        if (updateError) {
          return NextResponse.json(
            { error: updateError.message },
            { status: 400 }
          )
        }
        
        // Log password reset requirement
        await logAuthEvent('password_reset_required', userId, true, {
          required_by: 'admin',
          ip_address: ip,
          user_agent: request.headers.get('user-agent')
        })
        
        return NextResponse.json({ success: true })
      }
      
      default: {
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        )
      }
    }
    
  } catch (error) {
    console.error('Admin auth API error:', error)
    
    // Log security event for unexpected errors
    const securityEvent = createSecurityEvent(
      'suspicious_activity',
      'medium',
      request,
      { error: error instanceof Error ? error.message : 'Unknown error' }
    )
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Only allow POST requests
 */
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  )
}