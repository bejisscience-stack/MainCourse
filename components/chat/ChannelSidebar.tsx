"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useActiveProjects } from "@/hooks/useActiveProjects";
import type { Server, ChannelCategory, Channel } from "@/types/server";
import ChannelManagement from "./ChannelManagement";

interface ChannelSidebarProps {
  server: Server | null;
  activeChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  onChannelCreate?: (channel: Omit<Channel, "id">) => Promise<void>;
  onChannelUpdate?: (
    channelId: string,
    updates: Partial<Channel>,
  ) => Promise<void>;
  onChannelDelete?: (channelId: string) => Promise<void>;
  isLecturer?: boolean;
  onCollapse?: () => void;
  getUnreadCount: (channelId: string) => number;
  markAsRead: (channelId: string) => Promise<void>;
  totalUnread: number;
  memberCount?: number;
  onlineCount?: number;
}

type ChannelGroupKind = "learn" | "chat" | "voice";

const isLearningChannel = (channel: Channel) => {
  const name = channel.name.toLowerCase();
  return channel.type === "lectures" || name === "projects";
};

const channelGroupKind = (channel: Channel): ChannelGroupKind => {
  if (isLearningChannel(channel)) return "learn";
  if (channel.type === "voice") return "voice";
  return "chat";
};

// Learning-tile icon (bigger card-style element for lectures/projects)
const LearningTile = ({ channel }: { channel: Channel }) => {
  const isLectures = channel.type === "lectures";
  const tone = isLectures
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/30"
    : "bg-amber-500/15 text-amber-200 border-amber-500/30";

  return (
    <span
      className={`w-7 h-7 rounded-lg border ${tone} flex items-center justify-center flex-shrink-0`}
    >
      {isLectures ? (
        <svg
          className="w-[14px] h-[14px]"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M6 4l14 8-14 8z" />
        </svg>
      ) : (
        <svg
          className="w-[14px] h-[14px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
          />
        </svg>
      )}
    </span>
  );
};

const ChatIcon = ({ type }: { type: string }) => {
  if (type === "voice") {
    return (
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3"
        />
      </svg>
    );
  }
  return <span className="text-gray-500 text-base font-medium">#</span>;
};

