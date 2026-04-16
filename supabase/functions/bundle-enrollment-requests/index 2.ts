import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) {
    return auth.response
  }
  const { user, supabase } = auth

  if (req.method === 'GET') {
    return handleGet(supabase, user.id)
  } else {
    return handlePost(req, supabase, user.id)
  }
})

async function handleGet(
  supabase: ReturnType<typeof import('../_shared/supabase.ts').createServerSupabaseClient>,
  userId: string
) {
  try {
    const { data: requests, error } = await supabase
      .from('bundle_enrollment_requests')
      .select(`
        id,
        bundle_id,
        status,
        created_at,
        updated_at,
        course_bundles (
          id,
          title,
          thumbnail_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching bundle enrollment requests:', error)
      return errorResponse('Failed to fetch bundle enrollment requests', 500)
    }

    return jsonResponse({ requests: requests || [] })
  } catch (error) {
    console.error('Error in GET /bundle-enrollment-requests:', error)
    return errorResponse('Internal server error', 500)
  }
}

async function handlePost(
  req: Request,
  supabase: ReturnType<typeof import('../_shared/supabase.ts').createServerSupabaseClient>,
  userId: string
) {
  try {
    const body = await req.json()
    const { bundleId, paymentScreenshots, referralCode } = body

    if (!bundleId) {
      return errorResponse('bundleId is required', 400)
    }

    // Validate paymentScreenshots if provided
    if (paymentScreenshots && !Array.isArray(paymentScreenshots)) {
      return errorResponse('paymentScreenshots must be an array', 400)
    }

    // Validate referralCode if provided
    if (referralCode && (typeof referralCode !== 'string' || referralCode.length > 20)) {
      return errorResponse('referralCode must be a string with max 20 characters', 400)
    }

    // Check if user already has a pending request
    const { data: existingRequest, error: requestCheckError } = await supabase
      .from('bundle_enrollment_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('bundle_id', bundleId)
      .eq('status', 'pending')
      .maybeSingle()

    if (requestCheckError && requestCheckError.code !== 'PGRST116') {
      console.error('Error checking existing request:', requestCheckError)
      return jsonResponse(
        { error: 'Failed to verify bundle enrollment request status', details: requestCheckError.message },
        500
      )
    }

    if (existingRequest) {
      return errorResponse('You already have a pending bundle enrollment request', 400)
    }

    // Check if user is already enrolled
    const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
      .from('bundle_enrollments')
      .select('id')
      .eq('user_id', userId)
      .eq('bundle_id', bundleId)
      .maybeSingle()

    if (enrollmentCheckError && enrollmentCheckError.code !== 'PGRST116') {
      console.error('Error checking existing enrollment:', enrollmentCheckError)
      return jsonResponse(
        { error: 'Failed to verify bundle enrollment status', details: enrollmentCheckError.message },
        500
      )
    }

    if (existingEnrollment) {
      return errorResponse('You are already enrolled in this bundle', 400)
    }

    // Verify bundle exists and is active
    const { data: bundle, error: bundleError } = await supabase
      .from('course_bundles')
      .select('id, is_active')
      .eq('id', bundleId)
      .eq('is_active', true)
      .maybeSingle()

    if (bundleError) {
      console.error('Error checking bundle:', bundleError)
      return jsonResponse(
        { error: 'Failed to verify bundle', details: bundleError.message },
        500
      )
    }

    if (!bundle) {
      return errorResponse('Bundle not found or is not active', 404)
    }

    // Format payment screenshots
    const formattedScreenshots = Array.isArray(paymentScreenshots)
      ? paymentScreenshots
      : paymentScreenshots
        ? [paymentScreenshots]
        : []

    // Create bundle enrollment request
    const { data: enrollmentRequest, error: insertError } = await supabase
      .from('bundle_enrollment_requests')
      .insert({
        user_id: userId,
        bundle_id: bundleId,
        status: 'pending',
        payment_screenshots: formattedScreenshots.length > 0 ? formattedScreenshots : [],
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating bundle enrollment request:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId,
        bundleId,
      })

      if (insertError.code === '23505') {
        return jsonResponse(
          { error: 'You already have a bundle enrollment request for this bundle', details: insertError.message },
          400
        )
      }

      if (insertError.code === '23503') {
        return jsonResponse(
          { error: 'Invalid bundle or user', details: insertError.message },
          400
        )
      }

      if (insertError.code === '42501') {
        return jsonResponse(
          { error: 'Permission denied. Please ensure you are logged in correctly.', details: insertError.message },
          403
        )
      }

      return jsonResponse(
        {
          error: 'Failed to create bundle enrollment request',
          details: insertError.message || 'Unknown database error',
          code: insertError.code,
        },
        500
      )
    }

    if (!enrollmentRequest) {
      return errorResponse('Failed to create bundle enrollment request - no data returned', 500)
    }

    return jsonResponse({ request: enrollmentRequest }, 201)
  } catch (error) {
    console.error('Error in POST /bundle-enrollment-requests:', error)
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return jsonResponse(
      {
        error: errorMessage,
        details: error instanceof Error ? error.stack : 'An unexpected error occurred',
      },
      500
    )
  }
}
