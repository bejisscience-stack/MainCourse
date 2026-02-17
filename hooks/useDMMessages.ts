import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { edgeFunctionUrl } from '@/lib/api-client';
import type { Message, MessageAttachment } from '@/types/message';
import { useRealtimeDMMessages } from './useRealtimeDMMessages';
import { prefetchProfiles, getCachedUsername } from './useRealtimeMessages';

interface UseDMMessagesOptions {
  conversationId: string | null;
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

type DMChatMessage = Message | PendingMessage | FailedMessage;

// Dedupe pending message matching
function findMatchingPending(
  pendingMap: Map<string, PendingMessage>,
  message: Message
): PendingMessage | undefined {
  return Array.from(pendingMap.values()).find((p) => {
    const contentMatches = p.content.trim() === message.content.trim();
    const userMatches = p.user.id === message.user.id;
    const timeClose = Math.abs(p.timestamp - message.timestamp) < 15000;
    return contentMatches && userMatches && timeClose;
  });
}

export function useDMMessages({ conversationId, enabled = true }: UseDMMessagesOptions) {
  const [messages, setMessages] = useState<DMChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const messageIdsRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  // Fetch messages from dm-messages edge function
  const fetchMessages = useCallback(async (
    targetConversationId: string,
    before?: string,
    signal?: AbortSignal
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (!refreshedSession?.access_token) {
          throw new Error('Not authenticated. Please log in again.');
        }
      }

      const token = session?.access_token || (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const url = new URL(edgeFunctionUrl('dm-messages'));
      url.searchParams.set('conversationId', targetConversationId);
      if (before) {
        url.searchParams.set('before', before);
      }
      url.searchParams.set('limit', '50');

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...(anonKey && { 'apikey': anonKey }),
        },
        signal,
      });

      if (signal?.aborted) return null;

