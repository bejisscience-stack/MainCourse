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
  supabase.auth.getSession().catch((error) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/695db6a1-160d-40d0-ab86-4058ba2ea89b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:40',message:'Session get error (silent catch)',data:{error:error?.message||'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C1'})}).catch(()=>{});
    // #endregion
    // Silent fail - session will be null if not available
  });

  // Listen for storage events to sync session across tabs
  // Store handler reference for potential cleanup (though it persists for app lifetime)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === 'supabase.auth.token') {
      supabase.auth.getSession().catch((error) => {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/695db6a1-160d-40d0-ab86-4058ba2ea89b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'supabase.ts:47',message:'Storage event session error (silent catch)',data:{error:error?.message||'unknown'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C1'})}).catch(()=>{});
        // #endregion
      });
    }
  };
  window.addEventListener('storage', storageHandler, { passive: true });
  // Note: This is module-level initialization, so listener persists for app lifetime
  // This is intentional for cross-tab session sync. If cleanup is needed, use a singleton pattern.
}

