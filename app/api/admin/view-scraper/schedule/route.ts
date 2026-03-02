import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Simple cron expression validation: 5 fields, each non-empty
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  // Each field: number, *, ranges, lists, steps
  const fieldPattern = /^(\*|[0-9]+(-[0-9]+)?(,[0-9]+(-[0-9]+)?)*)(\/([0-9]+))?$/;
  return parts.every((p) => fieldPattern.test(p));
}

/**
 * GET /api/admin/view-scraper/schedule
 * Fetch current cron schedule for the view scraper
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
    const { data: isAdmin, error: adminError } = await supabase.rpc('check_is_admin', { user_id: user.id });
    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabase.rpc('get_view_scraper_schedule');
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/view-scraper/schedule
 * Update cron schedule and/or active state
 */
export async function PATCH(request: NextRequest) {
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

    const body = await request.json();
    const { schedule, active } = body;

    // Validate inputs
    if (schedule !== undefined && schedule !== null) {
      if (typeof schedule !== 'string' || !isValidCron(schedule)) {
        return NextResponse.json({ error: 'Invalid cron expression. Must be 5 fields (minute hour day month weekday).' }, { status: 400 });
      }
    }

    if (active !== undefined && active !== null && typeof active !== 'boolean') {
      return NextResponse.json({ error: 'active must be a boolean' }, { status: 400 });
    }

    if (schedule === undefined && active === undefined) {
      return NextResponse.json({ error: 'Must provide schedule and/or active' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('update_view_scraper_schedule', {
      p_schedule: schedule ?? null,
      p_active: active ?? null,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ schedule: data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
