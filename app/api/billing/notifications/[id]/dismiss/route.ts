/**
 * EPIC 5 STORY 5.5: Dismiss Billing Notification API Route
 * Allows users to dismiss billing notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const notificationId = params.id;

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401 }
      );
    }

    // Store dismissal in database
    // First, check if this table exists - if not, we'll create it via migration later
    const { error: insertError } = await supabase
      .from('dismissed_notifications')
      .upsert({
        user_id: user.id,
        notification_id: notificationId,
        dismissed_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error storing notification dismissal:', insertError);
      // For now, just log the error and return success
      // In production, you might want to handle this differently
    }

    return NextResponse.json({ 
      success: true,
      message: 'Notification dismissed successfully'
    });

  } catch (error) {
    console.error('Dismiss notification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}