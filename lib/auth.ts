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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || '',
        role: role,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data;
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
      if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
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

