"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Message from "./Message";
import MessageInput from "./MessageInput";
import dynamic from "next/dynamic";
import { ChevronDown, Pin, PinOff } from "lucide-react";
import VideoUploadDialog, {
  type ProjectSubmissionData,
} from "./VideoUploadDialog";

const LecturesChannel = dynamic(() => import("./LecturesChannel"), {
  loading: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
    </div>
  ),
});
import type { Channel } from "@/types/server";
import type {
  Message as MessageType,
  MessageAttachment,
  PinnedMessage,
  Reaction,
} from "@/types/message";
import { useChatMessages } from "@/hooks/useChatMessages";
import { usePinnedMessages } from "@/hooks/usePinnedMessages";
import { useRealtimeTyping } from "@/hooks/useRealtimeTyping";
import { useMuteStatus } from "@/hooks/useMuteStatus";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import { useI18n } from "@/contexts/I18nContext";
import type { EnrollmentInfo } from "@/hooks/useEnrollments";

interface ChatAreaProps {
  channel: Channel | null;
  currentUserId: string;
  isLecturer?: boolean;
  onSendMessage: (channelId: string, content: string | null) => void;
  onReply?: (messageId: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  isEnrolledInCourse?: boolean;
  enrollmentInfo?: EnrollmentInfo | null;
  onReEnrollRequest?: () => void;
  onMobileMenuClick?: () => void;
  markAsRead?: (channelId: string) => void | Promise<void>;
  canManagePins?: boolean;
}

function PinnedMessagesBar({
  pinnedMessages,
  isExpanded,
  canManagePins,
  pendingMessageId,
  jumpError,
  onToggleExpanded,
  onJumpToMessage,
  onUnpin,
}: {
  pinnedMessages: PinnedMessage[];
  isExpanded: boolean;
  canManagePins: boolean;
  pendingMessageId: string | null;
  jumpError: string | null;
  onToggleExpanded: () => void;
  onJumpToMessage: (messageId: string) => void;
  onUnpin: (messageId: string) => void;
}) {
  const { t } = useI18n();
  const latestPin = pinnedMessages[0];
  if (!latestPin) return null;

  const getPreview = (pin: PinnedMessage) => {
    if (pin.preview) return pin.preview;
    if (pin.message.attachments?.length) return t("chat.pinnedAttachment");
    return t("chat.pinnedEmptyMessage");
  };

  return (
    <div className="border-b border-navy-800/60 bg-navy-950/80 backdrop-blur-md shadow-soft flex-shrink-0 z-10">
      <div className="flex min-h-11 items-center gap-2 px-4 py-2">
        <button
          type="button"
          onClick={() => onJumpToMessage(latestPin.messageId)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-navy-900/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
        >
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-300">
            <Pin className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[11px] font-semibold uppercase text-amber-300">
              {t("chat.pinnedMessages")}
              {pinnedMessages.length > 1 && (
                <span className="rounded-full bg-navy-800/80 px-1.5 py-0.5 text-[10px] text-gray-300">
                  {pinnedMessages.length}
                </span>
              )}
            </span>
            <span className="block truncate text-sm text-gray-200">
              {latestPin.message.user.username}: {getPreview(latestPin)}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          title={
            isExpanded
              ? t("chat.hidePinnedMessages")
              : t("chat.showPinnedMessages")
          }
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-navy-800/70 hover:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {jumpError && (
        <div className="px-6 pb-2 text-xs text-amber-200">{jumpError}</div>
      )}

      {isExpanded && (
        <div className="max-h-64 overflow-y-auto border-t border-navy-800/50 px-4 py-2 chat-scrollbar">
          <div className="space-y-1">
            {pinnedMessages.map((pin) => (
              <div
                key={pin.id}
                className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-navy-900/55"
              >
                <button
                  type="button"
                  onClick={() => onJumpToMessage(pin.messageId)}
                  className="min-w-0 flex-1 text-left focus-visible:outline-none"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="font-medium text-gray-300 truncate">
                      {pin.message.user.username}
                    </span>
                    <span className="truncate">
                      {t("chat.pinnedBy", { username: pin.pinnedBy.username })}
                    </span>
                  </div>
                  <div className="truncate text-sm text-gray-200">
                    {getPreview(pin)}
                  </div>
                </button>
                {canManagePins && (
                  <button
                    type="button"
                    onClick={() => onUnpin(pin.messageId)}
                    disabled={pendingMessageId === pin.messageId}
                    title={t("chat.unpinMessage")}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-200 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300/30"
                  >
                    <PinOff className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ChatArea({
  channel,
  currentUserId,
  isLecturer = false,
  onSendMessage,
  onReply,
  onReaction,
  isEnrolledInCourse = false,
  enrollmentInfo = null,
  onReEnrollRequest,
  onMobileMenuClick,
  markAsRead,
  canManagePins = isLecturer,
}: ChatAreaProps) {
  const { t } = useI18n();
  const isEnrollmentExpired = !isEnrolledInCourse;
  const [replyTo, setReplyTo] = useState<
    | {
        id: string;
        username: string;
        content: string;
      }
    | undefined
  >(undefined);
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

  // Clear replyTo when channel changes
  useEffect(() => {
    if (prevChannelIdRef.current !== channel?.id) {
      setReplyTo(undefined);
      setShowPinnedMessages(false);
      setPinnedJumpError(null);
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
    loadUntilMessage,
    updateMessage,
    addReaction,
    refetch,
    broadcastMessage,
    broadcastReaction,
  } = useChatMessages({
    channelId: channel?.id || null,
    enabled: !!channel,
  });

  const {
    pinnedMessages,
    pinnedMessageIds,
    pendingMessageId: pendingPinMessageId,
    pinMessage,
    unpinMessage,
  } = usePinnedMessages({
    channelId: channel?.id || null,
    enabled: !!channel && channel.type !== "lectures",
  });
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedJumpError, setPinnedJumpError] = useState<string | null>(null);
  const pinnedMessageMap = useMemo(
    () => new Map(pinnedMessages.map((pin) => [pin.messageId, pin])),
    [pinnedMessages],
  );

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
    if (!channel || !currentUserId || !markAsRead) return;

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
  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      scrollTimeoutRef.current = setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior, block: "end" });
        }
      }, 50);
    },
    [messagesEndRef],
  );

  // Auto-scroll on new messages if user is near bottom
  useEffect(() => {
    const messageCount = messages.length;
    const isNewMessage = messageCount > prevMessageCountRef.current;
    prevMessageCountRef.current = messageCount;

    // Only auto-scroll if:
    // 1. It's a new message (not initial load)
    // 2. User hasn't scrolled up
    // 3. Not currently loading initial messages
    if (
      isNewMessage &&
      !userScrolledUpRef.current &&
      messageCount > 0 &&
      !isLoading
    ) {
      // Small delay to ensure message is rendered
      const timeoutId = setTimeout(() => {
        scrollToBottom("smooth");
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
          messagesContainerRef.current.scrollTop =
            messagesContainerRef.current.scrollHeight;
        }
      }, 150);
      return () => clearTimeout(timeoutId);
    }
  }, [channel?.id, isLoading, messages.length]);

  // Add scroll listener
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const handleSend = useCallback(
    async (content: string | null, attachments?: MessageAttachment[]) => {
      if (!channel) {
        console.error("Cannot send message: channel is null");
        return;
      }

      if (!content?.trim() && (!attachments || attachments.length === 0)) {
        console.warn("Cannot send empty message");
        return;
      }

      // Get session once, with refresh fallback
      let {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const {
          data: { session: refreshed },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        session = refreshed;
        sessionError = refreshError;
      }
      if (sessionError || !session?.user) {
        console.error("Session error:", sessionError);
        throw new Error("Not authenticated. Please log in again.");
      }

      // Capture replyTo at the time of sending
      const currentReplyTo = replyTo;

      // Add optimistic message INSTANTLY with reply preview
      const tempId = addPendingMessage(
        content || "",
        currentReplyTo?.id,
        session.user.id,
        attachments,
        currentReplyTo
          ? {
              id: currentReplyTo.id,
              username: currentReplyTo.username,
              content: currentReplyTo.content,
            }
          : undefined,
      );

      // Track sending state for UI feedback only (not blocking)
      pendingSendsRef.current += 1;
      setIsSending(true);

      // Scroll to bottom immediately
      userScrolledUpRef.current = false;
      scrollToBottom("smooth");

      try {
        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("chat-messages"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({
            chatId: channel.id,
            content: content || "",
            replyTo: currentReplyTo?.id || null,
            attachments,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMessage =
            errorData.error || errorData.details || "Failed to send message";
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
            attachments: serverMessage.attachments || attachments,
            edited: serverMessage.edited,
            timestamp: serverMessage.timestamp,
            user: serverMessage.user,
          };

          replacePendingMessage(tempId, transformedMessage);

          // Broadcast to other clients for instant delivery (bypasses RLS)
          broadcastMessage(transformedMessage);
        }

        // Fallback timeout to cleanup stuck pending messages
        const fallbackTimeout = setTimeout(() => {
          const currentMessages = messagesRef.current;
          const stillPending = currentMessages.find(
            (m) => "tempId" in m && m.tempId === tempId,
          );
          const messageExists = currentMessages.some(
            (m) => m.id === serverMessage?.id,
          );

          if (stillPending && !messageExists && serverMessage) {
            console.warn("Fallback: Removing stuck pending message");
            removePendingMessage(tempId);
          }
          timeoutRefsRef.current.delete(tempId);
        }, 5000);

        timeoutRefsRef.current.set(tempId, fallbackTimeout);

        // Clear replyTo on success
        setReplyTo(undefined);
        onSendMessage(channel.id, content);
      } catch (error: any) {
        console.error("Error sending message:", error);

        // Handle muted error gracefully - don't throw, just show the message
        const errorMessage = error.message || "Failed to send";
        const isMutedError = errorMessage.toLowerCase().includes("muted");

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
    },
    [
      channel,
      replyTo,
      addPendingMessage,
      markMessageFailed,
      removePendingMessage,
      replacePendingMessage,
      onSendMessage,
      scrollToBottom,
    ],
  );

  const handleTyping = useCallback(async () => {
    if (!channel) return;

    try {
      let {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const {
          data: { session: refreshed },
        } = await supabase.auth.refreshSession();
        session = refreshed;
      }
      if (!session?.access_token) return;

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      await fetch(edgeFunctionUrl("chat-typing"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(anonKey && { apikey: anonKey }),
        },
        body: JSON.stringify({ chatId: channel.id }),
      });
    } catch {
      // Silently fail - typing indicator is not critical
    }
  }, [channel]);

  const handleReply = useCallback(
    (messageId: string) => {
      const message = messages.find(
        (m) => m.id === messageId && !("pending" in m) && !("failed" in m),
      );
      if (message) {
        setReplyTo({
          id: message.id,
          username: message.user.username,
          content:
            (message.content || "").substring(0, 50) +
            ((message.content?.length || 0) > 50 ? "..." : ""),
        });
      }
    },
    [messages],
  );

  const handleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!channel) return;

      addReaction(messageId, emoji, currentUserId);

      try {
        let {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          const {
            data: { session: refreshed },
          } = await supabase.auth.refreshSession();
          session = refreshed;
        }
        if (!session?.access_token) {
          throw new Error("Not authenticated. Please log in again.");
        }

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const response = await fetch(edgeFunctionUrl("chat-messages"), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({
            chatId: channel.id,
            messageId,
            emoji,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || "Failed to save reaction");
        }

        const data = await response.json();
        const reactions: Reaction[] = Array.isArray(data.reactions)
          ? data.reactions
          : [];

        updateMessage(messageId, {
          reactions: reactions.length > 0 ? reactions : undefined,
        });
        broadcastReaction(messageId, reactions);
        onReaction?.(messageId, emoji);
      } catch (error) {
        addReaction(messageId, emoji, currentUserId);
        console.error("Error saving reaction:", error);
      }
    },
    [
      channel,
      addReaction,
      currentUserId,
      updateMessage,
      broadcastReaction,
      onReaction,
    ],
  );

  const handleRetry = useCallback(
    (tempId: string) => {
      const failedMessage = messages.find(
        (m) => "tempId" in m && m.tempId === tempId,
      );
      if (failedMessage && "content" in failedMessage) {
        removePendingMessage(tempId);
        handleSend(failedMessage.content, failedMessage.attachments);
      }
    },
    [messages, removePendingMessage, handleSend],
  );

  // Scroll to bottom button handler
  const handleScrollToBottom = useCallback(() => {
    userScrolledUpRef.current = false;
    scrollToBottom("smooth");
  }, [scrollToBottom]);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageElement = document.querySelector(
      `[data-message-id="${messageId}"]`,
    );
    if (!messageElement) return false;

    messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
    messageElement.classList.add("ring-2", "ring-amber-400", "bg-amber-500/10");
    window.setTimeout(() => {
      messageElement.classList.remove(
        "ring-2",
        "ring-amber-400",
        "bg-amber-500/10",
      );
    }, 2200);
    return true;
  }, []);

  const handlePinnedMessageClick = useCallback(
    async (messageId: string) => {
      setPinnedJumpError(null);
      if (scrollToMessage(messageId)) return;

      const found = await loadUntilMessage(messageId);
      window.setTimeout(() => {
        if (!found || !scrollToMessage(messageId)) {
          setPinnedJumpError(t("chat.pinnedMessageUnavailable"));
        }
      }, 80);
    },
    [loadUntilMessage, scrollToMessage, t],
  );

  const handleTogglePin = useCallback(
    async (messageId: string) => {
      try {
        if (pinnedMessageIds.has(messageId)) {
          await unpinMessage(messageId);
        } else {
          await pinMessage(messageId);
        }
      } catch (error) {
        console.error("Failed to update pinned message:", error);
      }
    },
    [pinMessage, pinnedMessageIds, unpinMessage],
  );

  // Handle project submission
  const handleProjectSubmit = useCallback(
    async (data: ProjectSubmissionData) => {
      if (!channel || !channel.courseId) {
        throw new Error("Channel not found");
      }

      let {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const {
          data: { session: refreshed },
          error: refreshError,
        } = await supabase.auth.refreshSession();
        session = refreshed;
        sessionError = refreshError;
      }
      if (sessionError || !session?.user) {
        throw new Error("Not authenticated. Please log in again.");
      }

      // Upload video file if provided. chat-media is private (mig 235) — we
      // persist the bucket-relative path; reads (ProjectCard, ProjectDetailsModal)
      // discriminate path-vs-external-URL and sign on demand.
      let videoUrl = data.videoLink;
      let attachments: any[] = [];

      if (data.videoFile) {
        if (!channel.courseId) {
          throw new Error("Channel course ID not found");
        }

        const fileExt =
          data.videoFile.name.split(".").pop()?.toLowerCase() || "mp4";
        const fileName = `project-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}.${fileExt}`;
        // Storage path structure: {course_id}/{channel_id}/{user_id}/{filename}
        const filePath = `${channel.courseId}/${channel.id}/${session.user.id}/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("chat-media")
          .upload(filePath, data.videoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Failed to upload video: ${uploadError.message}`);
        }

        const storedPath = uploadData?.path || filePath;
        videoUrl = storedPath;
        attachments = [
          {
            filePath: storedPath,
            fileName: data.videoFile.name,
            fileType: "video",
            fileSize: data.videoFile.size,
            mimeType: data.videoFile.type,
          },
        ];
      }

      // Create a simple message content (for display purposes)
      const messageContent = `🎬 Project: ${data.name}`;

      // First, create the message
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(edgeFunctionUrl("chat-messages"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          ...(anonKey && { apikey: anonKey }),
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
        throw new Error(errorData.error || "Failed to create message");
      }

      const { message: createdMessage } = await response.json();

      // Free-project lecturers (admin-granted) skip the Keepz payment flow.
      // The DB trigger trg_set_project_pending_payment is the authoritative
      // gate; this client check exists only to skip the unnecessary redirect.
      const { data: lecturerProfile } = await supabase
        .from("profiles")
        .select("can_create_free_projects")
        .eq("id", session.user.id)
        .maybeSingle();
      const isExempt = lecturerProfile?.can_create_free_projects === true;

      // Create project with pending_payment status if budget > 0 and not exempt
      const needsPayment = data.budget > 0 && !isExempt;
      const { data: projectRecord, error: projectError } = await supabase
        .from("projects")
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
          ...(needsPayment ? { status: "pending_payment" } : {}),
        })
        .select("id")
        .single();

      if (projectError) {
        console.error("Error creating project:", projectError);
        throw new Error(`Failed to save project: ${projectError.message}`);
      }

      // Insert criteria if any
      if (data.criteria && data.criteria.length > 0 && projectRecord) {
        const criteriaRecords = data.criteria.map((criterion, index) => ({
          project_id: projectRecord.id,
          criteria_text: criterion.text,
          rpm: criterion.rpm,
          display_order: index,
          platform: criterion.platform || null,
        }));

        const { error: criteriaError } = await supabase
          .from("project_criteria")
          .insert(criteriaRecords);

        if (criteriaError) {
          console.error("Error creating criteria:", criteriaError);
        }
      }

      // If budget > 0, initiate Keepz payment
      if (needsPayment && projectRecord) {
        const orderResponse = await fetch("/api/payments/keepz/create-order", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            paymentType: "project_budget",
            referenceId: projectRecord.id,
          }),
        });

        if (!orderResponse.ok) {
          const errData = await orderResponse.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create payment order");
        }

        const orderData = await orderResponse.json();

        if (orderData.recovered && orderData.status === "success") {
          // Payment was already completed (edge case recovery)
          refetch();
          return;
        }

        if (orderData.checkoutUrl) {
          // Redirect to Keepz checkout
          window.location.href = orderData.checkoutUrl;
          return;
        }

        if (orderData.processing) {
          // Saved card flow — project will activate via callback
          refetch();
          return;
        }
      }

      // Refresh messages to show the new project
      refetch();
    },
    [channel, supabase, refetch],
  );

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
          <p className="text-lg font-semibold text-gray-200">
            {t("chat.selectChannel")}
          </p>
        </div>
      </div>
    );
  }

  // Show Lectures channel for lectures type
  if (channel.type === "lectures") {
    return (
      <LecturesChannel
        channel={channel}
        courseId={channel.courseId || ""}
        currentUserId={currentUserId}
        isLecturer={isLecturer}
        isEnrollmentExpired={isEnrollmentExpired}
        enrollmentInfo={enrollmentInfo}
        onReEnrollRequest={onReEnrollRequest}
        onMobileMenuClick={onMobileMenuClick}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-navy-950/30 backdrop-blur-sm relative">
      {/* Channel header */}
      <div className="h-12 px-4 border-b border-navy-800/60 flex items-center shadow-soft flex-shrink-0 bg-navy-950/60 backdrop-blur-md z-10">
        <div className="flex items-center gap-2">
          {/* Mobile Menu Button */}
          <button
            onClick={onMobileMenuClick}
            className="md:hidden text-gray-400 hover:text-white mr-2"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <span className="text-emerald-300 text-lg">#</span>
          <h2 className="text-gray-100 font-semibold text-sm">
            {channel.name}
          </h2>
          {!isConnected && (
            <span className="flex items-center gap-1 text-amber-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              {t("chat.connecting")}
            </span>
          )}
        </div>
        {channel.description && (
          <span className="ml-4 text-gray-500 text-xs hidden md:block">
            {channel.description}
          </span>
        )}
      </div>

      <PinnedMessagesBar
        pinnedMessages={pinnedMessages}
        isExpanded={showPinnedMessages}
        canManagePins={canManagePins}
        pendingMessageId={pendingPinMessageId}
        jumpError={pinnedJumpError}
        onToggleExpanded={() => setShowPinnedMessages((value) => !value)}
        onJumpToMessage={handlePinnedMessageClick}
        onUnpin={(messageId) => {
          handleTogglePin(messageId);
        }}
      />

      {/* Messages container */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden chat-scrollbar"
        style={{
          scrollBehavior: "auto",
          overscrollBehavior: "contain",
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
                  <p className="font-semibold mb-1 text-red-100">
                    Error loading messages
                  </p>
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
                <p className="text-base font-semibold text-gray-200 mb-1">
                  No messages yet
                </p>
                <p className="text-sm text-gray-500">
                  Be the first to start the conversation.
                </p>
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
                        <svg
                          className="w-4 h-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Loading...
                      </span>
                    ) : (
                      "Load older messages"
                    )}
                  </button>
                </div>
              )}

              {/* Messages */}
              <div className="space-y-0">
                {(() => {
                  // Filter out "Video submission" and "Submission" messages (submission messages without user content)
                  const filteredMessages = messages.filter((message) => {
                    if ("content" in message) {
                      const content = message.content;
                      // Filter out default submission messages that don't have user-provided content
                      if (
                        content === "Video submission" ||
                        content === "Submission"
                      ) {
                        return false;
                      }
                    }
                    return true;
                  });

                  return filteredMessages.map((message, index) => {
                    const prevMessage =
                      index > 0 ? filteredMessages[index - 1] : null;
                    const showAvatar: boolean =
                      index === 0 ||
                      !!(
                        prevMessage &&
                        "user" in prevMessage &&
                        prevMessage.user &&
                        "user" in message &&
                        message.user &&
                        prevMessage.user.id !== message.user.id
                      );

                    const isFailed = "failed" in message && message.failed;
                    const tempId =
                      "tempId" in message ? message.tempId : undefined;
                    const messageWithRetry = isFailed
                      ? {
                          ...message,
                          onRetry: () => handleRetry(tempId || ""),
                        }
                      : message;
                    const pin = pinnedMessageMap.get(message.id);
                    const messageWithPin = pin
                      ? {
                          ...messageWithRetry,
                          pinned: true,
                          pinnedAt: pin.pinnedAt,
                          pinnedBy: pin.pinnedBy,
                        }
                      : messageWithRetry;

                    if (
                      !message ||
                      !("id" in message) ||
                      !("user" in message)
                    ) {
                      return null;
                    }

                    return (
                      <Message
                        key={message.id}
                        message={messageWithPin}
                        currentUserId={currentUserId}
                        onReply={handleReply}
                        onReaction={handleReaction}
                        onTogglePin={handleTogglePin}
                        canPinMessages={canManagePins}
                        isPinning={pendingPinMessageId === message.id}
                        isLecturer={isLecturer}
                        channelId={channel.id}
                        courseId={channel.courseId}
                        showAvatar={showAvatar}
                        isEnrolledInCourse={isEnrolledInCourse}
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
          className="absolute bottom-[calc(7rem+env(safe-area-inset-bottom))] sm:bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 sm:right-6 h-10 w-10 flex items-center justify-center bg-navy-900/85 border border-navy-800/70 text-gray-100 rounded-full shadow-soft hover:shadow-soft-lg hover:bg-navy-800/80 transition-all transform hover:scale-105 z-20 will-change-transform"
          style={{ transformOrigin: "center", backfaceVisibility: "hidden" }}
          title="Scroll to bottom"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2 text-sm text-gray-400 italic flex items-center gap-2 bg-navy-950/70 border-t border-navy-800/60">
          <div className="flex gap-1">
            <span
              className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></span>
            <span
              className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></span>
            <span
              className="w-2 h-2 bg-emerald-400/80 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></span>
          </div>
          {typingUsers.length === 1 ? (
            <span>
              <strong>{typingUsers[0].username}</strong> is typing...
            </span>
          ) : typingUsers.length === 2 ? (
            <span>
              <strong>{typingUsers[0].username}</strong> and{" "}
              <strong>{typingUsers[1].username}</strong> are typing...
            </span>
          ) : (
            <span>
              <strong>{typingUsers[0].username}</strong> and{" "}
              {typingUsers.length - 1} others are typing...
            </span>
          )}
        </div>
      )}

      {/* Message input or Project submission button */}
      {(() => {
        // Check if this is a restricted channel (Lectures or Projects)
        const channelName = channel.name?.toLowerCase() || "";
        const channelType = channel.type as string;
        const isLecturesChannel =
          channelName === "lectures" && channelType === "lectures";
        const isProjectsChannel = channelName === "projects";
        const isRestrictedChannel = isLecturesChannel || isProjectsChannel;
        const canSendMessages = !isRestrictedChannel || isLecturer;

        // For projects channel, show plus button only for lecturers
        if (isProjectsChannel) {
          if (isLecturer) {
            return (
              <div className="px-4 pt-3 pb-safe border-t border-navy-800/60 bg-navy-950/70">
                <button
                  onClick={() => setShowVideoUploadDialog(true)}
                  className="w-12 h-12 flex items-center justify-center bg-emerald-500/90 hover:bg-emerald-500 text-white rounded-full transition-colors shadow-soft hover:shadow-soft-lg hover:scale-105 will-change-transform"
                  style={{
                    transformOrigin: "center",
                    backfaceVisibility: "hidden",
                  }}
                  title={t("projects.createVideoProject")}
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </button>
              </div>
            );
          } else {
            // For non-lecturers, show a message indicating they can't create projects
            return (
              <div className="px-4 pt-3 pb-safe border-t border-navy-800/60 bg-navy-950/70">
                <div className="text-center text-gray-500 text-sm">
                  {t("chat.onlyLecturerCanCreateProjects")}
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
                ? t("chat.onlyLecturerCanSendMessages")
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
