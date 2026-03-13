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
    // Parse query parameters
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = parseInt(url.searchParams.get('limit') || '20', 10)
    const unreadOnly = url.searchParams.get('unread') === 'true'

    const offset = (page - 1) * limit

    console.log('[Notifications API] Fetching notifications for user:', user.id, { page, limit, unreadOnly })

    // Build query
    let query = supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    const { data: notifications, error: fetchError, count } = await query

    if (fetchError) {
      console.error('[Notifications API] Error fetching notifications:', fetchError)
      return jsonResponse(
        { error: 'Failed to fetch notifications', details: fetchError.message },
        500
      )
    }

    const total = count || 0
    const hasMore = offset + limit < total

    return jsonResponse({
      notifications: notifications || [],
      total,
      page,
      limit,
      hasMore,
    })
  } catch (error) {
    console.error('[Notifications API] Unhandled exception:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse(
      { error: 'Internal server error', details: errorMessage },
      500
    )
  }
})
