import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) {
    return auth.response
  }
  const { user, supabase } = auth

  try {
    console.log('[Mark All Read API] Marking all notifications as read for user:', user.id)

    // Use RPC function to mark all as read
    const { data: count, error: rpcError } = await supabase
      .rpc('mark_all_notifications_read', { p_user_id: user.id })

    if (rpcError) {
      console.error('[Mark All Read API] Error marking all as read:', rpcError)
      return jsonResponse(
        { error: 'Failed to mark all notifications as read', details: rpcError.message },
        500
      )
    }

    console.log('[Mark All Read API] Successfully marked', count, 'notifications as read')

    return jsonResponse({
      success: true,
      count: count || 0,
    })
  } catch (error) {
    console.error('[Mark All Read API] Unhandled exception:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse(
      { error: 'Internal server error', details: errorMessage },
      500
    )
  }
})
