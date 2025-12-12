import { useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  role: string | null;
  full_name: string | null;
}

interface UserData {
  user: User | null;
  profile: Profile | null;
  role: string | null;
}

// Fetcher function for user session
async function fetchUserSession(): Promise<User | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
}

// Fetcher function for user profile
async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.warn('Profile fetch error:', error);
  }

  return data || null;
}

// Combined fetcher for user and profile
async function fetchUserData(): Promise<UserData> {
  const user = await fetchUserSession();
  
  if (!user) {
    return { user: null, profile: null, role: null };
  }

  const profile = await fetchProfile(user.id);
  const role = profile?.role || user.user_metadata?.role || null;

  // Normalize role if needed (non-blocking)
  if (role === 'lecturer' && profile && profile.role !== 'lecturer') {
    supabase
      .from('profiles')
      .update({ role: 'lecturer' })
      .eq('id', user.id)
      .then(({ error }) => {
        if (error) {
          console.warn('Role update failed:', error);
        }
      });
  }

  return { user, profile, role };
}

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<UserData>(
    'user-data',
    fetchUserData,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Dedupe requests within 5 seconds
      fallbackData: { user: null, profile: null, role: null },
    }
  );

  // Listen for auth changes - properly set up in useEffect with cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session?.user?.id);
      // Mutate the SWR cache when auth state changes
      mutate();
    });

    // Cleanup subscription on unmount
    return () => {
      subscription.unsubscribe();
    };
  }, [mutate]);

  return {
    user: data?.user || null,
    profile: data?.profile || null,
    role: data?.role || null,
    isLoading,
    error,
    mutate,
  };
}
