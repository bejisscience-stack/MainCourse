'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import type { Message as MessageType, MessageAttachment } from '@/types/message';
import { useDMMessages } from '@/hooks/useDMMessages';
import { FriendStatusProvider } from '@/contexts/FriendStatusContext';
import { supabase } from '@/lib/supabase';
import { edgeFunctionUrl } from '@/lib/api-client';

interface DMChatAreaProps {
  conversationId: string | null;
  currentUserId: string;
  friendUsername: string;
  onMobileMenuClick?: () => void;
}

export default function DMChatArea({
  conversationId,
  currentUserId,
  friendUsername,
  onMobileMenuClick,
}: DMChatAreaProps) {
  const [replyTo, setReplyTo] = useState<{
    id: string;
    username: string;
    content: string;
  } | undefined>(undefined);
  const [isSending, setIsSending] = useState(false);
  const pendingSendsRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const prevConversationIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear replyTo when conversation changes
  useEffect(() => {
    if (prevConversationIdRef.current !== conversationId) {
      setReplyTo(undefined);
      userScrolledUpRef.current = false;
      prevConversationIdRef.current = conversationId || null;
    }
  }, [conversationId]);

  const {
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
    refetch,
  } = useDMMessages({
    conversationId,
    enabled: !!conversationId,
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
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Smart scroll management
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    userScrolledUpRef.current = distanceFromBottom > 150;

    if (scrollTop < 100 && hasMore && !isLoading) {
      loadMore();
    }
  }, [hasMore, isLoading, loadMore]);

  // Smooth scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      }
    }, 50);
  }, [messagesEndRef]);

  // Auto-scroll on new messages
  useEffect(() => {
    const messageCount = messages.length;
    const isNewMessage = messageCount > prevMessageCountRef.current;
    prevMessageCountRef.current = messageCount;

    if (isNewMessage && !userScrolledUpRef.current && messageCount > 0 && !isLoading) {
      const timeoutId = setTimeout(() => {
        scrollToBottom('smooth');
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, scrollToBottom, isLoading]);

  // Scroll to bottom on initial load or conversation change
  useEffect(() => {
    if (conversationId && messages.length > 0 && !isLoading) {
      const timeoutId = setTimeout(() => {
        if (messagesContainerRef.current && messagesEndRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [conversationId, isLoading, messages.length]);

  // Add scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleSend = useCallback(async (content: string, attachments?: MessageAttachment[]) => {
    if (!conversationId) return;

    if (!content?.trim() && (!attachments || attachments.length === 0)) return;

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Not authenticated. Please log in again.');
    }

    const currentReplyTo = replyTo;

    const tempId = addPendingMessage(
      content || '',
      currentReplyTo?.id,
      session.user.id,
      attachments,
      currentReplyTo ? {
        id: currentReplyTo.id,
        username: currentReplyTo.username,
        content: currentReplyTo.content,
      } : undefined
    );

    pendingSendsRef.current += 1;
    setIsSending(true);

    userScrolledUpRef.current = false;
    scrollToBottom('smooth');

    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(edgeFunctionUrl('dm-messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey && { 'apikey': anonKey }),
        },
        body: JSON.stringify({
          conversationId,
          content: content || '',
          replyTo: currentReplyTo?.id || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const responseData = await response.json();
      const serverMessage = responseData.message;

      if (serverMessage) {
        const transformedMessage: MessageType = {
          id: serverMessage.id,
          content: serverMessage.content,
          replyTo: serverMessage.replyTo,
          replyPreview: serverMessage.replyPreview,
          edited: serverMessage.edited,
          timestamp: serverMessage.timestamp,
          user: serverMessage.user,
        };

        replacePendingMessage(tempId, transformedMessage);
      }

      // Fallback timeout for stuck pending messages
      const fallbackTimeout = setTimeout(() => {
        const currentMessages = messagesRef.current;
        const stillPending = currentMessages.find((m) => 'tempId' in m && m.tempId === tempId);
        const messageExists = currentMessages.some((m) => m.id === serverMessage?.id);

        if (stillPending && !messageExists && serverMessage) {
          removePendingMessage(tempId);
        }
        timeoutRefsRef.current.delete(tempId);
      }, 5000);

      timeoutRefsRef.current.set(tempId, fallbackTimeout);

      setReplyTo(undefined);
    } catch (error: any) {
      console.error('Error sending DM:', error);
      markMessageFailed(tempId, error.message || 'Failed to send');
    } finally {
      pendingSendsRef.current = Math.max(0, pendingSendsRef.current - 1);
      setIsSending(pendingSendsRef.current > 0);
    }
  }, [conversationId, replyTo, addPendingMessage, markMessageFailed, removePendingMessage, replacePendingMessage, scrollToBottom]);

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

  const handleRetry = useCallback((tempId: string) => {
    const failedMessage = messages.find((m) => 'tempId' in m && m.tempId === tempId);
    if (failedMessage && 'content' in failedMessage) {
      removePendingMessage(tempId);
      handleSend(failedMessage.content, failedMessage.attachments);
    }
  }, [messages, removePendingMessage, handleSend]);

  const handleScrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  if (!conversationId) {
    return (
      <div className="flex-1 bg-navy-950/30 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p className="text-lg font-semibold text-gray-200">Select a conversation</p>
          <p className="text-sm text-gray-500 mt-1">Choose a friend to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-navy-950/30 backdrop-blur-sm relative">
      {/* Header */}
      <div className="h-12 px-4 border-b border-navy-800/60 flex items-center shadow-soft flex-shrink-0 bg-navy-950/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {/* Mobile Menu Button */}
          <button
            onClick={onMobileMenuClick}
            className="md:hidden text-gray-400 hover:text-white mr-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* DM icon */}
          <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h2 className="text-gray-100 font-semibold text-sm">{friendUsername}</h2>
          {!isConnected && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Connecting...
            </span>
          )}
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden chat-scrollbar"
        style={{
          scrollBehavior: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <div className="min-h-full flex flex-col justify-end py-5">
          {isLoading && messages.length === 0 && conversationId ? (
            <div className="space-y-4 px-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-4 animate-pulse pt-3">
                  <div className="w-10 h-10 rounded-full bg-navy-900/60 flex-shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="flex items-center gap-2">
                      <div className="h-4 bg-navy-900/60 rounded w-24" />
                      <div className="h-3 bg-navy-900/40 rounded w-16" />
                    </div>
                    <div className="h-4 bg-navy-900/50 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error && messages.length === 0 && conversationId ? (
            <div className="flex items-center justify-center flex-1 px-4">
              <div className="text-center text-gray-400 max-w-md">
                <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-6 py-4 rounded-xl mb-4">
                  <p className="font-semibold mb-1 text-red-100">Error loading messages</p>
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  onClick={() => refetch()}
                  className="bg-emerald-500/90 text-white px-6 py-2 rounded-lg hover:bg-emerald-500 transition-colors shadow-soft"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : messages.length === 0 && !isLoading && conversationId ? (
            <div className="flex items-center justify-center flex-1 px-4 text-gray-400">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-navy-900/60 flex items-center justify-center border border-navy-800/60">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-200 mb-1">No messages yet</p>
                <p className="text-sm text-gray-500">Say hi to {friendUsername}!</p>
              </div>
            </div>
          ) : (
            <>
              {/* Load more */}
              {hasMore && (
                <div className="text-center py-3 px-4">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="text-sm text-emerald-300 hover:text-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg bg-navy-900/40 border border-navy-800/60 hover:bg-navy-800/60 transition-colors shadow-soft"
                  >
                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      'Load older messages'
                    )}
                  </button>
                </div>
              )}

              {/* Messages */}
              <FriendStatusProvider currentUserId={currentUserId}>
              <div className="space-y-0">
                {messages.map((message, index) => {
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const showAvatar: boolean =
                    index === 0 ||
                    !!(prevMessage &&
                      'user' in prevMessage &&
                      prevMessage.user &&
                      'user' in message &&
                      message.user &&
                      prevMessage.user.id !== message.user.id);

                  const isFailed = 'failed' in message && message.failed;
                  const tempId = 'tempId' in message ? message.tempId : undefined;
                  const messageWithRetry = isFailed
                    ? {
                      ...message,
                      onRetry: () => handleRetry(tempId || ''),
                    }
                    : message;

                  if (!message || !('id' in message) || !('user' in message)) {
                    return null;
                  }

                  return (
                    <Message
                      key={message.id}
                      message={messageWithRetry}
                      currentUserId={currentUserId}
                      onReply={handleReply}
                      showAvatar={showAvatar}
                    />
                  );
                })}
              </div>
              </FriendStatusProvider>
              <div ref={messagesEndRef} className="h-1" />
            </>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {userScrolledUpRef.current && messages.length > 10 && (
        <button
          onClick={handleScrollToBottom}
          className="absolute bottom-28 sm:bottom-24 right-4 sm:right-6 h-10 w-10 flex items-center justify-center bg-navy-900/85 border border-navy-800/70 text-gray-100 rounded-full shadow-soft hover:shadow-soft-lg hover:bg-navy-800/80 transition-all transform hover:scale-105 z-20 will-change-transform"
          style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
          title="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        placeholder={`Message ${friendUsername}`}
        isSending={isSending}
      />
    </div>
  );
}
