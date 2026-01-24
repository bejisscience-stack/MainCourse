import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// TypeScript type guards - these are guaranteed to be strings after the check above
const safeSupabaseUrl: string = supabaseUrl;
const safeSupabaseAnonKey: string = supabaseAnonKey;

/**
 * Create a Supabase client with service role key (bypasses RLS)
 * Use this ONLY on the server side for operations that need to bypass RLS
 * WARNING: This has full database access - use with caution!
 *
 * @param fallbackToken - Optional user access token to use if service role key is not set.
 *                        When provided, creates a user-scoped client that respects RLS policies.
 *                        This allows admin operations to still work via RLS admin policies.
 */
export function createServiceRoleClient(fallbackToken?: string) {
  if (!supabaseServiceRoleKey) {
    if (fallbackToken) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set. Falling back to user token (RLS will apply, admin policies should work).');
      return createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${fallbackToken}`,
            'Cache-Control': 'no-cache',
          },
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
      });
    }
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set and no fallback token provided. Using anon key (RLS will apply, may fail for admin operations).');
    return createClient(safeSupabaseUrl, safeSupabaseAnonKey);
  }

  return createClient(safeSupabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        'Cache-Control': 'no-cache',
      },
    },
  });
}

/**
 * Create a Supabase client for server-side use with a user's access token
 */
export function createServerSupabaseClient(accessToken: string) {
  return createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Verify access token and get user
 * Uses Supabase's Auth REST API to verify the JWT token
 */
export async function verifyTokenAndGetUser(accessToken: string) {
  try {
    // Call Supabase Auth API directly to verify the token
    const response = await fetch(`${safeSupabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': safeSupabaseAnonKey,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { 
        user: null, 
        error: { 
          message: errorData.msg || errorData.message || `HTTP ${response.status}`,
          status: response.status
        } 
      };
    }

    const user = await response.json();
    return { user, error: null };
  } catch (err: any) {
    return { 
      user: null, 
      error: { 
        message: err?.message || 'Token verification failed',
        status: 500
      } 
    };
  }
}
