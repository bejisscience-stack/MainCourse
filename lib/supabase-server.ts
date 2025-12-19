import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Create a Supabase client for server-side use with a user's access token
 */
export function createServerSupabaseClient(accessToken: string) {
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
  });
}

/**
 * Verify access token and get user
 * Uses Supabase's Auth REST API to verify the JWT token
 */
export async function verifyTokenAndGetUser(accessToken: string) {
  try {
    // Call Supabase Auth API directly to verify the token
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'apikey': supabaseAnonKey,
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
