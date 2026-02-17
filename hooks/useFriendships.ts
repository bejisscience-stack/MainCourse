import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { Friendship } from '@/types/friend-request';

async function fetchFriendships(userId: string): Promise<Friendship[]> {
  // Fetch friendships where user is either user1 or user2, join with profiles to get friend info
  const [asUser1, asUser2] = await Promise.all([
    supabase
      .from('friendships')
      .select('id, user1_id, user2_id, created_at, friend:profiles!friendships_user2_id_fkey(id, username, avatar_url)')
      .eq('user1_id', userId),
    supabase
      .from('friendships')
      .select('id, user1_id, user2_id, created_at, friend:profiles!friendships_user1_id_fkey(id, username, avatar_url)')
      .eq('user2_id', userId),
  ]);

  if (asUser1.error) throw asUser1.error;
  if (asUser2.error) throw asUser2.error;

  const friendships: Friendship[] = [];

  (asUser1.data || []).forEach((row: any) => {
    friendships.push({
      id: row.id,
      friendId: row.user2_id,
      friendUsername: row.friend?.username || 'User',
      friendAvatarUrl: row.friend?.avatar_url || '',
      createdAt: row.created_at,
    });
  });

  (asUser2.data || []).forEach((row: any) => {
    friendships.push({
      id: row.id,
      friendId: row.user1_id,
      friendUsername: row.friend?.username || 'User',
      friendAvatarUrl: row.friend?.avatar_url || '',
      createdAt: row.created_at,
    });
  });

  return friendships;
}

export function useFriendships(userId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<Friendship[]>(
    userId ? ['friendships', userId] : null,
    () => userId ? fetchFriendships(userId) : Promise.resolve([]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: [],
    }
  );

  const friendships = data || [];

  const removeFriend = useCallback(async (friendshipId: string) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

      if (error) throw error;
      await mutate();
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, mutate]);

  return {
    friendships,
    isLoading,
    isSubmitting,
    error,
    mutate,
    removeFriend,
  };
}
