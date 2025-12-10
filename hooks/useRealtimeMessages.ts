import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/message';

interface UseRealtimeMessagesOptions {
  channelId: string | null;
  enabled?: boolean;
  onNewMessage?: (message: Message) => void;
}

export function useRealtimeMessages({
  channelId,
  enabled = true,
  onNewMessage,
}: UseRealtimeMessagesOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled || !channelId) {
      setIsConnected(false);
      return;
    }

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `channel_id=eq.${channelId}`,
        },
        async (payload) => {
          // Use payload data directly for instant updates, then fetch profile in background
          const messageData = payload.new as {
            id: string;
            content: string;
            reply_to_id?: string | null;
            edited_at?: string | null;
            created_at: string;
            user_id: string;
          };
          
          // Create message immediately with basic data
          const message: Message = {
            id: messageData.id,
            content: messageData.content,
            replyTo: messageData.reply_to_id || undefined,
            edited: !!messageData.edited_at,
            timestamp: new Date(messageData.created_at).getTime(),
            user: {
              id: messageData.user_id,
              username: 'Loading...', // Will be updated when profile loads
              avatarUrl: '',
            },
          };

          // Send message immediately for instant UI update
          onNewMessage?.(message);

          // Fetch profile in background and update IMMEDIATELY
          // Use a more reliable approach - fetch with error handling and retry
          (async () => {
            let profile = null;
            let profileError = null;
            
            // Try fetching profile with retry logic (3 attempts)
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                const result = await supabase
                  .from('profiles')
                  .select('id, full_name, email')
                  .eq('id', messageData.user_id)
                  .single();

                if (result.data && !result.error) {
                  profile = result.data;
                  break;
                } else {
                  profileError = result.error;
                  console.warn(`Profile fetch attempt ${attempt + 1} failed:`, result.error);
                }
              } catch (err: any) {
                profileError = err;
                console.warn(`Profile fetch attempt ${attempt + 1} error:`, err);
                if (attempt < 2) {
                  // Wait a bit before retry (exponential backoff)
                  await new Promise(resolve => setTimeout(resolve, 200 * (attempt + 1)));
                }
              }
            }

            // Determine username with better fallback logic
            let username = 'User';
            
            if (profile) {
              username = profile.full_name || profile.email?.split('@')[0] || 'User';
            } else {
              // If profile fetch failed, use a better identifier
              // Use first 8 chars of user_id as a temporary identifier
              const userIdShort = messageData.user_id.substring(0, 8);
              username = `User-${userIdShort}`;
              
              // Log the failure for debugging
              console.error(`CRITICAL: Failed to fetch profile for user ${messageData.user_id} after 3 attempts.`);
              console.error('Profile error:', profileError);
              console.error('Using fallback username:', username);
              console.error('This suggests an RLS policy issue or profile doesn\'t exist');
            }
            
            const updatedMessage: Message = {
              ...message,
              user: {
                ...message.user,
                username,
              },
            };
            
            // Always update the message (even if profile fetch failed, use fallback)
            // This ensures "Loading..." gets replaced
            onNewMessage?.(updatedMessage);
          })();
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
          // Handle message updates (edits) - use payload directly
          const messageData = payload.new as {
            id: string;
            content: string;
            reply_to_id?: string | null;
            edited_at?: string | null;
            created_at: string;
            user_id: string;
          };
          
          const message: Message = {
            id: messageData.id,
            content: messageData.content,
            replyTo: messageData.reply_to_id || undefined,
            edited: !!messageData.edited_at,
            timestamp: new Date(messageData.created_at).getTime(),
            user: {
              id: messageData.user_id,
              username: 'Loading...',
              avatarUrl: '',
            },
          };

          onNewMessage?.(message);

          // Fetch profile in background
          supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('id', messageData.user_id)
            .single()
            .then(({ data: profile }) => {
              if (profile) {
                const updatedMessage: Message = {
                  ...message,
                  user: {
                    ...message.user,
                    username: profile.full_name || profile.email?.split('@')[0] || 'User',
                  },
                };
                onNewMessage?.(updatedMessage);
              }
            });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [channelId, enabled, onNewMessage]);

  return { isConnected };
}
