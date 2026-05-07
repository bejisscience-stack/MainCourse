import type { Platform } from "@/types/view-scraper";

const PLATFORM_HOSTNAMES: Record<string, string[]> = {
  tiktok: ["tiktok.com"],
  instagram: ["instagram.com"],
};

// Exact-or-subdomain match. `tiktok.com.evil.com` does not match `tiktok.com`.
function hostnameMatches(hostname: string, allowed: string): boolean {
  return hostname === allowed || hostname.endsWith("." + allowed);
}

/**
 * Validate that a URL belongs to the expected platform.
 * Returns true for unknown platforms (safe default — don't block).
 * Returns false for invalid URLs.
 */
export function validatePlatformUrl(platform: string, url: string): boolean {
  const allowedHostnames = PLATFORM_HOSTNAMES[platform.toLowerCase()];
  if (!allowedHostnames) return true;

  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return allowedHostnames.some((allowed) =>
      hostnameMatches(hostname, allowed),
    );
  } catch {
    return false;
  }
}

/**
 * Detect platform from a video URL
 */
export function detectPlatform(url: string): Platform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostnameMatches(hostname, "tiktok.com")) return "tiktok";
    if (hostnameMatches(hostname, "instagram.com")) return "instagram";
    return null;
  } catch {
    return null;
  }
}

/**
 * Extract the storage path from a Supabase public URL.
 * e.g., "https://xxx.supabase.co/storage/v1/object/public/course-videos/abc/vid.mp4"
 *   → "abc/vid.mp4"
 */
export function extractStoragePath(
  publicUrl: string,
  bucket: string,
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.substring(idx + marker.length);
}
