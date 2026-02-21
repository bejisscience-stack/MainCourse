import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'
import { sendBundleEnrollmentApprovedEmail } from '../_shared/email.ts'

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

    console.log('[Approve API] Attempting to approve bundle request:', requestId)

    const { error: approveError } = await supabase.rpc('approve_bundle_enrollment_request', {
      request_id: requestId,
      admin_user_id: user.id,
    })

    if (approveError) {
      console.error('[Approve API] Error:', approveError)
      return jsonResponse(
        {
          error: 'Failed to approve bundle enrollment request',
          details: approveError.message,
          code: approveError.code,
        },
        500
      )
    }

    const serviceSupabase = createServiceRoleClient()
    const { data: updatedRequest, error: verifyError } = await serviceSupabase
      .from('bundle_enrollment_requests')
      .select('id, status, updated_at, user_id, bundle_id, course_bundles(title)')
      .eq('id', requestId)
      .single()

    if (verifyError) {
      console.error('[Approve API] Error verifying:', verifyError)
    } else {
      console.log('[Approve API] Approved, status:', updatedRequest?.status)

      if (updatedRequest?.user_id) {
        const bundleTitle = (updatedRequest.course_bundles as { title?: string } | null)?.title || 'Unknown Bundle'

        try {
          await serviceSupabase.rpc('create_notification', {
            p_user_id: updatedRequest.user_id,
            p_type: 'bundle_enrollment_approved',
            p_title_en: 'Bundle Enrollment Approved',
            p_title_ge: 'პაკეტში რეგისტრაცია დამტკიცებულია',
            p_message_en: `Your enrollment request for bundle "${bundleTitle}" has been approved. You can now access all courses in the bundle.`,
            p_message_ge: `თქვენი რეგისტრაციის მოთხოვნა პაკეტზე "${bundleTitle}" დამტკიცებულია. ახლა შეგიძლიათ პაკეტის ყველა კურსზე წვდომა.`,
            p_metadata: {
              bundle_id: updatedRequest.bundle_id,
              bundle_title: bundleTitle,
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
            await sendBundleEnrollmentApprovedEmail(userProfile.email, bundleTitle)
            console.log('[Approve API] Email sent to:', userProfile.email)
          }
        } catch (emailError) {
          console.error('[Approve API] Email error:', emailError)
        }
      }
    }

    return jsonResponse({
      message: 'Bundle enrollment request approved successfully',
      success: true,
    })
  } catch (error) {
    console.error('[Approve API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
