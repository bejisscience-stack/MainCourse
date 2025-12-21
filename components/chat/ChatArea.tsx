'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Message from './Message';
import MessageInput from './MessageInput';
import LecturesChannel from './LecturesChannel';
import VideoUploadDialog, { type ProjectSubmissionData } from './VideoUploadDialog';
import type { Channel } from '@/types/server';
import type { Message as MessageType, MessageAttachment } from '@/types/message';
import { useChatMessages } from '@/hooks/useChatMessages';
import { useRealtimeTyping } from '@/hooks/useRealtimeTyping';
import { useMuteStatus } from '@/hooks/useMuteStatus';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
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
  const [showVideoUploadDialog, setShowVideoUploadDialog] = useState(false);
  const pendingSendsRef = useRef(0);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const prevChannelIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get mute status with real-time updates
  const { isMuted } = useMuteStatus({
    channelId: channel?.id || null,
    userId: currentUserId,
    enabled: !!channel,
  });

  // Get unread messages hook for marking channel as read
  const channelIds = useMemo(() => channel ? [channel.id] : [], [channel?.id]);
  const { markAsRead } = useUnreadMessages({ channelIds, enabled: !!channel });

  // Clear replyTo when channel changes
  useEffect(() => {
    if (prevChannelIdRef.current !== channel?.id) {
      setReplyTo(undefined);
      userScrolledUpRef.current = false;
      prevChannelIdRef.current = channel?.id || null;
    }
  }, [channel?.id]);

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
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const { typingUsers } = useRealtimeTyping({
    channelId: channel?.id || null,
    currentUserId,
    enabled: !!channel,
  });

  // Mark channel as read when opened or when new messages arrive
  useEffect(() => {
    if (!channel || !currentUserId) return;
    
    // Mark as read after a short delay to ensure the channel is viewed
    const timeoutId = setTimeout(() => {
      markAsRead(channel.id);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [channel?.id, currentUserId, markAsRead]);

  // Smart scroll management
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;

    const container = messagesContainerRef.current;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    
    // User is considered "scrolled up" if more than 150px from bottom
    userScrolledUpRef.current = distanceFromBottom > 150;

    // Load more when near top
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

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    const messageCount = messages.length;
    const isNewMessage = messageCount > prevMessageCountRef.current;
    prevMessageCountRef.current = messageCount;

    if (isNewMessage && !userScrolledUpRef.current && messageCount > 0) {
      scrollToBottom('smooth');
    }
  }, [messages.length, scrollToBottom]);

  // Scroll to bottom on initial load or channel change
  useEffect(() => {
    if (messages.length > 0 && !isLoading) {
      // Use instant scroll for initial load
      scrollToBottom('instant');
    }
  }, [channel?.id, isLoading]);

  // Add scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const handleSend = useCallback(async (content: string, attachments?: MessageAttachment[]) => {
    if (!channel) {
      console.error('Cannot send message: channel is null');
      return;
    }

    if (!content?.trim() && (!attachments || attachments.length === 0)) {
      console.warn('Cannot send empty message');
      return;
    }

    // Get session once
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.error('Session error:', sessionError);
      throw new Error('Not authenticated. Please log in again.');
    }

    // Capture replyTo at the time of sending
    const currentReplyTo = replyTo;

    // Add optimistic message INSTANTLY with reply preview
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

    // Track sending state for UI feedback only (not blocking)
    pendingSendsRef.current += 1;
    setIsSending(true);

    // Scroll to bottom immediately
    userScrolledUpRef.current = false;
    scrollToBottom('smooth');

    try {
      const response = await fetch(`/api/chats/${channel.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          content: content || '',
          replyTo: currentReplyTo?.id || null,
          attachments,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || errorData.details || 'Failed to send message';
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      const serverMessage = responseData.message;

      // Immediately replace pending message with server response
      if (serverMessage) {
        const transformedMessage: MessageType = {
          id: serverMessage.id,
          content: serverMessage.content,
          replyTo: serverMessage.replyTo,
          replyPreview: serverMessage.replyPreview,
          attachments: serverMessage.attachments,
          edited: serverMessage.edited,
          timestamp: serverMessage.timestamp,
          user: serverMessage.user,
        };

        replacePendingMessage(tempId, transformedMessage);
      }

      // Fallback timeout to cleanup stuck pending messages
      const fallbackTimeout = setTimeout(() => {
        const currentMessages = messagesRef.current;
        const stillPending = currentMessages.find((m) => 'tempId' in m && m.tempId === tempId);
        const messageExists = currentMessages.some((m) => m.id === serverMessage?.id);

        if (stillPending && !messageExists && serverMessage) {
          console.warn('Fallback: Removing stuck pending message');
          removePendingMessage(tempId);
        }
        timeoutRefsRef.current.delete(tempId);
      }, 5000);

      timeoutRefsRef.current.set(tempId, fallbackTimeout);

      // Clear replyTo on success
      setReplyTo(undefined);
      onSendMessage(channel.id, content);
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      // Handle muted error gracefully - don't throw, just show the message
      const errorMessage = error.message || 'Failed to send';
      const isMutedError = errorMessage.toLowerCase().includes('muted');
      
      if (isMutedError) {
        // For muted users, remove the pending message and don't show failed state
        removePendingMessage(tempId);
      } else {
        // For other errors, mark as failed so user can retry
        markMessageFailed(tempId, errorMessage);
      }
      
      // Don't throw - this prevents the ugly runtime error popup
      // The error is already handled via markMessageFailed or removePendingMessage
    } finally {
      // Decrement pending sends counter and update UI state
      pendingSendsRef.current = Math.max(0, pendingSendsRef.current - 1);
      setIsSending(pendingSendsRef.current > 0);
    }
  }, [channel, replyTo, addPendingMessage, markMessageFailed, removePendingMessage, replacePendingMessage, onSendMessage, scrollToBottom]);

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
    } catch {
      // Silently fail - typing indicator is not critical
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
      handleSend(failedMessage.content, failedMessage.attachments);
    }
  }, [messages, removePendingMessage, handleSend]);

  // Scroll to bottom button handler
  const handleScrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    scrollToBottom('smooth');
  }, [scrollToBottom]);

  // Handle project submission
  const handleProjectSubmit = useCallback(async (data: ProjectSubmissionData) => {
    if (!channel || !channel.courseId) {
      throw new Error('Channel not found');
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('Not authenticated. Please log in again.');
    }

    // Upload video file if provided
    let videoUrl = data.videoLink;
    let attachments: any[] = [];
    
    if (data.videoFile) {
      if (!channel.courseId) {
        throw new Error('Channel course ID not found');
      }
      
      const fileExt = data.videoFile.name.split('.').pop()?.toLowerCase() || 'mp4';
      const fileName = `project-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      // Storage path structure: {course_id}/{channel_id}/{user_id}/{filename}
      const filePath = `${channel.courseId}/${channel.id}/${session.user.id}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, data.videoFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        throw new Error(`Failed to upload video: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        videoUrl = urlData.publicUrl;
        attachments = [{
          fileUrl: urlData.publicUrl,
          fileName: data.videoFile.name,
          fileType: 'video',
          fileSize: data.videoFile.size,
          mimeType: data.videoFile.type,
        }];
      }
    }

    // Create a simple message content (for display purposes)
    const messageContent = `🎬 Project: ${data.name}`;

    // First, create the message
    const response = await fetch(`/api/chats/${channel.id}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      credentials: 'include',
      body: JSON.stringify({
        content: messageContent,
        replyTo: null,
        attachments: attachments.length > 0 ? attachments : undefined,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create message');
    }

    const { message: createdMessage } = await response.json();

    // Then, create the project record in the database
    const { data: projectRecord, error: projectError } = await supabase
      .from('projects')
      .insert({
        message_id: createdMessage.id,
        channel_id: channel.id,
        course_id: channel.courseId,
        user_id: session.user.id,
        name: data.name,
        description: data.description,
        video_link: videoUrl || null,
        budget: data.budget,
        min_views: data.minViews,
        max_views: data.maxViews,
        platforms: data.platforms,
      })
      .select('id')
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
      throw new Error(`Failed to save project: ${projectError.message}`);
    }

    // Insert criteria if any
    if (data.criteria && data.criteria.length > 0 && projectRecord) {
      const criteriaRecords = data.criteria.map((criterion, index) => ({
        project_id: projectRecord.id,
        criteria_text: criterion.text,
        rpm: criterion.rpm,
        display_order: index,
      }));

      const { error: criteriaError } = await supabase
        .from('project_criteria')
        .insert(criteriaRecords);

      if (criteriaError) {
        console.error('Error creating criteria:', criteriaError);
        // Don't fail the whole operation, just log the error
      }
    }

    // Refresh messages to show the new project
    refetch();
  }, [channel, supabase, refetch]);

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
    <div className="flex-1 flex flex-col bg-gray-900 relative">
      {/* Channel header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center shadow-sm flex-shrink-0 bg-gray-900 z-10">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xl">#</span>
          <h2 className="text-white font-semibold text-sm">{channel.name}</h2>
          {!isConnected && (
            <span className="flex items-center gap-1 text-yellow-500 text-xs">
              <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>
              Connecting...
            </span>
          )}
        </div>
        {channel.description && (
          <span className="ml-4 text-gray-400 text-xs hidden md:block">{channel.description}</span>
        )}
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          <button className="text-gray-400 hover:text-white transition-colors p-1" title="Threads">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white transition-colors p-1" title="Pinned Messages">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <div className="hidden md:flex items-center">
            <div className="w-px h-6 bg-gray-700 mx-2"></div>
            <input
              type="text"
              placeholder="Search"
              className="bg-gray-800 text-gray-300 text-sm px-3 py-1.5 rounded w-32 lg:w-40 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ 
          scrollBehavior: 'auto',
          overscrollBehavior: 'contain',
        }}
      >
        <div className="min-h-full flex flex-col justify-end py-4">
          {isLoading && messages.length === 0 ? (
            // Loading skeleton
            <div className="space-y-4 px-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="flex gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-full bg-gray-700 flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-700 rounded w-24"></div>
                    <div className="h-4 bg-gray-700 rounded" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                    {i % 3 === 0 && <div className="h-4 bg-gray-700 rounded w-1/2"></div>}
                  </div>
                </div>
              ))}
            </div>
          ) : error && messages.length === 0 ? (
            // Error state
            <div className="flex items-center justify-center flex-1 px-4">
              <div className="text-center text-gray-400 max-w-md">
                <div className="bg-red-900/50 border border-red-700 text-red-200 px-6 py-4 rounded-lg mb-4">
                  <p className="font-semibold mb-2">Error loading messages</p>
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  onClick={async () => {
                    // Refresh session before retrying if it's an auth error
                    if (error.includes('Unauthorized') || error.includes('session') || error.includes('Session')) {
                      try {
                        await supabase.auth.refreshSession();
                      } catch (refreshError) {
                        console.warn('Session refresh failed:', refreshError);
                      }
                    }
                    refetch();
                  }}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : messages.length === 0 ? (
            // Empty state
            <div className="flex items-center justify-center flex-1 px-4 text-gray-400">
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
                <p className="text-base font-medium mb-1">No messages yet</p>
                <p className="text-sm text-gray-500">Start the conversation!</p>
              </div>
            </div>
          ) : (
            <>
              {/* Load more button */}
              {hasMore && (
                <div className="text-center py-3 px-4">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors"
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
              <div className="space-y-0.5">
                {(() => {
                  // Filter out "Video submission" messages
                  const filteredMessages = messages.filter((message) => {
                    if ('content' in message && message.content === 'Video submission') {
                      return false;
                    }
                    return true;
                  });
                  
                  return filteredMessages.map((message, index) => {
                    const prevMessage = index > 0 ? filteredMessages[index - 1] : null;
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
                      onReaction={handleReaction}
                      isLecturer={isLecturer}
                      channelId={channel.id}
                      showAvatar={showAvatar}
                    />
                  );
                });
                })()}
              </div>
              <div ref={messagesEndRef} className="h-1" />
            </>
          )}
        </div>
      </div>

      {/* Scroll to bottom button */}
      {userScrolledUpRef.current && messages.length > 10 && (
        <button
          onClick={handleScrollToBottom}
          className="absolute bottom-24 right-6 bg-gray-700 hover:bg-gray-600 text-white p-2 rounded-full shadow-lg transition-all transform hover:scale-105 z-20"
          title="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-400 italic flex items-center gap-2 bg-gray-900 border-t border-gray-800">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          {typingUsers.length === 1 ? (
            <span><strong>{typingUsers[0].username}</strong> is typing...</span>
          ) : typingUsers.length === 2 ? (
            <span><strong>{typingUsers[0].username}</strong> and <strong>{typingUsers[1].username}</strong> are typing...</span>
          ) : (
            <span><strong>{typingUsers[0].username}</strong> and {typingUsers.length - 1} others are typing...</span>
          )}
        </div>
      )}

      {/* Message input or Project submission button */}
      {(() => {
        // Check if this is a restricted channel (Lectures or Projects)
        const channelName = channel.name?.toLowerCase() || '';
        const channelType = channel.type as string;
        const isLecturesChannel = channelName === 'lectures' && channelType === 'lectures';
        const isProjectsChannel = channelName === 'projects';
        const isRestrictedChannel = isLecturesChannel || isProjectsChannel;
        const canSendMessages = !isRestrictedChannel || isLecturer;

        // For projects channel, show plus button only for lecturers
        if (isProjectsChannel) {
          if (isLecturer) {
            return (
              <div className="px-4 py-3 border-t border-gray-700 bg-gray-900">
                <button
                  onClick={() => setShowVideoUploadDialog(true)}
                  className="w-12 h-12 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors shadow-lg hover:shadow-xl hover:scale-105"
                  title="Create Video Project"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            );
          } else {
            // For non-lecturers, show a message indicating they can't create projects
            return (
              <div className="px-4 py-3 border-t border-gray-700 bg-gray-900">
                <div className="text-center text-gray-400 text-sm">
                  Only the course lecturer can create projects
                </div>
              </div>
            );
          }
        }

        return (
          <MessageInput
            onSend={handleSend}
            onTyping={handleTyping}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(undefined)}
            placeholder={
              !canSendMessages
                ? 'Only the course lecturer can send messages in this channel'
                : `Message #${channel.name}`
            }
            disabled={!canSendMessages}
            isSending={isSending}
            channelId={channel.id}
            isMuted={isMuted || !canSendMessages}
          />
        );
      })()}

      {/* Video Upload Dialog */}
      <VideoUploadDialog
        isOpen={showVideoUploadDialog}
        onClose={() => setShowVideoUploadDialog(false)}
        onSubmit={handleProjectSubmit}
        channelId={channel?.id}
      />
    </div>
  );
}
