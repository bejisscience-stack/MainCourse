import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface Friend {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  commonCourses: number;
  commonCourseIds: string[];
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFriends = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No session found for friends');
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/friends', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to fetch friends`;
        console.error('Friends API error:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Friends fetched:', data.friends?.length || 0);
      setFriends(data.friends || []);
    } catch (err: any) {
      console.error('Error fetching friends:', err);
      setError(err.message || 'Failed to fetch friends');
      // Set empty array on error so UI still renders
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const removeFriend = useCallback(async (friendId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/friends?friendId=${friendId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove friend');
      }

      // Refresh friends list
      await fetchFriends();
    } catch (err: any) {
      console.error('Error removing friend:', err);
      throw err;
    }
  }, [fetchFriends]);

  useEffect(() => {
    fetchFriends();

    // Subscribe to real-time changes in friendships
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupSubscription = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        channel = supabase
          .channel(`friendships-changes-${session.user.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'friendships',
              filter: `user1_id=eq.${session.user.id}`,
            },
            () => {
              fetchFriends();
            }
          )
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'friendships',
              filter: `user2_id=eq.${session.user.id}`,
            },
            () => {
              fetchFriends();
            }
          )
          .subscribe();

        return () => {
          if (channel) {
            supabase.removeChannel(channel);
          }
        };
      }
    };

    setupSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [fetchFriends]);

  return {
    friends,
    isLoading,
    error,
    refetch: fetchFriends,
    removeFriend,
  };
}