export default function ChannelSidebar({
  server,
  activeChannelId,
  onChannelSelect,
  onChannelCreate,
  onChannelUpdate,
  onChannelDelete,
  isLecturer = false,
  onCollapse,
  getUnreadCount,
  markAsRead,
  totalUnread,
  memberCount,
  onlineCount,
}: ChannelSidebarProps) {
  const { t } = useI18n();
  const [showChannelManagement, setShowChannelManagement] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ChannelGroupKind>>(
    () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("collapsedChannelGroups");
        if (stored) {
          try {
            return new Set(JSON.parse(stored) as ChannelGroupKind[]);
          } catch {
            return new Set();
          }
        }
      }
      return new Set();
    },
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "collapsedChannelGroups",
        JSON.stringify([...collapsedGroups]),
      );
    }
  }, [collapsedGroups]);

  const toggleGroup = useCallback((kind: ChannelGroupKind) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const allChannels = useMemo(
    () => server?.channels.flatMap((cat) => cat.channels) || [],
    [server],
  );

  const grouped = useMemo(() => {
    const out: Record<ChannelGroupKind, Channel[]> = {
      learn: [],
      chat: [],
      voice: [],
    };
    for (const ch of allChannels) {
      out[channelGroupKind(ch)].push(ch);
    }
    // Keep lectures before projects inside learn, otherwise preserve order
    out.learn.sort((a, b) => {
      const aLect = a.type === "lectures" ? 0 : 1;
      const bLect = b.type === "lectures" ? 0 : 1;
      if (aLect !== bLect) return aLect - bLect;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
    out.chat.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    out.voice.sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));
    return out;
  }, [allChannels]);

  // Active project for this course (drives quick-facts deadline pill)
  const { projects: activeProjects } = useActiveProjects();
  const courseActiveProject = useMemo(() => {
    if (!server || !activeProjects?.length) return null;
    return (
      activeProjects.find((project) => project.course_id === server.id) || null
    );
  }, [server, activeProjects]);

  const daysLeft = useMemo(() => {
    if (!courseActiveProject?.end_date) return null;
    const end = new Date(courseActiveProject.end_date);
    const now = new Date();
    const msPerDay = 86400000;
    const diff = Math.ceil((end.getTime() - now.getTime()) / msPerDay);
    return diff > 0 ? diff : null;
  }, [courseActiveProject]);

  const handleChannelClick = useCallback(
    (channelId: string) => {
      onChannelSelect(channelId);
      setTimeout(() => markAsRead(channelId), 200);
    },
    [onChannelSelect, markAsRead],
  );

  if (!server) {
    return (
      <div className="w-full h-full bg-navy-950/70 flex flex-col">
        <div className="p-4 border-b border-navy-800/60">
          <h2 className="text-gray-100 font-semibold">Select a course</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No course selected
        </div>
      </div>
    );
  }

  const groupLabel: Record<ChannelGroupKind, string> = {
    learn: t("chat.learningGroup"),
    chat: t("chat.conversationGroup"),
    voice: t("chat.voiceGroup"),
  };

  const groupOrder: ChannelGroupKind[] = ["learn", "chat", "voice"];

  return (
    <div className="w-full h-full bg-navy-950/70 border-r border-navy-800/60 flex flex-col relative overflow-hidden">
      {/* Course quick-facts header */}
      <div className="px-4 py-3.5 border-b border-navy-800/60 bg-navy-950/60 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
              {t("chat.courseLabel")}
            </div>
            <h2 className="text-gray-100 font-semibold text-[15px] mt-1 truncate">
              {server.name}
            </h2>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {totalUnread > 0 && (
              <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft">
                {totalUnread > 9 ? "9+" : totalUnread}
              </span>
            )}
            {onCollapse && (
              <button
                onClick={onCollapse}
                className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
                title="Collapse channels"
              >
                <svg
                  className="w-4 h-4 rotate-180"
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
            {isLecturer && (
              <button
                onClick={() => setShowChannelManagement(true)}
                className="text-gray-400 hover:text-emerald-300 p-1 rounded-md hover:bg-navy-800/60 transition-colors"
                title="Manage Channels"
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
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        {(memberCount != null || daysLeft != null) && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {memberCount != null && memberCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-navy-900/60 border border-navy-800/60 text-gray-300">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  />
                </svg>
                {memberCount}
              </span>
            )}
            {onlineCount != null && onlineCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {onlineCount}
              </span>
            )}
            {daysLeft != null && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] bg-amber-500/10 border border-amber-500/30 text-amber-200">
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"
                  />
                </svg>
                {t("chat.daysLeft", { days: daysLeft })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 chat-scrollbar">
        {groupOrder.map((kind) => {
          const items = grouped[kind];
          if (items.length === 0) return null;
          const isCollapsed = collapsedGroups.has(kind);
          const groupUnread = items.reduce(
            (sum, ch) => sum + getUnreadCount(ch.id),
            0,
          );
          const isLearn = kind === "learn";

          return (
            <div key={kind} className="mb-4">
              <button
                onClick={() => toggleGroup(kind)}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 text-gray-500 hover:text-emerald-300 font-mono text-[10px] uppercase tracking-[0.14em] group"
              >
                <svg
                  className={`w-3 h-3 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>{groupLabel[kind]}</span>
                <span className="flex-1 h-px bg-navy-800/60 ml-2" />
                {isCollapsed && groupUnread > 0 && (
                  <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-soft">
                    {groupUnread > 9 ? "9+" : groupUnread}
                  </span>
                )}
              </button>

              {!isCollapsed && (
                <div
                  className={isLearn ? "space-y-1 mt-1.5" : "space-y-0.5 mt-1"}
                >
                  {items.map((channel) => {
                    const isActive = activeChannelId === channel.id;
                    const unreadCount = getUnreadCount(channel.id);
                    const hasUnread = unreadCount > 0;

                    const basePadding = isLearn
                      ? "px-2.5 py-2.5"
                      : "px-2.5 py-2";
                    const baseBg = isLearn
                      ? "bg-navy-900/40 border-navy-800/70"
                      : "border-transparent";

                    return (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        className={`w-full flex items-center gap-2.5 ${basePadding} rounded-lg text-sm transition-all border ${
                          isActive
                            ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft"
                            : hasUnread
                              ? `text-gray-100 font-medium hover:bg-navy-800/50 hover:border-navy-700/60 ${baseBg}`
                              : `text-gray-400 hover:bg-navy-800/40 hover:text-gray-200 hover:border-navy-700/50 ${baseBg}`
                        } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
                      >
                        {isLearn ? (
                          <LearningTile channel={channel} />
                        ) : (
                          <ChatIcon type={channel.type} />
                        )}
                        <div className="flex-1 min-w-0 text-left">
                          <div
                            className={`truncate ${
                              isActive || hasUnread
                                ? "font-semibold"
                                : "font-medium"
                            }`}
                          >
                            {channel.name}
                          </div>
                          {isLearn && channel.description && (
                            <div className="font-mono text-[10px] text-gray-500 truncate mt-0.5">
                              {channel.description}
                            </div>
                          )}
                        </div>

                        {hasUnread && !isActive && (
                          <span className="bg-emerald-500/20 text-emerald-200 text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center border border-emerald-500/30">
                            {unreadCount > 9 ? "9+" : unreadCount}
                          </span>
                        )}

                        {isActive && (
                          <span className="w-[3px] h-4 rounded-full bg-emerald-400 flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showChannelManagement &&
        server &&
        onChannelCreate &&
        onChannelUpdate &&
        onChannelDelete && (
          <div
            className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowChannelManagement(false)}
          >
            <div
              className="w-full max-w-3xl max-h-[90vh] bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl overflow-hidden"
              onClick={(event) => event.stopPropagation()}
            >
              <ChannelManagement
                courseId={server.id}
                channels={allChannels}
                onChannelCreate={onChannelCreate}
                onChannelUpdate={onChannelUpdate}
                onChannelDelete={onChannelDelete}
                onClose={() => setShowChannelManagement(false)}
              />
            </div>
          </div>
        )}
    </div>
  );
}
