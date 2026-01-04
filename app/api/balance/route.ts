import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// GET: Fetch user's balance information
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

    // Get balance info using the RPC function
    const { data: balanceInfo, error: balanceError } = await supabase
      .rpc('get_user_balance_info', { p_user_id: user.id });

    if (balanceError) {
      console.error('Error fetching balance info:', balanceError);
      return NextResponse.json(
        { error: 'Failed to fetch balance information' },
        { status: 500 }
      );
    }

    // Get recent transactions
    const { data: transactions, error: transError } = await supabase
      .from('balance_transactions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (transError) {
      console.error('Error fetching transactions:', transError);
    }

    return NextResponse.json({
      balance: balanceInfo?.[0]?.balance || 0,
      bankAccountNumber: balanceInfo?.[0]?.bank_account_number || null,
      pendingWithdrawal: balanceInfo?.[0]?.pending_withdrawal || 0,
      totalEarned: balanceInfo?.[0]?.total_earned || 0,
      totalWithdrawn: balanceInfo?.[0]?.total_withdrawn || 0,
      transactions: transactions || [],
    });
  } catch (error: any) {
    console.error('Error in GET /api/balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Update bank account number
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
    const { bankAccountNumber } = body;

    if (!bankAccountNumber || typeof bankAccountNumber !== 'string') {
      return NextResponse.json(
        { error: 'Bank account number is required' },
        { status: 400 }
      );
    }

    // Validate Georgian IBAN format
    const ibanUpper = bankAccountNumber.trim().toUpperCase();
    const georgianIbanPattern = /^GE[0-9]{2}[A-Z]{2}[0-9]{16}$/;

    if (!georgianIbanPattern.test(ibanUpper)) {
      return NextResponse.json(
        { error: 'Invalid Georgian IBAN format. Must be 22 characters: GE + 2 digits + 2 letters + 16 digits' },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(token);

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ bank_account_number: ibanUpper })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating bank account:', updateError);
      return NextResponse.json(
        { error: 'Failed to update bank account number' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      bankAccountNumber: ibanUpper
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/balance:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

