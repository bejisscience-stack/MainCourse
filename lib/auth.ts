import { supabase } from './supabase';

export interface SignUpData {
  email: string;
  password: string;
  fullName?: string;
  role?: 'student' | 'lecturer';
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp({ email, password, fullName, role = 'student' }: SignUpData) {
  // Get the base URL for redirects (works in both dev and production)
  const getRedirectUrl = () => {
    if (typeof window !== 'undefined') {
      // Client-side: use current origin
      return `${window.location.origin}/auth/callback`;
    }
    // Server-side: use environment variable or fallback
    return process.env.NEXT_PUBLIC_SITE_URL 
      ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
      : 'http://localhost:3000/auth/callback';
  };

  const redirectUrl = getRedirectUrl();
  console.log('Signup redirect URL:', redirectUrl);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        full_name: fullName || '',
        role: role,
      },
    },
  });

  if (error) {
    console.error('Signup error:', error);
    throw error;
  }

  // Log signup response for debugging
  console.log('Signup response:', {
    user: data.user?.id,
    email: data.user?.email,
    emailConfirmed: data.user?.email_confirmed_at,
    session: !!data.session,
  });

  return data;
}

export async function resendVerificationEmail(email: string) {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: typeof window !== 'undefined' 
        ? `${window.location.origin}/auth/callback`
        : process.env.NEXT_PUBLIC_SITE_URL 
          ? `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
          : 'http://localhost:3000/auth/callback',
    },
  });

  if (error) {
    console.error('Resend verification email error:', error);
    throw error;
  }
}

export async function signIn({ email, password }: SignInData) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Supabase sign in error:', error);
      // Provide more user-friendly error messages
      if (error.message.includes('Email not confirmed') || error.message.includes('email_not_confirmed')) {
        throw new Error('Please verify your email address before signing in. Check your inbox for the verification email.');
      }
      if (error.message.includes('Invalid login credentials')) {
        throw new Error('Invalid email or password. Please check your credentials and try again.');
      }
      throw error;
    }

    if (!data || !data.user) {
      throw new Error('Sign in failed. No user data returned.');
    }

    return data;
  } catch (err: any) {
    console.error('Sign in function error:', err);
    // Re-throw with better error message if it's a network error
    if (err.message?.includes('fetch') || err.message?.includes('network') || err.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
    throw err;
  }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  
  if (error) {
    throw error;
  }
}

export async function getCurrentUser() {
  // First check session from localStorage (faster, works offline)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    return session.user;
  }
  
  // Fallback to network call if no session found
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

