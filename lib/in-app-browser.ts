/**
 * Detects "in-app browsers" — embedded WebViews used by social/messaging apps
 * (Instagram, Facebook, Messenger, TikTok, LinkedIn, Twitter/X, Snapchat,
 * Pinterest, Line, WeChat, Telegram, plus generic Android WebViews).
 *
 * Google's OAuth identity service rejects sign-in attempts from these
 * user-agents with `Error 403: disallowed_useragent`, so we use this to hide
 * the "Continue with Google" button and prompt users to open the site in
 * Safari / Chrome instead.
 */

export type InAppBrowserApp =
  | "instagram"
  | "facebook"
  | "messenger"
  | "tiktok"
  | "linkedin"
  | "twitter"
  | "snapchat"
  | "pinterest"
  | "line"
  | "wechat"
  | "telegram"
  | "androidWebView"
  | "other";

export interface InAppBrowserResult {
  isInApp: boolean;
  app?: InAppBrowserApp;
}

const PATTERNS: Array<{ app: InAppBrowserApp; regex: RegExp }> = [
  { app: "instagram", regex: /Instagram/i },
  { app: "facebook", regex: /FBAN|FBAV|FB_IAB|FB4A/i },
  { app: "messenger", regex: /Messenger/i },
  { app: "tiktok", regex: /TikTok|musical_ly|BytedanceWebview/i },
  { app: "linkedin", regex: /LinkedInApp/i },
  { app: "twitter", regex: /Twitter|TwitterAndroid/i },
  { app: "snapchat", regex: /Snapchat/i },
  { app: "pinterest", regex: /Pinterest/i },
  { app: "line", regex: /\bLine\//i },
  { app: "wechat", regex: /MicroMessenger/i },
  { app: "telegram", regex: /TelegramBot|Telegram/i },
  { app: "androidWebView", regex: /Android.*;\s*wv\b/i },
];

export function detectInAppBrowser(userAgent: string): InAppBrowserResult {
  if (!userAgent) return { isInApp: false };

  for (const { app, regex } of PATTERNS) {
    if (regex.test(userAgent)) return { isInApp: true, app };
  }

  // iOS WKWebView heuristic: AppleWebKit but no Safari token and no CriOS/FxiOS.
  // Real Mobile Safari includes "Safari/" — embedded WKWebViews typically omit it.
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  if (isIOS) {
    const hasSafari = /Safari\//.test(userAgent);
    const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/.test(userAgent);
    if (!hasSafari && !isOtherBrowser) {
      return { isInApp: true, app: "other" };
    }
  }

  return { isInApp: false };
}
