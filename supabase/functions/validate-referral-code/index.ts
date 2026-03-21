import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  // Only allow POST
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405)
  }

  // Authenticate user
  const auth = await getAuthenticatedUser(req)
  if ('response' in auth) {
    return auth.response
  }
  const { user, supabase } = auth

  try {
    const body = await req.json()
    const { code, referralCode } = body

    // Accept either 'code' or 'referralCode' for flexibility
    const codeValue = code || referralCode

    if (!codeValue) {
      return errorResponse('code is required', 400)
    }

    // Validate format
    if (typeof codeValue !== 'string' || codeValue.length > 20) {
      return jsonResponse({ valid: false, error: 'Invalid referral code format' })
    }

    // Normalize referral code (uppercase, trim)
    const normalizedCode = codeValue.trim().toUpperCase()

    // Check if this is the user's own code
    const { data: ownProfile } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('id', user.id)
      .single()

    if (ownProfile?.referral_code === normalizedCode) {
      return jsonResponse({ valid: false, error: 'You cannot use your own referral code' })
    }

    // Check if referral code exists in profiles table
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('referral_code, first_name, last_name')
      .eq('referral_code', normalizedCode)
      .maybeSingle()

    if (error) {
      console.error('Error validating referral code:', error)
      return errorResponse('Failed to validate referral code', 500)
    }

    if (!profile) {
      return jsonResponse({ valid: false, error: 'Invalid referral code' })
    }

    // Build referrer name (if available)
    const referrerName = profile.first_name
      ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name.charAt(0) + '.' : ''}`
      : undefined

    return jsonResponse({
      valid: true,
      referrerName,
    })
  } catch (error) {
    console.error('Error in POST /validate-referral-code:', error)
    return errorResponse('Internal server error', 500)
  }
})
