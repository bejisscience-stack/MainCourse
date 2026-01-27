import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendWelcomeEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/my-courses';

  if (code) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.redirect(
        new URL(`/login?error=Configuration error`, requestUrl.origin)
      );
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

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Get the user to check their role
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check user role and redirect accordingly
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, username')
          .eq('id', user.id)
          .single();

        const role = profile?.role || user.user_metadata?.role;
        const username = profile?.username || user.user_metadata?.username;

        // Check if this is a new user (email just confirmed)
        // Send welcome email if email_confirmed_at is within last 5 minutes
        if (user.email_confirmed_at && user.email) {
          const confirmedAt = new Date(user.email_confirmed_at);
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

          if (confirmedAt > fiveMinutesAgo) {
            // This is likely a new user verification
            try {
              await sendWelcomeEmail(user.email, username);
              console.log('Welcome email sent to:', user.email);
            } catch (emailError) {
              // Don't fail the auth flow if email fails
              console.error('Failed to send welcome email:', emailError);
            }
          }
        }

        if (role === 'lecturer') {
          return NextResponse.redirect(new URL('/lecturer/dashboard', requestUrl.origin));
        }
      }

      // Redirect to the specified next URL or default to my-courses
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }

    // If there's an error, redirect to login with error message
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, requestUrl.origin)
    );
  }

  // If no code, redirect to login
  return NextResponse.redirect(new URL('/login', requestUrl.origin));
}
