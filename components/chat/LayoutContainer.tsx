"use client";

import { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import ServerSidebar from "./ServerSidebar";
import ChannelSidebar from "./ChannelSidebar";
import ChatArea from "./ChatArea";
import ChatErrorBoundary from "./ChatErrorBoundary";
import DMSection from "./DMSection";
import AddFriendDialog from "./AddFriendDialog";
import FriendRequestsDialog from "./FriendRequestsDialog";
import { useActiveServer } from "@/hooks/useActiveServer";
import { useActiveChannel } from "@/hooks/useActiveChannel";
import { useUser } from "@/hooks/useUser";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { useFriends } from "@/hooks/useFriends";
import { useFriendRequests } from "@/hooks/useFriendRequests";
import { useDMChannels } from "@/hooks/useDMChannels";
import type { Server, Channel } from "@/types/server";
import type { EnrollmentInfo } from "@/hooks/useEnrollments";

interface LayoutContainerProps {
  servers: Server[];
  currentUserId: string;
  isLecturer?: boolean;
  enrolledCourseIds?: Set<string>;
  onAddCourse?: () => void;
  onSendMessage?: (channelId: string, content: string | null) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onChannelCreate?: (channel: Omit<Channel, "id">) => Promise<void>;
  onChannelUpdate?: (
    channelId: string,
    updates: Partial<Channel>,
  ) => Promise<void>;
  onChannelDelete?: (channelId: string) => Promise<void>;
  showDMButton?: boolean;
  isEnrolledInCourse?: boolean;
  enrollmentInfo?: EnrollmentInfo | null;
  onReEnrollRequest?: () => void;
  initialChannelName?: string;
}

export default function LayoutContainer({
  servers,
  currentUserId,
  isLecturer = false,
  enrolledCourseIds = new Set(),
  onAddCourse,
  onSendMessage,
  onReaction,
  onChannelCreate,
  onChannelUpdate,
  onChannelDelete,
  showDMButton = true,
  isEnrolledInCourse = false,
  enrollmentInfo = null,
  onReEnrollRequest,
  initialChannelName,
}: LayoutContainerProps) {
  const [activeServerId, setActiveServerId] = useActiveServer();
  const [activeChannelId, setActiveChannelId] = useActiveChannel();
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDMChannelId, setActiveDMChannelId] = useState<string | null>(
    null,
  );
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const { user, profile } = useUser();
  const { t } = useI18n();

  // DM & Friends hooks
  const { friends, refetch: refetchFriends } = useFriends();
  const {
    incoming: incomingRequests,
    outgoing: outgoingRequests,
    pendingCount,
    sendRequest,
    acceptRequest,
    rejectRequest,
    isLoading: requestsLoading,
    refetch: refetchRequests,
  } = useFriendRequests();
  const {
    channels: dmChannels,
    totalUnread: dmTotalUnread,
    openOrCreateChannel,
    refetch: refetchDMChannels,
  } = useDMChannels();

  // Derive username and avatar from useUser() profile
  const userName =
    profile?.username?.trim() ||
    user?.user_metadata?.username?.trim() ||
    user?.email?.split("@")[0] ||
    "User";
  const userAvatarUrl = profile?.avatar_url || null;

  // Unread messages: single hook for all channels across all servers
  const allChannelIds = useMemo(() => {
    return servers.flatMap((s) =>
      s.channels.flatMap((cat) => cat.channels.map((ch) => ch.id)),
    );
  }, [servers]);

  const { getUnreadCount, markAsRead, totalUnread } = useUnreadMessages({
    channelIds: allChannelIds,
    enabled: servers.length > 0,
  });

  // Aggregate unread counts per server/course for ServerSidebar badges
  const serverUnreadCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const server of servers) {
      let total = 0;
      for (const cat of server.channels) {
        for (const ch of cat.channels) {
          total += getUnreadCount(ch.id);
        }
      }
      counts.set(server.id, total);
    }
    return counts;
  }, [servers, getUnreadCount]);

  // Per-active-server total for ChannelSidebar header badge
  const activeServerTotalUnread = useMemo(() => {
    if (!activeServerId || activeServerId === "home") return 0;
    return serverUnreadCounts.get(activeServerId) || 0;
  }, [activeServerId, serverUnreadCounts]);

  const activeServer =
    activeServerId && activeServerId !== "home"
      ? servers.find((s) => s.id === activeServerId) || null
      : null;
  const activeChannel =
    activeServer?.channels
      .flatMap((cat) => cat.channels)
      .find((ch) => ch.id === activeChannelId) || null;

  // Check if we're in DM mode (home)
  const isDMMode = activeServerId === "home";

  const [hasAppliedInitialChannel, setHasAppliedInitialChannel] =
    useState(false);

  // Auto-select channel from URL param (e.g., ?channel=projects)
  useEffect(() => {
    if (initialChannelName && activeServer && !hasAppliedInitialChannel) {
      const allChannels = activeServer.channels.flatMap((cat) => cat.channels);
      const targetChannel = allChannels.find(
        (ch) => ch.name.toLowerCase() === initialChannelName.toLowerCase(),
      );
      if (targetChannel) {
        setActiveChannelId(targetChannel.id);
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
      // Always mark applied (even if not found → fallback to default)
      setHasAppliedInitialChannel(true);
    }
  }, [
    initialChannelName,
    activeServer,
    hasAppliedInitialChannel,
    setActiveChannelId,
  ]);

  // Auto-select first server and channel if none selected (but not if DM is selected)
  useEffect(() => {
    if (!activeServerId && servers.length > 0) {
      setActiveServerId(servers[0].id);
    }
  }, [activeServerId, servers, setActiveServerId]);

  useEffect(() => {
    if (initialChannelName && !hasAppliedInitialChannel) return;
    if (activeServer && !activeChannelId && activeServer.channels.length > 0) {
      // Prefer lectures channel first, then text channels
      const allChannels = activeServer.channels.flatMap((cat) => cat.channels);
      if (allChannels.length > 0) {
        const lecturesChannel = allChannels.find(
          (ch) => ch.type === "lectures",
        );
        const textChannel = allChannels.find((ch) => ch.type === "text");
        const firstChannel = lecturesChannel || textChannel || allChannels[0];
        if (firstChannel) {
          setActiveChannelId(firstChannel.id);
        }
      }
    }
  }, [
    activeServer,
    activeChannelId,
    initialChannelName,
    hasAppliedInitialChannel,
    setActiveChannelId,
  ]);

  const handleServerSelect = (serverId: string) => {
    const newServer = servers.find((s) => s.id === serverId);
    setActiveServerId(serverId);

    // Clear DM selection when switching to a course server
    if (serverId !== "home") {
      setActiveDMChannelId(null);
    }

    // Try to find a matching channel in the new server before clearing
    if (newServer && activeChannelId) {
      const allChannels = newServer.channels.flatMap((cat) => cat.channels);
      const matchingChannel = allChannels.find(
        (ch) => ch.id === activeChannelId,
      );
      if (matchingChannel) {
        // Keep the same channel if it exists in the new server
        return;
      }
    }

    // Reset channel selection only if no matching channel found
    // The useEffect below will auto-select a channel
    setActiveChannelId(null);
  };

  const handleChannelSelect = (channelId: string) => {
    setActiveChannelId(channelId);
    setActiveDMChannelId(null); // Clear DM selection when selecting a course channel
    if (window.innerWidth < 768) {
      setMobileMenuOpen(false);
    }
  };

  const handleDMSelect = (dmChannelId: string) => {
    setActiveDMChannelId(dmChannelId);
    setActiveChannelId(null); // Clear course channel when selecting DM
    if (window.innerWidth < 768) {
      setMobileMenuOpen(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    await acceptRequest(requestId);
    refetchFriends();
  };

  const handleRejectRequest = async (requestId: string) => {
    await rejectRequest(requestId);
  };

  // Find the active DM channel's other user info for ChatArea
  const activeDMChannel = dmChannels.find((c) => c.id === activeDMChannelId);

  return (
    <div className="flex w-full h-full bg-navy-950/40 backdrop-blur-sm text-white overflow-hidden relative">
      {/* Mobile Menu Overlay / Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Container (Responsive) */}
      <div
        className={`
        fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:transform-none"}
      `}
      >
        {/* Server sidebar */}
        <ServerSidebar
          servers={servers}
          activeServerId={activeServerId}
          onServerSelect={handleServerSelect}
          onAddCourse={onAddCourse}
          isLecturer={isLecturer}
          enrolledCourseIds={enrolledCourseIds}
          showDMButton={showDMButton}
          serverUnreadCounts={serverUnreadCounts}
          dmUnreadCount={dmTotalUnread}
        />

        {/* DM Mode Sidebar */}
        {isDMMode && (
          <div className="w-60 bg-navy-950/95 md:bg-navy-950/70 border-r border-navy-800/60 flex flex-col h-full shadow-2xl md:shadow-none">
            {/* DM Header */}
            <div className="h-12 px-4 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between shadow-soft flex-shrink-0">
              <h2 className="text-gray-100 font-semibold text-sm">
                Direct Messages
              </h2>
              {dmTotalUnread > 0 && (
                <span className="bg-red-500 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft">
                  {dmTotalUnread > 9 ? "9+" : dmTotalUnread}
                </span>
              )}
            </div>

            {/* Friends + DM content */}
            <div className="flex-1 overflow-y-auto px-2.5 py-3 chat-scrollbar">
              <DMSection
                channels={dmChannels}
                activeDMChannelId={activeDMChannelId}
                onDMSelect={handleDMSelect}
                onOpenAddFriend={() => setShowAddFriend(true)}
                pendingRequestCount={pendingCount}
                onOpenFriendRequests={() => setShowFriendRequests(true)}
                totalUnread={dmTotalUnread}
              />
            </div>

            {/* User profile footer */}
            <div className="h-14 bg-navy-950/80 px-2 py-2 flex items-center gap-2 border-t border-navy-800/60 flex-shrink-0 mt-auto">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shadow-soft"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold shadow-soft">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-gray-100 text-sm font-medium truncate">
                  {userName || "User"}
                </div>
                <div className="text-emerald-300 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  {t("chat.online")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Channels Sidebar Container */}
        {!isDMMode && activeServer && (
          <div className="w-60 bg-navy-950/95 md:bg-navy-950/70 border-r border-navy-800/60 flex flex-col h-full shadow-2xl md:shadow-none">
            {/* Channels Section */}
            <div
              className={`flex flex-col transition-all ${channelsCollapsed ? "flex-shrink-0" : "flex-1 min-h-0"}`}
            >
              {/* Channels Header with Collapse Button - shown when collapsed */}
              {channelsCollapsed ? (
                <div className="h-12 px-4 border-b border-navy-800/60 flex items-center justify-between bg-navy-950/60 flex-shrink-0">
                  <span className="text-gray-400 text-xs font-semibold tracking-wider">
                    CHANNELS
                  </span>
                  <button
                    onClick={() => setChannelsCollapsed(!channelsCollapsed)}
                    className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
                    title="Expand channels"
                  >
                    <svg
                      className="w-4 h-4 transition-transform"
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
                </div>
              ) : (
                <div className="flex-1 overflow-hidden min-h-0">
                  <ChannelSidebar
                    server={activeServer}
                    activeChannelId={activeChannelId}
                    onChannelSelect={handleChannelSelect}
                    onChannelCreate={onChannelCreate}
                    onChannelUpdate={onChannelUpdate}
                    onChannelDelete={onChannelDelete}
                    isLecturer={isLecturer}
                    onCollapse={() => setChannelsCollapsed(true)}
                    getUnreadCount={getUnreadCount}
                    markAsRead={markAsRead}
                    totalUnread={activeServerTotalUnread}
                  />
                </div>
              )}
            </div>

            {/* DM Section - below channels */}
            <div className="border-t border-navy-800/60 mt-2 pt-2 flex-shrink-0">
              <DMSection
                channels={dmChannels}
                activeDMChannelId={activeDMChannelId}
                onDMSelect={handleDMSelect}
                onOpenAddFriend={() => setShowAddFriend(true)}
                pendingRequestCount={pendingCount}
                onOpenFriendRequests={() => setShowFriendRequests(true)}
                totalUnread={dmTotalUnread}
              />
            </div>

            {/* User profile footer - at the very bottom */}
            <div className="h-14 bg-navy-950/80 px-2 py-2 flex items-center gap-2 border-t border-navy-800/60 flex-shrink-0 mt-auto">
              {userAvatarUrl ? (
                <img
                  src={userAvatarUrl}
                  alt={userName}
                  className="w-8 h-8 rounded-full object-cover shadow-soft"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold shadow-soft">
                  {userName ? userName.charAt(0).toUpperCase() : "U"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-gray-100 text-sm font-medium truncate">
                  {userName || "User"}
                </div>
                <div className="text-emerald-300 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  {t("chat.online")}
                </div>
              </div>
              <div className="flex gap-0.5">
                <button className="h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-200 rounded-lg border border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 transition-colors">
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
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </button>
                <button className="h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-200 rounded-lg border border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 transition-colors">
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat area */}
      <ChatErrorBoundary>
        <ChatArea
          channel={activeDMChannelId ? null : activeChannel}
          currentUserId={currentUserId}
          isLecturer={isLecturer}
          onSendMessage={onSendMessage || (() => {})}
          onReaction={onReaction}
          isEnrolledInCourse={isEnrolledInCourse}
          enrollmentInfo={enrollmentInfo}
          onReEnrollRequest={onReEnrollRequest}
          onMobileMenuClick={() => setMobileMenuOpen(true)}
          dmChannelId={activeDMChannelId}
          dmOtherUser={activeDMChannel?.otherUser || null}
        />
      </ChatErrorBoundary>

      {/* Friend Dialogs */}
      <AddFriendDialog
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onSendRequest={async (userId) => {
          await sendRequest(userId);
        }}
        currentUserId={currentUserId}
        existingFriendIds={friends.map((f) => f.id)}
      />
      <FriendRequestsDialog
        isOpen={showFriendRequests}
        onClose={() => setShowFriendRequests(false)}
        incoming={incomingRequests}
        outgoing={outgoingRequests}
        onAccept={handleAcceptRequest}
        onReject={handleRejectRequest}
        isLoading={requestsLoading}
      />
    </div>
  );
}
