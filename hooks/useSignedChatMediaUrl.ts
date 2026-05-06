import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const REFRESH_BUFFER_MS = 50 * 60 * 1000; // Refresh 50 min into a 1h TTL.
const CACHE_MAX_AGE_MS = 50 * 60 * 1000;

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
    `/api/chat-media/sign?path=${encodeURIComponent(path)}`,
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

export function clearChatMediaSignedUrlCache(): void {
  urlCache.clear();
}

interface UseSignedChatMediaUrlResult {
  signedUrl: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Resolves a signed URL for a private chat-media storage path. Caches
 * in-memory and auto-refreshes ahead of the 1h TTL so a chat tab kept open
 * for hours keeps rendering attachments without a manual refresh.
 */
export function useSignedChatMediaUrl(
  filePath: string | null | undefined,
): UseSignedChatMediaUrlResult {
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
