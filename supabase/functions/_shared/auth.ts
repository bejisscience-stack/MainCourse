import { createServerSupabaseClient } from './supabase.ts'
import { errorResponse } from './cors.ts'
import type { User, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export interface AuthResult {
  user: User
  supabase: SupabaseClient
  token: string
}

export interface AuthError {
  response: Response
}

/**
 * Extract Bearer token from Authorization header and verify the user
 * Returns the authenticated user, their access token, and a user-scoped Supabase client
 *
 * @param req - The incoming request
 * @returns AuthResult on success, or AuthError with a ready-to-return Response on failure
 *
 * @example
 * const auth = await getAuthenticatedUser(req)
 * if ('response' in auth) {
 *   return auth.response // Return the error response
 * }
 * const { user, supabase, token } = auth
 */
export async function getAuthenticatedUser(
  req: Request
): Promise<AuthResult | AuthError> {
  // Extract Authorization header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return {
      response: errorResponse('Missing authorization header', 401),
    }
  }

  // Extract token
  const token = authHeader.replace('Bearer ', '')
  if (!token || token === authHeader) {
    return {
      response: errorResponse('Invalid authorization header format', 401),
    }
  }

  // Create user-scoped client
  const supabase = createServerSupabaseClient(token)

  // Verify user
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      response: errorResponse(authError?.message || 'Unauthorized', 401),
    }
  }

  return { user, supabase, token }
}

/**
 * Check if the authenticated user is an admin
 * Uses the check_is_admin RPC function
 *
 * @param supabase - A Supabase client (service role recommended for admin checks)
 * @param userId - The user's ID to check
 * @returns true if admin, false otherwise
 */
export async function checkIsAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_is_admin', { user_id: userId })

  if (error) {
    console.error('Error checking admin status:', error)
    return false
  }

  return data === true
}
