'use client';

import { useState, memo } from 'react';
import type { Message as MessageType } from '@/types/message';

interface MessageProps {
  message: MessageType & { pending?: boolean; failed?: boolean; error?: string; tempId?: string; onRetry?: () => void };
  currentUserId: string;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
}

const Message = memo(function Message({ message, currentUserId, onReply, onReaction }: MessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

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

  return (
    <div
      className="group px-4 py-1 hover:bg-gray-800/50 transition-colors"
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
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
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-white font-semibold text-sm hover:underline cursor-pointer">
              {message.user.username}
            </span>
            <span className="text-gray-400 text-xs">{formatTimestamp(message.timestamp)}</span>
            {message.edited && (
              <span className="text-gray-500 text-xs italic">(edited)</span>
            )}
          </div>

          {/* Message text */}
          <div className={`text-gray-300 text-sm whitespace-pre-wrap break-words ${
            message.pending ? 'opacity-60' : message.failed ? 'opacity-80' : ''
          }`}>
            {message.content}
          </div>

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

          {/* Hover menu */}
          {showMenu && (
            <div className="absolute right-4 mt-1 flex items-center gap-1 bg-gray-800 border border-gray-700 rounded shadow-lg p-1 z-10">
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

          {/* Reaction picker */}
          {showReactionPicker && (
            <div className="absolute mt-2 bg-gray-800 border border-gray-700 rounded shadow-lg p-2 flex gap-1 z-20">
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
      </div>
    </div>
  );
});

export default Message;
