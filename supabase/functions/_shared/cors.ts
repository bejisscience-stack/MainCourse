/**
 * CORS headers for Edge Functions
 * Include these headers in ALL responses (including errors)
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, cache-control',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

/**
 * Handle CORS preflight requests
 * Call this at the start of every Edge Function
 * @returns Response for OPTIONS request, or null if not a preflight
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  return null
}

/**
 * Create a JSON response with CORS headers
 */
export function jsonResponse(
  data: unknown,
  status: number = 200
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  error: string,
  status: number = 500
): Response {
  return jsonResponse({ error }, status)
}
