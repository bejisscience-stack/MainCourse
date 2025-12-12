import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message, ReplyPreview } from '@/types/message';

// Global profile cache for instant lookups
const profileCache = new Map<string, { username: string; email?: string; avatarUrl?: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface UseRealtimeMessagesOptions {
  channelId: string | null;
  enabled?: boolean;
  onNewMessage?: (message: Message) => void;
  onMessageUpdate?: (message: Message) => void;
  onMessageDelete?: (messageId: string) => void;
}

// Pre-fetch and cache profiles for a list of user IDs
export async function prefetchProfiles(userIds: string[]) {
  const now = Date.now();
  const uncachedIds = userIds.filter(id => {
    const cached = profileCache.get(id);
    return !cached || (now - cached.timestamp > CACHE_TTL);
  });

  if (uncachedIds.length === 0) return;

  try {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, email')
      .in('id', uncachedIds);

    if (profiles) {
      profiles.forEach(profile => {
        profileCache.set(profile.id, {
          username: profile.username?.trim() || profile.email?.split('@')[0] || 'User',
          email: profile.email,
          avatarUrl: '',
          timestamp: now,
        });
      });
    }
  } catch (error) {
    console.warn('Failed to prefetch profiles:', error);
  }
}

// Get username from cache or return fallback
export function getCachedUsername(userId: string): string {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.username;
  }
  return 'User';
}

// Fetch and cache a single profile
async function fetchAndCacheProfile(userId: string): Promise<string> {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.username;
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username, email')
      .eq('id', userId)
      .single();

    if (profile && !error) {
      const username = profile.username?.trim() || profile.email?.split('@')[0] || 'User';
      profileCache.set(userId, {
        username,
        email: profile.email,
        avatarUrl: '',
        timestamp: Date.now(),
      });
      return username;
    }
  } catch (err) {
    console.warn(`Failed to fetch profile for ${userId}:`, err);
  }

  return 'User';
}

// Fetch reply preview for a message
async function fetchReplyPreview(replyToId: string): Promise<ReplyPreview | undefined> {
  try {
    const { data: replyMessage, error } = await supabase
      .from('messages')
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

// Fetch attachments for a message
async function fetchAttachments(messageId: string) {
  try {
    const { data: attachments } = await supabase
      .from('message_attachments')
      .select('*')
      .eq('message_id', messageId);

    if (attachments && attachments.length > 0) {
      return attachments.map((att: any) => ({
        id: att.id,
        fileUrl: att.file_url,
        fileName: att.file_name,
        fileType: att.file_type,
        fileSize: att.file_size,
        mimeType: att.mime_type,
      }));
    }
  } catch {
    // Silent fail for attachments
  }
  return undefined;
}

export function useRealtimeMessages({
  channelId,
  enabled = true,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
}: UseRealtimeMessagesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const callbacksRef = useRef({ onNewMessage, onMessageUpdate, onMessageDelete });

  // Keep callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageUpdate, onMessageDelete };
  }, [onNewMessage, onMessageUpdate, onMessageDelete]);

  useEffect(() => {
    if (!enabled || !channelId) {
      setIsConnected(false);
      return;
    }

    // Subscribe to message changes
    const channel = supabase
      .channel(`messages:${channelId}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const messageData = payload.new as {
            id: string;
            content: string;
            reply_to_id?: string | null;
            edited_at?: string | null;
            created_at: string;
            user_id: string;
          };

          // Try to get username from cache first for INSTANT display
          const cachedUsername = getCachedUsername(messageData.user_id);

          // Create message immediately with cached or fallback username
          const message: Message = {
            id: messageData.id,
            content: messageData.content,
            replyTo: messageData.reply_to_id || undefined,
            edited: !!messageData.edited_at,
            timestamp: new Date(messageData.created_at).getTime(),
            user: {
              id: messageData.user_id,
              username: cachedUsername,
              avatarUrl: '',
            },
          };

          // Send message IMMEDIATELY
          callbacksRef.current.onNewMessage?.(message);

          // Fetch additional data in background and update
          const [actualUsername, replyPreview, attachments] = await Promise.all([
            cachedUsername === 'User' ? fetchAndCacheProfile(messageData.user_id) : Promise.resolve(cachedUsername),
            messageData.reply_to_id ? fetchReplyPreview(messageData.reply_to_id) : Promise.resolve(undefined),
            fetchAttachments(messageData.id),
          ]);

          // Only update if we have additional data
          if (actualUsername !== cachedUsername || replyPreview || attachments) {
            const updatedMessage: Message = {
              ...message,
              user: {
                ...message.user,
                username: actualUsername,
              },
              replyPreview,
              attachments,
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
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          const messageData = payload.new as {
            id: string;
            content: string;
            reply_to_id?: string | null;
            edited_at?: string | null;
            created_at: string;
            user_id: string;
          };

          const username = await fetchAndCacheProfile(messageData.user_id);
          const [replyPreview, attachments] = await Promise.all([
            messageData.reply_to_id ? fetchReplyPreview(messageData.reply_to_id) : Promise.resolve(undefined),
            fetchAttachments(messageData.id),
          ]);

          const message: Message = {
            id: messageData.id,
            content: messageData.content,
            replyTo: messageData.reply_to_id || undefined,
            replyPreview,
            attachments,
            edited: !!messageData.edited_at,
            timestamp: new Date(messageData.created_at).getTime(),
            user: {
              id: messageData.user_id,
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
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
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
          console.log(`[RT] Connected to channel ${channelId}`);
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn(`[RT] Disconnected from channel ${channelId}: ${status}`);
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
  }, [channelId, enabled]);

  return { isConnected };
}
