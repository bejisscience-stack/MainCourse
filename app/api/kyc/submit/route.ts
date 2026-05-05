import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import {
  paymentLimiter,
  rateLimitResponse,
  getClientIP,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const ALLOWED_DOC_TYPES = ["id_card", "passport", "drivers_license"] as const;
type DocType = (typeof ALLOWED_DOC_TYPES)[number];

const UUID_RE = /^[0-9a-f-]{36}$/i;

// Strict path validator: must be exactly {userId}/{nonEmpty}/{front|back|selfie}.{ext}
// with no traversal, no leading slash, no backslash, no double-slash, no
// percent-encoded characters. The RPC re-validates with the same shape.
function isValidKycPath(
  raw: unknown,
  userId: string,
  kind: "front" | "back" | "selfie",
): boolean {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 256) {
    return false;
  }
  // Reject any backslash or percent-encoded sequence outright
  if (raw.includes("\\") || raw.includes("%")) return false;
  // Reject leading slash and any '..' path segment
  if (raw.startsWith("/")) return false;
  // Split on '/'; expect exactly 3 segments
  const segments = raw.split("/");
  if (segments.length !== 3) return false;
  const [folderUser, submissionId, file] = segments;
  if (folderUser !== userId) return false;
  if (!UUID_RE.test(folderUser)) return false; // belt-and-braces
  if (
    submissionId.length === 0 ||
    submissionId === "." ||
    submissionId === ".." ||
    submissionId.includes(".")
  ) {
    return false;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(submissionId)) return false;
  // file must be {kind}.{ext} with ext being lowercase alnum
  const expected = new RegExp(`^${kind}\\.[a-z0-9]+$`);
  return expected.test(file);
}

// POST: Create a new KYC submission for the current user
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

    const rl = await paymentLimiter.check(getClientIP(request));
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const docType = body.docType;
    const docFrontPath = body.docFrontPath;
    const docBackPath = body.docBackPath ?? null;
    const selfiePath = body.selfiePath;
    const phoneRaw = body.phone;

    if (!ALLOWED_DOC_TYPES.includes(docType as DocType)) {
      return NextResponse.json(
        { error: "Invalid document type" },
        { status: 400 },
      );
    }

    if (typeof docFrontPath !== "string" || !docFrontPath) {
      return NextResponse.json(
        { error: "Document front photo is required" },
        { status: 400 },
      );
    }

    if (typeof selfiePath !== "string" || !selfiePath) {
      return NextResponse.json(
        { error: "Selfie is required" },
        { status: 400 },
      );
    }

    if (
      docType !== "passport" &&
      (typeof docBackPath !== "string" || !docBackPath)
    ) {
      return NextResponse.json(
        { error: "Document back photo is required for this document type" },
        { status: 400 },
      );
    }

    if (typeof phoneRaw !== "string" || !phoneRaw) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 },
      );
    }

    const phone = phoneRaw.replace(/[\s-]/g, "");
    if (!/^\+995\d{9}$/.test(phone)) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 },
      );
    }

    // Defense against malicious clients trying to reference another user's
    // storage objects or smuggle traversal sequences. The RPC re-validates with
    // the same shape so a direct supabase.rpc() bypass is also rejected.
    if (!isValidKycPath(docFrontPath, user.id, "front")) {
      return NextResponse.json(
        { error: "Invalid document front path" },
        { status: 400 },
      );
    }
    if (!isValidKycPath(selfiePath, user.id, "selfie")) {
      return NextResponse.json(
        { error: "Invalid selfie path" },
        { status: 400 },
      );
    }
    if (docType === "passport") {
      if (docBackPath !== null && docBackPath !== undefined) {
        return NextResponse.json(
          { error: "Passport submissions must not include a back path" },
          { status: 400 },
        );
      }
    } else {
      if (!isValidKycPath(docBackPath, user.id, "back")) {
        return NextResponse.json(
          { error: "Invalid document back path" },
          { status: 400 },
        );
      }
    }

    const supabase = createServerSupabaseClient(token);

    const { data: submissionId, error: rpcError } = await supabase.rpc(
      "create_kyc_submission",
      {
        p_doc_type: docType,
        p_doc_front_path: docFrontPath,
        p_doc_back_path: docType === "passport" ? null : docBackPath,
        p_selfie_path: selfiePath,
        p_phone: phone,
      },
    );

    if (rpcError) {
      const message = rpcError.message || "";
      const status = /already (verified|pending)/i.test(message) ? 409 : 400;
      console.error("[KYC Submit API] RPC error:", rpcError);
      return NextResponse.json(
        { error: message || "Failed to submit KYC" },
        { status },
      );
    }

    return NextResponse.json({ success: true, submissionId }, { status: 201 });
  } catch (error: any) {
    console.error("[KYC Submit API] Unhandled exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
