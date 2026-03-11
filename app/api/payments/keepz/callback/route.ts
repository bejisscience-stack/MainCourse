import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { decryptCallback } from '@/lib/keepz';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ALWAYS return 200 (Keepz expects this)
  try {
    const body = await request.json();

    // Safety check: decrypt if encrypted, otherwise use as-is
    let callbackData: any;
    if (body.encryptedData && body.encryptedKeys) {
      callbackData = decryptCallback(body);
    } else {
      callbackData = body;
    }

    const { integratorOrderId } = callbackData;
    if (!integratorOrderId) {
      console.error('Keepz callback: missing integratorOrderId');
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = createServiceRoleClient();

    // Look up payment
    const { data: payment, error: lookupError } = await supabase
      .from('keepz_payments')
      .select('*')
      .eq('keepz_order_id', integratorOrderId)
      .single();

    if (!payment || lookupError) {
      console.error('Keepz callback: payment not found', { integratorOrderId });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Validate amount if present
    if (callbackData.amount && Number(callbackData.amount) !== Number(payment.amount)) {
      console.error('Keepz callback: amount mismatch', {
        expected: payment.amount,
        received: callbackData.amount,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const isSuccess = callbackData.status === 'SUCCESS' || callbackData.orderStatus === 'SUCCESS';

    if (isSuccess) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('complete_keepz_payment', {
        p_keepz_order_id: integratorOrderId,
        p_callback_payload: callbackData,
      });
      if (rpcError || rpcResult?.success === false) {
        console.error('Keepz callback: payment processing failed', {
          rpcError,
          rpcResult,
          integratorOrderId,
          callbackStatus: callbackData.status || callbackData.orderStatus,
        });
      }
    } else {
      await supabase
        .from('keepz_payments')
        .update({
          status: 'failed',
          callback_payload: callbackData,
          updated_at: new Date().toISOString(),
        })
        .eq('keepz_order_id', integratorOrderId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error('Keepz callback error:', error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
