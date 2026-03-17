import { NextRequest, NextResponse } from "next/server";
import {
  verifyAdminRequest,
  isAuthError,
  internalError,
} from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/submissions/[id]/pay
 * Body: { review_id: string, payout_amount: number }
 *
 * Pays the student for a specific platform review via atomic RPC.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // PAY-01 fix: use verifyAdminRequest (check_is_admin RPC)
    const auth = await verifyAdminRequest(request);
    if (isAuthError(auth)) return auth;

    const { userId, serviceSupabase } = auth;
    const submissionId = params.id;

    const body = await request.json();
    const { review_id, payout_amount } = body;

    if (!review_id || typeof payout_amount !== "number" || payout_amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Invalid request: review_id and positive payout_amount required",
        },
        { status: 400 },
      );
    }

    // PAY-02 fix: single atomic RPC replaces 7 sequential calls
    const { data, error } = await serviceSupabase.rpc("pay_submission", {
      p_review_id: review_id,
      p_payout_amount: payout_amount,
      p_admin_id: userId,
      p_submission_id: submissionId,
    });

    if (error) {
      console.error("[Pay API] RPC error:", error);
      return NextResponse.json(
        { error: "Failed to process payout" },
        { status: 500 },
      );
    }

    if (!data.success) {
      const statusMap: Record<string, number> = {
        invalid_amount: 400,
        not_admin: 403,
        review_not_found: 404,
        submission_not_found: 404,
        project_not_found: 404,
        student_not_found: 404,
        not_accepted: 400,
        already_paid: 409,
        insufficient_budget: 400,
      };

      const messageMap: Record<string, string> = {
        insufficient_budget: `Insufficient project budget (remaining: ₾${Number(data.remaining).toFixed(2)})`,
        already_paid: "Already paid",
        not_accepted: "Review is not accepted",
      };

      return NextResponse.json(
        { error: messageMap[data.reason] || data.reason },
        { status: statusMap[data.reason] || 500 },
      );
    }

    return NextResponse.json({
      success: true,
      payout_amount: data.payout_amount,
      balance_after: data.balance_after,
      project_remaining: data.project_remaining,
      review_id: data.review_id,
    });
  } catch (err) {
    return internalError("Pay API", err);
  }
}
