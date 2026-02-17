import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { prefetchProfiles, getCachedUsername } from './useRealtimeMessages';
import type { Message } from '@/types/message';

interface UseRealtimeDMMessagesOptions {
  conversationId: string | null;
  enabled?: boolean;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
}

// Fetch and cache a single profile
async function fetchAndCacheProfile(userId: string): Promise<string> {
  const cached = getCachedUsername(userId);
  if (cached !== 'User') return cached;

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', userId)
      .single();

    if (profile && !error) {
      const username = profile.username?.trim() || profile.email?.split('@')[0] || 'User';
      // Prefetch to populate the cache
      await prefetchProfiles([userId]);
      return username;
    }
  } catch {
    // Silent fail
  }
  return 'User';
}

// Fetch reply preview from dm_messages table
async function fetchDMReplyPreview(replyToId: string): Promise<{ id: string; username: string; content: string } | undefined> {
  try {
    const { data: replyMessage, error } = await supabase
      .from('dm_messages')
      .select('id, content, user_id')
      .eq('id', replyToId)
      .single();

    if (error || !replyMessage) return undefined;

    const username = await fetchAndCacheProfile(replyMessage.user_id);
    return {
      id: replyMessage.id,
      username,
      content: replyMessage.content.substring(0, 50) + (replyMessage.content.length > 50 ? '...' : ''),
    };
  } catch {
    return undefined;
  }
}

export function useRealtimeDMMessages({
  conversationId,
  enabled = true,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
}: UseRealtimeDMMessagesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const callbacksRef = useRef({ onNewMessage, onMessageUpdate, onMessageDelete });

  // Keep callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageUpdate, onMessageDelete };
  }, [onNewMessage, onMessageUpdate, onMessageDelete]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`dm-messages:${conversationId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const msgData = payload.new as {
            id: string;
            content: string;
            reply_to_id?: string | null;
            edited_at?: string | null;
            created_at: string;
            user_id: string;
          };

          // Try cached username first for instant display
          const cachedUsername = getCachedUsername(msgData.user_id);

          const message: Message = {
            id: msgData.id,
            content: msgData.content,
            replyTo: msgData.reply_to_id || undefined,
            edited: !!msgData.edited_at,
            timestamp: new Date(msgData.created_at).getTime(),
            user: {
              id: msgData.user_id,
              username: cachedUsername,
              avatarUrl: '',
            },
          };

          // Send immediately
          callbacksRef.current.onNewMessage?.(message);

          // Fetch additional data in background
          const [actualUsername, replyPreview] = await Promise.all([
            cachedUsername === 'User' ? fetchAndCacheProfile(msgData.user_id) : Promise.resolve(cachedUsername),
            msgData.reply_to_id ? fetchDMReplyPreview(msgData.reply_to_id) : Promise.resolve(undefined),
          ]);

          if (actualUsername !== cachedUsername || replyPreview) {
            const updatedMessage: Message = {
              ...message,
              user: { ...message.user, username: actualUsername },
              replyPreview,
            };
            callbacksRef.current.onNewMessage?.(updatedMessage);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const msgData = payload.new as {
            id: string;
            content: string;
            reply_to_id?: string | null;
            edited_at?: string | null;
            created_at: string;
            user_id: string;
          };

          const username = await fetchAndCacheProfile(msgData.user_id);
          const replyPreview = msgData.reply_to_id
            ? await fetchDMReplyPreview(msgData.reply_to_id)
            : undefined;

          const message: Message = {
            id: msgData.id,
            content: msgData.content,
            replyTo: msgData.reply_to_id || undefined,
            replyPreview,
            edited: !!msgData.edited_at,
            timestamp: new Date(msgData.created_at).getTime(),
            user: {
              id: msgData.user_id,
              username,
              avatarUrl: '',
            },
          };

          callbacksRef.current.onMessageUpdate?.(message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'dm_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const oldMessage = payload.old as { id: string };
          if (oldMessage?.id) {
            callbacksRef.current.onMessageDelete?.(oldMessage.id);
          }
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log(`[RT] Connected to DM conversation ${conversationId}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`[RT] Disconnected from DM conversation ${conversationId}: ${status}`);
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [conversationId, enabled]);

  return { isConnected };
}
