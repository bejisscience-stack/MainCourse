import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeProfileUsername } from '@/lib/username';
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

// Max reconnection settings
const MAX_RECONNECT_ATTEMPTS = 10;
const MAX_BACKOFF_MS = 30000;

// Pre-fetch and cache profiles for a list of user IDs
export async function prefetchProfiles(userIds: string[]) {
  const now = Date.now();
  const uncachedIds = userIds.filter(id => {
    const cached = profileCache.get(id);
    return !cached || (now - cached.timestamp > CACHE_TTL);
  });

  if (uncachedIds.length === 0) {
    console.log('📦 All profiles already cached for:', userIds);
    return;
  }

  console.log('📥 Prefetching profiles for user IDs:', uncachedIds);

  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, email, avatar_url')
      .in('id', uncachedIds);

    // Store profiles in a variable to avoid type narrowing issues
    const profilesArray = profiles || [];
    // Store error properties to avoid type narrowing issues
    const errorMessage = error?.message;
    const errorCode = error?.code;

    if (profilesArray.length > 0 && !error) {
      console.log(`✅ Prefetched ${profilesArray.length} profiles out of ${uncachedIds.length} requested`);
      
      profilesArray.forEach(profile => {
        // Always use profiles.username (required field in database)
        const username = normalizeProfileUsername(profile);
        
        // Debug log for missing usernames
        if (!profile.username || profile.username.trim() === '' || username === 'User') {
          console.warn(`⚠️ Prefetched profile with missing username:`, {
            userId: profile.id,
            profileUsername: profile.username,
            normalizedUsername: username,
            profileEmail: profile.email,
          });
        }
        
        profileCache.set(profile.id, {
          username,
          email: profile.email,
          avatarUrl: profile.avatar_url || '',
          timestamp: now,
        });
      });
      
      // Log missing profiles
      const fetchedIds = new Set(profilesArray.map(p => p.id));
      const missingIds = uncachedIds.filter(id => !fetchedIds.has(id));
      if (missingIds.length > 0) {
        console.warn(`⚠️ Could not prefetch ${missingIds.length} profiles:`, missingIds);
      }
    } else {
      console.error('❌ Failed to prefetch profiles:', {
        error: errorMessage,
        errorCode: errorCode,
        requestedCount: uncachedIds.length,
        fetchedCount: profilesArray.length,
      });
    }
  } catch (error) {
    console.error('❌ Exception prefetching profiles:', error);
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

export function getCachedAvatarUrl(userId: string): string {
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.avatarUrl || '';
  }
  return '';
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
      .select('id, username, email, avatar_url')
      .eq('id', userId)
      .single();

    // Store error in a variable to avoid type narrowing issues
    const fetchError = error;
    const errorMessage = fetchError?.message;
    const errorCode = fetchError?.code;

    if (profile && !fetchError) {
      const username = normalizeProfileUsername(profile);
      
      // Debug log
      if (!profile.username || profile.username.trim() === '' || username === 'User') {
        console.warn(`⚠️ Profile fetch issue for user ${userId}:`, {
          userId,
          profileUsername: profile.username,
          normalizedUsername: username,
          profileEmail: profile.email,
          hasError: !!fetchError,
          error: errorMessage,
        });
      } else {
        console.log(`✅ Fetched profile for user ${userId}:`, {
          userId,
          username,
          profileEmail: profile.email,
        });
      }
      
      profileCache.set(userId, {
        username,
        email: profile.email,
        avatarUrl: profile.avatar_url || '',
        timestamp: Date.now(),
      });
      return username;
    } else {
      console.error(`❌ Failed to fetch profile for ${userId}:`, {
        userId,
        error: errorMessage,
        errorCode: errorCode,
        hasProfile: !!profile,
      });
    }
  } catch (err) {
    console.error(`❌ Exception fetching profile for ${userId}:`, err);
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
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Keep callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onNewMessage, onMessageUpdate, onMessageDelete };
  }, [onNewMessage, onMessageUpdate, onMessageDelete]);

  useEffect(() => {
    if (!enabled || !channelId) {
      setIsConnected(false);
      return;
    }

    let cancelled = false;

    function setupSubscription() {
      if (cancelled) return;

      // Clean up previous channel if any
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }

      const channel = supabase
        .channel(`messages:${channelId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
          }
        })
        // Broadcast listener — primary delivery for new messages (bypasses RLS)
        .on(
          'broadcast',
          { event: 'new_message' },
          (payload: { payload: Message }) => {
            const message = payload.payload;
            if (message?.id) {
              callbacksRef.current.onNewMessage?.(message);
            }
          }
        )
        // postgres_changes INSERT — backup for new messages
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

            const cachedUsername = getCachedUsername(messageData.user_id);

            const message: Message = {
              id: messageData.id,
              content: messageData.content,
              replyTo: messageData.reply_to_id || undefined,
              edited: !!messageData.edited_at,
              timestamp: new Date(messageData.created_at).getTime(),
              user: {
                id: messageData.user_id,
                username: cachedUsername,
                avatarUrl: profile.avatar_url || '',
              },
            };

            callbacksRef.current.onNewMessage?.(message);

            const [actualUsername, replyPreview, attachments] = await Promise.all([
              cachedUsername === 'User' ? fetchAndCacheProfile(messageData.user_id) : Promise.resolve(cachedUsername),
              messageData.reply_to_id ? fetchReplyPreview(messageData.reply_to_id) : Promise.resolve(undefined),
              fetchAttachments(messageData.id),
            ]);

            if (actualUsername !== cachedUsername || replyPreview || attachments) {
              const updatedMessage: Message = {
                ...message,
                user: { ...message.user, username: actualUsername },
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
                avatarUrl: profile.avatar_url || '',
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
          if (cancelled) return;

          setIsConnected(status === 'SUBSCRIBED');

          if (status === 'SUBSCRIBED') {
            console.log(`[RT] Connected to channel ${channelId}`);
            reconnectAttemptsRef.current = 0;
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn(`[RT] Disconnected from channel ${channelId}: ${status}`);
            scheduleReconnect();
          }
        });

      subscriptionRef.current = channel;
    }

    function scheduleReconnect() {
      if (cancelled) return;
      if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
        console.error(`[RT] Max reconnect attempts (${MAX_RECONNECT_ATTEMPTS}) reached for channel ${channelId}`);
        return;
      }

      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), MAX_BACKOFF_MS);
      reconnectAttemptsRef.current += 1;
      console.log(`[RT] Reconnecting to channel ${channelId} in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

      reconnectTimerRef.current = setTimeout(() => {
        if (!cancelled) {
          setupSubscription();
        }
      }, delay);
    }

    setupSubscription();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [channelId, enabled]);

  // Expose the channel ref so callers can broadcast on it
  return { isConnected, channelRef: subscriptionRef };
}
