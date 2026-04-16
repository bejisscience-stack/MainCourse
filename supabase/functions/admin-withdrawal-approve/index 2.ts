import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'
import { sendWithdrawalApprovedEmail } from '../_shared/email.ts'

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
    const { requestId, adminNotes } = body

    if (!requestId) {
      return errorResponse('requestId is required', 400)
    }

    console.log('[Approve Withdrawal API] Processing approval for request:', requestId)

    const serviceSupabase = createServiceRoleClient()

    const { data: withdrawalRequest, error: fetchError } = await serviceSupabase
      .from('withdrawal_requests')
      .select('*')
      .eq('id', requestId)
      .single()

    if (fetchError || !withdrawalRequest) {
      console.error('[Approve Withdrawal API] Request not found:', fetchError)
      return errorResponse('Withdrawal request not found', 404)
    }

    if (withdrawalRequest.status !== 'pending') {
      return errorResponse(`Request is already ${withdrawalRequest.status}`, 400)
    }

    const { error: approveError } = await supabase.rpc('approve_withdrawal_request', {
      p_request_id: requestId,
      p_admin_notes: adminNotes || null,
    })

    if (approveError) {
      console.error('[Approve Withdrawal API] RPC error:', approveError)
      return jsonResponse(
        {
          error: 'Failed to approve withdrawal request',
          details: approveError.message,
          code: approveError.code,
        },
        500
      )
    }

    console.log('[Approve Withdrawal API] Request approved successfully:', requestId)

    try {
      const { error: notificationError } = await serviceSupabase.rpc('create_notification', {
        p_user_id: withdrawalRequest.user_id,
        p_type: 'withdrawal_approved',
        p_title_en: 'Withdrawal Approved',
        p_title_ge: 'თანხის გატანა დამტკიცებულია',
        p_message_en: `Your withdrawal request for ₾${withdrawalRequest.amount.toFixed(2)} has been approved and will be processed soon.`,
        p_message_ge: `თქვენი თანხის გატანის მოთხოვნა ₾${withdrawalRequest.amount.toFixed(2)}-ზე დამტკიცებულია და მალე დამუშავდება.`,
        p_metadata: {
          request_id: requestId,
          amount: withdrawalRequest.amount,
        },
        p_created_by: user.id,
      })

      if (notificationError) {
        console.error('[Approve Withdrawal API] Error creating notification:', notificationError)
      } else {
        console.log('[Approve Withdrawal API] Notification created for user:', withdrawalRequest.user_id)
      }
    } catch (notifError) {
      console.error('[Approve Withdrawal API] Exception creating notification:', notifError)
    }

    try {
      const { data: userProfile } = await serviceSupabase
        .from('profiles')
        .select('email')
        .eq('id', withdrawalRequest.user_id)
        .single()

      if (userProfile?.email) {
        await sendWithdrawalApprovedEmail(userProfile.email, withdrawalRequest.amount)
        console.log('[Approve Withdrawal API] Email sent to:', userProfile.email)
      }
    } catch (emailError) {
      console.error('[Approve Withdrawal API] Error sending email:', emailError)
    }

    return jsonResponse({
      message: 'Withdrawal request approved successfully',
      success: true,
    })
  } catch (error) {
    console.error('[Approve Withdrawal API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
