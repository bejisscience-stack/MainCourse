import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getOrderStatus } from "@/lib/keepz";
import { getTokenFromHeader } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/payments/keepz/verify-pending
 *
 * Self-healing endpoint: finds all "created" keepz_payments for the
 * authenticated user that are older than 2 minutes, verifies each with
 * the Keepz API, and completes any that were actually paid.
 * Also expires truly abandoned payments older than 1 hour.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();

    // Find stale "created" payments (older than 30 seconds)
    // Lowered from 2 minutes: when the success page calls verify-pending immediately
    // after redirect, the payment needs to be checkable within seconds.
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    const { data: stalePayments, error: fetchError } = await supabase
      .from("keepz_payments")
      .select("id, keepz_order_id, payment_type, reference_id, amount")
      .eq("user_id", user.id)
      .eq("status", "created")
      .lt("created_at", thirtySecondsAgo)
      .not("keepz_order_id", "is", null);

    if (fetchError || !stalePayments?.length) {
      return NextResponse.json({ verified: 0, recovered: 0 });
    }

    let verified = 0;
    let recovered = 0;
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    for (const payment of stalePayments) {
      verified++;
      try {
        const keepzStatus = await getOrderStatus(payment.keepz_order_id);
        const orderStatus = (
          (keepzStatus.orderStatus as string) ||
          (keepzStatus.status as string) ||
          ""
        ).toUpperCase();

        if (orderStatus === "SUCCESS" || orderStatus === "COMPLETED") {
          const { data: rpcResult, error: rpcError } = await supabase.rpc(
            "complete_keepz_payment",
            {
              p_keepz_order_id: payment.keepz_order_id,
              p_callback_payload: keepzStatus,
            },
          );

          if (!rpcError && rpcResult?.success !== false) {
            recovered++;
            console.log("[Verify Pending] Recovered payment:", {
              paymentId: payment.id,
              type: payment.payment_type,
            });
            // Audit log the recovery
            await supabase
              .from("payment_audit_log")
              .insert({
                keepz_payment_id: payment.id,
                keepz_order_id: payment.keepz_order_id,
                user_id: user.id,
                event_type: "verify_pending_recovered",
                event_data: {
                  paymentType: payment.payment_type,
                  keepzStatus: orderStatus,
                  warning: rpcResult?.warning || null,
                },
              })
              .then(
                () => {},
                () => {},
              );
          } else {
            console.error("[Verify Pending] RPC failed for verified payment:", {
              paymentId: payment.id,
              rpcError,
              rpcResult,
            });
            await supabase
              .from("payment_audit_log")
              .insert({
                keepz_payment_id: payment.id,
                keepz_order_id: payment.keepz_order_id,
                user_id: user.id,
                event_type: "verify_pending_rpc_failed",
                event_data: {
                  rpcError: rpcError?.message,
                  rpcResult,
                },
              })
              .then(
                () => {},
                () => {},
              );
          }
        } else if (
          orderStatus === "FAILED" ||
          orderStatus === "REJECTED" ||
          orderStatus === "CANCELLED"
        ) {
          await supabase
            .from("keepz_payments")
            .update({
              status: "failed",
              callback_payload: keepzStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", payment.id);
        }
        // PENDING/CREATED on Keepz side — leave as-is, will be checked again later
      } catch (err) {
        console.warn("[Verify Pending] Keepz API error for payment:", {
          paymentId: payment.id,
          error: err,
        });
        // Audit log the failure for debugging
        await supabase
          .from("payment_audit_log")
          .insert({
            keepz_payment_id: payment.id,
            keepz_order_id: payment.keepz_order_id,
            user_id: user.id,
            event_type: "verify_pending_api_failed",
            event_data: {
              error: String(err),
              stack: err instanceof Error ? err.stack : undefined,
            },
          })
          .then(
            () => {},
            () => {},
          );
      }
    }

    return NextResponse.json({ verified, recovered });
  } catch (error) {
    console.error("[Verify Pending] Unhandled error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
