'use client';

import { useState, useRef, KeyboardEvent, useEffect, useCallback, DragEvent, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { MessageAttachment } from '@/types/message';

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'complete' | 'error';
  error?: string;
  preview?: string;
}

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

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
const ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

export default function MessageInput({
  onSend,
  onTyping,
  replyTo,
  onCancelReply,
  placeholder = 'Message #channel',
  disabled = false,
  isSending = false,
  channelId,
  isMuted = false,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingTimeRef = useRef<number>(0);
  const dragCounterRef = useRef(0);

  // Check if currently uploading
  const isUploading = useMemo(() => 
    uploadingFiles.some(f => f.status === 'uploading'), 
    [uploadingFiles]
  );

  // Clean up previews on unmount
  useEffect(() => {
    return () => {
      uploadingFiles.forEach(f => {
        if (f.preview) {
          URL.revokeObjectURL(f.preview);
        }
      });
    };
  }, []);

  // Clear error after 5 seconds
  useEffect(() => {
    if (error) {
      const timeout = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [error]);

  const sendTypingIndicator = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingTimeRef.current < 2000) return;
    lastTypingTimeRef.current = now;
    onTyping?.();
  }, [onTyping]);

  const handleSend = useCallback(async () => {
    const trimmedContent = content.trim();

    if ((!trimmedContent && attachments.length === 0) || disabled || isSending || isMuted || isUploading) {
      return;
    }

    const contentToSend = trimmedContent;
    const attachmentsToSend = [...attachments];
    
    // Clear input immediately for instant feedback
    setContent('');
    setAttachments([]);
    setUploadingFiles([]);
    setError(null);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    try {
      await onSend(contentToSend || '', attachmentsToSend.length > 0 ? attachmentsToSend : undefined);
      
      // Re-focus textarea after successful send so user can type next message immediately
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to send message';
      const isMutedError = errorMessage.toLowerCase().includes('muted');
      
      if (isMutedError) {
        // For muted users, show a friendly error but don't restore content
        // (they can't send anyway)
        setError('You have been muted by the lecturer and cannot send messages.');
      } else {
        // For other errors, restore content so user can retry
        setContent(contentToSend);
        setAttachments(attachmentsToSend);
        setError(errorMessage);
      }
      
      // Still focus back on error so user can see the message
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
      
      // Don't throw - this prevents the ugly runtime error popup
    }
  }, [content, attachments, disabled, isSending, isMuted, isUploading, onSend]);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      if ((content.trim() || attachments.length > 0) && !disabled && !isSending && !isUploading) {
        handleSend();
      }
    }
  }, [content, attachments.length, disabled, isSending, isUploading, handleSend]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;

    if (e.target.value.trim().length > 0) {
      sendTypingIndicator();

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {}, 3000);
    }
  }, [sendTypingIndicator]);

  const uploadFile = useCallback(async (file: File): Promise<MessageAttachment | null> => {
    if (!channelId) return null;

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`Invalid file type: ${file.type}. Only images and videos are allowed.`);
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File "${file.name}" exceeds 50MB limit`);
    }

    const uploadId = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    
    // Create preview for images
    let preview: string | undefined;
    if (ALLOWED_IMAGE_TYPES.includes(file.type)) {
      preview = URL.createObjectURL(file);
    }

    // Add to uploading files
    setUploadingFiles(prev => [...prev, {
      id: uploadId,
      file,
      progress: 0,
      status: 'uploading',
      preview,
    }]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const formData = new FormData();
      formData.append('file', file);

      // Use XMLHttpRequest for progress tracking
      const response = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 100);
            setUploadingFiles(prev => prev.map(f => 
              f.id === uploadId ? { ...f, progress } : f
            ));
          }
        };

        xhr.onload = () => {
          const response = new Response(xhr.response, {
            status: xhr.status,
            statusText: xhr.statusText,
          });
          resolve(response);
        };

        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.onabort = () => reject(new Error('Upload cancelled'));

        xhr.open('POST', `/api/chats/${channelId}/media`);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.send(formData);
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        throw new Error(errorData.error || 'Failed to upload file');
      }

      const data = await response.json();

      // Update status to complete
      setUploadingFiles(prev => prev.map(f => 
        f.id === uploadId ? { ...f, status: 'complete' as const, progress: 100 } : f
      ));

      return {
        id: uploadId,
        fileUrl: data.fileUrl,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        mimeType: data.mimeType,
      };
    } catch (err: any) {
      // Update status to error
      setUploadingFiles(prev => prev.map(f => 
        f.id === uploadId ? { ...f, status: 'error' as const, error: err.message } : f
      ));
      throw err;
    }
  }, [channelId]);

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !channelId) return;
    
    setError(null);

    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    const errors: string[] = [];

    // Validate files
    for (const file of fileArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`"${file.name}" - invalid file type`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`"${file.name}" - exceeds 50MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join(', '));
    }

    if (validFiles.length === 0) return;

    // Upload files in parallel
    const uploadPromises = validFiles.map(async (file) => {
      try {
        const attachment = await uploadFile(file);
        return attachment;
      } catch (err: any) {
        console.error(`Error uploading ${file.name}:`, err);
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const successfulUploads = results.filter((r): r is MessageAttachment => r !== null);
    
    if (successfulUploads.length > 0) {
      setAttachments(prev => [...prev, ...successfulUploads]);
    }

    // Clear completed uploads after a short delay
    setTimeout(() => {
      setUploadingFiles(prev => prev.filter(f => f.status !== 'complete'));
    }, 500);
  }, [channelId, uploadFile]);

  const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (!disabled && !isMuted) {
      setIsDragging(true);
    }
  }, [disabled, isMuted]);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragging(false);

    if (disabled || isMuted) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
  }, [disabled, isMuted, handleFileSelect]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeUploadingFile = useCallback((id: string) => {
    setUploadingFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  // Focus textarea when reply is set
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const canSend = (content.trim() || attachments.length > 0) && !disabled && !isSending && !isMuted && !isUploading;

  return (
    <div
      className={`px-4 py-3 bg-gray-800 border-t border-gray-700 transition-colors ${
        isDragging ? 'bg-indigo-900/30 ring-2 ring-indigo-500 ring-inset' : ''
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 bg-indigo-900/50 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-gray-800 rounded-lg px-6 py-4 text-white shadow-xl">
            <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-2 px-4 py-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-300 hover:text-white ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Muted indicator */}
      {isMuted && (
        <div className="mb-2 px-4 py-2 bg-red-900/50 border border-red-700 rounded text-red-200 text-sm flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          </svg>
          <span>You have been muted by the lecturer and cannot send messages.</span>
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="mb-2 px-4 py-2 bg-gray-700/70 border-l-4 border-indigo-500 rounded flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-indigo-400 font-medium mb-0.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              Replying to {replyTo.username}
            </div>
            <div className="text-sm text-gray-400 truncate">{replyTo.content}</div>
          </div>
          <button
            onClick={onCancelReply}
            className="ml-2 text-gray-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Uploading files preview */}
      {uploadingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {uploadingFiles.map((file) => (
            <div key={file.id} className="relative group">
              <div className={`relative rounded-lg overflow-hidden border ${
                file.status === 'error' ? 'border-red-600' : 'border-gray-600'
              }`}>
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="h-20 w-20 object-cover"
                  />
                ) : (
                  <div className="h-20 w-20 bg-gray-700 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}
                
                {/* Progress overlay */}
                {file.status === 'uploading' && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="text-center">
                      <div className="w-12 h-12 relative">
                        <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 48 48">
                          <circle
                            className="text-gray-600"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            r="20"
                            cx="24"
                            cy="24"
                          />
                          <circle
                            className="text-indigo-500"
                            stroke="currentColor"
                            strokeWidth="4"
                            strokeLinecap="round"
                            fill="transparent"
                            r="20"
                            cx="24"
                            cy="24"
                            strokeDasharray={`${2 * Math.PI * 20}`}
                            strokeDashoffset={`${2 * Math.PI * 20 * (1 - file.progress / 100)}`}
                            style={{ transition: 'stroke-dashoffset 0.3s' }}
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                          {file.progress}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error indicator */}
                {file.status === 'error' && (
                  <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                )}

                {/* Remove button */}
                <button
                  onClick={() => removeUploadingFile(file.id)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow-lg"
                >
                  ×
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1 truncate max-w-[80px]">{file.file.name}</div>
            </div>
          ))}
        </div>
      )}

      {/* Completed attachments preview */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((att, index) => (
            <div key={att.id || index} className="relative group">
              {att.fileType === 'image' || att.fileType === 'gif' ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-600">
                  <img
                    src={att.fileUrl}
                    alt={att.fileName}
                    className="h-20 w-20 object-cover"
                  />
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow-lg"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="relative rounded-lg border border-gray-600 bg-gray-700 p-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-gray-300 truncate max-w-[100px]">{att.fileName}</span>
                  </div>
                  <button
                    onClick={() => removeAttachment(index)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs shadow-lg"
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
          if (canSend) {
            await handleSend();
          }
        }}
        className={`flex items-end gap-2 bg-gray-700 rounded-lg px-3 py-2 transition-all ${
          isFocused ? 'ring-2 ring-indigo-500' : ''
        } ${disabled || isMuted ? 'opacity-60' : ''}`}
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
          className={`p-2 rounded-lg transition-all flex-shrink-0 ${
            disabled || isMuted || isUploading
              ? 'text-gray-500 cursor-not-allowed'
              : 'text-gray-300 hover:text-indigo-400 hover:bg-indigo-500/20 active:bg-indigo-500/30'
          }`}
          title={isMuted ? 'Cannot upload while muted' : isUploading ? 'Upload in progress...' : 'Upload image or video'}
        >
          {isUploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
          placeholder={isMuted ? 'You have been muted by the lecturer.' : placeholder}
          rows={1}
          disabled={disabled || isSending || isMuted}
          className="flex-1 bg-transparent text-white placeholder-gray-400 resize-none outline-none text-sm max-h-[200px] overflow-y-auto disabled:cursor-not-allowed py-1"
          style={{ minHeight: '24px' }}
        />

        {/* Emoji button */}
        <button
          type="button"
          className="text-gray-400 hover:text-gray-300 p-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Add emoji"
          disabled={disabled || isSending || isMuted}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={!canSend}
          className={`p-1.5 rounded-lg transition-all ${
            canSend
              ? 'text-white bg-indigo-600 hover:bg-indigo-500 cursor-pointer'
              : 'text-gray-500 cursor-not-allowed'
          }`}
          title={isMuted ? 'You are muted' : isUploading ? 'Wait for upload to finish' : !canSend ? 'Type a message or attach a file' : 'Send message'}
        >
          {isSending ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </form>

      {/* Keyboard shortcut hint */}
      <div className="mt-1 text-xs text-gray-500 text-right">
        Press <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400">Enter</kbd> to send, <kbd className="px-1 py-0.5 bg-gray-700 rounded text-gray-400">Shift+Enter</kbd> for new line
      </div>
    </div>
  );
}
