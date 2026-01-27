import { supabase } from './supabase';

export interface SignUpData {
  email: string;
  password: string;
  username: string;
  role?: 'student' | 'lecturer';
  signupReferralCode?: string;
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp({ email, password, username, role = 'student', signupReferralCode }: SignUpData) {
  // Validate username format
  if (!username || username.trim().length < 3 || username.trim().length > 30) {
    throw new Error('Username must be between 3 and 30 characters');
  }
  
  // Check username pattern (letters, numbers, underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    throw new Error('Username can only contain letters, numbers, and underscores');
  }

  // Production URL - hardcoded to ensure email links always work
  const PRODUCTION_URL = 'https://swavleba.ge';

  const getRedirectUrl = () => {
    // Use production URL unless explicitly in development
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return `${window.location.origin}/auth/callback`;
    }
    return `${PRODUCTION_URL}/auth/callback`;
  };

  const redirectUrl = getRedirectUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl,
      data: {
        username: username.trim(),
        role: role,
        signup_referral_code: signupReferralCode ? signupReferralCode.toUpperCase().trim() : null,
      },
    },
  });

  if (error) {
    // Surface DB-trigger validation errors as-is when possible
    throw new Error(error.message || 'Failed to create account. Please try again.');
  }

  return data;
}

export async function resendVerificationEmail(email: string) {
  // Production URL - hardcoded to ensure email links always work
  const PRODUCTION_URL = 'https://swavleba.ge';

  const getRedirectUrl = () => {
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      return `${window.location.origin}/auth/callback`;
    }
    return `${PRODUCTION_URL}/auth/callback`;
  };

  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email,
    options: {
      emailRedirectTo: getRedirectUrl(),
    },
  });

  if (error) {
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
    // Re-throw with better error message if it's a network error
    if (err.message?.includes('fetch') || err.message?.includes('network') || err.code === 'ECONNREFUSED') {
      throw new Error('Unable to connect to the server. Please check your internet connection and try again.');
    }
    throw err;
  }
}

export async function signOut() {
  try {
    // Set a timeout for the sign out request
    const timeoutPromise = new Promise<{ error: Error }>((_, reject) => {
      setTimeout(() => reject(new Error('Sign out request timed out')), 5000);
    });

    const signOutPromise = supabase.auth.signOut();

    // Race between sign out and timeout
    const result = await Promise.race([signOutPromise, timeoutPromise]);

    if (result && 'error' in result && result.error) {
      console.warn('Sign out server error:', result.error);
    }
  } catch (error) {
    console.warn('Sign out error:', error);
  }
  // Note: @supabase/ssr handles cookie cleanup automatically
}

export async function getCurrentUser() {
  // First check session from cookies (faster)
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

