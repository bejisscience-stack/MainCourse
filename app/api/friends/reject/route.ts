import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST /api/friends/reject - Reject a friend request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requestId } = body;

    if (!requestId || typeof requestId !== 'string') {
      return NextResponse.json(
        { error: 'Request ID is required' },
        { status: 400 }
      );
    }

    // Get auth token
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
        { error: 'Unauthorized', details: userError?.message || 'Invalid token' },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Verify the request exists and user is the receiver
    const { data: friendRequest, error: fetchError } = await supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .eq('id', requestId)
      .single();

    if (fetchError || !friendRequest) {
      return NextResponse.json(
        { error: 'Friend request not found' },
        { status: 404 }
      );
    }

    if (friendRequest.receiver_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: Can only reject friend requests sent to you' },
        { status: 403 }
      );
    }

    if (friendRequest.status !== 'pending') {
      return NextResponse.json(
        { error: 'Friend request is not pending' },
        { status: 400 }
      );
    }

    // Update the friend request status to rejected
    const { data: updatedRequest, error: updateError } = await supabase
      .from('friend_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error rejecting friend request:', updateError);
      return NextResponse.json(
        { error: 'Failed to reject friend request', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      friendRequest: updatedRequest,
      message: 'Friend request rejected successfully',
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error in POST /api/friends/reject:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
