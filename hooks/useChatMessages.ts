import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message, MessageAttachment } from '@/types/message';
import { useRealtimeMessages, prefetchProfiles, getCachedUsername } from './useRealtimeMessages';

interface UseChatMessagesOptions {
  channelId: string | null;
  enabled?: boolean;
}

interface PendingMessage extends Message {
  pending: true;
  tempId: string;
}

interface FailedMessage extends Message {
  failed: true;
  error?: string;
  tempId?: string;
}

type ChatMessage = Message | PendingMessage | FailedMessage;

// Dedupe pending message matching
function findMatchingPending(
  pendingMap: Map<string, PendingMessage>,
  message: Message
): PendingMessage | undefined {
  return Array.from(pendingMap.values()).find((p) => {
    const contentMatches = p.content.trim() === message.content.trim();
    const userMatches = p.user.id === message.user.id;
    const timeClose = Math.abs(p.timestamp - message.timestamp) < 15000; // 15 second window
    return contentMatches && userMatches && timeClose;
  });
}

export function useChatMessages({ channelId, enabled = true }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const lastChannelIdRef = useRef<string | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Stable message map for deduplication
  const messageIdsRef = useRef<Set<string>>(new Set());

  // Fetch messages from API with optimizations
  const fetchMessages = useCallback(async (before?: string, signal?: AbortSignal, retryCount = 0) => {
    if (!channelId || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get session and refresh if needed
      let { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/695db6a1-160d-40d0-ab86-4058ba2ea89b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useChatMessages.ts:61',message:'Session check before fetch',data:{hasSession:!!session,hasError:!!sessionError,channelId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B2'})}).catch(()=>{});
      // #endregion
      
      // If no session or session error, try to refresh
      if (sessionError || !session) {
        console.warn('Session error, attempting refresh:', sessionError);
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/695db6a1-160d-40d0-ab86-4058ba2ea89b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'useChatMessages.ts:65',message:'Attempting session refresh',data:{channelId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B2'})}).catch(()=>{});
        // #endregion
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshedSession) {
          throw new Error('Not authenticated. Please log in again.');
        }
        session = refreshedSession;
      }

      // Ensure we have an access token
      if (!session?.access_token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const url = new URL(`/api/chats/${channelId}/messages`, window.location.origin);
      if (before) {
        url.searchParams.set('before', before);
      }
      url.searchParams.set('limit', '50');

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        signal,
      });

      // Handle unauthorized errors with session refresh retry
      if (response.status === 401 && retryCount < 1) {
        console.warn('Unauthorized error, refreshing session and retrying...');
        // Try to refresh the session
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession();
        
        if (!refreshError && refreshedSession?.access_token) {
          // Retry once with the refreshed token
          return fetchMessages(before, signal, retryCount + 1);
        }
      }

      if (!response.ok) {
        let errorMessage = `Failed to fetch messages: ${response.statusText}`;
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
            if (errorData.details) {
              errorMessage += ` - ${errorData.details}`;
            }
          }
        } catch {
          // Use status text
        }
        
        // If it's an auth error, suggest re-login
        if (response.status === 401) {
          errorMessage = 'Your session has expired. Please refresh the page or log in again.';
        }
        
        throw new Error(errorMessage);
      }

      const responseData = await response.json();

      if (!responseData || !Array.isArray(responseData.messages)) {
        throw new Error('Invalid response from server.');
      }

      const { messages: fetchedMessages } = responseData;

      // Debug: Log fetched messages to see what usernames we're getting
      console.log('📨 Fetched messages from API:', {
        count: fetchedMessages.length,
        messages: fetchedMessages.map((m: Message) => ({
          id: m.id,
          userId: m.user.id,
          username: m.user.username,
          hasUsername: !!m.user.username && m.user.username !== 'User',
        })),
      });

      // Prefetch profiles for faster future lookups
      const userIds = Array.from(new Set(fetchedMessages.map((m: Message) => m.user.id))) as string[];
      console.log('👥 Prefetching profiles for user IDs:', userIds);
      
      // Prefetch profiles and then update messages with correct usernames
      await prefetchProfiles(userIds);
      
      // Update messages with usernames from cache if they were 'User'
      const updatedMessages = fetchedMessages.map((m: Message) => {
        if (!m.user.username || m.user.username === 'User') {
          const cachedUsername = getCachedUsername(m.user.id);
          if (cachedUsername && cachedUsername !== 'User') {
            console.log(`🔄 Updating message ${m.id} username from 'User' to '${cachedUsername}'`);
            return {
              ...m,
              user: {
                ...m.user,
                username: cachedUsername,
              },
            };
          }
        }
        return m;
      });

      // Update message IDs set
      updatedMessages.forEach((m: Message) => messageIdsRef.current.add(m.id));

      if (before) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = updatedMessages.filter((m: Message) => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });
      } else {
        messageIdsRef.current = new Set(updatedMessages.map((m: Message) => m.id));
        setMessages(updatedMessages);
      }

      setHasMore(fetchedMessages.length === 50);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Request was cancelled, don't show error
        return;
      }
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [channelId]);

  // Handle channel changes - clear and refetch
  useEffect(() => {
    // Abort any pending fetch
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
      fetchAbortRef.current = null;
    }

    const channelChanged = lastChannelIdRef.current !== channelId;
    lastChannelIdRef.current = channelId;

    if (!enabled || !channelId) {
      setMessages([]);
      setError(null);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
      return;
    }

    if (channelChanged) {
      // Clear immediately for instant visual feedback
      setMessages([]);
      setError(null);
      setHasMore(true);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
      setIsLoading(true);
    }

    // Create new abort controller
    const abortController = new AbortController();
    fetchAbortRef.current = abortController;

    fetchMessages(undefined, abortController.signal);

    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, [channelId, enabled, fetchMessages]);

  // Handle new real-time messages (optimized for instant updates)
  const handleNewMessage = useCallback((message: Message) => {
    // Debug: Log realtime message updates
    if (message.user.username && message.user.username !== 'User') {
      console.log('✅ Realtime message with username:', {
        messageId: message.id,
        userId: message.user.id,
        username: message.user.username,
      });
    } else if (message.user.username === 'User') {
      console.warn('⚠️ Realtime message with placeholder username:', {
        messageId: message.id,
        userId: message.user.id,
      });
    }
    
    setMessages((prev) => {
      // Check if message already exists
      const existingIdx = prev.findIndex((m) => m.id === message.id);
      if (existingIdx !== -1) {
        // Update existing message (e.g., when profile loads)
        const existing = prev[existingIdx];
        // Always update if username changed from 'User' to actual username
        const usernameImproved = 
          (existing.user.username === 'User' || !existing.user.username) &&
          message.user.username &&
          message.user.username !== 'User';
        
        // Only update if the new message has more data OR username improved
        if (
          usernameImproved ||
          message.user.username !== 'User' ||
          message.replyPreview ||
          message.attachments
        ) {
          if (usernameImproved) {
            console.log('🔄 Updating message with improved username:', {
              messageId: message.id,
              oldUsername: existing.user.username,
              newUsername: message.user.username,
            });
          }
          return prev.map((m, idx) => (idx === existingIdx ? { ...existing, ...message } : m));
        }
        return prev;
      }

      // Try to match and replace pending message
      const pending = findMatchingPending(pendingMessagesRef.current, message);
      if (pending) {
        pendingMessagesRef.current.delete(pending.tempId);
        messageIdsRef.current.add(message.id);
        return prev.map((m) => {
          if ('tempId' in m && m.tempId === pending.tempId) {
            return message;
          }
          return m;
        });
      }

      // Add new message if not already in list
      if (!messageIdsRef.current.has(message.id)) {
        messageIdsRef.current.add(message.id);
        return [...prev, message];
      }

      return prev;
    });
  }, []);

  // Handle message updates
  const handleMessageUpdate = useCallback((message: Message) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? message : m))
    );
  }, []);

  // Handle message deletions
  const handleMessageDelete = useCallback((messageId: string) => {
    messageIdsRef.current.delete(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  // Real-time subscription
  const { isConnected } = useRealtimeMessages({
    channelId,
    enabled,
    onNewMessage: handleNewMessage,
    onMessageUpdate: handleMessageUpdate,
    onMessageDelete: handleMessageDelete,
  });

  // Periodically update messages with usernames from cache (in case profiles load after messages)
  useEffect(() => {
    if (!enabled || !channelId || messages.length === 0) return;

    const updateUsernamesFromCache = () => {
      setMessages((prev) => {
        let updated = false;
        const updatedMessages = prev.map((m) => {
          if ((!m.user.username || m.user.username === 'User') && m.user.id) {
            const cachedUsername = getCachedUsername(m.user.id);
            if (cachedUsername && cachedUsername !== 'User') {
              updated = true;
              return {
                ...m,
                user: {
                  ...m.user,
                  username: cachedUsername,
                },
              };
            }
          }
          return m;
        });

        if (updated) {
          console.log('🔄 Updated messages with usernames from cache');
        }

        return updated ? updatedMessages : prev;
      });
    };

    // Update immediately
    updateUsernamesFromCache();

    // Then update every 2 seconds for a short period (profiles should load quickly)
    const interval = setInterval(updateUsernamesFromCache, 2000);
    const timeout = setTimeout(() => clearInterval(interval), 10000); // Stop after 10 seconds

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [enabled, channelId, messages.length]);

  // Add optimistic message with instant display
  const addPendingMessage = useCallback((
    content: string, 
    replyTo?: string, 
    userId?: string, 
    attachments?: MessageAttachment[],
    replyPreview?: { id: string; username: string; content: string }
  ): string => {
    const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    const pendingMessage: PendingMessage = {
      id: tempId,
      tempId,
      content,
      replyTo,
      replyPreview,
      attachments,
      timestamp: Date.now(),
      pending: true,
      user: {
        id: userId || '',
        username: getCachedUsername(userId || '') || 'You',
        avatarUrl: '',
      },
    };

    pendingMessagesRef.current.set(tempId, pendingMessage);
    setMessages((prev) => [...prev, pendingMessage]);

    return tempId;
  }, []);

  // Mark message as failed
  const markMessageFailed = useCallback((tempId: string, error?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if ('tempId' in m && m.tempId === tempId) {
          const failed: FailedMessage = {
            ...m,
            failed: true,
            error,
          };
          delete (failed as any).pending;
          return failed;
        }
        return m;
      })
    );
  }, []);

  // Remove pending/failed message
  const removePendingMessage = useCallback((tempId: string) => {
    pendingMessagesRef.current.delete(tempId);
    setMessages((prev) => prev.filter((m) => !('tempId' in m && m.tempId === tempId)));
  }, []);

  // Replace pending message with real message (for immediate server response)
  const replacePendingMessage = useCallback((tempId: string, realMessage: Message) => {
    pendingMessagesRef.current.delete(tempId);
    messageIdsRef.current.add(realMessage.id);
    
    setMessages((prev) => {
      const hasRealMessage = prev.some((m) => m.id === realMessage.id);
      if (hasRealMessage) {
        // Real message already exists (from real-time), just remove pending
        return prev.filter((m) => !('tempId' in m && m.tempId === tempId));
      }
      // Replace pending with real message
      return prev.map((m) => {
        if ('tempId' in m && m.tempId === tempId) {
          return realMessage;
        }
        return m;
      });
    });
  }, []);

  // Load more messages (pagination)
  const loadMore = useCallback(() => {
    if (!hasMore || isLoading || messages.length === 0) return;

    const oldestMessage = messages.find(m => !('pending' in m));
    if (oldestMessage && 'timestamp' in oldestMessage) {
      const before = new Date(oldestMessage.timestamp).toISOString();
      fetchMessages(before);
    }
  }, [hasMore, isLoading, messages, fetchMessages]);

  // Update single message
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  }, []);

  // Add reaction (optimistic)
  const addReaction = useCallback((messageId: string, emoji: string, userId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const existingReaction = msg.reactions?.find((r) => r.emoji === emoji);
        const hasReacted = existingReaction?.users.includes(userId);

        if (hasReacted) {
          const updatedReactions = msg.reactions
            ?.map((r) => {
              if (r.emoji === emoji) {
                const newUsers = r.users.filter((id) => id !== userId);
                return newUsers.length > 0
                  ? { ...r, users: newUsers, count: newUsers.length }
                  : null;
              }
              return r;
            })
            .filter((r): r is NonNullable<typeof r> => r !== null) || [];

          return {
            ...msg,
            reactions: updatedReactions.length > 0 ? updatedReactions : undefined,
          };
        } else {
          const updatedReactions = existingReaction
            ? msg.reactions?.map((r) =>
                r.emoji === emoji
                  ? { ...r, users: [...r.users, userId], count: r.count + 1 }
                  : r
              )
            : [...(msg.reactions || []), { emoji, count: 1, users: [userId] }];

          return { ...msg, reactions: updatedReactions };
        }
      })
    );
  }, []);

  // Refetch all messages
  const refetch = useCallback(() => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    const abortController = new AbortController();
    fetchAbortRef.current = abortController;
    messageIdsRef.current.clear();
    setMessages([]);
    fetchMessages(undefined, abortController.signal);
  }, [fetchMessages]);

  return {
    messages,
    isLoading,
    error,
    hasMore,
    isConnected,
    messagesEndRef,
    addPendingMessage,
    markMessageFailed,
    removePendingMessage,
    replacePendingMessage,
    loadMore,
    updateMessage,
    addReaction,
    refetch,
  };
}