      if (!response.ok) {
        if (response.status === 401) {
          const { data: { session: newSession } } = await supabase.auth.refreshSession();
          if (newSession?.access_token) {
            const retryResponse = await fetch(url.toString(), {
              headers: {
                'Authorization': `Bearer ${newSession.access_token}`,
                'Content-Type': 'application/json',
                ...(anonKey && { 'apikey': anonKey }),
              },
              signal,
            });
            if (retryResponse.ok) {
              return retryResponse.json();
            }
          }
          throw new Error('Session expired. Please refresh the page.');
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch messages: ${response.statusText}`);
      }

      return response.json();
    } catch (err: any) {
      if (err.name === 'AbortError') return null;
      throw err;
    }
  }, []);

  // Main effect - handles conversation changes and initial load
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (!enabled || !conversationId) {
      setMessages([]);
      setError(null);
      setIsLoading(false);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
      conversationIdRef.current = null;
      return;
    }

    const isNewConversation = conversationIdRef.current !== conversationId;
    conversationIdRef.current = conversationId;

    if (isNewConversation) {
      setMessages([]);
      setError(null);
      setHasMore(true);
      messageIdsRef.current.clear();
      pendingMessagesRef.current.clear();
    }

    setIsLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    (async () => {
      try {
        const result = await fetchMessages(conversationId, undefined, abortController.signal);

        if (abortController.signal.aborted || !result) return;

        const fetchedMessages: Message[] = result.messages || [];

        messageIdsRef.current = new Set(fetchedMessages.map(m => m.id));
        setMessages(fetchedMessages);
        setHasMore(fetchedMessages.length === 50);
        setIsLoading(false);
        setError(null);

        // Prefetch profiles in background
        if (fetchedMessages.length > 0) {
          const userIds = [...new Set(fetchedMessages.map(m => m.user.id))];
          prefetchProfiles(userIds).then(() => {
            if (conversationIdRef.current === conversationId) {
              setMessages(prev => {
                let hasUpdates = false;
                const updated = prev.map(m => {
                  if (!m.user.username || m.user.username === 'User') {
                    const cached = getCachedUsername(m.user.id);
                    if (cached && cached !== 'User') {
                      hasUpdates = true;
                      return { ...m, user: { ...m.user, username: cached } };
                    }
                  }
                  return m;
                });
                return hasUpdates ? updated : prev;
              });
            }
          }).catch(() => {});
        }
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        console.error('Error fetching DM messages:', err);
        setError(err.message || 'Failed to load messages');
        setIsLoading(false);
      }
    })();

    return () => {
      abortController.abort();
    };
  }, [conversationId, enabled, fetchMessages]);

  // Handle new real-time messages
  const handleNewMessage = useCallback((message: Message) => {
    setMessages((prev) => {
      const existingIdx = prev.findIndex((m) => m.id === message.id);
      if (existingIdx !== -1) {
        const existing = prev[existingIdx];
        const shouldUpdate =
          ((!existing.user.username || existing.user.username === 'User') &&
           message.user.username && message.user.username !== 'User') ||
          message.replyPreview;

        if (shouldUpdate) {
          return prev.map((m, idx) => idx === existingIdx ? { ...existing, ...message } : m);
        }
        return prev;
      }

      const pending = findMatchingPending(pendingMessagesRef.current, message);
      if (pending) {
        pendingMessagesRef.current.delete(pending.tempId);
        messageIdsRef.current.add(message.id);
        return prev.map((m) =>
          ('tempId' in m && m.tempId === pending.tempId) ? message : m
        );
      }

      if (!messageIdsRef.current.has(message.id)) {
        messageIdsRef.current.add(message.id);
        return [...prev, message];
      }

      return prev;
    });
  }, []);

  const handleMessageUpdate = useCallback((message: Message) => {
    setMessages((prev) => prev.map((m) => m.id === message.id ? message : m));
  }, []);

  const handleMessageDelete = useCallback((messageId: string) => {
    messageIdsRef.current.delete(messageId);
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  // Real-time subscription
  const { isConnected } = useRealtimeDMMessages({
    conversationId,
    enabled,
    onNewMessage: handleNewMessage,
    onMessageUpdate: handleMessageUpdate,
    onMessageDelete: handleMessageDelete,
  });

  // Add optimistic message
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

  const markMessageFailed = useCallback((tempId: string, errorMsg?: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if ('tempId' in m && m.tempId === tempId) {
          const failed: FailedMessage = { ...m, failed: true, error: errorMsg };
          delete (failed as any).pending;
          return failed;
        }
        return m;
      })
    );
  }, []);

  const removePendingMessage = useCallback((tempId: string) => {
    pendingMessagesRef.current.delete(tempId);
    setMessages((prev) => prev.filter((m) => !('tempId' in m && m.tempId === tempId)));
  }, []);

  const replacePendingMessage = useCallback((tempId: string, realMessage: Message) => {
    pendingMessagesRef.current.delete(tempId);
    messageIdsRef.current.add(realMessage.id);

    setMessages((prev) => {
      if (prev.some((m) => m.id === realMessage.id)) {
        return prev.filter((m) => !('tempId' in m && m.tempId === tempId));
      }
      return prev.map((m) => ('tempId' in m && m.tempId === tempId) ? realMessage : m);
    });
  }, []);

  // Load more messages (pagination)
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading || messages.length === 0 || !conversationId) return;

    const oldestMessage = messages.find(m => !('pending' in m));
    if (!oldestMessage || !('timestamp' in oldestMessage)) return;

    setIsLoading(true);

    try {
      const before = new Date(oldestMessage.timestamp).toISOString();
      const result = await fetchMessages(conversationId, before);

      if (!result) return;

      const olderMessages: Message[] = result.messages || [];

      if (olderMessages.length > 0) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = olderMessages.filter(m => !existingIds.has(m.id));
          newMessages.forEach(m => messageIdsRef.current.add(m.id));
          return [...newMessages, ...prev];
        });
      }

      setHasMore(olderMessages.length === 50);
    } catch (err: any) {
      console.error('Error loading more DM messages:', err);
    } finally {
      setIsLoading(false);
    }
  }, [hasMore, isLoading, messages, conversationId, fetchMessages]);

  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prev) => prev.map((msg) => msg.id === messageId ? { ...msg, ...updates } : msg));
  }, []);

  const refetch = useCallback(() => {
    if (!conversationId) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setError(null);
    setMessages([]);
    setIsLoading(true);
    messageIdsRef.current.clear();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    (async () => {
      try {
        const result = await fetchMessages(conversationId, undefined, abortController.signal);
        if (abortController.signal.aborted || !result) return;

        const fetchedMessages: Message[] = result.messages || [];
        messageIdsRef.current = new Set(fetchedMessages.map(m => m.id));
        setMessages(fetchedMessages);
        setHasMore(fetchedMessages.length === 50);
        setIsLoading(false);
      } catch (err: any) {
        if (abortController.signal.aborted) return;
        setError(err.message || 'Failed to load messages');
        setIsLoading(false);
      }
    })();
  }, [conversationId, fetchMessages]);

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
    refetch,
  };
}
