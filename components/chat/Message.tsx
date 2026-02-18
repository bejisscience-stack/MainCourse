'use client';

import { useState, memo, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { edgeFunctionUrl } from '@/lib/api-client';
import { useUserMuteStatus } from '@/hooks/useMuteStatus';
import { useProjectCountdown } from '@/hooks/useProjectCountdown';
import { useFriendStatusContext } from '@/contexts/FriendStatusContext';
import ProjectCard from './ProjectCard';
import type { Message as MessageType, MessageAttachment } from '@/types/message';

interface ProjectData {
  name: string;
  description: string;
  videoLink?: string;
  budget: number;
  minViews: number;
  maxViews: number;
  platforms: string[];
  startDate?: string;
  endDate?: string;
}

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
  isEnrollmentExpired?: boolean;
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

// Image Modal component for lightbox display
const ImageModal = memo(function ImageModal({
  imageUrl,
  imageAlt,
  isOpen,
  onClose,
}: {
  imageUrl: string;
  imageAlt: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Handle ESC key
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);

    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-navy-950/95 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-navy-900/80 border border-navy-700/60 text-gray-300 hover:text-white hover:bg-navy-800/80 transition-colors z-50"
        aria-label="Close image"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Image */}
      <img
        src={imageUrl}
        alt={imageAlt}
        className="max-w-full max-h-[90vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
});

