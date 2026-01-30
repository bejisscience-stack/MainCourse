import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import type { AdminNotificationPayload } from '@/types/notification';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .rpc('check_is_admin', { user_id: userId });

    if (error) {
      console.error('[Admin Notifications API] Error checking admin status:', error);
      return false;
    }

    return data === true;
  } catch (err) {
    console.error('[Admin Notifications API] Exception checking admin:', err);
    return false;
  }
}

// POST: Send targeted notifications (admin only)
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: userError?.message },
        { status: 401 }
      );
    }

    const serviceSupabase = createServiceRoleClient();

    // Check if user is admin
    const isAdmin = await checkAdmin(serviceSupabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied. Admin only.' },
        { status: 403 }
      );
    }

    const body: AdminNotificationPayload = await request.json();
    const { target_type, target_role, target_course_id, target_user_ids, title, message } = body;

    // Validate payload
    if (!target_type) {
      return NextResponse.json(
        { error: 'target_type is required' },
        { status: 400 }
      );
    }

    if (!title?.en || !title?.ge) {
      return NextResponse.json(
        { error: 'Title in both English and Georgian is required' },
        { status: 400 }
      );
    }

    if (!message?.en || !message?.ge) {
      return NextResponse.json(
        { error: 'Message in both English and Georgian is required' },
        { status: 400 }
      );
    }

    console.log('[Admin Notifications API] Sending notifications:', {
      target_type,
      target_role,
      target_course_id,
      target_user_ids_count: target_user_ids?.length,
      admin_id: user.id,
    });

    let userIds: string[] = [];

    switch (target_type) {
      case 'all':
        // Get all user IDs
        const { data: allProfiles, error: allError } = await serviceSupabase
          .from('profiles')
          .select('id');

        if (allError) {
          console.error('[Admin Notifications API] Error fetching all users:', allError);
          return NextResponse.json(
            { error: 'Failed to fetch users', details: allError.message },
            { status: 500 }
          );
        }

        userIds = allProfiles?.map(p => p.id) || [];
        break;

      case 'role':
        if (!target_role) {
          return NextResponse.json(
            { error: 'target_role is required when target_type is "role"' },
            { status: 400 }
          );
        }

        // Get user IDs by role
        const { data: roleUserIds, error: roleError } = await serviceSupabase
          .rpc('get_user_ids_by_role', { p_role: target_role });

        if (roleError) {
          console.error('[Admin Notifications API] Error fetching users by role:', roleError);
          return NextResponse.json(
            { error: 'Failed to fetch users by role', details: roleError.message },
            { status: 500 }
          );
        }

        userIds = roleUserIds || [];
        break;

      case 'course':
        if (!target_course_id) {
          return NextResponse.json(
            { error: 'target_course_id is required when target_type is "course"' },
            { status: 400 }
          );
        }

        // Get enrolled user IDs
        const { data: courseUserIds, error: courseError } = await serviceSupabase
          .rpc('get_enrolled_user_ids', { p_course_id: target_course_id });

        if (courseError) {
          console.error('[Admin Notifications API] Error fetching enrolled users:', courseError);
          return NextResponse.json(
            { error: 'Failed to fetch enrolled users', details: courseError.message },
            { status: 500 }
          );
        }

        userIds = courseUserIds || [];
        break;

      case 'specific':
        if (!target_user_ids || target_user_ids.length === 0) {
          return NextResponse.json(
            { error: 'target_user_ids is required when target_type is "specific"' },
            { status: 400 }
          );
        }

        userIds = target_user_ids;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid target_type' },
          { status: 400 }
        );
    }

    if (userIds.length === 0) {
      return NextResponse.json(
        { error: 'No users found for the specified target' },
        { status: 400 }
      );
    }

    // Send bulk notifications using RPC function
    const { data: count, error: sendError } = await serviceSupabase
      .rpc('send_bulk_notifications', {
        p_user_ids: userIds,
        p_type: 'admin_message',
        p_title_en: title.en,
        p_title_ge: title.ge,
        p_message_en: message.en,
        p_message_ge: message.ge,
        p_metadata: {},
        p_created_by: user.id,
      });

    if (sendError) {
      console.error('[Admin Notifications API] Error sending notifications:', sendError);
      return NextResponse.json(
        { error: 'Failed to send notifications', details: sendError.message },
        { status: 500 }
      );
    }

    console.log('[Admin Notifications API] Successfully sent', count, 'notifications');

    return NextResponse.json({
      success: true,
      count: count || userIds.length,
      message: `Successfully sent ${count || userIds.length} notifications`,
    });
  } catch (error: any) {
    console.error('[Admin Notifications API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
