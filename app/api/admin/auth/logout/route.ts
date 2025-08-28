import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const cookieStore = cookies();
    
    // Get session token from cookie
    const sessionToken = cookieStore.get('admin-session')?.value;
    
    if (!sessionToken) {
      return NextResponse.json({
        error: 'No active session',
        message: 'No admin session found'
      }, { status: 401 });
    }

    // Get client IP and user agent for logging
    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Find and terminate the admin session
    const { data: session, error: sessionError } = await supabase
      .from('admin_sessions')
      .select('id, admin_id')
      .eq('session_token', sessionToken)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      // Clear cookie even if session not found
      cookieStore.delete('admin-session');
      
      return NextResponse.json({
        error: 'Invalid session',
        message: 'Session not found or already terminated'
      }, { status: 401 });
    }

    // Terminate the admin session
    await supabase
      .from('admin_sessions')
      .update({
        is_active: false,
        terminated_at: new Date().toISOString(),
        termination_reason: 'user_logout'
      })
      .eq('id', session.id);

    // Update admin user last activity
    await supabase
      .from('admin_users')
      .update({
        last_activity_at: new Date().toISOString()
      })
      .eq('id', session.admin_id);

    // Log the logout action
    await supabase
      .from('admin_audit_log')
      .insert([{
        admin_id: session.admin_id,
        session_id: session.id,
        action: 'admin_logout',
        action_category: 'authentication',
        ip_address: clientIP,
        user_agent: userAgent,
        success: true
      }]);

    // Sign out from Supabase auth
    const { error: signOutError } = await supabase.auth.signOut();
    
    if (signOutError) {
      console.error('Supabase sign out error:', signOutError);
      // Continue with logout even if Supabase sign out fails
    }

    // Clear the session cookie
    cookieStore.delete('admin-session');

    return NextResponse.json({
      success: true,
      message: 'Successfully logged out'
    });

  } catch (error) {
    console.error('Admin logout error:', error);
    
    // Clear cookie on any error to prevent stuck sessions
    const cookieStore = cookies();
    cookieStore.delete('admin-session');
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during logout'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // GET request for logout (for simple logout links)
  return POST(request);
}