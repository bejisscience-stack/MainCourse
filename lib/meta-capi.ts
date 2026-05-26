/**
 * Meta Conversions API (server-side Pixel) helper.
 *
 * Server-to-server event reporting that mirrors browser-side fbq() calls.
 * Recovers ~30% of events that iOS 14+ Intelligent Tracking Prevention or
 * ad-blockers silently drop from the browser Pixel.
 *
 * Deduplication: pass the SAME `event_id` here and as `eventID` in the
 * matching browser fbq() call. Meta merges both into one Pixel event so we
 * don't double-count, but if the browser one is blocked, the server one wins.
 *
 * Required env:
 *   META_PIXEL_ID                — same Pixel ID as in <Script> in layout.tsx
 *   META_CAPI_ACCESS_TOKEN       — any token with ads_management scope;
 *                                  generated in Events Manager → Settings or
 *                                  reused from the existing Marketing API token
 *
 * No-op (returns gracefully) if env is missing — keeps payment success path
 * from failing in dev/staging where these aren't configured.
 */
import crypto from "node:crypto";

const GRAPH_VERSION = "v21.0";

function sha256(input: string): string {
  return crypto
    .createHash("sha256")
    .update(input.trim().toLowerCase(), "utf8")
    .digest("hex");
}

export interface CapiEventInput {
  /**
   * UUID shared with the matching browser fbq() call as `eventID` for
   * deduplication. Use the payment record's `id` (a uuid) for Purchase events.
   */
  eventId: string;
  eventName:
    | "Purchase"
    | "InitiateCheckout"
    | "CompleteRegistration"
    | "Lead"
    | "AddToCart"
    | "ViewContent"
    | "PageView"
    | "Subscribe"
    | "StartTrial";
  /**
   * Unix seconds when the event happened. Defaults to now.
   * Must be within the last 7 days or Meta rejects.
   */
  eventTime?: number;
  /** Full URL where the event happened (helps Meta debug & attribute). */
  eventSourceUrl?: string;
  /** Action source — "website" for web purchases, others for app/store/etc. */
  actionSource?: "website" | "email" | "phone_call" | "chat" | "other_offline";
  /** PII for matching — all hashed before sending. */
  userData?: {
    email?: string | null;
    phone?: string | null;
    /** Internal user id from your DB — hashed; helps build Custom Audiences. */
    externalId?: string | null;
    /** Browser fbp cookie value (if you can capture & forward it). */
    fbp?: string | null;
    /** Browser fbc cookie value (click ID from ad click). */
    fbc?: string | null;
    /** Remote client IP if known. */
    clientIpAddress?: string | null;
    /** Browser User-Agent if known. */
    clientUserAgent?: string | null;
  };
  /** Event-specific data — value, currency, content_ids, etc. */
  customData?: Record<string, unknown>;
}

interface CapiResponse {
  ok: boolean;
  /** Meta's events_received count, or undefined on failure. */
  eventsReceived?: number;
  /** fbtrace_id for debugging via Events Manager. */
  fbtraceId?: string;
  error?: string;
  /** True when env wasn't configured — caller can treat as soft-skip. */
  skipped?: boolean;
}

/**
 * Send a single event to Meta's Conversions API. Never throws — returns a
 * status object the caller can log. Designed to be called from a Next.js
 * server-side route handler (webhook, API route, etc.).
 */
export async function sendCapiEvent(
  input: CapiEventInput,
): Promise<CapiResponse> {
  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!pixelId || !token) {
    return {
      ok: false,
      skipped: true,
      error: "META_PIXEL_ID or META_CAPI_ACCESS_TOKEN not set — skipped",
    };
  }

  const ud: Record<string, string[] | string> = {};
  if (input.userData?.email) ud.em = [sha256(input.userData.email)];
  if (input.userData?.phone) {
    // Phone must be E.164-ish (digits only, with country code), then hashed.
    const digits = input.userData.phone.replace(/[^\d]/g, "");
    if (digits) ud.ph = [sha256(digits)];
  }
  if (input.userData?.externalId)
    ud.external_id = [sha256(String(input.userData.externalId))];
  if (input.userData?.fbp) ud.fbp = input.userData.fbp;
  if (input.userData?.fbc) ud.fbc = input.userData.fbc;
  if (input.userData?.clientIpAddress)
    ud.client_ip_address = input.userData.clientIpAddress;
  if (input.userData?.clientUserAgent)
    ud.client_user_agent = input.userData.clientUserAgent;

  const body = {
    data: [
      {
        event_name: input.eventName,
        event_time: input.eventTime ?? Math.floor(Date.now() / 1000),
        event_id: input.eventId,
        action_source: input.actionSource ?? "website",
        ...(input.eventSourceUrl && {
          event_source_url: input.eventSourceUrl,
        }),
        user_data: ud,
        ...(input.customData && { custom_data: input.customData }),
      },
    ],
    // Add this when iterating to keep the live Pixel clean:
    //   test_event_code: "TESTXXXXX"
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    const json = (await res.json().catch(() => ({}))) as {
      events_received?: number;
      fbtrace_id?: string;
      error?: { message?: string };
    };
    if (!res.ok) {
      return {
        ok: false,
        error: json.error?.message || `HTTP ${res.status}`,
        fbtraceId: json.fbtrace_id,
      };
    }
    return {
      ok: true,
      eventsReceived: json.events_received,
      fbtraceId: json.fbtrace_id,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
