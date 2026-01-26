import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

// POST: Validate referral code (public endpoint - no auth required)
// This endpoint is used during signup when the user is not yet authenticated
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { referralCode } = body;

    if (!referralCode) {
      return NextResponse.json(
        { valid: false, error: 'referralCode is required' },
        { status: 400 }
      );
    }

    // Validate referralCode format
    if (typeof referralCode !== 'string' || referralCode.length > 20) {
      return NextResponse.json(
        { valid: false, error: 'Invalid referral code format' },
        { status: 200 }
      );
    }

    // Use service role client to bypass RLS (needed for anonymous users)
    const supabase = createServiceRoleClient();

    // Normalize referral code (uppercase, trim)
    const normalizedCode = referralCode.trim().toUpperCase();

    // Check if referral code exists in profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('referral_code', normalizedCode)
      .maybeSingle();

    if (error) {
      console.error('Error validating referral code:', error);
      return NextResponse.json(
        { valid: false, error: 'Failed to validate referral code' },
        { status: 500 }
      );
    }

    // Return validation result
    return NextResponse.json({
      valid: !!profile,
      message: profile ? 'Valid referral code' : 'Invalid referral code'
    });
  } catch (error: any) {
    console.error('Error in POST /api/public/validate-referral-code:', error);
    return NextResponse.json(
      { valid: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
