import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { FriendRequest } from '@/types/friend-request';

interface FriendRequestRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  sender: { username: string; avatar_url: string } | null;
  receiver: { username: string; avatar_url: string } | null;
}

function transformRow(row: FriendRequestRow): FriendRequest {
  return {
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    status: row.status as FriendRequest['status'],
    senderUsername: row.sender?.username || undefined,
    senderAvatarUrl: row.sender?.avatar_url || undefined,
    receiverUsername: row.receiver?.username || undefined,
    receiverAvatarUrl: row.receiver?.avatar_url || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function fetchFriendRequests(userId: string): Promise<{ sent: FriendRequest[]; received: FriendRequest[] }> {
  const [sentResult, receivedResult] = await Promise.all([
    supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at, sender:profiles!friend_requests_sender_id_fkey(username, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(username, avatar_url)')
      .eq('sender_id', userId)
      .eq('status', 'pending'),
    supabase
      .from('friend_requests')
      .select('id, sender_id, receiver_id, status, created_at, updated_at, sender:profiles!friend_requests_sender_id_fkey(username, avatar_url), receiver:profiles!friend_requests_receiver_id_fkey(username, avatar_url)')
      .eq('receiver_id', userId)
      .eq('status', 'pending'),
  ]);

  if (sentResult.error) throw sentResult.error;
  if (receivedResult.error) throw receivedResult.error;

  return {
    sent: (sentResult.data || []).map((row: any) => transformRow(row)),
    received: (receivedResult.data || []).map((row: any) => transformRow(row)),
  };
}

export function useFriendRequests(userId: string | null) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data, error, isLoading, mutate } = useSWR(
    userId ? ['friend-requests', userId] : null,
    () => userId ? fetchFriendRequests(userId) : Promise.resolve({ sent: [], received: [] }),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
      fallbackData: { sent: [], received: [] },
    }
  );

  const sent = data?.sent || [];
  const received = data?.received || [];

  const sendFriendRequest = useCallback(async (receiverId: string) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .insert({ sender_id: userId, receiver_id: receiverId });

      if (error) throw error;
      await mutate();
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, mutate]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId)
        .eq('receiver_id', userId);

      if (error) throw error;
      await mutate();
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, mutate]);

  const rejectFriendRequest = useCallback(async (requestId: string) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId)
        .eq('receiver_id', userId);

      if (error) throw error;
      await mutate();
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, mutate]);

  const cancelFriendRequest = useCallback(async (requestId: string) => {
    if (!userId) throw new Error('Not authenticated');
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId)
        .eq('sender_id', userId)
        .eq('status', 'pending');

      if (error) throw error;
      await mutate();
    } finally {
      setIsSubmitting(false);
    }
  }, [userId, mutate]);

  return {
    sent,
    received,
    isLoading,
    isSubmitting,
    error,
    mutate,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
  };
}
