import { useState, useEffect, useRef } from 'react';
import type { Message } from '@/types/message';

export function useMessages(channelId: string | null, initialMessages: Message[] = []) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (channelId) {
      setMessages(initialMessages);
    }
  }, [channelId, initialMessages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const addMessage = (message: Message) => {
    setMessages((prev) => [...prev, message]);
  };

  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  };

  const addReaction = (messageId: string, emoji: string, userId: string) => {
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
  };

  return {
    messages,
    addMessage,
    updateMessage,
    addReaction,
    messagesEndRef,
  };
}
