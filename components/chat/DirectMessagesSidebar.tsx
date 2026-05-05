"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useFriends } from "@/hooks/useFriends";
import type { DirectConversation } from "@/types/direct-message";
import AddFriendDialog from "./AddFriendDialog";

type Tab = "conversations" | "friends" | "requests";

interface DirectMessagesSidebarProps {
  conversations: DirectConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onOpenConversationByFriend: (friendId: string) => Promise<void>;
  onCollapse?: () => void;
  totalUnread?: number;
}

export default function DirectMessagesSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onOpenConversationByFriend,
  onCollapse,
  totalUnread = 0,
}: DirectMessagesSidebarProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("conversations");
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [busyFriend, setBusyFriend] = useState<string | null>(null);

  const {
    friends,
    incoming,
    outgoing,
    incomingCount,
    search,
    sendRequest,
    cancelRequest,
    acceptRequest,
    declineRequest,
    removeFriend,
  } = useFriends();

  const handleAcceptIncoming = async (requestId: string) => {
    try {
      await acceptRequest(requestId);
    } catch {
      /* surfaced by hook error state */
    }
  };

  const handleDeclineIncoming = async (requestId: string) => {
    try {
      await declineRequest(requestId);
    } catch {
      /* ignore */
    }
  };

  const handleCancelOutgoing = async (requestId: string) => {
    try {
      await cancelRequest(requestId);
    } catch {
      /* ignore */
    }
  };

  const handleMessageFriend = async (friendId: string) => {
    setBusyFriend(friendId);
    try {
      await onOpenConversationByFriend(friendId);
      setTab("conversations");
    } finally {
      setBusyFriend(null);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!confirm(t("friends.confirm.removeFriend"))) return;
    try {
      await removeFriend(friendId);
    } catch {
      /* ignore */
    }
  };

  // Adapter: AddFriendDialog cancels by userId, but our hook requires requestId
  // for cancel/accept. Translate via outgoing/incoming lookup.
  const sendRequestByUserId = async (userId: string) => {
    await sendRequest(userId);
  };
  const cancelRequestByUserId = async (userId: string) => {
    const req = outgoing.find((r) => r.user.id === userId);
    if (req) await cancelRequest(req.id);
  };
  const acceptRequestByUserId = async (userId: string) => {
    const req = incoming.find((r) => r.user.id === userId);
    if (req) await acceptRequest(req.id);
  };

  return (
    <div className="w-full h-full bg-navy-950/70 border-r border-navy-800/60 flex flex-col relative overflow-hidden">
      <div className="h-12 px-4 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between shadow-soft flex-shrink-0">
        <h2 className="text-gray-100 font-semibold text-sm truncate flex-1">
          {t("chat.directMessages")}
        </h2>
        <div className="flex items-center gap-1">
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
              title="Collapse direct messages"
            >
              <svg
                className="w-4 h-4 transition-transform rotate-180"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowAddFriend(true)}
            className="text-gray-400 hover:text-emerald-300 p-1 rounded-md hover:bg-navy-800/60 transition-colors"
            title={t("friends.addFriend")}
          >
            <svg
              className="w-4 h-4"
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
      </div>

      <div className="flex border-b border-navy-800/60 bg-navy-950/40">
        {(
          [
            ["conversations", t("friends.tabs.conversations")],
            ["friends", t("friends.tabs.friends")],
            ["requests", t("friends.tabs.requests")],
          ] as [Tab, string][]
        ).map(([id, label]) => {
          const active = tab === id;
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 text-xs font-semibold uppercase tracking-wider py-2 transition-colors border-b-2 ${
                active
                  ? "text-emerald-200 border-emerald-400"
                  : "text-gray-500 border-transparent hover:text-gray-300"
              }`}
            >
              <span className="inline-flex items-center gap-1.5 justify-center">
                {label}
                {id === "requests" && incomingCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-soft">
                    {incomingCount > 9 ? "9+" : incomingCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 chat-scrollbar">
        {tab === "conversations" && (
          <>
            {conversations.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500 text-center">
                {t("friends.empty.conversations")}
              </div>
            )}
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              const unread = c.unreadCount > 0;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all border border-transparent ${
                    active
                      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft"
                      : unread
                        ? "text-gray-100 font-medium hover:bg-navy-800/50 hover:border-navy-700/60"
                        : "text-gray-400 hover:bg-navy-800/40 hover:text-gray-200 hover:border-navy-700/50"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
                >
                  {c.otherUser?.avatarUrl ? (
                    <img
                      src={c.otherUser.avatarUrl}
                      alt={c.otherUser.username}
                      className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                      {(c.otherUser?.username || "U").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 text-left min-w-0">
                    <div className="truncate">
                      {c.otherUser?.username || "User"}
                    </div>
                    {c.lastMessage && (
                      <div className="text-xs text-gray-500 truncate">
                        {c.lastMessage.content
                          ? c.lastMessage.content
                          : c.lastMessage.hasAttachments
                            ? "📎"
                            : ""}
                      </div>
                    )}
                  </div>
                  {unread && !active && (
                    <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft">
                      {c.unreadCount > 9 ? "9+" : c.unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}

        {tab === "friends" && (
          <>
            {friends.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500 text-center">
                {t("friends.empty.friends")}
              </div>
            )}
            {friends.map((f) => (
              <div
                key={f.friendshipId}
                className="px-2.5 py-2 rounded-lg flex items-center gap-2.5 hover:bg-navy-800/40"
              >
                {f.user.avatarUrl ? (
                  <img
                    src={f.user.avatarUrl}
                    alt={f.user.username}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {f.user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-sm text-gray-100 truncate">
                  {f.user.username}
                </div>
                <button
                  onClick={() => handleMessageFriend(f.user.id)}
                  disabled={busyFriend === f.user.id}
                  className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/90 hover:bg-emerald-500 text-white disabled:opacity-60"
                >
                  {t("friends.actions.message")}
                </button>
                <button
                  onClick={() => handleRemoveFriend(f.user.id)}
                  className="text-xs px-2.5 py-1 rounded-md text-gray-400 hover:text-red-300 border border-navy-800/60"
                  title={t("friends.actions.remove")}
                >
                  ×
                </button>
              </div>
            ))}
          </>
        )}

        {tab === "requests" && (
          <>
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {t("friends.tabs.incoming")}
            </div>
            {incoming.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-500">
                {t("friends.empty.incoming")}
              </div>
            )}
            {incoming.map((r) => (
              <div
                key={r.id}
                className="px-2.5 py-2 rounded-lg flex items-center gap-2.5"
              >
                {r.user.avatarUrl ? (
                  <img
                    src={r.user.avatarUrl}
                    alt={r.user.username}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {r.user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-sm text-gray-100 truncate">
                  {r.user.username}
                </div>
                <button
                  onClick={() => handleAcceptIncoming(r.id)}
                  className="text-xs px-2.5 py-1 rounded-md bg-emerald-500/90 hover:bg-emerald-500 text-white"
                >
                  {t("friends.actions.accept")}
                </button>
                <button
                  onClick={() => handleDeclineIncoming(r.id)}
                  className="text-xs px-2.5 py-1 rounded-md text-gray-400 hover:text-red-300 border border-navy-800/60"
                >
                  {t("friends.actions.decline")}
                </button>
              </div>
            ))}

            <div className="mt-3 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              {t("friends.tabs.outgoing")}
            </div>
            {outgoing.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-500">
                {t("friends.empty.outgoing")}
              </div>
            )}
            {outgoing.map((r) => (
              <div
                key={r.id}
                className="px-2.5 py-2 rounded-lg flex items-center gap-2.5"
              >
                {r.user.avatarUrl ? (
                  <img
                    src={r.user.avatarUrl}
                    alt={r.user.username}
                    className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                    {r.user.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 text-sm text-gray-100 truncate">
                  {r.user.username}
                </div>
                <button
                  onClick={() => handleCancelOutgoing(r.id)}
                  className="text-xs px-2.5 py-1 rounded-md text-gray-400 hover:text-red-300 border border-navy-800/60"
                >
                  {t("friends.actions.cancel")}
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      <AddFriendDialog
        open={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onSearch={search}
        onSendRequest={sendRequestByUserId}
        onCancelRequest={cancelRequestByUserId}
        onAcceptRequest={acceptRequestByUserId}
      />
    </div>
  );
}
