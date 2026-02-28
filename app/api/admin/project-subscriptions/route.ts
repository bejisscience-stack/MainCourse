import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/project-subscriptions
 * Fetch all project subscriptions (admin only)
 * Returns subscriptions joined with profile info (username, avatar_url)
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const { user, error: userError } = await verifyTokenAndGetUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServerSupabaseClient(token);

    // Check admin status
    const { data: isAdmin, error: adminError } = await supabase.rpc('check_is_admin', {
      user_id: user.id,
    });

    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch subscriptions with profile info
    const { data, error } = await supabase
      .from('project_subscriptions')
      .select(`
        id,
        user_id,
        price,
        status,
        created_at,
        payment_screenshot,
        approved_at,
        profiles!project_subscriptions_user_id_fkey (
          username,
          avatar_url
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform to flatten profile data
    const subscriptions = data?.map((sub: any) => ({
      id: sub.id,
      user_id: sub.user_id,
      username: sub.profiles?.username || 'Unknown',
      avatar_url: sub.profiles?.avatar_url || null,
      price: sub.price,
      status: sub.status,
      created_at: sub.created_at,
      payment_screenshot: sub.payment_screenshot,
      approved_at: sub.approved_at,
    })) || [];

    // Count by status
    const counts = {
      pending: subscriptions.filter((s) => s.status === 'pending').length,
      active: subscriptions.filter((s) => s.status === 'active').length,
      rejected: subscriptions.filter((s) => s.status === 'rejected').length,
    };

    return NextResponse.json({ subscriptions, counts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
