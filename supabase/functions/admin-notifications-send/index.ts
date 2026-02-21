import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'

interface AdminNotificationPayload {
  target_type: 'all' | 'role' | 'course' | 'specific'
  target_role?: string
  target_course_id?: string
  target_user_ids?: string[]
  title: { en: string; ge: string }
  message: { en: string; ge: string }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) return auth.response
  const { user, supabase } = auth

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    return errorResponse('Forbidden: Admin access required', 403)
  }

  try {
    const body: AdminNotificationPayload = await req.json()
    const { target_type, target_role, target_course_id, target_user_ids, title, message } = body

    if (!target_type) {
      return errorResponse('target_type is required', 400)
    }

    if (!title?.en || !title?.ge) {
      return errorResponse('Title in both English and Georgian is required', 400)
    }

    if (!message?.en || !message?.ge) {
      return errorResponse('Message in both English and Georgian is required', 400)
    }

    console.log('[Admin Notifications API] Sending notifications:', {
      target_type,
      target_role,
      target_course_id,
      target_user_ids_count: target_user_ids?.length,
      admin_id: user.id,
    })

    const serviceSupabase = createServiceRoleClient()
    let userIds: string[] = []

    switch (target_type) {
      case 'all': {
        const { data: allProfiles, error: allError } = await serviceSupabase
          .from('profiles')
          .select('id')

        if (allError) {
          console.error('[Admin Notifications API] Error fetching all users:', allError)
          return jsonResponse(
            { error: 'Failed to fetch users', details: allError.message },
            500
          )
        }

        userIds = allProfiles?.map(p => p.id) || []
        break
      }

      case 'role': {
        if (!target_role) {
          return errorResponse('target_role is required when target_type is "role"', 400)
        }

        const { data: roleUserIds, error: roleError } = await serviceSupabase
          .rpc('get_user_ids_by_role', { p_role: target_role })

        if (roleError) {
          console.error('[Admin Notifications API] Error fetching users by role:', roleError)
          return jsonResponse(
            { error: 'Failed to fetch users by role', details: roleError.message },
            500
          )
        }

        userIds = roleUserIds || []
        break
      }

      case 'course': {
        if (!target_course_id) {
          return errorResponse('target_course_id is required when target_type is "course"', 400)
        }

        const { data: courseUserIds, error: courseError } = await serviceSupabase
          .rpc('get_enrolled_user_ids', { p_course_id: target_course_id })

        if (courseError) {
          console.error('[Admin Notifications API] Error fetching enrolled users:', courseError)
          return jsonResponse(
            { error: 'Failed to fetch enrolled users', details: courseError.message },
            500
          )
        }

        userIds = courseUserIds || []
        break
      }

      case 'specific': {
        if (!target_user_ids || target_user_ids.length === 0) {
          return errorResponse('target_user_ids is required when target_type is "specific"', 400)
        }

        userIds = target_user_ids
        break
      }

      default:
        return errorResponse('Invalid target_type', 400)
    }

    if (userIds.length === 0) {
      return errorResponse('No users found for the specified target', 400)
    }

    const { data: count, error: sendError } = await serviceSupabase
      .rpc('send_bulk_notifications', {
        p_user_ids: userIds,
        p_type: 'admin_message',
        p_title_en: title.en,
        p_title_ge: title.ge,
        p_message_en: message.en,
        p_message_ge: message.ge,
        p_metadata: {},
        p_created_by: user.id,
      })

    if (sendError) {
      console.error('[Admin Notifications API] Error sending notifications:', sendError)
      return jsonResponse(
        { error: 'Failed to send notifications', details: sendError.message },
        500
      )
    }

    console.log('[Admin Notifications API] Successfully sent', count, 'notifications')

    return jsonResponse({
      success: true,
      count: count || userIds.length,
      message: `Successfully sent ${count || userIds.length} notifications`,
    })
  } catch (error) {
    console.error('[Admin Notifications API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
