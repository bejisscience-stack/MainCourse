import { useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  role: string | null;
  username: string | null;
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
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, username')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[useUser] Profile fetch error:', error);
      console.error('[useUser] Error code:', error.code);
      console.error('[useUser] Error message:', error.message);
      // Don't throw for missing profiles (user might not have profile yet)
      // Only throw for actual database errors
      if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      return null;
    }

    console.log('[useUser] Fetched profile for user:', userId, 'Profile data:', data, 'Role:', data?.role);
    return data || null;
  } catch (err: any) {
    console.error('[useUser] Unexpected error fetching profile:', err);
    // Return null for missing profiles, but log the error
    return null;
  }
}

// Combined fetcher for user and profile
async function fetchUserData(): Promise<UserData> {
  try {
    const user = await fetchUserSession();
    
    if (!user) {
      return { user: null, profile: null, role: null };
    }

    const profile = await fetchProfile(user.id);
    // Always prioritize profile role over metadata (database is source of truth)
    const role = profile?.role || user.user_metadata?.role || null;

    console.log('[useUser] ========== ROLE FETCH ==========');
    console.log('[useUser] User ID:', user.id);
    console.log('[useUser] Profile:', profile);
    console.log('[useUser] Profile role:', profile?.role);
    console.log('[useUser] Metadata role:', user.user_metadata?.role);
    console.log('[useUser] Final role determined:', role);
    console.log('[useUser] =================================');

    // Normalize role if needed (non-blocking) - but only if role is lecturer
    // Don't update if it's admin
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
  } catch (err: any) {
    console.error('[useUser] Error fetching user data:', err);
    // Return empty state on error so UI doesn't hang
    return { user: null, profile: null, role: null };
  }
}

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<UserData>(
    'user-data',
    fetchUserData,
    {
      revalidateOnFocus: true, // Revalidate when window gets focus to catch role changes
      revalidateOnReconnect: true,
      dedupingInterval: 2000, // Reduce deduping interval to catch role changes faster
      fallbackData: { user: null, profile: null, role: null },
      errorRetryCount: 2, // Only retry 2 times on error
      errorRetryInterval: 1000, // Wait 1 second between retries
      shouldRetryOnError: (error) => {
        // Don't retry on authentication errors or missing env vars
        if (error?.message?.includes('Missing Supabase') || 
            error?.code === 'PGRST301') {
          return false;
        }
        return true;
      },
      onError: (error) => {
        console.error('[useUser] SWR error:', error);
      },
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
