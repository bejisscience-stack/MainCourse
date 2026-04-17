import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase-server";
import { decryptCallback } from "@/lib/keepz";
import { callbackLimiter, getClientIP } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** Write to payment_audit_log (best-effort, never throws) */
async function auditLog(
  supabase: ReturnType<typeof createServiceRoleClient>,
  keepzPaymentId: string | null,
  keepzOrderId: string | null,
  userId: string | null,
  eventType: string,
  eventData: Record<string, unknown> = {},
) {
  try {
    await supabase.from("payment_audit_log").insert({
      keepz_payment_id: keepzPaymentId,
      keepz_order_id: keepzOrderId,
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
    });
  } catch {
    // Never let audit logging break the callback
  }
}

export async function POST(request: NextRequest) {
  // ALWAYS return 200 (Keepz expects this — they retry on non-2xx)
  const supabase = createServiceRoleClient();
  try {
    const clientIP = getClientIP(request);

    // IP allowlist check (defense-in-depth — encrypted payload is the primary authentication).
    // If KEEPZ_ALLOWED_IPS is configured, block unknown IPs.
    // If not configured, proceed — RSA-encrypted payload decryption proves authenticity.
    const allowedIPs = process.env.KEEPZ_ALLOWED_IPS;
    if (allowedIPs) {
      const whitelist = allowedIPs.split(",").map((ip) => ip.trim());
      if (!whitelist.includes(clientIP)) {
        console.warn("[Keepz Callback] BLOCKED: IP not in allowlist", {
          ip: clientIP,
        });
        await auditLog(supabase, null, null, null, "callback_ip_blocked", {
          ip: clientIP,
        });
        return NextResponse.json({ received: true }, { status: 200 });
      }
    } else {
      // IP allowlist not configured. Behavior depends on environment:
      // - Production: FAIL CLOSED. We still return 200 (Keepz retries on non-2xx),
      //   but we audit the misconfiguration and stop processing the callback. This
      //   enforces defense-in-depth: RSA decryption alone is not acceptable in prod.
      // - Dev/staging: warn and continue. RSA decryption still authenticates the payload.
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[Keepz Callback] CRITICAL: KEEPZ_ALLOWED_IPS unset in production — callback rejected",
          { ip: clientIP },
        );
        await auditLog(
          supabase,
          null,
          null,
          null,
          "callback_misconfigured_no_ip_allowlist",
          { ip: clientIP, env: "production" },
        );
        return NextResponse.json({ received: true }, { status: 200 });
      }
      console.warn(
        "[Keepz Callback] KEEPZ_ALLOWED_IPS not set — relying on encrypted payload auth (non-production)",
        { ip: clientIP },
      );
      await auditLog(supabase, null, null, null, "callback_no_ip_allowlist", {
        ip: clientIP,
      });
    }

    // Rate limit check (return 200, not 429 — payment providers retry on non-2xx)
    const { allowed } = await callbackLimiter.check(clientIP);
    if (!allowed) {
      console.warn("[Keepz Callback] Rate limited", { ip: clientIP });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const rawText = await request.text();
    console.log("[Keepz Callback] Body received", {
      length: rawText.length,
      ip: clientIP,
    });

    let body: any;
    try {
      body = JSON.parse(rawText);
    } catch (parseError) {
      console.error("[Keepz Callback] Failed to parse JSON body:", parseError);
      await auditLog(supabase, null, null, null, "callback_parse_error", {
        ip: clientIP,
        bodyLength: rawText.length,
      });
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
      await auditLog(
        supabase,
        null,
        body.integratorOrderId || null,
        null,
        "callback_plaintext_rejected",
        { ip: clientIP },
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
      await auditLog(
        supabase,
        null,
        body.integratorOrderId || null,
        null,
        "callback_decrypt_failed",
        { ip: clientIP, error: String(decryptError) },
      );
      // Try to save the raw encrypted body for debugging
      if (body.integratorOrderId) {
        await supabase
          .from("keepz_payments")
          .update({
            callback_payload: {
              raw_encrypted: true,
              error: String(decryptError),
            },
            updated_at: new Date().toISOString(),
          })
          .eq("keepz_order_id", body.integratorOrderId);
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const callbackStatus = callbackData.status || callbackData.orderStatus;
    console.log("[Keepz Callback] Decrypted callback", {
      integratorOrderId: callbackData.integratorOrderId,
      status: callbackStatus,
      hasAmount: callbackData.amount != null,
      hasCardInfo: !!callbackData.cardInfo,
    });

    const { integratorOrderId } = callbackData;
    if (!integratorOrderId) {
      console.error(
        "[Keepz Callback] Missing integratorOrderId in decrypted data",
      );
      await auditLog(supabase, null, null, null, "callback_missing_order_id", {
        ip: clientIP,
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Look up payment
    const { data: payment, error: lookupError } = await supabase
      .from("keepz_payments")
      .select("id, status, amount, user_id, payment_type")
      .eq("keepz_order_id", integratorOrderId)
      .single();

    if (!payment || lookupError) {
      console.error("[Keepz Callback] Payment not found:", {
        integratorOrderId,
        lookupError,
      });
      await auditLog(
        supabase,
        null,
        integratorOrderId,
        null,
        "callback_payment_not_found",
        { ip: clientIP, error: lookupError?.message },
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Log the callback receipt
    await auditLog(
      supabase,
      payment.id,
      integratorOrderId,
      payment.user_id,
      "callback_received",
      {
        ip: clientIP,
        callbackStatus,
        paymentType: payment.payment_type,
        currentStatus: payment.status,
        amount: callbackData.amount,
      },
    );

    console.log("[Keepz Callback] Processing payment:", {
      timestamp: new Date().toISOString(),
      integratorOrderId,
      paymentId: payment.id,
      userId: payment.user_id,
      paymentType: payment.payment_type,
      currentStatus: payment.status,
      callbackStatus,
      amount: payment.amount,
      ip: clientIP,
    });

    // Validate amount — reject if missing or mismatched
    if (callbackData.amount == null) {
      console.error("[Keepz Callback] REJECTED: Missing amount in callback", {
        integratorOrderId,
      });
      await auditLog(
        supabase,
        payment.id,
        integratorOrderId,
        payment.user_id,
        "callback_missing_amount",
        {},
      );
      return NextResponse.json({ received: true }, { status: 200 });
    }
    if (Number(callbackData.amount) !== Number(payment.amount)) {
      console.error("[Keepz Callback] REJECTED: Amount mismatch", {
        expected: payment.amount,
        received: callbackData.amount,
        integratorOrderId,
      });
      await auditLog(
        supabase,
        payment.id,
        integratorOrderId,
        payment.user_id,
        "callback_amount_mismatch",
        { expected: payment.amount, received: callbackData.amount },
      );
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
        if (rpcResult?.payment_recorded === true) {
          console.error(
            "[CRITICAL] Payment recorded as success but enrollment/subscription failed — needs manual admin intervention",
            {
              integratorOrderId,
              userId: payment.user_id,
              paymentType: payment.payment_type,
              amount: payment.amount,
              error: rpcResult?.error,
            },
          );
          await auditLog(
            supabase,
            payment.id,
            integratorOrderId,
            payment.user_id,
            "callback_payment_recorded_enrollment_failed",
            {
              error: rpcResult?.error,
              paymentType: payment.payment_type,
              amount: payment.amount,
            },
          );
        } else {
          console.error("[Keepz Callback] Payment processing failed:", {
            rpcError,
            rpcResult,
            integratorOrderId,
            callbackStatus,
          });
          await auditLog(
            supabase,
            payment.id,
            integratorOrderId,
            payment.user_id,
            "callback_rpc_failed",
            { rpcError: rpcError?.message, rpcResult },
          );
        }
      } else {
        console.log("[Keepz Callback] Payment completed successfully:", {
          timestamp: new Date().toISOString(),
          integratorOrderId,
          userId: payment.user_id,
          paymentType: payment.payment_type,
          amount: payment.amount,
          alreadyCompleted: rpcResult?.already_completed || false,
          warning: rpcResult?.warning,
        });
        await auditLog(
          supabase,
          payment.id,
          integratorOrderId,
          payment.user_id,
          "callback_success",
          {
            warning: rpcResult?.warning || null,
            alreadyCompleted: rpcResult?.already_completed || false,
          },
        );
      }

      // Save card info if present (from saveCard: true payments)
      if (callbackData.cardInfo && callbackData.cardInfo.token) {
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
        }
      }
    } else {
      // Never overwrite a successful payment — duplicate/delayed FAILED callbacks
      // must not corrupt completed transactions
      await supabase
        .from("keepz_payments")
        .update({
          status: "failed",
          callback_payload: callbackData,
          updated_at: new Date().toISOString(),
        })
        .eq("keepz_order_id", integratorOrderId)
        .in("status", ["created", "pending", "processing"]);

      await auditLog(
        supabase,
        payment.id,
        integratorOrderId,
        payment.user_id,
        "callback_failed",
        { callbackStatus },
      );
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[Keepz Callback] Unhandled error:", String(error));
    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      console.error("[Keepz Callback] Stack trace:", error.stack);
    }
    await auditLog(supabase, null, null, null, "callback_unhandled_error", {
      error: String(error),
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
