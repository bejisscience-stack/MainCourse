import type { ReactNode } from "react";
import {
  splitUrlTrailingPunctuation,
  toSafeHref,
  URL_PATTERN,
} from "@/lib/url-utils";

interface LinkifiedTextProps {
  text: string;
  className?: string;
  linkClassName?: string;
}

const DEFAULT_LINK_CLASS =
  "text-emerald-400 hover:text-emerald-300 underline underline-offset-2 break-all";

export default function LinkifiedText({
  text,
  className = "",
  linkClassName = DEFAULT_LINK_CLASS,
}: LinkifiedTextProps) {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  const pattern = new RegExp(URL_PATTERN.source, URL_PATTERN.flags);

  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    const rawMatch = match[0];

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    const { url, trailing } = splitUrlTrailingPunctuation(rawMatch);
    const href = toSafeHref(url);

    if (href) {
      parts.push(
        <a
          key={key++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClassName}
        >
          {url}
        </a>,
      );
      if (trailing) {
        parts.push(trailing);
      }
    } else {
      parts.push(rawMatch);
    }

    lastIndex = start + rawMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <div
      className={`whitespace-pre-wrap break-words leading-relaxed ${className}`.trim()}
    >
      {parts.length > 0 ? parts : text}
    </div>
  );
}
