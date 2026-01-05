import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables. Please check your .env.local file.\n' +
    `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? '✓' : '✗ Missing'}\n` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? '✓' : '✗ Missing'}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
  },
  global: {
    headers: {
      'x-client-info': 'course-website',
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries: number) => Math.min(tries * 1000, 30000),
  },
});

// Ensure session is restored on page load
if (typeof window !== 'undefined') {
  // Supabase automatically restores sessions with persistSession: true
  // We verify it silently here and handle any errors gracefully
  supabase.auth.getSession().catch(() => {
    // Silent fail - session will be null if not available
  });

  // Listen for storage events to sync session across tabs
  const storageHandler = (e: StorageEvent) => {
    if (e.key === 'supabase.auth.token') {
      supabase.auth.getSession().catch(() => {
        // Silent fail
      });
    }
  };
  window.addEventListener('storage', storageHandler, { passive: true });
}

