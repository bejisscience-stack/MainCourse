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
import { edgeFunctionUrl } from '@/lib/api-client';
import { useI18n } from '@/contexts/I18nContext';
import type { EnrollmentInfo } from '@/hooks/useEnrollments';

interface ChatAreaProps {
  channel: Channel | null;
  currentUserId: string;
  isLecturer?: boolean;
  onSendMessage: (channelId: string, content: string) => void;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  isEnrollmentExpired?: boolean;
  enrollmentInfo?: EnrollmentInfo | null;
  onReEnrollRequest?: () => void;
}

export default function ChatArea({
  channel,
  currentUserId,
  isLecturer = false,
  onSendMessage,
  onReply,
  onReaction,
  isEnrollmentExpired = false,
  enrollmentInfo = null,
  onReEnrollRequest,
}: ChatAreaProps) {
  const { t } = useI18n();
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

    // Only auto-scroll if:
    // 1. It's a new message (not initial load)
    // 2. User hasn't scrolled up
    // 3. Not currently loading initial messages
    if (isNewMessage && !userScrolledUpRef.current && messageCount > 0 && !isLoading) {
      // Small delay to ensure message is rendered
      const timeoutId = setTimeout(() => {
        scrollToBottom('smooth');
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [messages.length, scrollToBottom, isLoading]);

  // Scroll to bottom on initial load or channel change
  useEffect(() => {
    if (channel?.id && messages.length > 0 && !isLoading) {
      // Use instant scroll for initial load, but wait a bit for DOM to update
      const timeoutId = setTimeout(() => {
        if (messagesContainerRef.current && messagesEndRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [channel?.id, isLoading, messages.length]);

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
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(edgeFunctionUrl('chat-messages'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey && { 'apikey': anonKey }),
        },
        body: JSON.stringify({
          chatId: channel.id,
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

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(edgeFunctionUrl('chat-typing'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey && { 'apikey': anonKey }),
        },
        body: JSON.stringify({ chatId: channel.id }),
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
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const response = await fetch(edgeFunctionUrl('chat-messages'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...(anonKey && { 'apikey': anonKey }),
      },
      body: JSON.stringify({
        chatId: channel.id,
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
        start_date: data.startDate,
        end_date: data.endDate,
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
        platform: criterion.platform || null, // Platform-specific or null for all platforms
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
      <div className="flex-1 bg-navy-950/30 backdrop-blur-sm flex items-center justify-center">
        <div className="text-center text-gray-500">
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
          <p className="text-lg font-semibold text-gray-200">{t('chat.selectChannel')}</p>
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
        isEnrollmentExpired={isEnrollmentExpired}
        enrollmentInfo={enrollmentInfo}
        onReEnrollRequest={onReEnrollRequest}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-navy-950/30 backdrop-blur-sm relative">
      {/* Channel header */}
      <div className="h-12 px-4 border-b border-navy-800/60 flex items-center shadow-soft flex-shrink-0 bg-navy-950/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          <span className="text-emerald-300 text-lg">#</span>
          <h2 className="text-gray-100 font-semibold text-sm">{channel.name}</h2>
          {!isConnected && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              {t('chat.connecting')}
            </span>
          )}
        </div>
        {channel.description && (
          <span className="ml-4 text-gray-500 text-xs hidden md:block">{channel.description}</span>
        )}
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
          {isLoading && messages.length === 0 && channel?.id ? (
            // Fast loading skeleton - minimal DOM for speed
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
          ) : error && messages.length === 0 && channel?.id ? (
            // Error state
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
          ) : messages.length === 0 && !isLoading && channel?.id ? (
            // Empty state
            <div className="flex items-center justify-center flex-1 px-4 text-gray-400">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-navy-900/60 flex items-center justify-center border border-navy-800/60">
                  <svg
                    className="w-8 h-8 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <p className="text-base font-semibold text-gray-200 mb-1">No messages yet</p>
                <p className="text-sm text-gray-500">Be the first to start the conversation.</p>
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
              <div className="space-y-0">
                {(() => {
                  // Filter out "Video submission" and "Submission" messages (submission messages without user content)
                  const filteredMessages = messages.filter((message) => {
                    if ('content' in message) {
                      const content = message.content;
                      // Filter out default submission messages that don't have user-provided content
                      if (content === 'Video submission' || content === 'Submission') {
                        return false;
                      }
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
                      isEnrollmentExpired={isEnrollmentExpired}
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
          className="absolute bottom-28 sm:bottom-24 right-4 sm:right-6 h-10 w-10 flex items-center justify-center bg-navy-900/85 border border-navy-800/70 text-gray-100 rounded-full shadow-soft hover:shadow-soft-lg hover:bg-navy-800/80 transition-all transform hover:scale-105 z-20 will-change-transform"
          style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
          title="Scroll to bottom"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-400 italic flex items-center gap-2 bg-navy-950/70 border-t border-navy-800/60">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
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
              <div className="px-4 py-3 border-t border-navy-800/60 bg-navy-950/70">
                <button
                  onClick={() => setShowVideoUploadDialog(true)}
                  className="w-12 h-12 flex items-center justify-center bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-full transition-colors shadow-soft hover:shadow-soft-lg hover:scale-105 will-change-transform"
                  style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
                  title={t('projects.createVideoProject')}
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
              <div className="px-4 py-3 border-t border-navy-800/60 bg-navy-950/70">
                <div className="text-center text-gray-500 text-sm">
                  {t('chat.onlyLecturerCanCreateProjects')}
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
                ? t('chat.onlyLecturerCanSendMessages')
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
