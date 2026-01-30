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
  const { user, supabase, token } = auth

  const isAdmin = await checkIsAdmin(supabase, user.id)
  if (!isAdmin) {
    return errorResponse('Forbidden: Admin access required', 403)
  }

  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const filterStatus = status && status !== 'all' && status.trim() !== '' ? status : null

    console.log('[Admin Withdrawals API] Fetching requests, filter:', filterStatus || 'all')

    // Pass user token as fallback in case service role key is not available
    const serviceSupabase = createServiceRoleClient(token)

    // Use RPC function to bypass RLS and prevent caching (marked VOLATILE)
    let requests: any[] = []
    let requestsError: any = null

    try {
      console.log('[Admin Withdrawals API] Using RPC function get_withdrawal_requests_admin')
      const { data: rpcData, error: rpcError } = await serviceSupabase
        .rpc('get_withdrawal_requests_admin', {
          filter_status: filterStatus || null
        })

      if (rpcError) {
        console.error('[Admin Withdrawals API] RPC error:', rpcError)
        // Fallback to direct query if RPC fails
        console.log('[Admin Withdrawals API] Falling back to direct query')
        let queryBuilder = serviceSupabase
          .from('withdrawal_requests')
          .select('id, user_id, user_type, amount, bank_account_number, status, admin_notes, processed_at, processed_by, created_at, updated_at')
          .order('created_at', { ascending: false })

        if (filterStatus) {
          queryBuilder = queryBuilder.eq('status', filterStatus)
        }

        const { data, error } = await queryBuilder
        requests = data || []
        requestsError = error
      } else {
        requests = rpcData || []
        console.log('[Admin Withdrawals API] RPC succeeded, found', requests.length, 'requests')
      }

      // Verify count matches
      const { count: dbCount, error: dbCountError } = await serviceSupabase
        .from('withdrawal_requests')
        .select('*', { count: 'exact', head: true })

      if (!dbCountError && dbCount !== null) {
        console.log(`[Admin Withdrawals API] DB total count: ${dbCount}, Query returned: ${requests.length}`)
        if (dbCount !== requests.length && !filterStatus) {
          console.warn(`[Admin Withdrawals API] WARNING: Count mismatch! DB has ${dbCount} records but query returned ${requests.length}`)
        }
      }

      console.log('[Admin Withdrawals API] Request statuses:', requests.map((r: any) => ({ id: r.id, status: r.status })))
    } catch (err: any) {
      console.error('[Admin Withdrawals API] Query failed:', err)
      requestsError = err
    }

    if (requestsError && requests.length === 0) {
      console.error('[Admin Withdrawals API] Error:', requestsError)
      return jsonResponse(
        {
          error: 'Failed to fetch withdrawal requests',
          details: requestsError.message || 'Database query failed',
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
