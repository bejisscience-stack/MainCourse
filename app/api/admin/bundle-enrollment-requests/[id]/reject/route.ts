import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { sendBundleEnrollmentRejectedEmail } from '@/lib/email';

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

// POST: Reject a bundle enrollment request (admin only)
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
        { error: 'Bundle enrollment request ID is required' },
        { status: 400 }
      );
    }

    console.log('[Reject API] Attempting to reject bundle request:', id);

    // Use service role client for queries that need to bypass RLS (verification)
    const serviceSupabase = createServiceRoleClient();

    // Use authenticated client (not service role) so auth.uid() works in the database function
    // The reject_bundle_enrollment_request function may use auth.uid() to verify admin status
    const { error: rejectError } = await supabase.rpc('reject_bundle_enrollment_request', {
      request_id: id,
      admin_user_id: user.id,
    });

    if (rejectError) {
      console.error('[Reject API] Error rejecting bundle enrollment request:', {
        code: rejectError.code,
        message: rejectError.message,
        details: rejectError.details,
        hint: rejectError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to reject bundle enrollment request', 
          details: rejectError.message || 'Unknown error occurred',
          code: rejectError.code
        },
        { status: 500 }
      );
    }
    
    // Verify the update was successful by querying the request directly
    const { data: updatedRequest, error: verifyError } = await serviceSupabase
      .from('bundle_enrollment_requests')
      .select('id, status, updated_at, user_id, bundle_id, course_bundles(title)')
      .eq('id', id)
      .single();

    if (verifyError) {
      console.error('[Reject API] Error verifying bundle rejection:', verifyError);
    } else {
      console.log('[Reject API] Bundle rejection successful, verified status:', updatedRequest?.status, 'updated_at:', updatedRequest?.updated_at);

      // Send notification and email
      if (updatedRequest?.user_id) {
        const bundleTitle = (updatedRequest.course_bundles as { title?: string } | null)?.title || 'Unknown Bundle';

        // Create notification
        try {
          await serviceSupabase.rpc('create_notification', {
            p_user_id: updatedRequest.user_id,
            p_type: 'bundle_enrollment_rejected',
            p_title_en: 'Bundle Enrollment Request Update',
            p_title_ge: 'პაკეტში რეგისტრაციის მოთხოვნის განახლება',
            p_message_en: `Your enrollment request for bundle "${bundleTitle}" was not approved.`,
            p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა პაკეტზე "${bundleTitle}" არ დამტკიცდა.`,
            p_metadata: {
              bundle_id: updatedRequest.bundle_id,
              bundle_title: bundleTitle,
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
            .eq('id', updatedRequest.user_id)
            .single();

          if (userProfile?.email) {
            await sendBundleEnrollmentRejectedEmail(userProfile.email, bundleTitle);
            console.log('[Reject API] Email sent to:', userProfile.email);
          }
        } catch (emailError) {
          console.error('[Reject API] Error sending email:', emailError);
        }
      }
    }

    // Return success - the frontend will refresh the list
    return NextResponse.json({
      message: 'Bundle enrollment request rejected successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/bundle-enrollment-requests/[id]/reject:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}


