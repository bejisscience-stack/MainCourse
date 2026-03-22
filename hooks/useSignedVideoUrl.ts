import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { extractStoragePath } from "@/lib/video-url-parser";

const REFRESH_BUFFER_MS = 12 * 60 * 1000; // Refresh 12 min into a 15 min TTL
const CACHE_MAX_AGE_MS = 12 * 60 * 1000; // Cache valid for 12 min

// ── In-memory signed URL cache (shared across all hook instances) ──
interface CacheEntry {
  signedUrl: string;
  fetchedAt: number;
  refreshTimer: ReturnType<typeof setTimeout> | null;
}

const urlCache = new Map<string, CacheEntry>();

function getCacheKey(courseId: string, videoUrl: string): string {
  return `${courseId}::${videoUrl}`;
}

function getCached(courseId: string, videoUrl: string): string | null {
  const entry = urlCache.get(getCacheKey(courseId, videoUrl));
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_MAX_AGE_MS) {
    // Expired — remove from cache
    if (entry.refreshTimer) clearTimeout(entry.refreshTimer);
    urlCache.delete(getCacheKey(courseId, videoUrl));
    return null;
  }
  return entry.signedUrl;
}

// ── Core fetch function (used by hook and prefetch) ──
async function fetchSignedUrlFromApi(
  courseId: string,
  storagePath: string,
): Promise<string> {
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

  const { signedUrl } = await res.json();
  return signedUrl;
}

// ── Prefetch: call from outside React to warm the cache ──
// In-flight tracking to prevent duplicate requests
const inFlight = new Map<string, Promise<string | null>>();

export function prefetchSignedUrl(
  courseId: string,
  videoUrl: string,
): Promise<string | null> {
  if (!courseId || !videoUrl) return Promise.resolve(null);

  // Already cached and fresh
  const cached = getCached(courseId, videoUrl);
  if (cached) return Promise.resolve(cached);

  const cacheKey = getCacheKey(courseId, videoUrl);

  // Already fetching
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const storagePath = extractStoragePath(videoUrl, "course-videos");
  if (!storagePath) return Promise.resolve(null);

  const promise = fetchSignedUrlFromApi(courseId, storagePath)
    .then((url) => {
      // Store in cache
      const prev = urlCache.get(cacheKey);
      if (prev?.refreshTimer) clearTimeout(prev.refreshTimer);

      urlCache.set(cacheKey, {
        signedUrl: url,
        fetchedAt: Date.now(),
        refreshTimer: null,
      });
      return url;
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
}

/** Clear all cached URLs (e.g., on course change) */
export function clearSignedUrlCache(): void {
  for (const entry of urlCache.values()) {
    if (entry.refreshTimer) clearTimeout(entry.refreshTimer);
  }
  urlCache.clear();
}

// ── React hook ──
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
  const cacheKey = videoUrl ? getCacheKey(courseId, videoUrl) : null;
  const initialCached = videoUrl ? getCached(courseId, videoUrl) : null;

  const [signedUrl, setSignedUrl] = useState<string | null>(initialCached);
  const [isLoading, setIsLoading] = useState(!initialCached);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSignedUrl = useCallback(
    async (skipCache = false) => {
      if (!videoUrl || !courseId) return;

      const storagePath = extractStoragePath(videoUrl, "course-videos");
      if (!storagePath) {
        setError(new Error("Invalid video URL format"));
        return;
      }

      // Check cache first (unless forced refresh)
      if (!skipCache) {
        const cached = getCached(courseId, videoUrl);
        if (cached) {
          setSignedUrl(cached);
          setIsLoading(false);
          setError(null);
          // Schedule refresh for remaining TTL
          const entry = urlCache.get(getCacheKey(courseId, videoUrl));
          if (entry) {
            const elapsed = Date.now() - entry.fetchedAt;
            const remaining = REFRESH_BUFFER_MS - elapsed;
            if (remaining > 0) {
              if (refreshTimerRef.current)
                clearTimeout(refreshTimerRef.current);
              refreshTimerRef.current = setTimeout(
                () => fetchSignedUrl(true),
                remaining,
              );
            }
          }
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      const currentFetchId = ++fetchIdRef.current;

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      try {
        const url = await fetchSignedUrlFromApi(courseId, storagePath);

        if (currentFetchId !== fetchIdRef.current) return;

        // Store in cache
        const key = getCacheKey(courseId, videoUrl);
        const prev = urlCache.get(key);
        if (prev?.refreshTimer) clearTimeout(prev.refreshTimer);

        urlCache.set(key, {
          signedUrl: url,
          fetchedAt: Date.now(),
          refreshTimer: null,
        });

        setSignedUrl(url);

        // Schedule auto-refresh before the signed URL expires
        refreshTimerRef.current = setTimeout(() => {
          fetchSignedUrl(true);
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
    },
    [courseId, videoUrl],
  );

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

  return {
    signedUrl,
    isLoading,
    error,
    refresh: () => fetchSignedUrl(true),
  };
}
