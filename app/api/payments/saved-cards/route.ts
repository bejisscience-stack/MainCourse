import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET — List user's saved cards
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

    const { data: cards, error } = await supabase
      .from('saved_cards')
      .select('id, card_mask, card_brand, expiration_date, provider, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch saved cards:', error);
      return NextResponse.json({ error: 'Failed to fetch saved cards' }, { status: 500 });
    }

    return NextResponse.json({
      cards: (cards || []).map((c) => ({
        id: c.id,
        cardMask: c.card_mask,
        cardBrand: c.card_brand,
        expirationDate: c.expiration_date,
        provider: c.provider,
        createdAt: c.created_at,
      })),
    });
  } catch (error) {
    console.error('Saved cards GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE — Remove a saved card (soft delete)
export async function DELETE(request: NextRequest) {
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

    const { cardId } = await request.json();
    if (!cardId) {
      return NextResponse.json({ error: 'cardId is required' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient(token);

    const { error } = await supabase
      .from('saved_cards')
      .update({ is_active: false })
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to delete saved card:', error);
      return NextResponse.json({ error: 'Failed to delete card' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Saved cards DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
