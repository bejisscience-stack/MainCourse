import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/project-subscriptions
 * Fetch user's project subscriptions (ordered by created_at DESC)
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
    const { data, error } = await supabase
      .from('project_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscriptions: data || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/project-subscriptions
 * Create new project subscription request
 *
 * Body: { payment_screenshot: string (URL) }
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { payment_screenshot } = body;

    if (!payment_screenshot || typeof payment_screenshot !== 'string') {
      return NextResponse.json(
        { error: 'Invalid payment_screenshot URL' },
        { status: 422 }
      );
    }

    const supabase = createServerSupabaseClient();

    // Check for existing pending subscription
    const { data: existing, error: existingError } = await supabase
      .from('project_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Pending subscription request already exists' },
        { status: 400 }
      );
    }

    // Create new subscription request
    const { data, error } = await supabase
      .from('project_subscriptions')
      .insert({
        user_id: user.id,
        payment_screenshot,
        price: 10.0,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
