import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { extractStoragePath } from "@/lib/video-url-parser";

const REFRESH_BUFFER_MS = 12 * 60 * 1000; // Refresh 12 min into a 15 min TTL

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
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // Clear any pending refresh timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
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

      setSignedUrl(url);

      // Schedule auto-refresh before the signed URL expires
      refreshTimerRef.current = setTimeout(() => {
        fetchSignedUrl();
      }, REFRESH_BUFFER_MS);
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

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  return { signedUrl, isLoading, error, refresh: fetchSignedUrl };
}
