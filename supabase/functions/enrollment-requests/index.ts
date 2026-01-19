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
      .from('enrollment_requests')
      .select(`
        id,
        course_id,
        status,
        created_at,
        updated_at,
        courses (
          id,
          title,
          thumbnail_url
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching enrollment requests:', error)
      return errorResponse('Failed to fetch enrollment requests', 500)
    }

    return jsonResponse({ requests: requests || [] })
  } catch (error) {
    console.error('Error in GET /enrollment-requests:', error)
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
    const { courseId, paymentScreenshots, referralCode, isReEnrollment } = body

    if (!courseId) {
      return errorResponse('courseId is required', 400)
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
      .from('enrollment_requests')
      .select('id, status')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .eq('status', 'pending')
      .maybeSingle()

    if (requestCheckError && requestCheckError.code !== 'PGRST116') {
      console.error('Error checking existing request:', requestCheckError)
      return jsonResponse(
        { error: 'Failed to verify enrollment request status', details: requestCheckError.message },
        500
      )
    }

    if (existingRequest) {
      return errorResponse('You already have a pending enrollment request for this course', 400)
    }

    // Check if user is already enrolled
    const { data: existingEnrollment, error: enrollmentCheckError } = await supabase
      .from('enrollments')
      .select('id, expires_at')
      .eq('user_id', userId)
      .eq('course_id', courseId)
      .maybeSingle()

    if (enrollmentCheckError && enrollmentCheckError.code !== 'PGRST116') {
      console.error('Error checking existing enrollment:', enrollmentCheckError)
      return jsonResponse(
        { error: 'Failed to verify enrollment status', details: enrollmentCheckError.message },
        500
      )
    }

    if (existingEnrollment) {
      if (isReEnrollment) {
        const expiresAt = existingEnrollment.expires_at ? new Date(existingEnrollment.expires_at) : null
        const isExpired = expiresAt ? expiresAt < new Date() : false

        if (!isExpired) {
          return errorResponse(
            'Your enrollment is still active. Re-enrollment is only available for expired enrollments.',
            400
          )
        }
      } else {
        return errorResponse('You are already enrolled in this course', 400)
      }
    } else if (isReEnrollment) {
      return errorResponse('No previous enrollment found for re-enrollment', 400)
    }

    // Verify course exists
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id')
      .eq('id', courseId)
      .maybeSingle()

    if (courseError) {
      console.error('Error checking course:', courseError)
      return jsonResponse(
        { error: 'Failed to verify course', details: courseError.message },
        500
      )
    }

    if (!course) {
      return errorResponse('Course not found', 404)
    }

    // Format payment screenshots
    const formattedScreenshots = Array.isArray(paymentScreenshots)
      ? paymentScreenshots
      : paymentScreenshots
        ? [paymentScreenshots]
        : []

    // Create enrollment request
    const { data: enrollmentRequest, error: insertError } = await supabase
      .from('enrollment_requests')
      .insert({
        user_id: userId,
        course_id: courseId,
        status: 'pending',
        payment_screenshots: formattedScreenshots.length > 0 ? formattedScreenshots : [],
        referral_code: referralCode ? referralCode.trim().toUpperCase() : null,
      })
      .select()
      .single()

    if (insertError) {
      console.error('Error creating enrollment request:', {
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId,
        courseId,
      })

      if (insertError.code === '23505') {
        return jsonResponse(
          { error: 'You already have an enrollment request for this course', details: insertError.message },
          400
        )
      }

      if (insertError.code === '23503') {
        return jsonResponse(
          { error: 'Invalid course or user', details: insertError.message },
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
          error: 'Failed to create enrollment request',
          details: insertError.message || 'Unknown database error',
          code: insertError.code,
        },
        500
      )
    }

    if (!enrollmentRequest) {
      return errorResponse('Failed to create enrollment request - no data returned', 500)
    }

    // Process referral
    if (enrollmentRequest.id) {
      try {
        let referralProcessed = false

        // First, try to process provided referral code
        if (referralCode) {
          const { error: referralError, data: referralData } = await supabase.rpc('process_referral', {
            p_referral_code: referralCode.trim().toUpperCase(),
            p_referred_user_id: userId,
            p_enrollment_request_id: enrollmentRequest.id,
            p_course_id: courseId,
          })

          if (!referralError && referralData) {
            referralProcessed = true
          } else if (referralError) {
            console.error('Error processing provided referral code:', referralError)
          }
        }

        // If no referral code was provided or it failed, try signup referral code
        if (!referralProcessed) {
          const { error: signupRefError } = await supabase.rpc('process_signup_referral_on_enrollment', {
            p_user_id: userId,
            p_enrollment_request_id: enrollmentRequest.id,
            p_course_id: courseId,
          })

          if (signupRefError) {
            console.error('Error processing signup referral:', signupRefError)
            // Continue - referral is optional
          }
        }
      } catch (referralErr) {
        console.error('Exception processing referral:', referralErr)
        // Continue - referral is optional
      }
    }

    return jsonResponse({ request: enrollmentRequest }, 201)
  } catch (error) {
    console.error('Error in POST /enrollment-requests:', error)
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
