import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { KycDocType } from "@/types/kyc";

interface SubmitPayload {
  docType: KycDocType;
  docFront: Blob;
  docBack: Blob | null;
  selfie: Blob;
  phone: string;
}

interface UploadedPaths {
  docFrontPath: string;
  docBackPath: string | null;
  selfiePath: string;
}

const BUCKET = "kyc-documents";

function makePath(userId: string, submissionId: string, kind: string): string {
  return `${userId}/${submissionId}/${kind}.jpg`;
}

async function uploadOne(path: string, blob: Blob): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: false,
    contentType: blob.type || "image/jpeg",
  });
  if (error) {
    const raw = error.message || "Upload failed";
    // storage-api returns DatabaseInvalidObjectDefinition ("The database
    // schema is invalid or incompatible.") when its own metadata cache is
    // stale — usually after a service version bump. The DB is fine; only a
    // Storage service restart from the Supabase Dashboard clears it.
    if (/database schema is invalid or incompatible/i.test(raw)) {
      console.error("[KYC upload] storage-api stale cache:", error);
      throw new Error(
        "Document upload service is temporarily unavailable. Please try again in a minute.",
      );
    }
    throw new Error(raw);
  }
}

// Best-effort orphan cleanup. Silently swallow any error — the user-visible
// error from the failing submit/upload is what matters.
async function tryCleanupOrphans(
  token: string,
  submissionId: string,
): Promise<void> {
  try {
    await fetch("/api/kyc/cleanup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ submissionId }),
      keepalive: true,
    });
  } catch (e) {
    console.warn("[KYC submission] cleanup failed (best-effort):", e);
  }
}

export function useKycSubmission() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitKyc = async (payload: SubmitPayload): Promise<string> => {
    setIsSubmitting(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const userId = session?.user?.id;

    if (!token || !userId) {
      setIsSubmitting(false);
      const err = new Error("Not authenticated");
      setError(err.message);
      throw err;
    }

    const submissionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const docFrontPath = makePath(userId, submissionId, "front");
    const selfiePath = makePath(userId, submissionId, "selfie");
    const docBackPath =
      payload.docType !== "passport" && payload.docBack
        ? makePath(userId, submissionId, "back")
        : null;

    let uploadedAnything = false;

    try {
      await uploadOne(docFrontPath, payload.docFront);
      uploadedAnything = true;
      if (docBackPath && payload.docBack) {
        await uploadOne(docBackPath, payload.docBack);
      }
      await uploadOne(selfiePath, payload.selfie);

      const uploaded: UploadedPaths = {
        docFrontPath,
        docBackPath,
        selfiePath,
      };

      const response = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          docType: payload.docType,
          phone: payload.phone,
          ...uploaded,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to submit KYC");
      }

      const data = await response.json();
      return data.submissionId as string;
    } catch (e: any) {
      // Best-effort cleanup of any files we already uploaded so they don't
      // sit forever in the private bucket. The /api/kyc/cleanup endpoint
      // verifies no DB row references them before removing.
      if (uploadedAnything) {
        await tryCleanupOrphans(token, submissionId);
      }
      setError(e?.message || "Failed to submit KYC");
      throw e;
    } finally {
      setIsSubmitting(false);
    }
  };

  return { submitKyc, isSubmitting, error };
}
