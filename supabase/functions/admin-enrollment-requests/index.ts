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

    console.log('[Admin API] Fetching requests, filter:', filterStatus || 'all')

    // Pass user token as fallback in case service role key is not available
    const serviceSupabase = createServiceRoleClient(token)

    // Use RPC function to bypass RLS and prevent caching (marked VOLATILE)
    let requests: any[] = []
    let requestsError: any = null

    try {
      console.log('[Admin API] Using RPC function get_enrollment_requests_admin')
      const { data: rpcData, error: rpcError } = await serviceSupabase
        .rpc('get_enrollment_requests_admin', {
          filter_status: filterStatus || null
        })

      if (rpcError) {
        console.error('[Admin API] RPC error:', rpcError)
        // Fallback to direct query if RPC fails
        console.log('[Admin API] Falling back to direct query')
        let queryBuilder = serviceSupabase
          .from('enrollment_requests')
          .select('id, user_id, course_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots, referral_code')
          .order('created_at', { ascending: false })

        if (filterStatus) {
          queryBuilder = queryBuilder.eq('status', filterStatus)
        }

        const { data, error } = await queryBuilder
        requests = data || []
        requestsError = error
      } else {
        requests = rpcData || []
        console.log('[Admin API] RPC succeeded, found', requests.length, 'requests')
      }

      // Verify count matches
      const { count: dbCount, error: dbCountError } = await serviceSupabase
        .from('enrollment_requests')
        .select('*', { count: 'exact', head: true })

      if (!dbCountError && dbCount !== null) {
        console.log(`[Admin API] DB total count: ${dbCount}, Query returned: ${requests.length}`)
        if (dbCount !== requests.length && !filterStatus) {
          console.warn(`[Admin API] WARNING: Count mismatch! DB has ${dbCount} records but query returned ${requests.length}`)
        }
      }

      console.log('[Admin API] Request statuses:', requests.map((r: any) => ({ id: r.id, status: r.status })))
    } catch (err: any) {
      console.error('[Admin API] Query failed:', err)
      requestsError = err
    }

    if (requestsError && requests.length === 0) {
      console.error('[Admin API] Error fetching requests:', requestsError)
      return jsonResponse(
        {
          error: 'Failed to fetch enrollment requests',
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
    const courseIds = [...new Set(requests.map(r => r.course_id).filter(Boolean))]
    const referralCodes = [...new Set(requests.map(r => r.referral_code).filter(Boolean))]

    const [profilesResult, coursesResult, referrersResult] = await Promise.all([
      userIds.length > 0
        ? serviceSupabase.from('profiles').select('id, username, email').in('id', userIds)
        : Promise.resolve({ data: [] }),
      courseIds.length > 0
        ? serviceSupabase.from('courses').select('id, title, thumbnail_url').in('id', courseIds)
        : Promise.resolve({ data: [] }),
      referralCodes.length > 0
        ? serviceSupabase.from('profiles').select('id, username, email, referral_code').in('referral_code', referralCodes)
        : Promise.resolve({ data: [] }),
    ])

    const profilesMap = new Map((profilesResult.data || []).map(p => [p.id, p]))
    const coursesMap = new Map((coursesResult.data || []).map(c => [c.id, c]))
    const referrerMap = new Map((referrersResult.data || []).map(p => [p.referral_code, p]))

    const requestsWithRelations = requests.map(request => ({
      ...request,
      profiles: profilesMap.get(request.user_id) || null,
      courses: coursesMap.get(request.course_id) || null,
      referrer: request.referral_code ? referrerMap.get(request.referral_code) || null : null,
    }))

    console.log('[Admin API] Returning', requestsWithRelations.length, 'requests')

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
    console.error('[Admin API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
