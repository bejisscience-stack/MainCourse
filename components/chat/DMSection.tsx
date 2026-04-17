"use client";

import { useState, useEffect } from "react";
import type { DMChannel } from "@/types/dm";
import type { Friend } from "@/types/dm";

interface DMSectionProps {
  channels: DMChannel[];
  friends: Friend[];
  activeDMChannelId: string | null;
  onDMSelect: (channelId: string) => void;
  onSelectFriend: (friendId: string) => void;
  onOpenAddFriend: () => void;
  pendingRequestCount: number;
  onOpenFriendRequests: () => void;
  totalUnread: number;
}

export default function DMSection({
  channels,
  friends,
  activeDMChannelId,
  onDMSelect,
  onSelectFriend,
  onOpenAddFriend,
  pendingRequestCount,
  onOpenFriendRequests,
  totalUnread,
}: DMSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("dmSectionCollapsed") === "true";
    }
    return false;
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("dmSectionCollapsed", String(isCollapsed));
    }
  }, [isCollapsed]);

  return (
    <div>
      {/* Section header */}
      <div className="w-full flex items-center justify-between px-3 py-1.5 text-gray-500 hover:text-emerald-300 text-[11px] font-semibold uppercase tracking-wider group cursor-pointer">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex-1 flex items-center gap-1 text-left"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="truncate">Direct Messages</span>
          {isCollapsed && totalUnread > 0 && (
            <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-auto shadow-soft">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </button>
        <div className="flex items-center gap-0.5">
          {/* Friend requests button with badge */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenFriendRequests();
            }}
            className="relative opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-300 p-0.5 rounded-md hover:bg-navy-800/60"
            title="Friend Requests"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            {pendingRequestCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full">
                {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
              </span>
            )}
          </button>
          {/* Always show friend requests badge when has pending, even when not hovering */}
          {pendingRequestCount > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenFriendRequests();
              }}
              className="group-hover:hidden text-gray-400 hover:text-emerald-300 p-0.5 rounded-md hover:bg-navy-800/60 relative"
              title="Friend Requests"
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
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold min-w-[14px] h-[14px] flex items-center justify-center rounded-full">
                {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
              </span>
            </button>
          )}
          {/* Add friend button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenAddFriend();
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-300 p-0.5 rounded-md hover:bg-navy-800/60"
            title="Add Friend"
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* DM channels list */}
      {!isCollapsed && (
        <div className="space-y-0.5 px-1">
          {friends.length > 0 && (
            <div className="mb-2">
              <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-gray-500">
                Friends
              </div>
              <div className="space-y-0.5">
                {friends.map((friend) => (
                  <button
                    key={friend.id}
                    onClick={() => onSelectFriend(friend.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-300 hover:bg-navy-800/40 hover:text-gray-100 transition-all border border-transparent hover:border-navy-700/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
                  >
                    <div className="w-7 h-7 rounded-full bg-navy-900/70 border border-navy-800/60 flex items-center justify-center text-[10px] font-semibold text-emerald-200 overflow-hidden flex-shrink-0">
                      {friend.avatarUrl ? (
                        <img
                          src={friend.avatarUrl}
                          alt={friend.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        friend.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="truncate text-sm">{friend.username}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {channels.length === 0 ? (
            <div className="px-3 py-3 text-center">
              <p className="text-gray-500 text-xs mb-2">No conversations yet</p>
              <button
                onClick={onOpenAddFriend}
                className="text-emerald-400 hover:text-emerald-300 text-xs font-medium"
              >
                Add a friend to start chatting
              </button>
            </div>
          ) : (
            channels.map((channel) => {
              const isActive = activeDMChannelId === channel.id;
              const hasUnread = channel.unreadCount > 0;

              return (
                <button
                  key={channel.id}
                  onClick={() => onDMSelect(channel.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all group/dm border border-transparent ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft"
                      : hasUnread
                        ? "text-gray-100 font-medium hover:bg-navy-800/50 hover:border-navy-700/60"
                        : "text-gray-400 hover:bg-navy-800/40 hover:text-gray-200 hover:border-navy-700/50"
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
                >
                  {/* Avatar */}
                  <div className="relative w-7 h-7 rounded-full bg-navy-900/70 border border-navy-800/60 flex items-center justify-center text-[10px] font-semibold text-emerald-200 overflow-hidden flex-shrink-0">
                    {channel.otherUser.avatarUrl ? (
                      <img
                        src={channel.otherUser.avatarUrl}
                        alt={channel.otherUser.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      channel.otherUser.username.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Name + last message */}
                  <div className="flex-1 min-w-0 text-left">
                    <div
                      className={`truncate text-sm ${hasUnread && !isActive ? "font-semibold text-gray-100" : ""}`}
                    >
                      {channel.otherUser.username}
                    </div>
                    {channel.lastMessage && (
                      <div className="text-[11px] text-gray-500 truncate">
                        {channel.lastMessage.content || "Attachment"}
                      </div>
                    )}
                  </div>

                  {/* Unread badge */}
                  {hasUnread && !isActive && (
                    <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft flex-shrink-0">
                      {channel.unreadCount > 9 ? "9+" : channel.unreadCount}
                    </span>
                  )}

                  {/* Active indicator */}
                  {isActive && (
                    <div className="w-1 h-4 bg-emerald-400 rounded-full flex-shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
