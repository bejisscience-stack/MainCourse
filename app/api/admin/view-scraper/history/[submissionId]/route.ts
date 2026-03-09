import { createServerSupabaseClient, verifyTokenAndGetUser, createServiceRoleClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/view-scraper/history/[submissionId]
 * Fetch scrape history for a specific submission
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { submissionId: string } }
) {
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
    const { data: isAdmin, error: adminError } = await supabase.rpc('check_is_admin', { user_id: user.id });
    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const serviceClient = createServiceRoleClient(token);
    const { submissionId } = params;

    const { data: history, error } = await serviceClient
      .from('view_scrape_results')
      .select('*')
      .eq('submission_id', submissionId)
      .order('scraped_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ history: history || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
