import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

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

// POST: Approve a bundle enrollment request (admin only)
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

    console.log('[Approve API] Attempting to approve bundle request:', id);
    
    // Use service role client to ensure we bypass RLS and get immediate updates
    const serviceSupabase = createServiceRoleClient();
    
    // Use the database function to approve (ensures consistency and bypasses RLS)
    // Pass admin user ID as parameter since we're using service role client
    const { error: approveError } = await serviceSupabase.rpc('approve_bundle_enrollment_request', {
      request_id: id,
      admin_user_id: user.id,
    });

    if (approveError) {
      console.error('[Approve API] Error approving bundle enrollment request:', {
        code: approveError.code,
        message: approveError.message,
        details: approveError.details,
        hint: approveError.hint
      });
      return NextResponse.json(
        { 
          error: 'Failed to approve bundle enrollment request', 
          details: approveError.message || 'Unknown error occurred',
          code: approveError.code
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
      console.error('[Approve API] Error verifying bundle approval:', verifyError);
    } else {
      console.log('[Approve API] Bundle approval successful, verified status:', updatedRequest?.status, 'updated_at:', updatedRequest?.updated_at);

      // Create notification for the user
      if (updatedRequest?.user_id) {
        const bundleTitle = (updatedRequest.course_bundles as { title?: string } | null)?.title || 'Unknown Bundle';

        try {
          const { error: notificationError } = await serviceSupabase
            .rpc('create_notification', {
              p_user_id: updatedRequest.user_id,
              p_type: 'bundle_enrollment_approved',
              p_title_en: 'Bundle Enrollment Approved',
              p_title_ge: 'პაკეტში რეგისტრაცია დამტკიცებულია',
              p_message_en: `Your enrollment request for bundle "${bundleTitle}" has been approved. You can now access all courses in the bundle.`,
              p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა პაკეტზე "${bundleTitle}" დამტკიცებულია. ახლა შეგიძლიათ პაკეტის ყველა კურსზე წვდომა.`,
              p_metadata: {
                bundle_id: updatedRequest.bundle_id,
                bundle_title: bundleTitle,
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
      }
    }

    // Return success - the frontend will refresh the list automatically
    return NextResponse.json({
      message: 'Bundle enrollment request approved successfully',
      success: true
    });
  } catch (error: any) {
    console.error('Error in POST /api/admin/bundle-enrollment-requests/[id]/approve:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error.message || 'An unexpected error occurred'
      },
      { status: 500 }
    );
  }
}


