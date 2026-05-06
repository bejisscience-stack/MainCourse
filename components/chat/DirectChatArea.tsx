"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/lib/supabase";
import { edgeFunctionUrl } from "@/lib/api-client";
import type {
  Message as MessageType,
  MessageAttachment,
} from "@/types/message";
import type { DirectConversation } from "@/types/direct-message";
import Message from "./Message";
import MessageInput from "./MessageInput";
import { useDirectMessages } from "@/hooks/useDirectMessages";

interface DirectChatAreaProps {
  conversation: DirectConversation;
  currentUserId: string;
  currentUsername: string;
  onMarkRead: (conversationId: string) => void;
  onMobileMenuClick?: () => void;
}

export default function DirectChatArea({
  conversation,
  currentUserId,
  currentUsername,
  onMarkRead,
  onMobileMenuClick,
}: DirectChatAreaProps) {
  const { t } = useI18n();
  const conversationId = conversation.id;
  const [replyTo, setReplyTo] = useState<
    { id: string; username: string; content: string } | undefined
  >(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const lastReadMarkedRef = useRef<string | null>(null);

  const {
    messages,
    isLoading,
    error,
    hasMore,
    isConnected,
    typingUsers,
    broadcastTyping,
    addPendingMessage,
    markMessageFailed,
    removePendingMessage,
    replacePendingMessage,
    loadMore,
    broadcastMessage,
  } = useDirectMessages({ conversationId, enabled: !!conversationId });

  // Mark conversation as read after opening + after new messages arrive while open.
  useEffect(() => {
    if (!conversationId) return;
    if (lastReadMarkedRef.current === conversationId && messages.length === 0)
      return;
    const timer = setTimeout(() => {
      lastReadMarkedRef.current = conversationId;
      onMarkRead(conversationId);
    }, 400);
    return () => clearTimeout(timer);
  }, [conversationId, messages.length, onMarkRead]);

  // Track scroll position to auto-scroll on new messages.
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    isAtBottomRef.current = distance < 150;
    if (el.scrollTop < 80 && hasMore && !isLoading) loadMore();
  }, [hasMore, isLoading, loadMore]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  // On conversation change, scroll to bottom.
  useEffect(() => {
    isAtBottomRef.current = true;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [conversationId]);

  const onSend = useCallback(
    async (content: string | null, attachments?: MessageAttachment[]) => {
      const tempId = addPendingMessage(
        content || "",
        replyTo?.id,
        currentUserId,
        attachments,
        replyTo,
      );
      const replyToId = replyTo?.id;
      setReplyTo(undefined);

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
        if (!session?.access_token) throw new Error("Not authenticated");

        const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const res = await fetch(edgeFunctionUrl("dm-messages"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            ...(anonKey && { apikey: anonKey }),
          },
          body: JSON.stringify({
            conversationId,
            content,
            replyTo: replyToId,
            attachments,
          }),
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to send message");
        }

        const data = await res.json();
        const realMessage: MessageType = data.message;
        replacePendingMessage(tempId, realMessage);
        broadcastMessage(realMessage);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to send";
        markMessageFailed(tempId, msg);
        // Auto-remove failed pending after a few seconds so it doesn't block.
        setTimeout(() => removePendingMessage(tempId), 4000);
      }
    },
    [
      addPendingMessage,
      conversationId,
      currentUserId,
      replyTo,
      replacePendingMessage,
      markMessageFailed,
      removePendingMessage,
      broadcastMessage,
    ],
  );

  const onTyping = useCallback(() => {
    if (currentUserId)
      broadcastTyping(currentUserId, currentUsername || "User");
  }, [broadcastTyping, currentUserId, currentUsername]);

  const otherTypingUsers = useMemo(
    () => typingUsers.filter((u) => u.id !== currentUserId),
    [typingUsers, currentUserId],
  );

  const otherUsername = conversation.otherUser?.username || "User";

  return (
    <div className="flex-1 flex flex-col h-full bg-navy-950/40 min-w-0">
      {/* Header */}
      <div className="h-12 px-4 border-b border-navy-800/60 bg-navy-950/60 flex items-center gap-3 flex-shrink-0 shadow-soft">
        {onMobileMenuClick && (
          <button
            onClick={onMobileMenuClick}
            className="md:hidden text-gray-400 hover:text-emerald-300 p-1 rounded-md hover:bg-navy-800/60"
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
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        {conversation.otherUser?.avatarUrl ? (
          <img
            src={conversation.otherUser.avatarUrl}
            alt={otherUsername}
            className="w-7 h-7 rounded-full object-cover"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold">
            {otherUsername.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="text-gray-100 font-semibold text-sm truncate flex-1">
          {otherUsername}
        </div>
        {!isConnected && (
          <span className="text-xs text-gray-500">{t("chat.connecting")}</span>
        )}
      </div>

      {/* Messages list */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 chat-scrollbar"
      >
        {error && (
          <div className="px-4 py-2 mb-2 bg-red-500/10 border border-red-500/30 rounded-lg text-red-200 text-sm">
            {error}
          </div>
        )}
        {isLoading && messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-6">…</div>
        )}
        {messages.length === 0 && !isLoading && !error && (
          <div className="text-center text-gray-500 text-sm py-6">
            {t("chat.messageUser").replace("{username}", otherUsername)}
          </div>
        )}
        {messages.map((m) => (
          <Message
            key={m.id}
            message={m as MessageType}
            currentUserId={currentUserId}
            bucket="dm-media"
          />
        ))}
      </div>

      {/* Typing indicator */}
      {otherTypingUsers.length > 0 && (
        <div className="px-4 py-1 text-xs text-gray-400 italic">
          {otherTypingUsers.map((u) => u.username).join(", ")}{" "}
          {t("chat.isTyping")}
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSend={onSend}
        onTyping={onTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(undefined)}
        placeholder={t("chat.messageUser").replace("{username}", otherUsername)}
        channelId={conversationId}
        uploadEndpoint="dm-media"
        uploadIdParamName="conversationId"
        uploadIdValue={conversationId}
        isMuted={false}
      />
    </div>
  );
}
