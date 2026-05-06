"use client";

import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  MessageCircle,
  Paperclip,
  Plus,
  UserPlus,
  X,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useFriends } from "@/hooks/useFriends";
import type { DirectConversation } from "@/types/direct-message";
import type { User } from "@/types/member";
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

const tabItems: Tab[] = ["conversations", "friends", "requests"];

const getInitial = (username?: string | null) =>
  (username?.trim().charAt(0) || "U").toUpperCase();

function UserAvatar({
  user,
  size = "md",
}: {
  user: Pick<User, "username" | "avatarUrl"> | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "md" ? "h-8 w-8" : "h-7 w-7";
  const textClass = size === "md" ? "text-xs" : "text-[11px]";
  const username = user?.username || "User";

  if (user?.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={username}
        className={`${sizeClass} flex-shrink-0 rounded-full object-cover shadow-soft ring-1 ring-navy-700/70`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} ${textClass} flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 font-semibold text-white shadow-soft ring-1 ring-emerald-300/30`}
    >
      {getInitial(username)}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="mx-1 my-3 rounded-xl border border-dashed border-navy-800/70 bg-navy-900/20 px-3 py-4 text-center text-xs leading-5 text-gray-500">
      {children}
    </div>
  );
}

function SectionHeading({
  children,
  count,
  className = "",
}: {
  children: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between px-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 ${className}`}
    >
      <span className="truncate">{children}</span>
      {count ? (
        <span className="ml-2 rounded-full bg-navy-800/80 px-1.5 py-0.5 text-[10px] text-gray-300">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </div>
  );
}

type ActionTone = "primary" | "success" | "danger" | "muted";

function IconActionButton({
  label,
  tone = "muted",
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  tone?: ActionTone;
  children: ReactNode;
}) {
  const toneClass = {
    primary:
      "border-emerald-400/40 bg-emerald-500/90 text-white hover:bg-emerald-500 shadow-soft",
    success:
      "border-emerald-400/30 bg-emerald-500/15 text-emerald-200 hover:border-emerald-300/50 hover:bg-emerald-500/25 hover:text-white",
    danger:
      "border-navy-800/70 bg-navy-900/50 text-gray-400 hover:border-red-400/40 hover:bg-red-500/10 hover:text-red-200",
    muted:
      "border-navy-800/70 bg-navy-900/50 text-gray-400 hover:border-navy-700/80 hover:bg-navy-800/70 hover:text-gray-100",
  }[tone];

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border transition-all disabled:cursor-wait disabled:opacity-55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40 ${toneClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
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
        <h2 className="text-gray-100 font-semibold text-sm truncate flex-1 pr-2">
          {t("chat.directMessages")}
        </h2>
        <div className="flex items-center gap-1">
          {totalUnread > 0 && (
            <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
          {onCollapse && (
            <IconActionButton
              label="Collapse direct messages"
              onClick={onCollapse}
              className="h-7 w-7 border-transparent bg-transparent"
            >
              <ChevronDown className="h-4 w-4 rotate-180" />
            </IconActionButton>
          )}
          <IconActionButton
            label={t("friends.addFriend")}
            onClick={() => setShowAddFriend(true)}
            className="h-7 w-7 border-transparent bg-transparent"
          >
            <Plus className="h-4 w-4" />
          </IconActionButton>
        </div>
      </div>

      <div className="border-b border-navy-800/60 bg-navy-950/45 p-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-navy-800/60 bg-navy-900/30 p-1">
          {tabItems.map((id) => {
            const label = t(`friends.tabs.${id}`);
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`min-w-0 rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-emerald-500/15 text-emerald-200 shadow-soft"
                    : "text-gray-500 hover:bg-navy-800/50 hover:text-gray-300"
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
              >
                <span className="inline-flex max-w-full items-center justify-center gap-1">
                  <span className="truncate">{label}</span>
                  {id === "requests" && incomingCount > 0 && (
                    <span className="min-w-[16px] rounded-full bg-red-500 px-1 py-0.5 text-center text-[9px] font-semibold text-white shadow-soft">
                      {incomingCount > 9 ? "9+" : incomingCount}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 py-3 chat-scrollbar">
        {tab === "conversations" && (
          <div className="space-y-1">
            {conversations.length === 0 && (
              <EmptyState>
                {t("friends.empty.conversations")}
              </EmptyState>
            )}
            {conversations.map((c) => {
              const active = c.id === activeConversationId;
              const unread = c.unreadCount > 0;
              return (
                <button
                  key={c.id}
                  onClick={() => onSelectConversation(c.id)}
                  className={`relative w-full overflow-hidden rounded-xl border px-2.5 py-2 text-sm transition-all ${
                    active
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 shadow-soft"
                      : unread
                        ? "border-navy-700/60 bg-navy-900/30 font-medium text-gray-100 hover:bg-navy-800/50"
                        : "border-transparent text-gray-400 hover:border-navy-700/50 hover:bg-navy-800/40 hover:text-gray-200"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
                >
                  <div className="flex items-center gap-2.5">
                    <UserAvatar user={c.otherUser} />
                    <div className="min-w-0 flex-1 text-left">
                      <div className="truncate font-medium">
                        {c.otherUser?.username || "User"}
                      </div>
                      {c.lastMessage && (
                        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs text-gray-500">
                          {c.lastMessage.content ? (
                            <span className="truncate">
                              {c.lastMessage.content}
                            </span>
                          ) : c.lastMessage.hasAttachments ? (
                            <Paperclip className="h-3.5 w-3.5" />
                          ) : null}
                        </div>
                      )}
                    </div>
                    {unread && !active && (
                      <span className="min-w-[20px] rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[11px] font-semibold text-white shadow-soft">
                        {c.unreadCount > 9 ? "9+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                  {active && (
                    <span className="absolute right-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-emerald-300" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {tab === "friends" && (
          <div className="space-y-1.5">
            {friends.length === 0 && (
              <EmptyState>{t("friends.empty.friends")}</EmptyState>
            )}
            {friends.map((f) => (
              <div
                key={f.friendshipId}
                className="group flex items-center gap-2.5 rounded-xl border border-navy-800/45 bg-navy-900/20 px-2.5 py-2 shadow-soft transition-all hover:border-navy-700/70 hover:bg-navy-800/40"
              >
                <UserAvatar user={f.user} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-gray-100">
                    {f.user.username}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t("friends.status.friends")}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <IconActionButton
                    label={t("friends.actions.message")}
                    tone="primary"
                    onClick={() => handleMessageFriend(f.user.id)}
                    disabled={busyFriend === f.user.id}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </IconActionButton>
                  <IconActionButton
                    label={t("friends.actions.remove")}
                    tone="danger"
                    onClick={() => handleRemoveFriend(f.user.id)}
                  >
                    <X className="h-4 w-4" />
                  </IconActionButton>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "requests" && (
          <div className="space-y-3">
            <section className="space-y-1.5">
              <SectionHeading count={incoming.length}>
                {t("friends.tabs.incoming")}
              </SectionHeading>
              {incoming.length === 0 && (
                <EmptyState>{t("friends.empty.incoming")}</EmptyState>
              )}
              {incoming.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 shadow-soft transition-all hover:border-emerald-400/35 hover:bg-emerald-500/15"
                >
                  <UserAvatar user={r.user} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-100">
                      {r.user.username}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                      <UserPlus className="h-3 w-3" />
                      {t("friends.status.pendingIn")}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconActionButton
                      label={t("friends.actions.accept")}
                      tone="success"
                      onClick={() => handleAcceptIncoming(r.id)}
                    >
                      <Check className="h-4 w-4" />
                    </IconActionButton>
                    <IconActionButton
                      label={t("friends.actions.decline")}
                      tone="danger"
                      onClick={() => handleDeclineIncoming(r.id)}
                    >
                      <X className="h-4 w-4" />
                    </IconActionButton>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-1.5">
              <SectionHeading count={outgoing.length}>
                {t("friends.tabs.outgoing")}
              </SectionHeading>
              {outgoing.length === 0 && (
                <EmptyState>{t("friends.empty.outgoing")}</EmptyState>
              )}
              {outgoing.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2.5 rounded-xl border border-navy-800/45 bg-navy-900/20 px-2.5 py-2 shadow-soft transition-all hover:border-navy-700/70 hover:bg-navy-800/40"
                >
                  <UserAvatar user={r.user} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-gray-100">
                      {r.user.username}
                    </div>
                    <div className="mt-0.5 text-[11px] text-gray-500">
                      {t("friends.status.pendingOut")}
                    </div>
                  </div>
                  <IconActionButton
                    label={t("friends.actions.cancel")}
                    tone="danger"
                    onClick={() => handleCancelOutgoing(r.id)}
                  >
                    <X className="h-4 w-4" />
                  </IconActionButton>
                </div>
              ))}
            </section>
          </div>
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
