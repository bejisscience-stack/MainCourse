import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow GET
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) {
    return auth.response
  }
  const { user, supabase } = auth

  try {
    // Use RPC function to get count
    const { data: count, error: rpcError } = await supabase
      .rpc('get_unread_notification_count', { p_user_id: user.id })

    if (rpcError) {
      console.error('[Unread Count API] Error getting unread count:', rpcError)
      return jsonResponse(
        { error: 'Failed to get unread count', details: rpcError.message },
        500
      )
    }

    return jsonResponse({
      count: count || 0,
    })
  } catch (error) {
    console.error('[Unread Count API] Unhandled exception:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse(
      { error: 'Internal server error', details: errorMessage },
      500
    )
  }
})
