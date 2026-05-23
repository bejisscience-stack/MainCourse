"use client";

import { useProjectResourceUrl } from "@/hooks/useProjectResourceUrl";

export function ProjectResourceMedia({
  projectId,
  resourceType,
  url,
  title,
}: {
  projectId: string;
  resourceType: "image" | "video" | "link";
  url: string;
  title?: string | null;
}) {
  const { signedUrl, isLoading } = useProjectResourceUrl(projectId, url);

  if (resourceType === "link") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-charcoal-200 dark:border-navy-700 bg-white dark:bg-navy-900/60 text-emerald-600 dark:text-emerald-400 hover:bg-charcoal-50 dark:hover:bg-navy-800 transition-colors text-sm font-medium break-all"
      >
        <svg
          className="w-4 h-4 shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
        {title || url}
      </a>
    );
  }

  if (isLoading) {
    return (
      <div className="h-40 rounded-xl bg-charcoal-100 dark:bg-navy-800 animate-pulse" />
    );
  }

  if (!signedUrl) return null;

  if (resourceType === "image") {
    return (
      <figure className="rounded-xl overflow-hidden border border-charcoal-200 dark:border-navy-700 bg-white dark:bg-navy-900/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={signedUrl}
          alt={title || "Project resource"}
          className="w-full max-h-96 object-contain bg-charcoal-50 dark:bg-navy-950"
        />
        {title ? (
          <figcaption className="px-3 py-2 text-sm text-charcoal-600 dark:text-gray-400">
            {title}
          </figcaption>
        ) : null}
      </figure>
    );
  }

  return (
    <figure className="rounded-xl overflow-hidden border border-charcoal-200 dark:border-navy-700 bg-black">
      <video
        src={signedUrl}
        controls
        className="w-full max-h-96"
        preload="metadata"
      />
      {title ? (
        <figcaption className="px-3 py-2 text-sm text-charcoal-600 dark:text-gray-400 bg-white dark:bg-navy-900/40">
          {title}
        </figcaption>
      ) : null}
    </figure>
  );
}
