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
    // Get notification ID from body or query
    const url = new URL(req.url)
    let notificationId = url.searchParams.get('notificationId')

    // Also try to get from body
    if (!notificationId) {
      try {
        const body = await req.json()
        notificationId = body.notificationId || body.id
      } catch {
        // Body might be empty or not JSON
      }
    }

    if (!notificationId) {
      return errorResponse('Notification ID is required (in body as notificationId or query param)', 400)
    }

    console.log('[Mark Read API] Marking notification as read:', notificationId, 'for user:', user.id)

    // Update the notification - RLS ensures only owner can update
    const { data: notification, error: updateError } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId)
      .eq('user_id', user.id) // Extra security check
      .select()
      .single()

    if (updateError) {
      console.error('[Mark Read API] Error updating notification:', updateError)

      if (updateError.code === 'PGRST116') {
        return jsonResponse(
          { error: 'Notification not found or you do not have permission to update it' },
          404
        )
      }

      return jsonResponse(
        { error: 'Failed to mark notification as read', details: updateError.message },
        500
      )
    }

    console.log('[Mark Read API] Successfully marked notification as read:', notificationId)

    return jsonResponse({
      success: true,
      notification,
    })
  } catch (error) {
    console.error('[Mark Read API] Unhandled exception:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return jsonResponse(
      { error: 'Internal server error', details: errorMessage },
      500
    )
  }
})
