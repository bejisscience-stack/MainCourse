'use client';

import { useState, useRef, KeyboardEvent, useEffect, useCallback } from 'react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: () => void;
  replyTo?: { id: string; username: string; content: string };
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
}

export default function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  placeholder = "Message #channel",
  disabled = false,
  isSending = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);

  const sendTypingIndicator = useCallback(() => {
    const now = Date.now();
    // Throttle typing indicators to once per 2 seconds
    if (now - lastTypingTimeRef.current < 2000) {
      return;
    }
    lastTypingTimeRef.current = now;
    onTyping?.();
  }, [onTyping]);

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();
    
    if (!trimmedContent || disabled || isSending) {
      return;
    }

    // Clear input immediately for instant UI feedback
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      await onSend(trimmedContent);
    } catch (error: any) {
      // Restore content on error so user can retry
      setContent(trimmedContent);
      throw error;
    }
  }, [content, disabled, isSending, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if (content.trim() && !disabled && !isSending) {
        handleSend();
      }
    }
  }, [content, disabled, isSending, handleSend]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;

    // Send typing indicator
    if (e.target.value.trim().length > 0) {
      sendTypingIndicator();
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Set new timeout to stop typing indicator after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        // Typing indicator will expire automatically
      }, 3000);
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="px-4 py-4 bg-gray-800">
      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 px-4 py-2 bg-gray-700 border-l-4 border-indigo-500 rounded flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-indigo-400 font-medium mb-1">
              Replying to {replyTo.username}
            </div>
            <div className="text-sm text-gray-400 truncate">{replyTo.content}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Input container */}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (content.trim() && !disabled && !isSending) {
            await handleSend();
          }
        }}
        className={`flex items-end gap-2 bg-gray-700 rounded-lg px-4 py-2 transition-colors ${
          isFocused ? 'ring-2 ring-indigo-500' : ''
        }`}
      >
        {/* File upload button */}
        <button
          className="text-gray-400 hover:text-gray-300 p-1.5 rounded transition-colors"
          title="Upload file"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 101.414 1.414l6.586-6.586a2 2 0 000-2.828l-6.586-6.586a2 2 0 10-1.414 1.414L13.586 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-2.828z"
            />
          </svg>
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          rows={1}
          disabled={disabled || isSending}
          className="flex-1 bg-transparent text-white placeholder-gray-400 resize-none outline-none text-sm max-h-[200px] overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: '20px' }}
        />

        {/* Emoji button */}
        <button
          className="text-gray-400 hover:text-gray-300 p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add emoji"
          disabled={disabled || isSending}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {/* Send button */}
        <button
          type="submit"
          className={`p-1.5 rounded transition-colors ${
            content.trim() && !disabled && !isSending
              ? 'text-indigo-400 hover:text-indigo-300 cursor-pointer'
              : 'text-gray-500 opacity-50'
          }`}
          title={!content.trim() ? 'Type a message to send' : 'Send message'}
        >
          {isSending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}
