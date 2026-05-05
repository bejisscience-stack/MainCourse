import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  generalLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const SUBMISSION_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;

// POST: Best-effort cleanup of orphan files in kyc-documents/{userId}/{submissionId}/.
// Only deletes if NO kyc_submissions row exists for that submissionId belonging
// to the caller — so genuine submissions are never disturbed. Used by the
// client when an upload succeeds but the subsequent /api/kyc/submit RPC fails.
export async function POST(request: NextRequest) {
  try {
    const token = getTokenFromHeader(request);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user, error: userError } = await verifyTokenAndGetUser(token);
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await generalLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json().catch(() => null);
    const submissionId = body?.submissionId;
    if (
      typeof submissionId !== "string" ||
      !SUBMISSION_ID_RE.test(submissionId)
    ) {
      return NextResponse.json(
        { error: "Invalid submissionId" },
        { status: 400 },
      );
    }

    const service = createServiceRoleClient(token);

    // Refuse to clean up if a real submission exists for this id and user.
    // This guards against a malicious caller trying to delete an admin-pending
    // submission's files by passing its id.
    const prefix = `${user.id}/${submissionId}`;
    const { data: existing, error: existingError } = await service
      .from("kyc_submissions")
      .select("id, doc_front_path")
      .eq("user_id", user.id)
      .or(
        `doc_front_path.like.${prefix}/%,doc_back_path.like.${prefix}/%,selfie_path.like.${prefix}/%`,
      )
      .limit(1);

    if (existingError) {
      console.error("[KYC Cleanup API] existing lookup error:", existingError);
      return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }

    if (existing && existing.length > 0) {
      // A real submission references this prefix — refuse cleanup.
      return NextResponse.json(
        { ok: false, reason: "submission_exists" },
        { status: 409 },
      );
    }

    // List and delete any files under {userId}/{submissionId}/
    const { data: files, error: listError } = await service.storage
      .from("kyc-documents")
      .list(prefix, { limit: 50 });

    if (listError) {
      console.error("[KYC Cleanup API] list error:", listError);
      return NextResponse.json({ error: "List failed" }, { status: 500 });
    }

    if (!files || files.length === 0) {
      return NextResponse.json({ ok: true, deleted: 0 });
    }

    const paths = files.map((f) => `${prefix}/${f.name}`);
    const { error: removeError } = await service.storage
      .from("kyc-documents")
      .remove(paths);

    if (removeError) {
      console.error("[KYC Cleanup API] remove error:", removeError);
      return NextResponse.json({ error: "Remove failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, deleted: paths.length });
  } catch (error: any) {
    console.error("[KYC Cleanup API] Unhandled exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
