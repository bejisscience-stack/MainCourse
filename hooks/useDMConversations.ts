import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { DMConversation } from '@/types/dm';

async function fetchDMConversations(userId: string): Promise<DMConversation[]> {
  // Fetch conversations where user is either user1 or user2
  const [asUser1, asUser2] = await Promise.all([
    supabase
      .from('dm_conversations')
      .select('id, user1_id, user2_id, last_message, last_message_at, created_at, friend:profiles!dm_conversations_user2_id_fkey(id, username, avatar_url)')
      .eq('user1_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('dm_conversations')
      .select('id, user1_id, user2_id, last_message, last_message_at, created_at, friend:profiles!dm_conversations_user1_id_fkey(id, username, avatar_url)')
      .eq('user2_id', userId)
      .order('last_message_at', { ascending: false, nullsFirst: false }),
  ]);

  if (asUser1.error) throw asUser1.error;
  if (asUser2.error) throw asUser2.error;

  const conversations: DMConversation[] = [];

  (asUser1.data || []).forEach((row: any) => {
    conversations.push({
      id: row.id,
      friendId: row.user2_id,
      friendUsername: row.friend?.username || 'User',
      friendAvatarUrl: row.friend?.avatar_url || '',
      lastMessage: row.last_message || undefined,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
    });
  });

  (asUser2.data || []).forEach((row: any) => {
    conversations.push({
      id: row.id,
      friendId: row.user1_id,
      friendUsername: row.friend?.username || 'User',
      friendAvatarUrl: row.friend?.avatar_url || '',
      lastMessage: row.last_message || undefined,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
    });
  });

  // Sort combined results by last_message_at DESC
  conversations.sort((a, b) => {
    const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
    const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
    return bTime - aTime;
  });

  return conversations;
}

export function useDMConversations(userId: string | null) {
  const [isCreating, setIsCreating] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<DMConversation[]>(
    userId ? ['dm-conversations', userId] : null,
    () => userId ? fetchDMConversations(userId) : Promise.resolve([]),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: [],
    }
  );

  const conversations = data || [];

  const getOrCreateConversation = useCallback(async (friendId: string): Promise<DMConversation> => {
    if (!userId) throw new Error('Not authenticated');
    setIsCreating(true);
    try {
      // Ensure user1_id < user2_id for consistent ordering
      const user1Id = userId < friendId ? userId : friendId;
      const user2Id = userId < friendId ? friendId : userId;

      // Check if conversation already exists
      const { data: existing, error: fetchError } = await supabase
        .from('dm_conversations')
        .select('id, user1_id, user2_id, last_message, last_message_at, created_at')
        .eq('user1_id', user1Id)
        .eq('user2_id', user2Id)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        // Fetch friend profile
        const { data: friendProfile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', friendId)
          .single();

        await mutate();
        return {
          id: existing.id,
          friendId,
          friendUsername: friendProfile?.username || 'User',
          friendAvatarUrl: friendProfile?.avatar_url || '',
          lastMessage: existing.last_message || undefined,
          lastMessageAt: existing.last_message_at,
          createdAt: existing.created_at,
        };
      }

      // Create new conversation
      const { data: newConvo, error: insertError } = await supabase
        .from('dm_conversations')
        .insert({ user1_id: user1Id, user2_id: user2Id })
        .select('id, user1_id, user2_id, last_message, last_message_at, created_at')
        .single();

      if (insertError) throw insertError;

      // Fetch friend profile
      const { data: friendProfile } = await supabase
        .from('profiles')
        .select('username, avatar_url')
        .eq('id', friendId)
        .single();

      await mutate();
      return {
        id: newConvo.id,
        friendId,
        friendUsername: friendProfile?.username || 'User',
        friendAvatarUrl: friendProfile?.avatar_url || '',
        lastMessage: undefined,
        lastMessageAt: newConvo.last_message_at,
        createdAt: newConvo.created_at,
      };
    } finally {
      setIsCreating(false);
    }
  }, [userId, mutate]);

  return {
    conversations,
    isLoading,
    isCreating,
    error,
    mutate,
    getOrCreateConversation,
  };
}
