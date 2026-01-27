import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendWelcomeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/my-courses';

  // Use production URL for redirects (reverse proxy may report localhost)
  const PRODUCTION_URL = 'https://swavleba.ge';
  const getBaseUrl = () => {
    if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
      return requestUrl.origin; // Use actual origin for local dev
    }
    return PRODUCTION_URL;
  };
  const baseUrl = getBaseUrl();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL(`/login?error=Configuration error`, baseUrl));
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Handle Server Component context
        }
      },
    },
  });

  // Handle token_hash verification (email confirmation link)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'signup' | 'email',
    });

    if (error) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl)
      );
    }

    // Successfully verified - get user and redirect
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, username')
        .eq('id', user.id)
        .single();

      const role = profile?.role || user.user_metadata?.role;
      const username = profile?.username || user.user_metadata?.username;

      // Send welcome email for new user verification
      if (user.email_confirmed_at && user.email) {
        const confirmedAt = new Date(user.email_confirmed_at);
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

        if (confirmedAt > fiveMinutesAgo) {
          try {
            await sendWelcomeEmail(user.email, username);
            console.log('Welcome email sent to:', user.email);
          } catch (emailError) {
            console.error('Failed to send welcome email:', emailError);
          }
        }
      }

      if (role === 'lecturer') {
        return NextResponse.redirect(new URL('/lecturer/dashboard', baseUrl));
      }
    }

    return NextResponse.redirect(new URL(next, baseUrl));
  }

  // Handle code exchange (PKCE flow)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, username')
          .eq('id', user.id)
          .single();

        const role = profile?.role || user.user_metadata?.role;
        const username = profile?.username || user.user_metadata?.username;

        if (user.email_confirmed_at && user.email) {
          const confirmedAt = new Date(user.email_confirmed_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

          if (confirmedAt > fiveMinutesAgo) {
            try {
              await sendWelcomeEmail(user.email, username);
              console.log('Welcome email sent to:', user.email);
            } catch (emailError) {
              console.error('Failed to send welcome email:', emailError);
            }
          }
        }

        if (role === 'lecturer') {
          return NextResponse.redirect(new URL('/lecturer/dashboard', baseUrl));
        }
      }

      return NextResponse.redirect(new URL(next, baseUrl));
    }

    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, baseUrl)
    );
  }

  // If no code or token_hash, redirect to login
  return NextResponse.redirect(new URL('/login', baseUrl));
}
