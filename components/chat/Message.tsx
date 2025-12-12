'use client';

import { useState, memo, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserMuteStatus } from '@/hooks/useMuteStatus';
import type { Message as MessageType, MessageAttachment } from '@/types/message';

interface MessageProps {
  message: MessageType & { 
    pending?: boolean; 
    failed?: boolean; 
    error?: string; 
    tempId?: string; 
    onRetry?: () => void;
  };
  currentUserId: string;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  isLecturer?: boolean;
  channelId?: string;
  showAvatar?: boolean;
}

const formatTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  if (isToday) {
    return `Today at ${time}`;
  } else if (isYesterday) {
    return `Yesterday at ${time}`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    }) + ` at ${time}`;
  }
};

const COMMON_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Media attachment component
const MediaAttachment = memo(function MediaAttachment({ 
  attachment 
}: { 
  attachment: MessageAttachment;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (attachment.fileType === 'image' || attachment.fileType === 'gif') {
    return (
      <div className="relative rounded-lg overflow-hidden border border-gray-700 bg-gray-800 max-w-md">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {hasError ? (
          <div className="p-4 text-gray-400 text-sm flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Failed to load image
          </div>
        ) : (
          <img
            src={attachment.fileUrl}
            alt={attachment.fileName}
            className={`max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity ${isLoading ? 'opacity-0' : 'opacity-100'}`}
            onClick={() => window.open(attachment.fileUrl, '_blank')}
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        )}
      </div>
    );
  }

  if (attachment.fileType === 'video') {
    return (
      <div className="rounded-lg overflow-hidden border border-gray-700 max-w-md">
        <video
          src={attachment.fileUrl}
          controls
          className="max-h-96 w-full"
          preload="metadata"
        >
          Your browser does not support the video tag.
        </video>
      </div>
    );
  }

  return null;
});

const Message = memo(function Message({
  message,
  currentUserId,
  onReply,
  onReaction,
  isLecturer = false,
  channelId,
  showAvatar = true,
}: MessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get mute status for this user (only if lecturer and not self)
  const canMute = isLecturer && message.user.id !== currentUserId && !!channelId;
  const { isMuted, refetch: refetchMuteStatus } = useUserMuteStatus(
    canMute ? channelId : null,
    canMute ? message.user.id : null
  );

  const handleMute = useCallback(async () => {
    if (!channelId || message.user.id === currentUserId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chats/${channelId}/mute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: message.user.id }),
      });

      if (response.ok) {
        refetchMuteStatus();
        setShowUserMenu(false);
        setShowMenu(false);
      }
    } catch (error) {
      console.error('Failed to mute user:', error);
    }
  }, [channelId, message.user.id, currentUserId, refetchMuteStatus]);

  const handleUnmute = useCallback(async () => {
    if (!channelId || message.user.id === currentUserId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chats/${channelId}/mute?userId=${message.user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        refetchMuteStatus();
        setShowUserMenu(false);
        setShowMenu(false);
      }
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }
  }, [channelId, message.user.id, currentUserId, refetchMuteStatus]);

  const scrollToOriginal = useCallback(() => {
    if (message.replyTo) {
      const originalMessage = document.querySelector(`[data-message-id="${message.replyTo}"]`);
      if (originalMessage) {
        originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        originalMessage.classList.add('ring-2', 'ring-indigo-500', 'bg-indigo-900/20');
        setTimeout(() => {
          originalMessage.classList.remove('ring-2', 'ring-indigo-500', 'bg-indigo-900/20');
        }, 2000);
      }
    }
  }, [message.replyTo]);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    if (showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showUserMenu]);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setShowMenu(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setShowMenu(false);
      setShowReactionPicker(false);
    }, 150);
  }, []);

  const isPending = message.pending;
  const isFailed = message.failed;

  return (
    <div
      ref={messageRef}
      data-message-id={message.id}
      className={`group px-4 py-1.5 hover:bg-gray-800/50 transition-colors relative ${
        isFailed ? 'bg-red-900/10' : ''
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10">
          {showAvatar ? (
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm overflow-hidden">
              {message.user.avatarUrl ? (
                <img
                  src={message.user.avatarUrl}
                  alt={message.user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                message.user.username.charAt(0).toUpperCase()
              )}
            </div>
          ) : (
            <div className="w-10" /> // Spacer for alignment
          )}
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {/* Reply preview */}
          {message.replyPreview && (
            <div
              onClick={scrollToOriginal}
              className="mb-1.5 px-3 py-1.5 border-l-2 border-indigo-500 bg-gray-800/70 rounded text-xs cursor-pointer hover:bg-gray-700/70 transition-colors flex items-center gap-2 group/reply"
            >
              <svg className="w-3 h-3 text-indigo-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="text-indigo-400 font-medium">{message.replyPreview.username}</span>
              <span className="text-gray-400 truncate">{message.replyPreview.content}</span>
              <span className="text-gray-500 opacity-0 group-hover/reply:opacity-100 transition-opacity text-xs ml-auto flex-shrink-0">
                Click to jump
              </span>
            </div>
          )}

          {/* Header - only show if showAvatar is true */}
          {showAvatar && (
            <div className="flex items-baseline gap-2 mb-0.5">
              <div className="relative" ref={userMenuRef}>
                <span
                  className={`text-white font-semibold text-sm hover:underline cursor-pointer ${
                    canMute ? 'hover:text-indigo-400' : ''
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (canMute) {
                      setShowUserMenu(!showUserMenu);
                    }
                  }}
                >
                  {message.user.username}
                </span>
                
                {/* User context menu */}
                {showUserMenu && canMute && (
                  <div className="absolute left-0 top-6 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 min-w-[160px] py-1 animate-in fade-in duration-100">
                    {isMuted ? (
                      <button
                        onClick={handleUnmute}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                        Unmute user
                      </button>
                    ) : (
                      <button
                        onClick={handleMute}
                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                        </svg>
                        Mute user
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <span className="text-gray-500 text-xs">{formatTimestamp(message.timestamp)}</span>
              {message.edited && (
                <span className="text-gray-500 text-xs italic">(edited)</span>
              )}
              {isMuted && canMute && (
                <span className="text-red-400 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  </svg>
                  Muted
                </span>
              )}
            </div>
          )}

          {/* Message text */}
          {message.content && (
            <div className={`text-gray-300 text-sm whitespace-pre-wrap break-words leading-relaxed ${
              isPending ? 'opacity-60' : isFailed ? 'opacity-80' : ''
            }`}>
              {message.content}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att) => (
                <MediaAttachment key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Pending indicator */}
          {isPending && (
            <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Sending...</span>
            </div>
          )}

          {/* Failed indicator */}
          {isFailed && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-red-400">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Failed to send{message.error ? `: ${message.error}` : ''}</span>
              {message.onRetry && (
                <button
                  onClick={message.onRetry}
                  className="text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {message.reactions.map((reaction, idx) => {
                const hasReacted = reaction.users.includes(currentUserId);
                return (
                  <button
                    key={idx}
                    onClick={() => onReaction?.(message.id, reaction.emoji)}
                    className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition-all ${
                      hasReacted
                        ? 'bg-indigo-600/30 border border-indigo-500/50 text-indigo-300'
                        : 'bg-gray-700 hover:bg-gray-600 border border-gray-600 text-gray-300'
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span>{reaction.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Hover action menu */}
        {showMenu && !isPending && !isFailed && (
          <div className="absolute right-4 -top-3 flex items-center gap-0.5 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-1 z-20">
            {/* Reaction picker trigger */}
            <div className="relative">
              <button
                onClick={() => setShowReactionPicker(!showReactionPicker)}
                className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                title="Add Reaction"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              
              {/* Reaction picker dropdown */}
              {showReactionPicker && (
                <div className="absolute right-0 top-8 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-2 flex gap-1 z-30">
                  {COMMON_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction?.(message.id, emoji);
                        setShowReactionPicker(false);
                        setShowMenu(false);
                      }}
                      className="p-2 hover:bg-gray-700 rounded text-lg transition-colors hover:scale-110"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Reply button */}
            <button
              onClick={() => {
                onReply?.(message.id);
                setShowMenu(false);
              }}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              title="Reply"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            {/* Mute button for lecturers */}
            {canMute && (
              <button
                onClick={isMuted ? handleUnmute : handleMute}
                className={`p-1.5 hover:bg-gray-700 rounded transition-colors ${
                  isMuted ? 'text-green-400 hover:text-green-300' : 'text-gray-400 hover:text-red-400'
                }`}
                title={isMuted ? 'Unmute user' : 'Mute user'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  ) : (
                    <>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </>
                  )}
                </svg>
              </button>
            )}

            {/* More options */}
            <button
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
              title="More options"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default Message;
