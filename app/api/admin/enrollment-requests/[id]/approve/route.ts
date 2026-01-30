import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { sendEnrollmentApprovedEmail } from '@/lib/email';

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

// POST: Approve an enrollment request (admin only)
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

    console.log('[Approve API] Attempting to approve request:', id);
    
    // Use the authenticated user's client (not service role) so that auth.uid() works in the database function
    // The approve_enrollment_request function uses auth.uid() to verify admin status via check_is_admin
    // Note: approve_enrollment_request returns void, so data will be null on success
    const { error: approveError } = await supabase.rpc('approve_enrollment_request', {
      request_id: id,
    });

    if (approveError) {
      console.error('[Approve API] Error approving enrollment request:', {
        code: approveError.code,
        message: approveError.message,
        details: approveError.details,
        hint: approveError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to approve enrollment request', 
          details: approveError.message || 'Unknown error occurred',
          code: approveError.code
        },
        { status: 500 }
      );
    }
    
    // Verify the update was successful by querying the request directly
    // Use service role client for verification to bypass any RLS issues
    // Pass user token as fallback so RLS admin policies work if service role key is missing
    const serviceSupabase = createServiceRoleClient(token);
    const { data: updatedRequest, error: verifyError } = await serviceSupabase
      .from('enrollment_requests')
      .select('id, status, updated_at, user_id, course_id, courses(title)')
      .eq('id', id)
      .single();

    if (verifyError) {
      console.error('[Approve API] Error verifying approval:', verifyError);
    } else {
      console.log('[Approve API] Approval successful, verified status:', updatedRequest?.status, 'updated_at:', updatedRequest?.updated_at);

      // Create notification for the user
      if (updatedRequest?.user_id) {
        const courseTitle = (updatedRequest.courses as { title?: string } | null)?.title || 'Unknown Course';

        try {
          const { error: notificationError } = await serviceSupabase
            .rpc('create_notification', {
              p_user_id: updatedRequest.user_id,
              p_type: 'enrollment_approved',
              p_title_en: 'Enrollment Approved',
              p_title_ge: 'რეგისტრაცია დამტკიცებულია',
              p_message_en: `Your enrollment request for "${courseTitle}" has been approved. You can now access the course.`,
              p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა კურსზე "${courseTitle}" დამტკიცებულია. ახლა შეგიძლიათ კურსზე წვდომა.`,
              p_metadata: {
                course_id: updatedRequest.course_id,
                course_title: courseTitle,
                request_id: id,
              },
              p_created_by: user.id,
            });

          if (notificationError) {
            console.error('[Approve API] Error creating notification:', notificationError);
          } else {
            console.log('[Approve API] Notification created for user:', updatedRequest.user_id);
          }
        } catch (notifError) {
          console.error('[Approve API] Exception creating notification:', notifError);
        }

        // Send email notification
        try {
          const { data: userProfile } = await serviceSupabase
            .from('profiles')
            .select('email')
            .eq('id', updatedRequest.user_id)
            .single();

          if (userProfile?.email) {
            await sendEnrollmentApprovedEmail(userProfile.email, courseTitle);
            console.log('[Approve API] Email sent to:', userProfile.email);
          }
        } catch (emailError) {
          // Don't fail the request if email fails
          console.error('[Approve API] Error sending email:', emailError);
        }
      }
    }

    // Return success - the frontend will refresh the list automatically
    return NextResponse.json({
      message: 'Enrollment request approved successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/enrollment-requests/[id]/approve:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}

