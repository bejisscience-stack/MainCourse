import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { extractStoragePath } from "@/lib/video-url-parser";

interface UseSignedVideoUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

export function useSignedVideoUrl(
  courseId: string,
  videoUrl: string | null,
): UseSignedVideoUrlResult {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  const fetchSignedUrl = useCallback(async () => {
    if (!videoUrl || !courseId) return;

    const storagePath = extractStoragePath(videoUrl, "course-videos");
    if (!storagePath) {
      setError(new Error("Invalid video URL format"));
      return;
    }

    setIsLoading(true);
    setError(null);
    const currentFetchId = ++fetchIdRef.current;

    // Revoke previous blob URL to free memory
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const res = await fetch(
        `/api/courses/${courseId}/video-url?videoPath=${encodeURIComponent(storagePath)}`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const { signedUrl: url } = await res.json();

      if (currentFetchId !== fetchIdRef.current) return;

      // Fetch the video as a blob and create a blob URL to prevent URL copying
      const videoRes = await fetch(url);
      if (!videoRes.ok) {
        throw new Error(`Video fetch failed: HTTP ${videoRes.status}`);
      }

      if (currentFetchId !== fetchIdRef.current) return;

      const blob = await videoRes.blob();
      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;

      if (currentFetchId === fetchIdRef.current) {
        setSignedUrl(blobUrl);
      }
    } catch (err) {
      if (currentFetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setSignedUrl(null);
      }
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [courseId, videoUrl]);

  useEffect(() => {
    fetchSignedUrl();
  }, [fetchSignedUrl]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  return { signedUrl, isLoading, error, refresh: fetchSignedUrl };
}
