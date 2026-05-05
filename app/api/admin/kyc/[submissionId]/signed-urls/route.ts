import { NextRequest, NextResponse } from "next/server";
import {
  createServiceRoleClient,
  verifyTokenAndGetUser,
} from "@/lib/supabase-server";
import { getTokenFromHeader } from "@/lib/admin-auth";
import { isValidUUID } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes

async function checkAdmin(supabase: any, userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_is_admin", {
      user_id: userId,
    });
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}

// GET: Generate short-lived signed URLs for a submission's three documents
// (admin only). Generated on-demand because the URLs expire fast.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
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

    const serviceSupabase = createServiceRoleClient(token);
    const isAdmin = await checkAdmin(serviceSupabase, user.id);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Access denied. Admin only." },
        { status: 403 },
      );
    }

    const { submissionId } = await params;
    if (!isValidUUID(submissionId)) {
      return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
    }

    const { data: submission, error: fetchError } = await serviceSupabase
      .from("kyc_submissions")
      .select("doc_front_path, doc_back_path, selfie_path")
      .eq("id", submissionId)
      .single();

    if (fetchError || !submission) {
      return NextResponse.json(
        { error: "KYC submission not found" },
        { status: 404 },
      );
    }

    const sign = async (path: string | null) => {
      if (!path) return null;
      const { data, error } = await serviceSupabase.storage
        .from("kyc-documents")
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) {
        console.error(
          "[KYC Signed URLs API] createSignedUrl error:",
          path,
          error,
        );
        return null;
      }
      return data?.signedUrl ?? null;
    };

    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      sign(submission.doc_front_path),
      sign(submission.doc_back_path),
      sign(submission.selfie_path),
    ]);

    return NextResponse.json(
      {
        frontUrl,
        backUrl,
        selfieUrl,
        expiresIn: SIGNED_URL_TTL_SECONDS,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error: any) {
    console.error("[KYC Signed URLs API] Unhandled exception:", error);
    return NextResponse.json({ error: "An error occurred" }, { status: 500 });
  }
}
