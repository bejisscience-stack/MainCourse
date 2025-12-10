'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import LecturesChannel from './LecturesChannel';
import type { Channel } from '@/types/server';
import type { Message as MessageType } from '@/types/message';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useRealtimeTyping } from '@/hooks/useRealtimeTyping';
import { supabase } from '@/lib/supabase';

interface ChatAreaProps {
  channel: Channel | null;
  currentUserId: string;
  isLecturer?: boolean;
  onSendMessage: (channelId: string, content: string) => void;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

export default function ChatArea({
  channel,
  currentUserId,
  isLecturer = false,
  onSendMessage,
  onReply,
  onReaction,
}: ChatAreaProps) {
  const [replyTo, setReplyTo] = useState<{
    id: string;
    username: string;
    content: string;
  } | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);
  const userScrolledUpRef = useRef(false);

  const {
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
    addReaction,
    refetch,
  } = useChatMessages({
    channelId: channel?.id || null,
    enabled: !!channel,
  });

  // Store messages ref for timeout check
  const messagesRef = useRef(messages);
  const timeoutRefsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefsRef.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefsRef.current.clear();
    };
  }, []);

  const { typingUsers } = useRealtimeTyping({
    channelId: channel?.id || null,
    currentUserId,
    enabled: !!channel,
  });

  // Track scroll position to determine if user is reading old messages
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    userScrolledUpRef.current = !isNearBottom;
    scrollPositionRef.current = scrollTop;
  }, []);

  // Auto-scroll to bottom only if user hasn't scrolled up
  // Auto-scroll to bottom on new messages (only if user is at bottom)
  useEffect(() => {
    if (!userScrolledUpRef.current && messages.length > 0) {
      // Use requestAnimationFrame for smooth, non-blocking scroll
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      });
    }
  }, [messages.length]);

  // Handle pagination on scroll up
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    
    const handleScrollTop = () => {
      if (container.scrollTop === 0 && hasMore && !isLoading) {
        loadMore();
      }
    };

    container.addEventListener('scroll', handleScrollTop);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      container.removeEventListener('scroll', handleScrollTop);
    };
  }, [hasMore, isLoading, loadMore, handleScroll]);

  const handleSend = useCallback(async (content: string) => {
    if (!channel) {
      console.error('Cannot send message: channel is null');
      return;
    }
    
    if (isSending) {
      console.warn('Message send already in progress');
      return;
    }

    if (!content || !content.trim()) {
      console.warn('Cannot send empty message');
      return;
    }

    // Get session once for both optimistic update and API call
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error('Session error:', sessionError);
      throw new Error('Not authenticated. Please log in again.');
    }

    // Add optimistic message INSTANTLY (before API call)
    const tempId = addPendingMessage(content, replyTo?.id, session.user.id);
    setIsSending(true);

    try {

      // Send message to API (non-blocking for UI)
      const response = await fetch(`/api/chats/${channel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include', // Include cookies for session
        body: JSON.stringify({
          content,
          replyTo: replyTo?.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || 'Failed to send message';
        console.error('API error:', errorMessage, response.status);
        throw new Error(errorMessage);
      }

      // Get the actual message from the response
      const responseData = await response.json();
      const serverMessage = responseData.message;
      
      // Immediately replace pending message with server response
      // This ensures replacement even if real-time is delayed
      if (serverMessage) {
        const transformedMessage: MessageType = {
          id: serverMessage.id,
          content: serverMessage.content,
          replyTo: serverMessage.replyTo,
          edited: serverMessage.edited,
          timestamp: serverMessage.timestamp,
          user: serverMessage.user,
        };
        
        // Use the hook's replacePendingMessage function
        replacePendingMessage(tempId, transformedMessage);
        console.log(`Immediately replacing pending ${tempId} with server message ${serverMessage.id}`);
      }
      
      // Set a fallback timeout (3s) to ensure cleanup if something goes wrong
      const fallbackTimeout = setTimeout(() => {
        const currentMessages = messagesRef.current;
        const stillPending = currentMessages.find((m) => 'tempId' in m && m.tempId === tempId);
        const messageExists = currentMessages.some((m) => m.id === serverMessage?.id);
        
        if (stillPending && !messageExists && serverMessage) {
          console.warn(`Fallback: Real-time didn't replace pending message after 3s, removing it`);
          // Remove the stuck pending message
          removePendingMessage(tempId);
        }
        timeoutRefsRef.current.delete(tempId);
      }, 3000);
      
      timeoutRefsRef.current.set(tempId, fallbackTimeout);

      setReplyTo(undefined);
      onSendMessage(channel.id, content);
    } catch (error: any) {
      console.error('Error sending message:', error);
      markMessageFailed(tempId, error.message || 'Failed to send');
      // Re-throw to let MessageInput handle it
      throw error;
    } finally {
      setIsSending(false);
    }
  }, [channel, replyTo, isSending, addPendingMessage, markMessageFailed, removePendingMessage, onSendMessage]);

  const handleTyping = useCallback(async () => {
    if (!channel) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`/api/chats/${channel.id}/typing`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
    } catch (error) {
      // Silently fail - typing indicator is not critical
      console.warn('Failed to send typing indicator:', error);
    }
  }, [channel]);

  const handleReply = useCallback((messageId: string) => {
    const message = messages.find((m) => m.id === messageId && !('pending' in m) && !('failed' in m));
    if (message) {
      setReplyTo({
        id: message.id,
        username: message.user.username,
        content: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
      });
    }
  }, [messages]);

  const handleReaction = useCallback((messageId: string, emoji: string) => {
    addReaction(messageId, emoji, currentUserId);
    onReaction?.(messageId, emoji);
  }, [addReaction, currentUserId, onReaction]);

  const handleRetry = useCallback((tempId: string) => {
    const failedMessage = messages.find((m) => 'tempId' in m && m.tempId === tempId);
    if (failedMessage && 'content' in failedMessage) {
      removePendingMessage(tempId);
      handleSend(failedMessage.content);
    }
  }, [messages, removePendingMessage, handleSend]);

  if (!channel) {
    return (
      <div className="flex-1 bg-gray-900 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <p className="text-lg font-medium">Select a channel to start chatting</p>
        </div>
      </div>
    );
  }

  // Show Lectures channel for lectures type
  if (channel.type === 'lectures') {
    return (
      <LecturesChannel
        channel={channel}
        courseId={channel.courseId || ''}
        currentUserId={currentUserId}
        isLecturer={isLecturer}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Channel header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xl">#</span>
          <h2 className="text-white font-semibold text-sm">{channel.name}</h2>
        </div>
        {channel.description && (
          <span className="ml-4 text-gray-400 text-xs">{channel.description}</span>
        )}
        <div className="ml-auto flex items-center gap-4">
          <button className="text-gray-400 hover:text-white transition-colors" title="Threads">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Notifications">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Pinned Messages">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors" title="Members">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
          </button>
          <div className="w-px h-6 bg-gray-700"></div>
          <input
            type="text"
            placeholder="Search"
            className="bg-gray-800 text-gray-300 text-sm px-3 py-1.5 rounded w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {isLoading && messages.length === 0 ? (
          // Loading skeleton
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-700"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-700 rounded w-24"></div>
                  <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error && messages.length === 0 ? (
          // Error state
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400 max-w-md">
              <div className="bg-red-900/50 border border-red-700 text-red-200 px-6 py-4 rounded-lg mb-4">
                <p className="font-semibold mb-2">Error loading messages</p>
                <p className="text-sm">{error}</p>
              </div>
              <button
                onClick={() => refetch()}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : messages.length === 0 ? (
          // Empty state
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <svg
                className="w-12 h-12 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p>No messages yet. Start the conversation!</p>
            </div>
          </div>
        ) : (
          <>
            {hasMore && (
              <div className="text-center py-2">
                <button
                  onClick={loadMore}
                  disabled={isLoading}
                  className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
                >
                  {isLoading ? 'Loading...' : 'Load older messages'}
                </button>
              </div>
            )}
            {messages.map((message, index) => {
              const showAvatar =
                index === 0 || 
                (messages[index - 1] && 'user' in messages[index - 1] && messages[index - 1].user.id !== message.user.id);
              
              const isFailed = 'failed' in message && message.failed;
              const tempId = 'tempId' in message ? message.tempId : undefined;
              const messageWithRetry = isFailed
                ? { 
                    ...message, 
                    onRetry: () => handleRetry(tempId || '') 
                  }
                : message;

              return (
                <Message
                  key={message.id}
                  message={messageWithRetry}
                  currentUserId={currentUserId}
                  onReply={handleReply}
                  onReaction={handleReaction}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-400 italic">
          {typingUsers.length === 1 ? (
            <span>{typingUsers[0].username} is typing...</span>
          ) : typingUsers.length === 2 ? (
            <span>{typingUsers[0].username} and {typingUsers[1].username} are typing...</span>
          ) : (
            <span>{typingUsers[0].username} and {typingUsers.length - 1} others are typing...</span>
          )}
        </div>
      )}

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        onTyping={handleTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        placeholder={`Message #${channel.name}`}
        disabled={isSending}
        isSending={isSending}
      />
    </div>
  );
}
