import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { sendAdminNotificationEmail } from '@/lib/email';
import type { AdminNotificationPayload } from '@/types/notification';

export const dynamic = 'force-dynamic';

const EMAIL_BATCH_SIZE = 50;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

// Resolve user IDs based on target_type
async function resolveUserIds(
  serviceSupabase: any,
  target_type: string,
  target_role?: string,
  target_course_id?: string,
  target_user_ids?: string[]
): Promise<{ userIds: string[]; error?: string }> {
  switch (target_type) {
    case 'all': {
      const { data, error } = await serviceSupabase
        .from('profiles')
        .select('id');
      if (error) return { userIds: [], error: `Failed to fetch users: ${error.message}` };
      return { userIds: data?.map((p: any) => p.id) || [] };
    }

    case 'role': {
      if (!target_role) return { userIds: [], error: 'target_role is required when target_type is "role"' };
      const { data, error } = await serviceSupabase
        .rpc('get_user_ids_by_role', { p_role: target_role });
      if (error) return { userIds: [], error: `Failed to fetch users by role: ${error.message}` };
      return { userIds: data || [] };
    }

    case 'course': {
      if (!target_course_id) return { userIds: [], error: 'target_course_id is required when target_type is "course"' };
      const { data, error } = await serviceSupabase
        .rpc('get_enrolled_user_ids', { p_course_id: target_course_id });
      if (error) return { userIds: [], error: `Failed to fetch enrolled users: ${error.message}` };
      return { userIds: data || [] };
    }

    case 'specific': {
      if (!target_user_ids || target_user_ids.length === 0) return { userIds: [], error: 'target_user_ids is required when target_type is "specific"' };
      return { userIds: target_user_ids };
    }

    default:
      return { userIds: [], error: 'Invalid target_type' };
  }
}

// Resolve email addresses based on email_target
async function resolveEmails(
  serviceSupabase: any,
  email_target: string,
  target_type: string,
  target_role?: string,
  target_course_id?: string,
  target_user_ids?: string[],
  target_emails?: string[]
): Promise<{ emails: string[]; error?: string }> {
  const allEmails = new Set<string>();

  // Fetch profile emails (using same target_type logic)
  if (email_target === 'profiles' || email_target === 'both') {
    const { userIds, error } = await resolveUserIds(serviceSupabase, target_type, target_role, target_course_id, target_user_ids);
    if (error) return { emails: [], error };

    if (userIds.length > 0) {
      const { data: profiles, error: profileError } = await serviceSupabase
        .from('profiles')
        .select('email')
        .in('id', userIds);

      if (profileError) return { emails: [], error: `Failed to fetch profile emails: ${profileError.message}` };
      profiles?.forEach((p: any) => {
        if (p.email) allEmails.add(p.email.toLowerCase());
      });
    }
  }

  // Fetch coming_soon_emails
  if (email_target === 'coming_soon' || email_target === 'both') {
    const { data: comingSoon, error: csError } = await serviceSupabase
      .from('coming_soon_emails')
      .select('email');

    if (csError) return { emails: [], error: `Failed to fetch coming soon emails: ${csError.message}` };
    comingSoon?.forEach((row: any) => {
      if (row.email) allEmails.add(row.email.toLowerCase());
    });
  }

  // Use specific manually-entered emails
  if (email_target === 'specific') {
    if (!target_emails || target_emails.length === 0) {
      return { emails: [], error: 'target_emails is required when email_target is "specific"' };
    }
    for (const email of target_emails) {
      const trimmed = email.trim().toLowerCase();
      if (!emailRegex.test(trimmed)) {
        return { emails: [], error: `Invalid email address: ${email}` };
      }
      allEmails.add(trimmed);
    }
  }

  return { emails: Array.from(allEmails) };
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
    const { target_type, target_role, target_course_id, target_user_ids, title, message, channel = 'in_app', email_target, target_emails } = body;

    // Validate payload
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

    const sendInApp = channel === 'in_app' || channel === 'both';
    const sendEmail = channel === 'email' || channel === 'both';

    // Validate target_type is needed for in-app or profiles email
    if (sendInApp || (sendEmail && email_target === 'profiles') || (sendEmail && email_target === 'both')) {
      if (!target_type) {
        return NextResponse.json(
          { error: 'target_type is required' },
          { status: 400 }
        );
      }
    }

    // Validate email_target when sending emails
    if (sendEmail && !email_target) {
      return NextResponse.json(
        { error: 'email_target is required when channel includes email' },
        { status: 400 }
      );
    }

    console.log('[Admin Notifications API] Sending notifications:', {
      channel,
      target_type,
      target_role,
      target_course_id,
      email_target,
      target_user_ids_count: target_user_ids?.length,
      target_emails_count: target_emails?.length,
      admin_id: user.id,
    });

    let inAppCount = 0;
    let emailSent = 0;
    let emailFailed = 0;

    // ===== IN-APP NOTIFICATIONS =====
    if (sendInApp) {
      const { userIds, error: resolveError } = await resolveUserIds(
        serviceSupabase, target_type, target_role, target_course_id, target_user_ids
      );

      if (resolveError) {
        return NextResponse.json({ error: resolveError }, { status: 400 });
      }

      if (userIds.length === 0) {
        // Only fail if we're not also sending emails
        if (!sendEmail) {
          return NextResponse.json(
            { error: 'No users found for the specified target' },
            { status: 400 }
          );
        }
      } else {
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
          console.error('[Admin Notifications API] Error sending in-app notifications:', sendError);
          return NextResponse.json(
            { error: 'Failed to send in-app notifications', details: sendError.message },
            { status: 500 }
          );
        }

        inAppCount = count || userIds.length;
      }
    }

    // ===== EMAIL NOTIFICATIONS =====
    if (sendEmail) {
      const { emails, error: emailResolveError } = await resolveEmails(
        serviceSupabase, email_target!, target_type, target_role, target_course_id, target_user_ids, target_emails
      );

      if (emailResolveError) {
        return NextResponse.json({ error: emailResolveError }, { status: 400 });
      }

      if (emails.length === 0) {
        if (!sendInApp) {
          return NextResponse.json(
            { error: 'No email recipients found' },
            { status: 400 }
          );
        }
      } else {
        // Batch emails in chunks
        const chunks: string[][] = [];
        for (let i = 0; i < emails.length; i += EMAIL_BATCH_SIZE) {
          chunks.push(emails.slice(i, i + EMAIL_BATCH_SIZE));
        }

        for (const chunk of chunks) {
          try {
            await sendAdminNotificationEmail(chunk, title, message);
            emailSent += chunk.length;
          } catch (err) {
            emailFailed += chunk.length;
            console.error('[Admin Notifications API] Email batch failed:', err);
          }
        }
      }
    }

    console.log('[Admin Notifications API] Results:', { inAppCount, emailSent, emailFailed });

    return NextResponse.json({
      success: true,
      in_app_count: inAppCount,
      email_count: emailSent,
      email_failed_count: emailFailed,
      message: `Sent ${inAppCount} in-app notification(s), ${emailSent} email(s)${emailFailed > 0 ? `, ${emailFailed} email(s) failed` : ''}`,
    });
  } catch (error: any) {
    console.error('[Admin Notifications API] Unhandled exception:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
