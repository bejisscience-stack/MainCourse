import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
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
  // Check if session exists in localStorage and restore it
  // Supabase automatically restores sessions with persistSession: true,
  // but we verify it here for debugging
  supabase.auth.getSession().then(({ data: { session }, error }) => {
    if (error) {
      console.warn('Error getting session on init:', error);
      return;
    }
    if (session) {
      console.log('Session restored from localStorage:', session.user.id);
    } else {
      console.log('No session found in localStorage');
    }
  }).catch(err => {
    console.warn('Error restoring session:', err);
  });

  // Listen for storage events to sync session across tabs
  window.addEventListener('storage', (e) => {
    if (e.key === 'supabase.auth.token') {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          console.log('Session synced from another tab');
        }
      });
    }
  });
}

