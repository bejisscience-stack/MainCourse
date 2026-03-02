import type { Platform } from '@/types/view-scraper';

/**
 * Detect platform from a video URL
 */
export function detectPlatform(url: string): Platform | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes('tiktok.com')) return 'tiktok';
    if (hostname.includes('instagram.com')) return 'instagram';
    return null;
  } catch {
    return null;
  }
}

interface ExtractedUrl {
  platform: Platform;
  originalUrl: string;
}

/**
 * Extract all video URLs from a submission's platform_links and video_url fields
 */
export function extractVideoUrls(submission: {
  video_url?: string | null;
  platform_links?: Record<string, string> | null;
}): ExtractedUrl[] {
  const urls: ExtractedUrl[] = [];
  const seen = new Set<string>();

  // Extract from platform_links JSONB
  if (submission.platform_links) {
    for (const [, url] of Object.entries(submission.platform_links)) {
      if (typeof url === 'string' && url.trim()) {
        const platform = detectPlatform(url);
        if (platform && !seen.has(url)) {
          seen.add(url);
          urls.push({ platform, originalUrl: url });
        }
      }
    }
  }

  // Fallback to video_url
  if (submission.video_url && !seen.has(submission.video_url)) {
    const platform = detectPlatform(submission.video_url);
    if (platform) {
      urls.push({ platform, originalUrl: submission.video_url });
    }
  }

  return urls;
}
