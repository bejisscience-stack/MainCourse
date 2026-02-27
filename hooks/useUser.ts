import { useEffect } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  role: string | null;
  username: string | null;
  avatar_url?: string | null;
  signup_referral_code?: string | null;
  referred_for_course_id?: string | null;
  first_login_completed?: boolean | null;
  profile_completed?: boolean | null;
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
      .select('id, role, username, avatar_url, signup_referral_code, referred_for_course_id, first_login_completed, profile_completed')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Don't throw for missing profiles (user might not have profile yet)
      // Only throw for actual database errors
      if (error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }
      return null;
    }

    return data || null;
  } catch (err: any) {
    // Return null for missing profiles
    return null;
  }
}

// Combined fetcher for user and profile with improved error resilience
async function fetchUserData(): Promise<UserData> {
  try {
    // getSession() reads from localStorage/cookies - no network call, no timeout needed
    const user = await fetchUserSession();

    if (!user) {
      return { user: null, profile: null, role: null };
    }

    // Fetch profile - use Promise.race with timeout for resilience
    // Profile fetch failure should not block user data
    let profile: Profile | null = null;
    try {
      profile = await Promise.race([
        fetchProfile(user.id),
        // Timeout after 10 seconds to survive DigitalOcean/Supabase cold starts
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);
    } catch {
      // Profile fetch failed, continue with user data only
      profile = null;
    }

    // Always prioritize profile role over metadata (database is source of truth)
    const role = profile?.role || user.user_metadata?.role || null;

    // Normalize role if needed (non-blocking) - but only if role is lecturer
    // Don't update if it's admin
    if (role === 'lecturer' && profile && profile.role !== 'lecturer') {
      supabase
        .from('profiles')
        .update({ role: 'lecturer' })
        .eq('id', user.id)
        .then(() => {
          // Silently handle role update
        });
    }

    return { user, profile, role };
  } catch (err: any) {
    // Return empty state on error so UI doesn't hang
    return { user: null, profile: null, role: null };
  }
}

export function useUser() {
  const { data, error, isLoading, mutate } = useSWR<UserData>(
    'user-data',
    fetchUserData,
    {
      revalidateOnFocus: true, // Re-fetch when tab regains focus to recover from timeout
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Increase deduping interval to reduce unnecessary re-renders
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
      onError: () => {
        // Silently handle SWR errors
      },
    }
  );

  // Listen for auth changes - properly set up in useEffect with cleanup
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let debounceTimer: NodeJS.Timeout | null = null;
    let isMounted = true;

    // Set up auth state change listener with debouncing to prevent rapid re-renders
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Debounce mutations to prevent flickering
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(async () => {
        if (!isMounted) return;

        if (session?.user) {
          // Fetch profile directly with the valid session to avoid race conditions
          // where the initial SWR fetch runs before auth token is fully initialized
          const profile = await fetchProfile(session.user.id);
          if (!isMounted) return;
          const role = profile?.role || session.user.user_metadata?.role || null;
          mutate({ user: session.user, profile, role }, { revalidate: false });
        } else {
          mutate({ user: null, profile: null, role: null }, { revalidate: false });
        }
      }, 100); // Small delay to batch rapid changes
    });

    // Cleanup subscription on unmount
    return () => {
      isMounted = false;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
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
