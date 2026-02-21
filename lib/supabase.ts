import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables. Please check your .env.local file.\n' +
    `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'OK' : 'Missing'}\n` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'OK' : 'Missing'}`
  console.error(errorMsg)
  throw new Error(errorMsg)
}

// Browser client singleton using @supabase/ssr for cookie-based auth
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

// Propagate auth token to Realtime WebSocket so RLS-filtered postgres_changes work
if (typeof window !== 'undefined') {
  // Set auth from existing session immediately
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token)
    }
  })

  // Update on every auth state change (login, token refresh, logout)
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token)
    }
  })
}
