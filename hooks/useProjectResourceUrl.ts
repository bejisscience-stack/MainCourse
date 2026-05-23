"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isStoragePath } from "@/lib/project-resources";

const CACHE_MAX_AGE_MS = 50 * 60 * 1000;

interface CacheEntry {
  signedUrl: string;
  fetchedAt: number;
}

const urlCache = new Map<string, CacheEntry>();

function cacheKey(projectId: string, path: string): string {
  return `${projectId}:${path}`;
}

function getCached(projectId: string, path: string): string | null {
  const key = cacheKey(projectId, path);
  const entry = urlCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_MAX_AGE_MS) {
    urlCache.delete(key);
    return null;
  }
  return entry.signedUrl;
}

async function fetchSignedUrl(
  projectId: string,
  path: string,
): Promise<string> {
  const headers: Record<string, string> = {};
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  const res = await fetch(
    `/api/project-media/sign?path=${encodeURIComponent(path)}&projectId=${encodeURIComponent(projectId)}`,
    { headers },
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  const { signedUrl } = await res.json();
  return signedUrl;
}

export function useProjectResourceUrl(
  projectId: string | null | undefined,
  url: string | null | undefined,
): { signedUrl: string | null; isLoading: boolean; error: Error | null } {
  const isPath = isStoragePath(url);
  const initialCached =
    projectId && url && isPath ? getCached(projectId, url) : null;
  const [signedUrl, setSignedUrl] = useState<string | null>(
    !isPath ? (url ?? null) : initialCached,
  );
  const [isLoading, setIsLoading] = useState(
    !!projectId && !!url && isPath && !initialCached,
  );
  const [error, setError] = useState<Error | null>(null);
  const fetchIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!projectId || !url) {
      setSignedUrl(null);
      setIsLoading(false);
      return;
    }

    if (!isStoragePath(url)) {
      setSignedUrl(url);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = getCached(projectId, url);
    if (cached) {
      setSignedUrl(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    const fetchId = ++fetchIdRef.current;

    try {
      const resolved = await fetchSignedUrl(projectId, url);
      if (fetchId !== fetchIdRef.current) return;
      urlCache.set(cacheKey(projectId, url), {
        signedUrl: resolved,
        fetchedAt: Date.now(),
      });
      setSignedUrl(resolved);
    } catch (err) {
      if (fetchId === fetchIdRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
        setSignedUrl(null);
      }
    } finally {
      if (fetchId === fetchIdRef.current) setIsLoading(false);
    }
  }, [projectId, url]);

  useEffect(() => {
    load();
  }, [load]);

  return { signedUrl, isLoading, error };
}
