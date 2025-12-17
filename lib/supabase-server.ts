import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// TypeScript type narrowing - these are guaranteed to be strings after the check above
const SUPABASE_URL: string = supabaseUrl;
const SUPABASE_ANON_KEY: string = supabaseAnonKey;

/**
 * Create a Supabase client for server-side use with a user's access token
 * The Authorization header sets the auth context for RLS policies
 * 
 * IMPORTANT: For RLS to work, PostgREST automatically extracts the user from the JWT
 * in the Authorization header and sets auth.uid() accordingly.
 */
export function createServerSupabaseClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: {
      schema: 'public',
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY, // Required for PostgREST to process the request
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
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
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': SUPABASE_ANON_KEY,
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
