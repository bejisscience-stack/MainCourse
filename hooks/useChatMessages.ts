import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message } from '@/types/message';
import { useRealtimeMessages } from './useRealtimeMessages';

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

export function useChatMessages({ channelId, enabled = true }: UseChatMessagesOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false);
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());

  // Fetch messages from API
  const fetchMessages = useCallback(async (before?: string) => {
    if (!channelId || isLoadingRef.current) return;

    isLoadingRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Get session - Supabase auto-refreshes if needed
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
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
        credentials: 'include', // Include cookies for session
        cache: 'no-store', // Ensure fresh data
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch messages: ${response.statusText}`);
      }

      const { messages: fetchedMessages } = await response.json();

      if (before) {
        // Pagination - prepend older messages
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMessages = fetchedMessages.filter((m: Message) => !existingIds.has(m.id));
          return [...newMessages, ...prev];
        });
      } else {
        // Initial load - replace all messages
        setMessages(fetchedMessages);
      }

      setHasMore(fetchedMessages.length === 50);
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  }, [channelId]);

  // Load initial messages
  useEffect(() => {
    if (!enabled || !channelId) {
      setMessages([]);
      setError(null);
      return;
    }

    fetchMessages();
  }, [channelId, enabled, fetchMessages]);

  // Handle new real-time messages (optimized for speed)
  const handleNewMessage = useCallback((message: Message) => {
    // Use functional update for instant state update
    setMessages((prev) => {
      // First, check if message already exists by ID (most reliable - handles profile updates)
      const existingIndex = prev.findIndex((m) => m.id === message.id);
      if (existingIndex !== -1) {
        // Update existing message (useful for profile updates from "Loading..." to actual name)
        return prev.map((m, idx) => 
          idx === existingIndex ? message : m
        );
      }

      // Try to match and replace pending messages
      // Match by content AND user ID (more lenient on time to catch delayed real-time updates)
      const pending = Array.from(pendingMessagesRef.current.values()).find(
        (p) => {
          const contentMatches = p.content.trim() === message.content.trim();
          const userMatches = p.user.id === message.user.id;
          // More lenient time window (10 seconds) to catch delayed real-time updates
          const timeClose = Math.abs(p.timestamp - message.timestamp) < 10000; // 10 seconds window
          
          // Match: content AND user AND time must all match
          return contentMatches && userMatches && timeClose;
        }
      );

      if (pending) {
        // Replace pending message with real message instantly
        pendingMessagesRef.current.delete(pending.tempId!);
        console.log(`Replacing pending message ${pending.tempId} with real message ${message.id}`);
        return prev.map((m) => {
          if ('tempId' in m && m.tempId === pending.tempId) {
            return message;
          }
          return m;
        });
      }

      // Add new message (from other users or if matching failed)
      return [...prev, message];
    });
  }, []);

  // Real-time subscription
  useRealtimeMessages({
    channelId,
    enabled,
    onNewMessage: handleNewMessage,
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // Add optimistic message
  const addPendingMessage = useCallback((content: string, replyTo?: string, userId?: string): string => {
    const tempId = `pending-${Date.now()}-${Math.random()}`;
    const pendingMessage: PendingMessage = {
      id: tempId,
      tempId,
      content,
      replyTo,
      timestamp: Date.now(),
      pending: true,
      user: {
        id: userId || '',
        username: 'You',
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

    const oldestMessage = messages[0];
    if ('timestamp' in oldestMessage) {
      const before = new Date(oldestMessage.timestamp).toISOString();
      fetchMessages(before);
    }
  }, [hasMore, isLoading, messages, fetchMessages]);

  // Update message
  const updateMessage = useCallback((messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  }, []);

  // Add reaction
  const addReaction = useCallback((messageId: string, emoji: string, userId: string) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id !== messageId) return msg;

        const existingReaction = msg.reactions?.find((r) => r.emoji === emoji);
        const hasReacted = existingReaction?.users.includes(userId);

        if (hasReacted) {
          // Remove reaction
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
          // Add reaction
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

  return {
    messages,
    isLoading,
    error,
    hasMore,
    messagesEndRef,
    addPendingMessage,
    markMessageFailed,
    removePendingMessage,
    replacePendingMessage,
    loadMore,
    updateMessage,
    addReaction,
    refetch: () => fetchMessages(),
  };
}
