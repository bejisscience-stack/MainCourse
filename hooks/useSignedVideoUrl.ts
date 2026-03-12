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

      // Only update state if this is still the latest request
      if (currentFetchId === fetchIdRef.current) {
        setSignedUrl(url);
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

  return { signedUrl, isLoading, error, refresh: fetchSignedUrl };
}
