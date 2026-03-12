/**
 * Validates a redirect URL to prevent open redirect attacks.
 * Only allows relative paths (starting with /) that aren't protocol-relative (//).
 */
export function validateRedirectUrl(url: string | null): string | null {
  if (!url) return null;
  // Safe: starts with / but not //
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return null;
}
