'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (content: string) => void;
  replyTo?: { id: string; username: string; content: string };
  onCancelReply?: () => void;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  replyTo,
  onCancelReply,
  placeholder = "Message #channel",
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const trimmedContent = content.trim();
    if (trimmedContent) {
      onSend(trimmedContent);
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

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
      <div
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
          className="flex-1 bg-transparent text-white placeholder-gray-400 resize-none outline-none text-sm max-h-[200px] overflow-y-auto"
          style={{ minHeight: '20px' }}
        />

        {/* Emoji button */}
        <button
          className="text-gray-400 hover:text-gray-300 p-1.5 rounded transition-colors"
          title="Add emoji"
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
      </div>
    </div>
  );
}
