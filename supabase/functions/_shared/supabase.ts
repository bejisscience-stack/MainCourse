import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Create a Supabase client with service role key (bypasses RLS)
 * Use this ONLY for operations that need to bypass RLS (admin operations)
 * WARNING: This has full database access - use with caution!
 *
 * @param fallbackToken - Optional user access token to use if service role key is not set.
 *                        When provided, creates a user-scoped client that respects RLS policies.
 */
export function createServiceRoleClient(fallbackToken?: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL environment variable')
  }

  if (!supabaseServiceRoleKey) {
    if (fallbackToken && supabaseAnonKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Falling back to user token (RLS will apply).')
      return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${fallbackToken}`,
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
      })
    }
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY environment variable and no fallback token provided')
  }

  // Generate unique request ID to prevent connection reuse and query caching
  const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'x-request-id': requestId,
      },
    },
  })
}

/**
 * Create a Supabase client for server-side use with a user's access token
 * This client respects RLS policies and acts as the authenticated user
 * @param accessToken - The user's JWT access token from Authorization header
 */
export function createServerSupabaseClient(accessToken: string): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
