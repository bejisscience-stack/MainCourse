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

    console.log('[Admin API] Fetching requests, filter:', filterStatus || 'all')

    const serviceSupabase = createServiceRoleClient()

    let queryBuilder = serviceSupabase
      .from('enrollment_requests')
      .select('id, user_id, course_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots, referral_code')
      .order('created_at', { ascending: false })

    if (filterStatus) {
      queryBuilder = queryBuilder.eq('status', filterStatus)
    }

    const { data: requests, error: requestsError } = await queryBuilder

    if (requestsError) {
      console.error('[Admin API] Error fetching requests:', requestsError)
      return jsonResponse(
        {
          error: 'Failed to fetch enrollment requests',
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
