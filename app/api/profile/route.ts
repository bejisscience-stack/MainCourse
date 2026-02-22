import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// PATCH: Update username and/or avatar_url
export async function PATCH(request: NextRequest) {
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
    const { username, avatar_url } = body;

    // Build update object - only include fields that were sent
    const updateData: Record<string, any> = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (!trimmed || trimmed.length < 3 || trimmed.length > 30 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        return NextResponse.json(
          { error: 'Username must be 3-30 characters, only letters, numbers, and underscores' },
          { status: 400 }
        );
      }
      updateData.username = trimmed;
    }

    if (avatar_url !== undefined) {
      updateData.avatar_url = avatar_url; // can be null to remove
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS - auth is already verified above
    // Falls back to user token if service role key is not set
    const supabase = createServiceRoleClient(token);

    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', user.id)
      .select('username, avatar_url')
      .single();

    if (updateError) {
      console.error('Error updating profile:', updateError);
      if (updateError.message?.includes('duplicate') || updateError.message?.includes('unique') || updateError.code === '23505') {
        return NextResponse.json(
          { error: 'username_taken' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      username: updated?.username,
      avatar_url: updated?.avatar_url,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