// Media attachment component
const MediaAttachment = memo(function MediaAttachment({
  attachment
}: {
  attachment: MessageAttachment;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  if (attachment.fileType === 'image' || attachment.fileType === 'gif') {
    return (
      <>
        <div className="relative rounded-xl overflow-hidden border border-navy-800/60 bg-navy-900/60 max-w-3xl shadow-soft">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-navy-900/70">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          {hasError ? (
            <div className="p-4 text-gray-300 text-sm flex items-center gap-2">
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
              onClick={() => setIsImageExpanded(true)}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>
        <ImageModal
          imageUrl={attachment.fileUrl}
          imageAlt={attachment.fileName}
          isOpen={isImageExpanded}
          onClose={() => setIsImageExpanded(false)}
        />
      </>
    );
  }

  if (attachment.fileType === 'video') {
    return (
      <div className="rounded-xl overflow-hidden border border-navy-800/60 bg-navy-900/60 max-w-3xl shadow-soft">
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
  isEnrollmentExpired = false,
}: MessageProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
  const reactionPickerRef = useRef<HTMLDivElement>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{
    top: number;
    left: number;
    placement: 'top' | 'bottom' | 'left' | 'right';
  } | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get mute status for this user (only if lecturer and not self)
  const canMute = isLecturer && message.user.id !== currentUserId && !!channelId;
  const { isMuted, refetch: refetchMuteStatus } = useUserMuteStatus(
    canMute ? channelId : null,
    canMute ? message.user.id : null
  );

  const isNotSelf = message.user.id !== currentUserId;
  const friendCtx = useFriendStatusContext();
  const [friendActionError, setFriendActionError] = useState<string | null>(null);
  const [friendRequestSent, setFriendRequestSent] = useState(false);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      setPortalRoot(document.body);
    }
  }, []);

  useEffect(() => {
    if (!showMenu) {
      setShowReactionPicker(false);
      setReactionPickerPosition(null);
    }
  }, [showMenu]);

  const updateReactionPickerPosition = useCallback(() => {
    if (!reactionButtonRef.current || !reactionPickerRef.current) return;

    const buttonRect = reactionButtonRef.current.getBoundingClientRect();
    const pickerRect = reactionPickerRef.current.getBoundingClientRect();
    const spacing = 10;
    const padding = 8;

    const topSpace = buttonRect.top;
    const bottomSpace = window.innerHeight - buttonRect.bottom;
    const leftSpace = buttonRect.left;
    const rightSpace = window.innerWidth - buttonRect.right;

    const fitsTop = topSpace >= pickerRect.height + spacing;
    const fitsBottom = bottomSpace >= pickerRect.height + spacing;
    const fitsLeft = leftSpace >= pickerRect.width + spacing;
    const fitsRight = rightSpace >= pickerRect.width + spacing;

    let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
    if (fitsTop) {
      placement = 'top';
    } else if (fitsBottom) {
      placement = 'bottom';
    } else if (fitsRight) {
      placement = 'right';
    } else if (fitsLeft) {
      placement = 'left';
    } else {
      const maxSpace = Math.max(topSpace, bottomSpace, leftSpace, rightSpace);
      if (maxSpace === topSpace) placement = 'top';
      else if (maxSpace === bottomSpace) placement = 'bottom';
      else if (maxSpace === rightSpace) placement = 'right';
      else placement = 'left';
    }

    let top = buttonRect.top + buttonRect.height / 2 - pickerRect.height / 2;
    let left = buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2;

    if (placement === 'top') {
      top = buttonRect.top - pickerRect.height - spacing;
    } else if (placement === 'bottom') {
      top = buttonRect.bottom + spacing;
    } else if (placement === 'left') {
      left = buttonRect.left - pickerRect.width - spacing;
    } else if (placement === 'right') {
      left = buttonRect.right + spacing;
    }

    top = Math.min(Math.max(padding, top), window.innerHeight - pickerRect.height - padding);
    left = Math.min(Math.max(padding, left), window.innerWidth - pickerRect.width - padding);

    setReactionPickerPosition({ top, left, placement });
  }, []);

  useEffect(() => {
    if (!showReactionPicker) {
      setReactionPickerPosition(null);
      return;
    }

    const raf = requestAnimationFrame(updateReactionPickerPosition);

    const handleResize = () => updateReactionPickerPosition();
    const handleScroll = () => updateReactionPickerPosition();
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        reactionPickerRef.current?.contains(target) ||
        reactionButtonRef.current?.contains(target)
      ) {
        return;
      }
      setShowReactionPicker(false);
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('scroll', handleScroll, true);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showReactionPicker, updateReactionPickerPosition]);

  const handleMute = useCallback(async () => {
    if (!channelId || message.user.id === currentUserId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(edgeFunctionUrl('chat-mute'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey && { 'apikey': anonKey }),
        },
        body: JSON.stringify({ chatId: channelId, muted: true, userId: message.user.id }),
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

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const url = new URL(edgeFunctionUrl('chat-mute'));
      url.searchParams.set('chatId', channelId);
      url.searchParams.set('userId', message.user.id);

      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          ...(anonKey && { 'apikey': anonKey }),
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

  const reactionArrowPlacement = reactionPickerPosition?.placement ?? 'top';


  const scrollToOriginal = useCallback(() => {
    if (message.replyTo) {
      const originalMessage = document.querySelector(`[data-message-id="${message.replyTo}"]`);
      if (originalMessage) {
        originalMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        originalMessage.classList.add('ring-2', 'ring-emerald-500', 'bg-emerald-900/20');
        setTimeout(() => {
          originalMessage.classList.remove('ring-2', 'ring-emerald-500', 'bg-emerald-900/20');
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
      if (showReactionPicker) return;
      setShowMenu(false);
      setShowReactionPicker(false);
    }, 150);
  }, [showReactionPicker]);

  const [projectData, setProjectData] = useState<any>(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  // Check if this is a project message by querying the database
  useEffect(() => {
    const checkProject = async () => {
      if (!channelId || !message.id) return;
      
      setIsLoadingProject(true);
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('message_id', message.id)
          .single();

        if (!error && data) {
          setProjectData(data);
        }
      } catch (error) {
        console.error('Error checking project:', error);
      } finally {
        setIsLoadingProject(false);
      }
    };

    checkProject();
  }, [message.id, channelId, supabase]);

  const isPending = message.pending;
  const isFailed = message.failed;

  // Check if project is expired using countdown hook
  const projectCountdown = useProjectCountdown(
    projectData?.start_date,
    projectData?.end_date
  );

  // If it's a project message, render ProjectCard instead
  if (projectData && !isLoadingProject) {
    return (
      <div
        ref={messageRef}
        data-message-id={message.id}
        className="px-4 py-2"
      >
        <ProjectCard
          project={{
            id: message.id,
            name: projectData.name,
            description: projectData.description,
            videoLink: projectData.video_link,
            budget: parseFloat(projectData.budget),
            minViews: projectData.min_views,
            maxViews: projectData.max_views,
            platforms: projectData.platforms,
            criteria: [], // Will be loaded by ProjectCard component
            submittedBy: {
              id: message.user.id,
              username: message.user.username,
            },
            timestamp: message.timestamp,
            startDate: projectData.start_date,
            endDate: projectData.end_date,
          }}
          currentUserId={currentUserId}
          isLecturer={isLecturer}
          channelId={channelId || ''}
          isEnrollmentExpired={isEnrollmentExpired}
        />
      </div>
    );
  }

  return (
    <div
      ref={messageRef}
      data-message-id={message.id}
      className={`group px-4 hover:bg-navy-800/25 transition-colors duration-150 relative ${
        showAvatar ? 'pt-3 mt-1' : 'py-1'
      } ${isFailed ? 'bg-red-500/10' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0 w-10">
          {showAvatar ? (
            <div
              className={`w-10 h-10 rounded-full bg-navy-900/70 border border-navy-800/70 flex items-center justify-center text-emerald-200 font-semibold text-sm overflow-hidden shadow-soft ${
                isNotSelf ? 'cursor-pointer hover:ring-2 hover:ring-emerald-500/40 transition-all' : ''
              }`}
              onClick={() => {
                if (isNotSelf) {
                  setShowUserMenu(!showUserMenu);
                  setFriendActionError(null);
                }
              }}
            >
              {message.user.avatarUrl ? (
                  <img
                    src={message.user.avatarUrl}
                    alt={message.user?.username || 'User'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  (message.user?.username ? message.user.username.charAt(0) : 'U').toUpperCase()
                )}
            </div>
          ) : (
            <div className="w-10 h-5 flex items-center justify-center">
              <span className="text-[10px] text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                {new Date(message.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            </div>
          )}
        </div>

        {/* Message content */}
        <div className="flex-1 min-w-0">
          {/* Reply preview */}
          {message.replyPreview && (
            <div
              onClick={scrollToOriginal}
              className="mb-2 pl-3 pr-2 py-1.5 border-l-2 border-emerald-400/60 bg-navy-900/50 rounded-lg text-xs cursor-pointer hover:bg-navy-800/60 transition-colors flex items-center gap-2 group/reply max-w-3xl"
            >
              <svg className="w-3.5 h-3.5 text-emerald-300/80 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
              <span className="text-emerald-200 font-medium text-[13px]">{message.replyPreview.username}</span>
              <span className="text-gray-300 truncate text-[13px]">{message.replyPreview.content}</span>
              <span className="text-gray-500 opacity-0 group-hover/reply:opacity-100 transition-opacity text-[11px] ml-auto flex-shrink-0">
                Click to jump
              </span>
            </div>
          )}

          {/* Header - only show if showAvatar is true */}
          {showAvatar && (
            <div className="flex items-center gap-2 mb-1">
              <div className="relative" ref={userMenuRef}>
                <span
                  className={`text-gray-100 font-semibold text-[15px] ${
                    isNotSelf ? 'hover:underline cursor-pointer hover:text-emerald-300' : ''
                  }`}
                  onClick={(e) => {
                    e.preventDefault();
                    if (isNotSelf) {
                      setShowUserMenu(!showUserMenu);
                      setFriendActionError(null);
                    }
                  }}
                  title={message.user?.username || 'User'}
                >
                  {message.user?.username || 'User'}
                </span>

                {/* User context menu */}
                {showUserMenu && isNotSelf && (
                  <div className="absolute left-0 top-7 bg-navy-950/90 border border-navy-700/60 rounded-lg shadow-xl z-50 min-w-[180px] py-1 animate-in fade-in duration-100">
                    {/* Friend actions */}
                    {friendCtx && (() => {
                      const status = friendCtx.getStatusForUser(message.user.id);
                      const receivedRequestId = friendCtx.getReceivedRequestId(message.user.id);

                      return (
                        <>
                          {status === 'none' && (
                            friendRequestSent ? (
                              <div className="px-4 py-2 text-sm text-emerald-300 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Request Sent!
                              </div>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    await friendCtx.sendFriendRequest(message.user.id);
                                    setFriendRequestSent(true);
                                    setTimeout(() => {
                                      setShowUserMenu(false);
                                      setShowMenu(false);
                                      setFriendRequestSent(false);
                                    }, 1200);
                                  } catch (err: any) {
                                    setFriendActionError(err.message || 'Failed to send request');
                                  }
                                }}
                                disabled={friendCtx.isSubmitting}
                                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-navy-800/70 transition-colors flex items-center gap-2 disabled:opacity-50"
                              >
                                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                </svg>
                                Add Friend
                              </button>
                            )
                          )}
                          {status === 'friend' && (
                            <div className="px-4 py-2 text-sm text-emerald-300 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Friends
                            </div>
                          )}
                          {status === 'pending_sent' && (
                            <div className="px-4 py-2 text-sm text-amber-300 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              Request Pending
                            </div>
                          )}
                          {status === 'pending_received' && receivedRequestId && (
                            <div className="px-3 py-2 flex items-center gap-1.5">
                              <button
                                onClick={async () => {
                                  try {
                                    await friendCtx.acceptFriendRequest(receivedRequestId);
                                    setShowUserMenu(false);
                                    setShowMenu(false);
                                  } catch (err: any) {
                                    setFriendActionError(err.message || 'Failed');
                                  }
                                }}
                                disabled={friendCtx.isSubmitting}
                                className="flex-1 text-xs font-medium px-2.5 py-1.5 text-emerald-200 bg-emerald-500/15 border border-emerald-500/40 rounded-md hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                              >
                                Accept
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    await friendCtx.rejectFriendRequest(receivedRequestId);
                                    setShowUserMenu(false);
                                    setShowMenu(false);
                                  } catch (err: any) {
                                    setFriendActionError(err.message || 'Failed');
                                  }
                                }}
                                disabled={friendCtx.isSubmitting}
                                className="flex-1 text-xs font-medium px-2.5 py-1.5 text-red-200 bg-red-500/15 border border-red-500/40 rounded-md hover:bg-red-500/25 transition-colors disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                          {friendActionError && (
                            <div className="px-4 py-1.5 text-xs text-red-300">
                              {friendActionError}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* Divider between friend actions and mute (when both exist) */}
                    {canMute && friendCtx && (
                      <div className="my-1 border-t border-navy-700/60" />
                    )}

                    {/* Mute/unmute for lecturers */}
                    {canMute && (
                      isMuted ? (
                        <button
                          onClick={handleUnmute}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-navy-800/70 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                          </svg>
                          Unmute user
                        </button>
                      ) : (
                        <button
                          onClick={handleMute}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-navy-800/70 transition-colors flex items-center gap-2"
                        >
                          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                          </svg>
                          Mute user
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              <span className="text-gray-500 text-xs font-normal">{formatTimestamp(message.timestamp)}</span>
              {message.edited && (
                <span className="text-gray-600 text-xs italic">(edited)</span>
              )}
              {isMuted && canMute && (
                <span className="text-red-300 text-xs flex items-center gap-1 ml-1">
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
            <div className={`text-gray-100 text-[15px] whitespace-pre-wrap break-words leading-6 ${
              isPending ? 'opacity-50' : isFailed ? 'opacity-70' : ''
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
            <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-gray-500">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Sending...</span>
            </div>
          )}

          {/* Failed indicator */}
          {isFailed && (
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-red-300">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Failed to send{message.error ? `: ${message.error}` : ''}</span>
              {message.onRetry && (
                <button
                  onClick={message.onRetry}
                  className="text-emerald-300 hover:text-emerald-200 underline font-medium text-[11px]"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {message.reactions.map((reaction, idx) => {
                const hasReacted = reaction.users.includes(currentUserId);
                return (
                  <button
                    key={idx}
                    onClick={() => onReaction?.(message.id, reaction.emoji)}
                    className={`group/reaction inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm transition-all duration-200 hover:scale-105 active:scale-95 border ${
                      hasReacted
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-soft'
                        : 'bg-navy-900/60 border-navy-800/60 hover:bg-navy-800/70 hover:border-navy-700/70'
                    }`}
                  >
                    <span className="text-lg leading-none transition-transform duration-200 group-hover/reaction:scale-110">{reaction.emoji}</span>
                    <span className={`text-xs font-bold tabular-nums ${hasReacted ? 'text-emerald-300' : 'text-gray-400'}`}>{reaction.count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Hover action menu */}
        {showMenu && !isPending && !isFailed && (
          <div className="absolute right-4 -top-5 flex items-center gap-1 bg-navy-950/90 backdrop-blur-xl border border-navy-700/60 rounded-xl shadow-soft-xl px-1.5 py-1.5 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Reaction picker trigger */}
            <div className="relative">
              <button
                ref={reactionButtonRef}
                onClick={() => setShowReactionPicker((prev) => !prev)}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  showReactionPicker
                    ? 'bg-amber-500/20 text-amber-300 ring-2 ring-amber-500/30'
                    : 'text-gray-400 hover:text-amber-300 hover:bg-navy-800/70'
                }`}
                title="Add Reaction"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>

            {/* Divider */}
            <div className="w-px h-6 bg-navy-700/60 mx-0.5" />

            {/* Reply button */}
            <button
              onClick={() => {
                onReply?.(message.id);
                setShowMenu(false);
              }}
              className="p-2 hover:bg-navy-800/70 rounded-lg text-gray-400 hover:text-emerald-300 transition-all duration-200"
              title="Reply"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>

            {/* Mute button for lecturers */}
            {canMute && (
              <button
                onClick={isMuted ? handleUnmute : handleMute}
                className={`p-2 rounded-lg transition-all duration-200 ${
                  isMuted
                    ? 'text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/10'
                    : 'text-gray-400 hover:text-red-300 hover:bg-red-500/10'
                }`}
                title={isMuted ? 'Unmute user' : 'Mute user'}
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              className="p-2 hover:bg-navy-800/70 rounded-lg text-gray-400 hover:text-gray-200 transition-all duration-200"
              title="More options"
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
          </div>
        )}

        {showReactionPicker && portalRoot &&
          createPortal(
            <div
              ref={reactionPickerRef}
              className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
              style={{
                top: reactionPickerPosition?.top ?? 0,
                left: reactionPickerPosition?.left ?? 0,
                visibility: reactionPickerPosition ? 'visible' : 'hidden',
              }}
            >
              <div className="bg-navy-950/95 backdrop-blur-2xl border border-navy-700/70 rounded-xl shadow-2xl shadow-black/50 p-3">
                <div
                  className={`absolute w-3 h-3 bg-navy-950/95 border border-navy-700/70 rotate-45 ${
                    reactionArrowPlacement === 'bottom'
                      ? 'top-[-6px] left-1/2 -translate-x-1/2'
                      : reactionArrowPlacement === 'left'
                        ? 'right-[-6px] top-1/2 -translate-y-1/2'
                        : reactionArrowPlacement === 'right'
                          ? 'left-[-6px] top-1/2 -translate-y-1/2'
                          : 'bottom-[-6px] left-1/2 -translate-x-1/2'
                  }`}
                />

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 min-w-[180px] sm:min-w-[260px]">
                  {COMMON_REACTIONS.map((emoji, index) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        onReaction?.(message.id, emoji);
                        setShowReactionPicker(false);
                        setShowMenu(false);
                      }}
                      className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-2xl leading-none transition-all duration-200 hover:bg-white/10 hover:scale-110 active:scale-100"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            portalRoot
          )
        }
      </div>
    </div>
  );
});

export default Message;
