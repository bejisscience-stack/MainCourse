import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { extractStoragePath } from "@/lib/video-url-parser";

/**
 * Resolves a public Supabase URL to a signed URL for the private course-videos bucket.
 * Works for both authenticated and anonymous users (RLS policy allows anon SELECT on intro videos).
 * Returns null while loading, the signed URL on success, or the original URL as fallback.
 */
export function useIntroVideoUrl(
  publicUrl: string | null | undefined,
): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!publicUrl) {
      setSignedUrl(null);
      return;
    }

    const storagePath = extractStoragePath(publicUrl, "course-videos");
    if (!storagePath) {
      // Not a course-videos URL — use as-is (e.g. external URL)
      setSignedUrl(publicUrl);
      return;
    }

    let cancelled = false;

    supabase.storage
      .from("course-videos")
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.signedUrl) {
          console.error("Failed to sign intro video URL:", error);
          setSignedUrl(publicUrl); // fallback to original
        } else {
          setSignedUrl(data.signedUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [publicUrl]);

  return signedUrl;
}
