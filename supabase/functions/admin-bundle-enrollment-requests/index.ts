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

    console.log('[Admin Bundle API] Fetching requests, filter:', filterStatus || 'all')

    // Pass user token as fallback in case service role key is not available
    const serviceSupabase = createServiceRoleClient(token)

    let queryBuilder = serviceSupabase
      .from('bundle_enrollment_requests')
      .select('id, user_id, bundle_id, status, created_at, updated_at, reviewed_by, reviewed_at, payment_screenshots')
      .order('created_at', { ascending: false })

    if (filterStatus) {
      queryBuilder = queryBuilder.eq('status', filterStatus)
    }

    const { data: requests, error: requestsError } = await queryBuilder

    if (requestsError) {
      console.error('[Admin Bundle API] Error:', requestsError)
      return jsonResponse(
        {
          error: 'Failed to fetch bundle enrollment requests',
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
    const bundleIds = [...new Set(requests.map(r => r.bundle_id).filter(Boolean))]

    const [profilesResult, bundlesResult] = await Promise.all([
      userIds.length > 0
        ? serviceSupabase.from('profiles').select('id, username, email').in('id', userIds)
        : Promise.resolve({ data: [] }),
      bundleIds.length > 0
        ? serviceSupabase.from('course_bundles').select('id, title, price').in('id', bundleIds)
        : Promise.resolve({ data: [] }),
    ])

    const profilesMap = new Map((profilesResult.data || []).map(p => [p.id, p]))
    const bundlesMap = new Map((bundlesResult.data || []).map(b => [b.id, b]))

    const requestsWithRelations = requests.map(request => {
      let paymentScreenshots = request.payment_screenshots
      if (typeof paymentScreenshots === 'string') {
        try {
          paymentScreenshots = JSON.parse(paymentScreenshots)
        } catch {
          paymentScreenshots = []
        }
      }

      return {
        ...request,
        payment_screenshots: paymentScreenshots,
        profiles: profilesMap.get(request.user_id) || null,
        bundles: bundlesMap.get(request.bundle_id) || null,
      }
    })

    console.log('[Admin Bundle API] Returning', requestsWithRelations.length, 'requests')

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
    console.error('[Admin Bundle API] Error:', error)
    return errorResponse('Internal server error', 500)
  }
})
