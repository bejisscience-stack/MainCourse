/**
 * Dynamic CORS for Edge Functions
 * Checks Origin against an allowlist instead of using wildcard '*'
 */

const ALLOWED_ORIGINS = [
  "https://swavleba.ge",
  "https://www.swavleba.ge",
  "https://plankton-app-wpsym.ondigitalocean.app",
  "http://localhost:3000",
];

/**
 * Build CORS headers for the given request.
 * Returns matched origin or omits Access-Control-Allow-Origin entirely.
 * @param req - The incoming request
 * @param extraAllowedHeaders - Additional headers to allow (e.g. 'x-scraper-secret')
 */
export function getCorsHeaders(
  req: Request,
  extraAllowedHeaders: string[] = [],
): Record<string, string> {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": [
      "authorization",
      "x-client-info",
      "apikey",
      "content-type",
      "cache-control",
      ...extraAllowedHeaders,
    ].join(", "),
  };

  if (ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

/**
 * Handle CORS preflight requests
 * @returns Response for OPTIONS request, or null if not a preflight
 */
export function handleCors(
  req: Request,
  extraAllowedHeaders: string[] = [],
): Response | null {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: getCorsHeaders(req, extraAllowedHeaders),
    });
  }
  return null;
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  error: string,
  status: number = 500,
  corsHeaders: Record<string, string> = {},
): Response {
  return jsonResponse({ error }, status, corsHeaders);
}
