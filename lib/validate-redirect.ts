/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows relative paths (starting with /) that aren't protocol-relative (//).
 * Also blocks backslash URLs which some browsers normalize to forward slashes.
 */
export function validateRedirectUrl(url: string | null): string | null {
  if (!url) return null;
  // SEC-14: Block backslash URLs — browsers may normalize \ to / making /\evil.com → //evil.com
  if (url.includes("\\")) return null;
  // Safe: starts with / but not //
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}
