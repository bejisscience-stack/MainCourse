import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'
import { sendEnrollmentApprovedEmail } from '../_shared/email.ts'

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
    const body = await req.json()
    const { requestId } = body

    if (!requestId) {
      return errorResponse('requestId is required', 400)
    }

    console.log('[Approve API] Attempting to approve request:', requestId)

    const { error: approveError } = await supabase.rpc('approve_enrollment_request', {
      request_id: requestId,
    })

    if (approveError) {
      console.error('[Approve API] Error:', approveError)
      return jsonResponse(
        {
          error: 'Failed to approve enrollment request',
          details: approveError.message,
          code: approveError.code,
        },
        500
      )
    }

    const serviceSupabase = createServiceRoleClient()
    const { data: updatedRequest, error: verifyError } = await serviceSupabase
      .from('enrollment_requests')
      .select('id, status, updated_at, user_id, course_id, courses(title)')
      .eq('id', requestId)
      .single()

    if (verifyError) {
      console.error('[Approve API] Error verifying:', verifyError)
    } else {
      console.log('[Approve API] Approved, status:', updatedRequest?.status)

      if (updatedRequest?.user_id) {
        const courseTitle = (updatedRequest.courses as { title?: string } | null)?.title || 'Unknown Course'

        try {
          await serviceSupabase.rpc('create_notification', {
            p_user_id: updatedRequest.user_id,
            p_type: 'enrollment_approved',
            p_title_en: 'Enrollment Approved',
            p_title_ge: 'რეგისტრაცია დამტკიცებულია',
            p_message_en: `Your enrollment request for "${courseTitle}" has been approved. You can now access the course.`,
            p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა კურსზე "${courseTitle}" დამტკიცებულია. ახლა შეგიძლიათ კურსზე წვდომა.`,
            p_metadata: {
              course_id: updatedRequest.course_id,
              course_title: courseTitle,
              request_id: requestId,
            },
            p_created_by: user.id,
          })
          console.log('[Approve API] Notification created')
        } catch (notifError) {
          console.error('[Approve API] Notification error:', notifError)
        }

        try {
          const { data: userProfile } = await serviceSupabase
            .from('profiles')
            .select('email')
            .eq('id', updatedRequest.user_id)
            .single()

          if (userProfile?.email) {
            await sendEnrollmentApprovedEmail(userProfile.email, courseTitle)
            console.log('[Approve API] Email sent to:', userProfile.email)
          }
        } catch (emailError) {
          console.error('[Approve API] Email error:', emailError)
        }
      }
    }

    return jsonResponse({
      message: 'Enrollment request approved successfully',
      success: true,
    })
  } catch (error) {
    console.error('[Approve API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
