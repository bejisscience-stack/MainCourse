import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit-log";

export const dynamic = "force-dynamic";

// GET /api/admin/payments — list recent payments with optional status filter
export async function GET(request: NextRequest) {
  const token = getTokenFromHeader(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, error: userError } = await verifyTokenAndGetUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: isAdmin } = await supabase.rpc("check_is_admin", {
    user_id: user.id,
  });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const statusFilter = request.nextUrl.searchParams.get("status");
  const limit = Math.min(
    Number(request.nextUrl.searchParams.get("limit")) || 50,
    100,
  );

  let query = supabase
    .from("keepz_payments")
    .select(
      "id, user_id, payment_type, reference_id, keepz_order_id, amount, currency, status, paid_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  const { data: payments, error } = await query;

  if (error) {
    console.error("[Admin Payments] List error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payments" },
      { status: 500 },
    );
  }

  return NextResponse.json({ payments });
}

// POST /api/admin/payments — manually complete a stuck payment
export async function POST(request: NextRequest) {
  const token = getTokenFromHeader(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { user, error: userError } = await verifyTokenAndGetUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: isAdmin } = await supabase.rpc("check_is_admin", {
    user_id: user.id,
  });
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { paymentId, action } = body;

  if (!paymentId || action !== "complete") {
    return NextResponse.json(
      { error: 'Invalid request. Required: paymentId and action "complete"' },
      { status: 400 },
    );
  }

  // Look up the payment
  const { data: payment, error: lookupError } = await supabase
    .from("keepz_payments")
    .select("id, status, keepz_order_id, user_id, payment_type, amount")
    .eq("id", paymentId)
    .single();

  if (lookupError || !payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  if (payment.status === "success") {
    return NextResponse.json({
      message: "Payment already completed",
      payment,
    });
  }

  if (payment.status !== "created" && payment.status !== "pending") {
    return NextResponse.json(
      {
        error: `Cannot complete payment with status "${payment.status}"`,
      },
      { status: 400 },
    );
  }

  // Complete via RPC
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    "complete_keepz_payment",
    {
      p_keepz_order_id: payment.keepz_order_id,
      p_callback_payload: {
        manual_admin_completion: true,
        completed_by: user.id,
        completed_at: new Date().toISOString(),
      },
    },
  );

  if (rpcError || rpcResult?.success === false) {
    console.error("[Admin Payments] Manual completion failed:", {
      rpcError,
      rpcResult,
      paymentId,
    });
    return NextResponse.json(
      { error: "Failed to complete payment", details: rpcError?.message },
      { status: 500 },
    );
  }

  await logAdminAction(
    request,
    user.id,
    "payment_manual_complete",
    "keepz_payments",
    paymentId,
    {
      payment_type: payment.payment_type,
      amount: payment.amount,
      user_id: payment.user_id,
      previous_status: payment.status,
    },
  );

  console.log("[Admin Payments] Payment manually completed:", {
    paymentId,
    completedBy: user.id,
  });

  return NextResponse.json({
    success: true,
    message: "Payment completed and enrollment granted",
  });
}
