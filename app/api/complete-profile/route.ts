import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

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

    const body = await request.json();
    const { username, role } = body;

    // Validate username
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 30 characters' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, and underscores' },
        { status: 400 }
      );
    }

    // Validate role
    if (!role || !['student', 'lecturer'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be student or lecturer' },
        { status: 400 }
      );
    }

    const supabase = createServiceRoleClient(token);

    // Verify profile is actually incomplete (prevent abuse)
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('profile_completed')
      .eq('id', user.id)
      .single();

    if (currentProfile?.profile_completed !== false) {
      return NextResponse.json(
        { error: 'Profile is already complete' },
        { status: 400 }
      );
    }

    // Update profile
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        username: trimmed,
        role,
        profile_completed: true,
      })
      .eq('id', user.id)
      .select('username, role, profile_completed')
      .single();

    if (updateError) {
      console.error('Error completing profile:', updateError);
      if (updateError.message?.includes('duplicate') || updateError.message?.includes('unique') || updateError.code === '23505') {
        return NextResponse.json(
          { error: 'username_taken' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to complete profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username: updated?.username,
      role: updated?.role,
    });
  } catch (error: any) {
    console.error('Error in POST /api/complete-profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
