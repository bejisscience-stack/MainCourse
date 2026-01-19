import { corsHeaders, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser, checkIsAdmin } from '../_shared/auth.ts'
import { createServiceRoleClient } from '../_shared/supabase.ts'

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  if (req.method !== 'GET') {
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
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const filterStatus = status && status !== 'all' && status.trim() !== '' ? status : null

    console.log('[Admin Withdrawals API] Fetching requests, filter:', filterStatus || 'all')

    const serviceSupabase = createServiceRoleClient()

    let queryBuilder = serviceSupabase
      .from('withdrawal_requests')
      .select('id, user_id, user_type, amount, bank_account_number, status, admin_notes, processed_at, processed_by, created_at, updated_at')
      .order('created_at', { ascending: false })

    if (filterStatus) {
      queryBuilder = queryBuilder.eq('status', filterStatus)
    }

    const { data: requests, error: requestsError } = await queryBuilder

    if (requestsError) {
      console.error('[Admin Withdrawals API] Error:', requestsError)
      return jsonResponse(
        {
          error: 'Failed to fetch withdrawal requests',
          details: requestsError.message,
          code: requestsError.code,
        },
        500
      )
    }

    if (!requests || requests.length === 0) {
      return jsonResponse({ requests: [] })
    }

    const userIds = [...new Set(requests.map(r => r.user_id).filter(Boolean))]

    let profiles: { id: string; username: string; email: string; role: string; balance: number }[] = []
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await serviceSupabase
        .from('profiles')
        .select('id, username, email, role, balance')
        .in('id', userIds)

      if (!profilesError && profilesData) {
        profiles = profilesData
      } else if (profilesError) {
        console.error('[Admin Withdrawals API] Error fetching profiles:', profilesError)
      }
    }

    const profilesMap = new Map(profiles.map(p => [p.id, p]))

    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
    }))

    console.log('[Admin Withdrawals API] Returning', requestsWithRelations.length, 'requests')

    return new Response(JSON.stringify({ requests: requestsWithRelations }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('[Admin Withdrawals API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
