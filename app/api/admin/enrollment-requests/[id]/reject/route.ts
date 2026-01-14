import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { sendEnrollmentRejectedEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// Helper function to check if user is admin using RPC function (bypasses RLS)
async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('check_is_admin', { user_id: userId });

  if (error) {
    console.error('Error checking admin status:', error);
    return false;
  }

  return data === true;
}

// POST: Reject an enrollment request (admin only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const supabase = createServerSupabaseClient(token);

    // Check if user is admin
    const isAdmin = await checkAdmin(supabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // Await params (Next.js 15 requirement)
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Enrollment request ID is required' },
        { status: 400 }
      );
    }

    // Fetch the enrollment request details before rejecting
    const serviceSupabase = createServiceRoleClient();
    const { data: enrollmentRequest } = await serviceSupabase
      .from('enrollment_requests')
      .select('user_id, course_id, courses(title)')
      .eq('id', id)
      .single();

    // Use the database function to reject (ensures consistency and bypasses RLS)
    // The RPC function handles all the logic including checking if request exists and is pending
    const { data: rejectResult, error: rejectError } = await supabase.rpc('reject_enrollment_request', {
      request_id: id,
    });

    if (rejectError) {
      console.error('Error rejecting enrollment request:', rejectError);
      return NextResponse.json(
        {
          error: 'Failed to reject enrollment request',
          details: rejectError.message || 'Unknown error occurred',
          code: rejectError.code
        },
        { status: 500 }
      );
    }

    console.log('[Reject API] Rejection successful');

    // Send email notification
    if (enrollmentRequest?.user_id) {
      const courseTitle = (enrollmentRequest.courses as { title?: string } | null)?.title || 'Unknown Course';

      // Create notification
      try {
        await serviceSupabase.rpc('create_notification', {
          p_user_id: enrollmentRequest.user_id,
          p_type: 'enrollment_rejected',
          p_title_en: 'Enrollment Request Update',
          p_title_ge: 'რეგისტრაციის მოთხოვნის განახლება',
          p_message_en: `Your enrollment request for "${courseTitle}" was not approved.`,
          p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა კურსზე "${courseTitle}" არ დამტკიცდა.`,
          p_metadata: {
            course_id: enrollmentRequest.course_id,
            course_title: courseTitle,
            request_id: id,
          },
          p_created_by: user.id,
        });
      } catch (notifError) {
        console.error('[Reject API] Error creating notification:', notifError);
      }

      // Send email
      try {
        const { data: userProfile } = await serviceSupabase
          .from('profiles')
          .select('email')
          .eq('id', enrollmentRequest.user_id)
          .single();

        if (userProfile?.email) {
          await sendEnrollmentRejectedEmail(userProfile.email, courseTitle);
          console.log('[Reject API] Email sent to:', userProfile.email);
        }
      } catch (emailError) {
        console.error('[Reject API] Error sending email:', emailError);
      }
    }

    // Return success - the frontend will refresh the list
    return NextResponse.json({
      message: 'Enrollment request rejected successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/enrollment-requests/[id]/reject:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

