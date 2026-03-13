import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getOrderStatus } from "@/lib/keepz";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

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

    const paymentId = request.nextUrl.searchParams.get("paymentId");
    if (!paymentId || !isValidUUID(paymentId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient(token);
    const { data: payment, error } = await supabase
      .from("keepz_payments")
      .select("status, payment_type, paid_at, amount, keepz_order_id")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .single();

    if (error || !payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    // Self-healing: if callback hasn't arrived yet, verify directly with Keepz API
    if (payment.status === "created" && payment.keepz_order_id) {
      try {
        const keepzStatus = await getOrderStatus(payment.keepz_order_id);
        const orderStatus = (
          (keepzStatus.orderStatus as string) ||
          (keepzStatus.status as string) ||
          ""
        ).toUpperCase();
        console.log("[Keepz Status] Verification result:", {
          paymentId,
          keepzOrderId: payment.keepz_order_id,
          keepzStatus: orderStatus,
        });

        if (orderStatus === "SUCCESS" || orderStatus === "COMPLETED") {
          // Payment confirmed by Keepz — complete enrollment via service role
          const serviceClient = createServiceRoleClient();
          const { data: rpcResult, error: rpcError } = await serviceClient.rpc(
            "complete_keepz_payment",
            {
              p_keepz_order_id: payment.keepz_order_id,
              p_callback_payload: keepzStatus,
            },
          );

          if (rpcError || rpcResult?.success === false) {
            console.error(
              "[Keepz Status] Failed to complete payment via verification:",
              {
                rpcError,
                rpcResult,
                paymentId,
              },
            );
            // Audit log the failure
            serviceClient
              .from("payment_audit_log")
              .insert({
                keepz_payment_id: paymentId,
                keepz_order_id: payment.keepz_order_id,
                user_id: user.id,
                event_type: "status_poll_rpc_failed",
                event_data: { rpcError: rpcError?.message, rpcResult },
              })
              .then(
                () => {},
                () => {},
              );
          } else {
            console.log(
              "[Keepz Status] Payment completed via verification fallback:",
              { paymentId },
            );
            // Audit log the recovery
            serviceClient
              .from("payment_audit_log")
              .insert({
                keepz_payment_id: paymentId,
                keepz_order_id: payment.keepz_order_id,
                user_id: user.id,
                event_type: "status_poll_recovered",
                event_data: {
                  keepzStatus: orderStatus,
                  warning: rpcResult?.warning || null,
                },
              })
              .then(
                () => {},
                () => {},
              );
            return NextResponse.json({
              status: "success",
              paymentType: payment.payment_type,
              paidAt: new Date().toISOString(),
              amount: payment.amount,
            });
          }
        } else if (
          orderStatus === "FAILED" ||
          orderStatus === "REJECTED" ||
          orderStatus === "CANCELLED"
        ) {
          // Payment failed at Keepz — update our record
          const serviceClient = createServiceRoleClient();
          await serviceClient
            .from("keepz_payments")
            .update({
              status: "failed",
              callback_payload: keepzStatus,
              updated_at: new Date().toISOString(),
            })
            .eq("id", paymentId);

          return NextResponse.json({
            status: "failed",
            paymentType: payment.payment_type,
            paidAt: null,
            amount: payment.amount,
          });
        }
        // Otherwise (PENDING, CREATED, etc.) — keep polling
      } catch (verifyError) {
        // Don't fail the status check if Keepz verification fails
        console.error(
          "[Keepz Status] Verification error (non-fatal):",
          verifyError,
        );
      }
    }

    return NextResponse.json({
      status: payment.status,
      paymentType: payment.payment_type,
      paidAt: payment.paid_at,
      amount: payment.amount,
    });
  } catch (error) {
    console.error("Payment status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
