import {
  verifyTokenAndGetUser,
  createServiceRoleClient,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/submissions/[id]/pay
 * Body: { review_id: string, payout_amount: number }
 *
 * Pays the student for a specific platform review:
 * 1. Validates review exists, is accepted, not already paid
 * 2. Updates submission_review with payout_amount, paid_at, paid_by
 * 3. Credits student's profiles.balance
 * 4. Creates balance_transaction audit record
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const serviceClient = createServiceRoleClient(token);

    // Check admin
    const { data: adminProfile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (adminProfile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { review_id, payout_amount } = body;
    const submissionId = params.id;

    if (!review_id || typeof payout_amount !== "number" || payout_amount <= 0) {
      return NextResponse.json(
        {
          error:
            "Invalid request: review_id and positive payout_amount required",
        },
        { status: 400 },
      );
    }

    // Step 1: Get the review + verify it's valid and unpaid
    const { data: review, error: reviewError } = await serviceClient
      .from("submission_reviews")
      .select(
        "id, submission_id, project_id, status, payment_amount, paid_at, platform",
      )
      .eq("id", review_id)
      .eq("submission_id", submissionId)
      .single();

    if (reviewError || !review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }
    if (review.status !== "accepted") {
      return NextResponse.json(
        { error: "Review is not accepted" },
        { status: 400 },
      );
    }
    if (review.paid_at) {
      return NextResponse.json({ error: "Already paid" }, { status: 409 });
    }

    // Step 2: Get student user_id from submission
    const { data: submission } = await serviceClient
      .from("project_submissions")
      .select("user_id, project_id")
      .eq("id", submissionId)
      .single();

    if (!submission) {
      return NextResponse.json(
        { error: "Submission not found" },
        { status: 404 },
      );
    }

    // Step 2b: Check project budget
    const projectId = review.project_id || submission.project_id;
    const { data: project } = await serviceClient
      .from("projects")
      .select("budget, spent")
      .eq("id", projectId)
      .single();

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const projectBudget = parseFloat(project.budget) || 0;
    const projectSpent = parseFloat(project.spent) || 0;
    const remaining = Math.round((projectBudget - projectSpent) * 100) / 100;

    if (remaining < payout_amount) {
      return NextResponse.json(
        {
          error: `Insufficient project budget (remaining: ₾${remaining.toFixed(2)})`,
        },
        { status: 400 },
      );
    }

    // Step 3: Get student's current balance
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("balance")
      .eq("id", submission.user_id)
      .single();

    if (!profile) {
      return NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      );
    }

    const balanceBefore = parseFloat(profile.balance) || 0;
    const roundedPayout = Math.round(payout_amount * 100) / 100;
    const balanceAfter =
      Math.round((balanceBefore + roundedPayout) * 100) / 100;

    // Step 4: Update student balance
    const { error: balanceError } = await serviceClient
      .from("profiles")
      .update({ balance: balanceAfter })
      .eq("id", submission.user_id);

    if (balanceError) {
      console.error("[Pay API] Balance update failed:", balanceError);
      return NextResponse.json(
        { error: "Failed to update balance" },
        { status: 500 },
      );
    }

    // Step 5: Create balance transaction
    const { error: txError } = await serviceClient
      .from("balance_transactions")
      .insert({
        user_id: submission.user_id,
        user_type: "student",
        amount: roundedPayout,
        transaction_type: "credit",
        source: "submission_payout",
        reference_id: review.id,
        reference_type: "submission_review",
        description: `Payout for video submission (${review.platform || "all"} platform)`,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
      });

    if (txError) {
      console.error("[Pay API] Transaction log failed:", txError);
      // Balance was already updated — log but don't fail
    }

    // Step 6: Mark review as paid
    const { error: paidError } = await serviceClient
      .from("submission_reviews")
      .update({
        payout_amount: roundedPayout,
        paid_at: new Date().toISOString(),
        paid_by: user.id,
      })
      .eq("id", review.id);

    if (paidError) {
      console.error("[Pay API] Review paid_at update failed:", paidError);
    }

    // Step 7: Deduct from project budget
    const newSpent = Math.round((projectSpent + roundedPayout) * 100) / 100;
    const { error: spentError } = await serviceClient
      .from("projects")
      .update({ spent: newSpent })
      .eq("id", projectId);

    if (spentError) {
      console.error("[Pay API] Project spent update failed:", spentError);
    }

    return NextResponse.json({
      success: true,
      payout_amount: roundedPayout,
      balance_after: balanceAfter,
      project_remaining: Math.round((projectBudget - newSpent) * 100) / 100,
      review_id: review.id,
    });
  } catch (err) {
    console.error("[Pay API] Unhandled exception:", err);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
