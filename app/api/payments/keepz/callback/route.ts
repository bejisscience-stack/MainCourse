import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { decryptCallback } from "@/lib/keepz";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // TODO: Add Keepz IP whitelist when they publish static IPs. Currently relying on encrypted payload verification only. See SECURITY_AUDIT.md PAY-01
  // ALWAYS return 200 (Keepz expects this)
  try {
    const rawText = await request.text();
    console.log(
      "[Keepz Callback] Raw body received:",
      rawText.substring(0, 1000),
    );

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[Keepz Callback] Failed to parse JSON body:", parseError);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Require encrypted payload — reject plaintext callbacks
    if (!body.encryptedData || !body.encryptedKeys) {
      console.error(
        "[Keepz Callback] REJECTED: Missing encrypted data — plaintext callbacks are not accepted",
        {
          hasEncryptedData: !!body.encryptedData,
          hasEncryptedKeys: !!body.encryptedKeys,
          integratorOrderId: body.integratorOrderId || "unknown",
        },
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    let callbackData: any;
    try {
      callbackData = decryptCallback(body);
    } catch (decryptError) {
      console.error(
        "[Keepz Callback] REJECTED: Decryption failed:",
        decryptError,
      );
      // Try to save the raw encrypted body for debugging
      const supabaseForLog = createServiceRoleClient();
      if (body.integratorOrderId) {
        await supabaseForLog
          .from("keepz_payments")
          .update({
            callback_payload: {
              raw_encrypted: true,
              error: String(decryptError),
              body,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("keepz_order_id", body.integratorOrderId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log(
      "[Keepz Callback] Decrypted data:",
      JSON.stringify(callbackData).substring(0, 500),
    );

    const { integratorOrderId } = callbackData;
    if (!integratorOrderId) {
      console.error(
        "[Keepz Callback] Missing integratorOrderId in decrypted data",
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = createServiceRoleClient();

    // Look up payment
    const { data: payment, error: lookupError } = await supabase
      .from("keepz_payments")
      .select("id, status, amount, user_id")
      .eq("keepz_order_id", integratorOrderId)
      .single();

    if (!payment || lookupError) {
      console.error("[Keepz Callback] Payment not found:", {
        integratorOrderId,
        lookupError,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log("[Keepz Callback] Processing payment:", {
      integratorOrderId,
      paymentId: payment.id,
      currentStatus: payment.status,
      callbackStatus: callbackData.status || callbackData.orderStatus,
    });

    // Validate amount if present
    if (
      callbackData.amount &&
      Number(callbackData.amount) !== Number(payment.amount)
    ) {
      console.error("[Keepz Callback] Amount mismatch:", {
        expected: payment.amount,
        received: callbackData.amount,
        integratorOrderId,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const isSuccess =
      callbackData.status === "SUCCESS" ||
      callbackData.orderStatus === "SUCCESS";

    if (isSuccess) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        "complete_keepz_payment",
        {
          p_keepz_order_id: integratorOrderId,
          p_callback_payload: callbackData,
        },
      );
      if (rpcError || rpcResult?.success === false) {
        console.error("[Keepz Callback] Payment processing failed:", {
          rpcError,
          rpcResult,
          integratorOrderId,
          callbackStatus: callbackData.status || callbackData.orderStatus,
        });
      } else {
        console.log("[Keepz Callback] Payment completed successfully:", {
          integratorOrderId,
        });
      }

      // Save card info if present (from saveCard: true payments)
      if (callbackData.cardInfo) {
        const cardInfo = callbackData.cardInfo;
        const { error: cardError } = await supabase.from("saved_cards").upsert(
          {
            user_id: payment.user_id,
            card_token: cardInfo.token,
            card_mask: cardInfo.cardMask || "****",
            card_brand: cardInfo.cardBrand || null,
            expiration_date: cardInfo.expirationDate || null,
            provider: cardInfo.provider || null,
            keepz_order_id: integratorOrderId,
            is_active: true,
          },
          {
            onConflict: "card_token",
          },
        );

        if (cardError) {
          console.error("[Keepz Callback] Failed to save card info:", {
            cardError,
            integratorOrderId,
          });
        } else {
          console.log("[Keepz Callback] Card saved successfully:", {
            integratorOrderId,
            cardMask: cardInfo.cardMask,
            cardBrand: cardInfo.cardBrand,
          });
        }
      }
    } else {
      await supabase
        .from("keepz_payments")
        .update({
          status: "failed",
          callback_payload: callbackData,
          updated_at: new Date().toISOString(),
        })
        .eq("keepz_order_id", integratorOrderId);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Keepz Callback] Unhandled error:", error);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
