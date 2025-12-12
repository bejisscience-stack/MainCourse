'use client';

import { useState, useRef, KeyboardEvent, useEffect, useCallback, DragEvent } from 'react';
import { supabase } from '@/lib/supabase';
import type { MessageAttachment } from '@/types/message';

interface MessageInputProps {
  onSend: (content: string, attachments?: MessageAttachment[]) => Promise<void>;
  onTyping?: () => void;
  replyTo?: { id: string; username: string; content: string };
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
  isSending?: boolean;
  channelId?: string;
  isMuted?: boolean;
}

export default function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  placeholder = "Message #channel",
  disabled = false,
  isSending = false,
  channelId,
  isMuted = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    
    // Allow sending if there's content OR attachments
    if ((!trimmedContent && attachments.length === 0) || disabled || isSending || isMuted) {
      return;
    }

    // Clear input immediately for instant UI feedback
    const contentToSend = trimmedContent;
    const attachmentsToSend = [...attachments];
    setContent('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      await onSend(contentToSend || '', attachmentsToSend.length > 0 ? attachmentsToSend : undefined);
    } catch (error: any) {
      // Restore content on error so user can retry
      setContent(contentToSend);
      setAttachments(attachmentsToSend);
      throw error;
    }
  }, [content, attachments, disabled, isSending, isMuted, onSend]);

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

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !channelId) return;

    setIsUploading(true);
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes];
    const maxSize = 10 * 1024 * 1024; // 10MB

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const uploadPromises = Array.from(files).map(async (file) => {
        if (!allowedTypes.includes(file.type)) {
          throw new Error(`Invalid file type: ${file.type}`);
        }
        if (file.size > maxSize) {
          throw new Error(`File ${file.name} exceeds 10MB limit`);
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/chats/${channelId}/media`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to upload file');
        }

        const data = await response.json();
        return {
          id: `temp-${Date.now()}-${Math.random()}`,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType,
          fileSize: data.fileSize,
          mimeType: data.mimeType,
        } as MessageAttachment;
      });

      const uploadedAttachments = await Promise.all(uploadPromises);
      setAttachments((prev) => [...prev, ...uploadedAttachments]);
    } catch (error: any) {
      console.error('Error uploading files:', error);
      alert(error.message || 'Failed to upload files');
    } finally {
      setIsUploading(false);
    }
  }, [channelId]);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isMuted) {
      setIsDragging(true);
    }
  }, [disabled, isMuted]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (disabled || isMuted) return;
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  }, [disabled, isMuted, handleFileSelect]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div 
      className={`px-4 py-4 bg-gray-800 ${isDragging ? 'ring-2 ring-indigo-500 bg-indigo-900/20' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Muted indicator */}
      {isMuted && (
        <div className="mb-2 px-4 py-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm">
          You have been muted by the lecturer.
        </div>
      )}

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

      {/* Attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, index) => (
            <div key={index} className="relative group">
              {att.fileType === 'image' || att.fileType === 'gif' ? (
                <div className="relative">
                  <img
                    src={att.fileUrl}
                    alt={att.fileName}
                    className="h-20 w-20 object-cover rounded border border-gray-600"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="relative bg-gray-700 rounded p-2 border border-gray-600">
                  <div className="text-xs text-gray-300 truncate max-w-[100px]">{att.fileName}</div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          ))}
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
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled && !isMuted && !isUploading) {
              fileInputRef.current?.click();
            }
          }}
          disabled={disabled || isMuted || isUploading}
          className={`p-2 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 ${
            disabled || isMuted || isUploading
              ? 'text-gray-500'
              : 'text-gray-300 hover:text-indigo-400 hover:bg-indigo-500/20 active:bg-indigo-500/30'
          }`}
          title={isMuted ? 'Cannot upload while muted' : isUploading ? 'Uploading...' : 'Upload image or video (click or drag & drop)'}
        >
          {isUploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32a.75.75 0 11-1.06-1.06l10.94-10.94a4.5 4.5 0 10-6.364-6.364c-1.097 1.097-1.097 2.877 0 3.974l7.693 7.693c.567.567 1.486.567 2.053 0a1.5 1.5 0 000-2.122z" />
            </svg>
          )}
        </button>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isMuted ? "You have been muted by the lecturer." : placeholder}
          rows={1}
          disabled={disabled || isSending || isMuted}
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
          disabled={(!content.trim() && attachments.length === 0) || disabled || isSending || isMuted}
          className={`p-1.5 rounded transition-colors ${
            (content.trim() || attachments.length > 0) && !disabled && !isSending && !isMuted
              ? 'text-indigo-400 hover:text-indigo-300 cursor-pointer'
              : 'text-gray-500 opacity-50'
          }`}
          title={isMuted ? 'You are muted' : (!content.trim() && attachments.length === 0) ? 'Type a message or attach a file to send' : 'Send message'}
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
