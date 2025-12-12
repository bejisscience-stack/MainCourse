'use client';

import { useState, memo, useRef, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Message as MessageType } from '@/types/message';

interface MessageProps {
  message: MessageType & { pending?: boolean; failed?: boolean; error?: string; tempId?: string; onRetry?: () => void };
  currentUserId: string;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  isLecturer?: boolean;
  channelId?: string;
}

const Message = memo(function Message({ 
  message, 
  currentUserId, 
  onReply, 
  onReaction,
  isLecturer = false,
  channelId,
}: MessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showUsernameMenu, setShowUsernameMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const usernameMenuRef = useRef<HTMLDivElement>(null);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
      }) + ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
  };

  const commonReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  // Check if user is muted (for lecturers)
  const checkMuteStatus = useCallback(async () => {
    if (!isLecturer || !channelId || message.user.id === currentUserId) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`/api/chats/${channelId}/mute?userId=${message.user.id}`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setIsMuted(data.muted || false);
      }
    } catch (error) {
      console.warn('Failed to check mute status:', error);
    }
  }, [isLecturer, channelId, message.user.id, currentUserId]);

  const handleMute = async () => {
    if (!isLecturer || !channelId || message.user.id === currentUserId) return;
    
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
        setIsMuted(true);
        setShowMuteMenu(false);
      }
    } catch (error) {
      console.error('Failed to mute user:', error);
    }
  };

  const handleUnmute = async () => {
    if (!isLecturer || !channelId || message.user.id === currentUserId) return;
    
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
        setIsMuted(false);
        setShowMuteMenu(false);
      }
    } catch (error) {
      console.error('Failed to unmute user:', error);
    }
  };

  const scrollToOriginal = () => {
    if (message.replyTo) {
      const originalMessage = document.querySelector(`[data-message-id="${message.replyTo}"]`);
      if (originalMessage) {
        originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight briefly
        originalMessage.classList.add('ring-2', 'ring-indigo-500');
        setTimeout(() => {
          originalMessage.classList.remove('ring-2', 'ring-indigo-500');
        }, 2000);
      }
    }
  };

  // Check mute status when menu opens
  useEffect(() => {
    if (showMenu && isLecturer && message.user.id !== currentUserId) {
      checkMuteStatus();
    }
  }, [showMenu, isLecturer, message.user.id, currentUserId, checkMuteStatus]);

  // Check mute status when username menu opens
  useEffect(() => {
    if (showUsernameMenu && isLecturer && message.user.id !== currentUserId) {
      checkMuteStatus();
    }
  }, [showUsernameMenu, isLecturer, message.user.id, currentUserId, checkMuteStatus]);

  // Close username menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (usernameMenuRef.current && !usernameMenuRef.current.contains(event.target as Node)) {
        setShowUsernameMenu(false);
      }
    };

    if (showUsernameMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showUsernameMenu]);

  return (
    <div
      ref={messageRef}
      data-message-id={message.id}
      className="group px-4 py-1 hover:bg-gray-800/50 transition-colors"
      onMouseEnter={() => {
        setShowMenu(true);
        if (isLecturer && message.user.id !== currentUserId) {
          checkMuteStatus();
        }
      }}
      onMouseLeave={() => {
        setShowMenu(false);
        setShowMuteMenu(false);
        // Don't close username menu on mouse leave - let click outside handle it
      }}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
            {message.user.avatarUrl ? (
              <img
                src={message.user.avatarUrl}
                alt={message.user.username}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              message.user.username.charAt(0).toUpperCase()
            )}
          </div>
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0 relative">
          {/* Reply preview */}
          {message.replyPreview && (
            <div 
              onClick={scrollToOriginal}
              className="mb-1 px-3 py-1 border-l-2 border-indigo-500 bg-gray-800/50 rounded text-xs text-gray-400 cursor-pointer hover:bg-gray-800 transition-colors"
            >
              <span className="text-indigo-400 font-medium">{message.replyPreview.username}</span>
              <span className="ml-2">{message.replyPreview.content}</span>
            </div>
          )}

          {/* Header */}
          <div className="flex items-baseline gap-2 mb-1 relative group/header">
            <div className="relative" ref={usernameMenuRef}>
              <span 
                className={`text-white font-semibold text-sm hover:underline cursor-pointer ${
                  isLecturer && message.user.id !== currentUserId ? 'hover:text-indigo-400' : ''
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isLecturer && message.user.id !== currentUserId) {
                    setShowUsernameMenu(!showUsernameMenu);
                    checkMuteStatus();
                  }
                }}
                onMouseDown={(e) => {
                  // Prevent text selection when clicking
                  if (isLecturer && message.user.id !== currentUserId) {
                    e.preventDefault();
                  }
                }}
                title={isLecturer && message.user.id !== currentUserId ? 'Click to mute/unmute user' : ''}
              >
                {message.user.username}
              </span>
              {showUsernameMenu && isLecturer && message.user.id !== currentUserId && (
                <div className="absolute left-0 top-6 bg-gray-800 border border-gray-700 rounded shadow-xl z-50 min-w-[140px]">
                  {isMuted ? (
                    <button
                      onClick={async () => {
                        await handleUnmute();
                        setShowUsernameMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      Unmute user
                    </button>
                  ) : (
                    <button
                      onClick={async () => {
                        await handleMute();
                        setShowUsernameMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                      </svg>
                      Mute user
                    </button>
                  )}
                </div>
              )}
            </div>
            <span className="text-gray-400 text-xs">{formatTimestamp(message.timestamp)}</span>
            {message.edited && (
              <span className="text-gray-500 text-xs italic">(edited)</span>
            )}
            {isMuted && (
              <span className="text-red-400 text-xs">🔇 Muted</span>
            )}
            {/* Hover menu - positioned inline with header */}
            {showMenu && (
              <div className="absolute right-0 top-0 flex items-center gap-1 bg-gray-800 border border-gray-700 rounded shadow-lg p-1 z-10 ml-auto">
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowReactionPicker(!showReactionPicker);
                    }}
                    className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                    title="Add Reaction"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </button>
                  {/* Reaction picker */}
                  {showReactionPicker && (
                    <div className="absolute right-0 top-6 bg-gray-800 border border-gray-700 rounded shadow-lg p-2 flex gap-1 z-20">
                      {commonReactions.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            onReaction?.(message.id, emoji);
                            setShowReactionPicker(false);
                            setShowMenu(false);
                          }}
                          className="p-2 hover:bg-gray-700 rounded text-xl transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    onReply?.(message.id);
                    setShowMenu(false);
                  }}
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="Reply"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
                {isLecturer && message.user.id !== currentUserId && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMuteMenu(!showMuteMenu)}
                      className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                      title="Mute/Unmute user"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                        />
                      </svg>
                    </button>
                    {showMuteMenu && (
                      <div className="absolute right-0 mt-1 bg-gray-800 border border-gray-700 rounded shadow-lg z-30 min-w-[120px]">
                        {isMuted ? (
                          <button
                            onClick={handleUnmute}
                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            Unmute user
                          </button>
                        ) : (
                          <button
                            onClick={handleMute}
                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors"
                          >
                            Mute user
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <button
                  className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                  title="More options"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Message text */}
          {message.content && (
            <div className={`text-gray-300 text-sm whitespace-pre-wrap break-words ${
              message.pending ? 'opacity-60' : message.failed ? 'opacity-80' : ''
            }`}>
              {message.content}
            </div>
          )}

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-2">
              {message.attachments.map((att) => (
                <div key={att.id} className="rounded-lg overflow-hidden border border-gray-700">
                  {att.fileType === 'image' || att.fileType === 'gif' ? (
                    <img
                      src={att.fileUrl}
                      alt={att.fileName}
                      className="max-w-md max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => window.open(att.fileUrl, '_blank')}
                    />
                  ) : att.fileType === 'video' ? (
                    <video
                      src={att.fileUrl}
                      controls
                      className="max-w-md max-h-96"
                    >
                      Your browser does not support the video tag.
                    </video>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Pending indicator */}
          {message.pending && (
            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Sending...</span>
            </div>
          )}

          {/* Failed indicator */}
          {message.failed && (
            <div className="flex items-center gap-2 mt-1 text-xs text-red-400">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Failed to send{message.error ? `: ${message.error}` : ''}</span>
              {message.onRetry && (
                <button
                  onClick={message.onRetry}
                  className="text-indigo-400 hover:text-indigo-300 underline"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {message.reactions.map((reaction, idx) => {
                const hasReacted = reaction.users.includes(currentUserId);
                return (
                  <button
                    key={idx}
                    onClick={() => onReaction?.(message.id, reaction.emoji)}
                    className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 transition-colors ${
                      hasReacted
                        ? 'bg-indigo-600/30 border border-indigo-500/50'
                        : 'bg-gray-700 hover:bg-gray-600 border border-gray-600'
                    }`}
                  >
                    <span>{reaction.emoji}</span>
                    <span className="text-gray-300">{reaction.count}</span>
                  </button>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
});

export default Message;
