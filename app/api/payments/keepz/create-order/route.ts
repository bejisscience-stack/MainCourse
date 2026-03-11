import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, verifyTokenAndGetUser } from '@/lib/supabase-server';
import { createKeepzOrder, KeepzError } from '@/lib/keepz';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const { paymentType, referenceId } = await request.json();
    if (!paymentType || !referenceId) {
      return NextResponse.json({ error: 'paymentType and referenceId are required' }, { status: 400 });
    }
    if (!['course_enrollment', 'project_subscription', 'bundle_enrollment'].includes(paymentType)) {
      return NextResponse.json({ error: 'Invalid paymentType' }, { status: 400 });
    }

    const supabase = createServerSupabaseClient(token);

    // 3. Validate reference and get amount
    let amount: number;
    if (paymentType === 'course_enrollment') {
      const { data: enrollment, error } = await supabase
        .from('enrollment_requests')
        .select('id, status, user_id, courses(price)')
        .eq('id', referenceId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();
      if (error || !enrollment) {
        return NextResponse.json({ error: 'Enrollment request not found or not pending' }, { status: 404 });
      }
      // courses is joined as object
      const course = enrollment.courses as any;
      amount = course?.price || 0;
      if (amount <= 0) {
        return NextResponse.json({ error: 'Invalid course price' }, { status: 400 });
      }
    } else if (paymentType === 'bundle_enrollment') {
      const { data: bundleReq, error } = await supabase
        .from('bundle_enrollment_requests')
        .select('id, status, user_id, course_bundles(price)')
        .eq('id', referenceId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();
      if (error || !bundleReq) {
        return NextResponse.json({ error: 'Bundle enrollment request not found or not pending' }, { status: 404 });
      }
      const bundle = bundleReq.course_bundles as any;
      amount = bundle?.price || 0;
      if (amount <= 0) {
        return NextResponse.json({ error: 'Invalid bundle price' }, { status: 400 });
      }
    } else {
      // project_subscription — fixed price
      const { data: sub, error } = await supabase
        .from('project_subscriptions')
        .select('id, status, user_id')
        .eq('id', referenceId)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();
      if (error || !sub) {
        return NextResponse.json({ error: 'Subscription not found or not pending' }, { status: 404 });
      }
      amount = 10.00;
    }

    // 4. Idempotency check — existing active payment for this reference
    const { data: existing } = await supabase
      .from('keepz_payments')
      .select('id, checkout_url, status')
      .eq('payment_type', paymentType)
      .eq('reference_id', referenceId)
      .in('status', ['pending', 'created'])
      .maybeSingle();

    if (existing?.checkout_url) {
      return NextResponse.json({ checkoutUrl: existing.checkout_url, paymentId: existing.id });
    }

    // 5. Create keepz_payments row (status: pending)
    const integratorOrderId = randomUUID();
    const { data: paymentRow, error: insertError } = await supabase
      .from('keepz_payments')
      .insert({
        user_id: user.id,
        payment_type: paymentType,
        reference_id: referenceId,
        amount,
        currency: 'GEL',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !paymentRow) {
      console.error('Failed to create payment row:', insertError);
      return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }

    // 6. Create Keepz order
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swavleba.ge';
    const { checkoutUrl } = await createKeepzOrder({
      amount,
      currency: 'GEL',
      integratorOrderId,
      successRedirectUri: `${appUrl}/payment/success?paymentId=${paymentRow.id}`,
      failRedirectUri: `${appUrl}/payment/failed?paymentId=${paymentRow.id}`,
      callbackUri: `${appUrl}/api/payments/keepz/callback`,
    });

    // 7. Update payment row with Keepz details
    await supabase
      .from('keepz_payments')
      .update({
        keepz_order_id: integratorOrderId,
        checkout_url: checkoutUrl,
        status: 'created',
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentRow.id);

    return NextResponse.json({ checkoutUrl, paymentId: paymentRow.id });
  } catch (error) {
    if (error instanceof KeepzError) {
      console.error('Keepz API error:', error.message, error.statusCode);
      return NextResponse.json({ error: 'Payment service error' }, { status: 502 });
    }
    console.error('Create order error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
