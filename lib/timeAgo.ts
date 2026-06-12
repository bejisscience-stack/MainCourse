/** Compact relative timestamp, localized for en/ge. */
export function timeAgo(iso: string, locale: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return locale === "ge" ? "ახლახან" : "just now";
  if (diffMin < 60)
    return locale === "ge" ? `${diffMin} წთ-ის წინ` : `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24)
    return locale === "ge" ? `${diffH} სთ-ის წინ` : `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return locale === "ge" ? `${diffD} დღის წინ` : `${diffD}d ago`;
  return new Date(iso).toLocaleDateString(locale === "ge" ? "ka-GE" : "en-US", {
    month: "short",
    day: "numeric",
  });
}
