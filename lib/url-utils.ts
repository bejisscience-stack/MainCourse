/** SEC-10: Only allow http/https URLs to prevent javascript: protocol XSS */
export function isSafeUrl(url: string): boolean {
  try {
    const p = new URL(url);
    return ["http:", "https:"].includes(p.protocol);
  } catch {
    return false;
  }
}

/** Normalize a detected URL fragment into a safe absolute href, or null if unsafe. */
export function toSafeHref(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let href = trimmed;
  if (/^www\./i.test(href)) {
    href = `https://${href}`;
  } else if (!/^https?:\/\//i.test(href)) {
    href = `https://${href}`;
  }

  return isSafeUrl(href) ? href : null;
}

const TRAILING_PUNCTUATION = /[.,;:!?)}\]'"]+$/;

/** Split trailing punctuation from a URL match for href vs display text. */
export function splitUrlTrailingPunctuation(match: string): {
  url: string;
  trailing: string;
} {
  const trailingMatch = match.match(TRAILING_PUNCTUATION);
  if (!trailingMatch) {
    return { url: match, trailing: "" };
  }
  return {
    url: match.slice(0, -trailingMatch[0].length),
    trailing: trailingMatch[0],
  };
}

/**
 * Matches http(s) URLs, www URLs, and bare domains (e.g. swavleba.ge).
 * Bare domains require a letter-only TLD to avoid matching dotted abbreviations.
 */
export const URL_PATTERN =
  /(?:https?:\/\/[^\s<]+|(?<![@\w])www\.[^\s<]+|(?<![@\w.])[a-zA-Z0-9][-a-zA-Z0-9]*(?:\.[a-zA-Z0-9][-a-zA-Z0-9]*)*\.[a-zA-Z]{2,}(?:\/[^\s<]*)?)/gi;
