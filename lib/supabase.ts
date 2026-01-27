import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Missing Supabase environment variables. Please check your .env.local file.\n' +
    `NEXT_PUBLIC_SUPABASE_URL: ${supabaseUrl ? 'OK' : 'Missing'}\n` +
    `NEXT_PUBLIC_SUPABASE_ANON_KEY: ${supabaseAnonKey ? 'OK' : 'Missing'}`;
  console.error(errorMsg);
  throw new Error(errorMsg);
}

// Use @supabase/ssr browser client - stores tokens in cookies instead of localStorage
// This enables proper PKCE flow support across client and server boundaries
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
