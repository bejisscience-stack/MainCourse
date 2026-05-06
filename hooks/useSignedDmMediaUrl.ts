import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const REFRESH_BUFFER_MS = 12 * 60 * 1000; // Refresh 12 min into a 15 min TTL.
const CACHE_MAX_AGE_MS = 12 * 60 * 1000;

interface CacheEntry {
  signedUrl: string;
  fetchedAt: number;
}

const urlCache = new Map<string, CacheEntry>();

function getCached(path: string): string | null {
  const entry = urlCache.get(path);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_MAX_AGE_MS) {
    urlCache.delete(path);
    return null;
  }
  return entry.signedUrl;
}

async function fetchSignedUrl(path: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const res = await fetch(
    `/api/dm/media-url?path=${encodeURIComponent(path)}`,
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

export function clearDmSignedUrlCache(): void {
  urlCache.clear();
}

interface UseSignedDmMediaUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolves a signed URL for a private dm-media storage path. Caches in-memory
 * and auto-refreshes before the 15 min TTL expires so long-lived chat sessions
 * don't break.
 */
export function useSignedDmMediaUrl(
  filePath: string | null | undefined,
): UseSignedDmMediaUrlResult {
  const initialCached = filePath ? getCached(filePath) : null;
  const [signedUrl, setSignedUrl] = useState<string | null>(initialCached);
  const [isLoading, setIsLoading] = useState(!initialCached && !!filePath);
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (skipCache = false) => {
      if (!filePath) return;

      if (!skipCache) {
        const cached = getCached(filePath);
        if (cached) {
          setSignedUrl(cached);
          setIsLoading(false);
          setError(null);
          const entry = urlCache.get(filePath);
          if (entry) {
            const remaining =
              REFRESH_BUFFER_MS - (Date.now() - entry.fetchedAt);
            if (remaining > 0) {
              if (refreshTimerRef.current)
                clearTimeout(refreshTimerRef.current);
              refreshTimerRef.current = setTimeout(() => load(true), remaining);
            }
          }
          return;
        }
      }

      setIsLoading(true);
      setError(null);
      const fetchId = ++fetchIdRef.current;

      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      try {
        const url = await fetchSignedUrl(filePath);
        if (fetchId !== fetchIdRef.current) return;

        urlCache.set(filePath, { signedUrl: url, fetchedAt: Date.now() });
        setSignedUrl(url);

        refreshTimerRef.current = setTimeout(
          () => load(true),
          REFRESH_BUFFER_MS,
        );
      } catch (err) {
        if (fetchId === fetchIdRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setSignedUrl(null);
        }
      } finally {
        if (fetchId === fetchIdRef.current) setIsLoading(false);
      }
    },
    [filePath],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  return { signedUrl, isLoading, error };
}
