import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET: Fetch user's withdrawal requests
export async function GET(request: NextRequest) {
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

    const { data: requests, error } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching withdrawal requests:', error);
      return NextResponse.json(
        { error: 'Failed to fetch withdrawal requests' },
        { status: 500 }
      );
    }

    return NextResponse.json({ requests: requests || [] });
  } catch (error: any) {
    console.error('Error in GET /api/withdrawals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new withdrawal request
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
    const { amount, bankAccountNumber } = body;

    // Validate amount
    if (!amount || typeof amount !== 'number' || amount < 20) {
      return NextResponse.json(
        { error: 'Minimum withdrawal amount is 20 GEL' },
        { status: 400 }
      );
    }

    // Validate bank account
    if (!bankAccountNumber || typeof bankAccountNumber !== 'string' || bankAccountNumber.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid bank account number is required' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    // Call the RPC function to create withdrawal request
    const { data: requestId, error: rpcError } = await supabase
      .rpc('create_withdrawal_request', {
        p_amount: amount,
        p_bank_account_number: bankAccountNumber.trim()
      });

    if (rpcError) {
      console.error('Error creating withdrawal request:', rpcError);
      return NextResponse.json(
        { error: rpcError.message || 'Failed to create withdrawal request' },
        { status: 400 }
      );
    }

    // Fetch the created request
    const { data: withdrawalRequest, error: fetchError } = await supabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError) {
      console.error('Error fetching created request:', fetchError);
    }

    return NextResponse.json({ 
      success: true,
      request: withdrawalRequest 
    }, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/withdrawals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

