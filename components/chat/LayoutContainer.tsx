'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import DMSidebar from './DMSidebar';
import DMChatArea from './DMChatArea';
import AddFriendDialog from './AddFriendDialog';
import ChatErrorBoundary from './ChatErrorBoundary';
import { useActiveServer } from '@/hooks/useActiveServer';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useUser } from '@/hooks/useUser';
import { supabase } from '@/lib/supabase';
import type { Server, Channel } from '@/types/server';
import type { EnrollmentInfo } from '@/hooks/useEnrollments';

interface LayoutContainerProps {
  servers: Server[];
  currentUserId: string;
  isLecturer?: boolean;
  enrolledCourseIds?: Set<string>;
  onAddCourse?: () => void;
  onSendMessage?: (channelId: string, content: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onChannelCreate?: (channel: Omit<Channel, 'id'>) => Promise<void>;
  onChannelUpdate?: (channelId: string, updates: Partial<Channel>) => Promise<void>;
  onChannelDelete?: (channelId: string) => Promise<void>;
  showDMButton?: boolean;
  isEnrollmentExpired?: boolean;
  enrollmentInfo?: EnrollmentInfo | null;
  onReEnrollRequest?: () => void;
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
  isEnrollmentExpired = false,
  enrollmentInfo = null,
  onReEnrollRequest,
}: LayoutContainerProps) {
  const [activeServerId, setActiveServerId] = useActiveServer();
  const [activeChannelId, setActiveChannelId] = useActiveChannel();
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // Mobile menu state
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeFriendUsername, setActiveFriendUsername] = useState<string>('');
  const [showAddFriendDialog, setShowAddFriendDialog] = useState(false);
  const { user } = useUser();
  const { t } = useI18n();

  const activeServer = activeServerId && activeServerId !== 'home'
    ? servers.find((s) => s.id === activeServerId) || null
    : null;
  const activeChannel =
    activeServer?.channels
      .flatMap((cat) => cat.channels)
      .find((ch) => ch.id === activeChannelId) || null;

  // Check if we're in DM mode (home)
  const isDMMode = activeServerId === 'home';

  // Load current user's username
  useEffect(() => {
    const loadUserName = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', user.id)
          .single();

        // Always use profiles.username (required field in database)
        // Fallback to metadata/email only if profile doesn't exist (shouldn't happen)
        const profileUsername = profile?.username?.trim();

        if (profileUsername && profileUsername.length > 0) {
          setUserName(profileUsername);
        } else {
          // Fallback only if profile doesn't exist (shouldn't happen in normal flow)
          const metadataUsername = user.user_metadata?.username?.trim();
          const emailUsername = user.email?.split('@')[0];

          if (metadataUsername && metadataUsername.length > 0) {
            setUserName(metadataUsername);
          } else if (emailUsername && emailUsername.length > 0) {
            setUserName(emailUsername);
          } else {
            setUserName('User');
          }
        }
      } catch (error) {
        console.error('Error loading username:', error);
        setUserName('User');
      }
    };

    loadUserName();
  }, [user]);

  // Auto-select first server and channel if none selected (but not if DM is selected)
  useEffect(() => {
    if (!activeServerId && servers.length > 0) {
      setActiveServerId(servers[0].id);
    }
  }, [activeServerId, servers, setActiveServerId]);

  useEffect(() => {
    if (activeServer && !activeChannelId && activeServer.channels.length > 0) {
      // Prefer lectures channel first, then text channels
      const allChannels = activeServer.channels.flatMap((cat) => cat.channels);
      if (allChannels.length > 0) {
        const lecturesChannel = allChannels.find((ch) => ch.type === 'lectures');
        const textChannel = allChannels.find((ch) => ch.type === 'text');
        const firstChannel = lecturesChannel || textChannel || allChannels[0];
        if (firstChannel) {
          setActiveChannelId(firstChannel.id);
        }
      }
    }
  }, [activeServer, activeChannelId, setActiveChannelId]);

  const handleServerSelect = (serverId: string) => {
    const newServer = servers.find((s) => s.id === serverId);
    setActiveServerId(serverId);

    // Clear DM state when leaving DM mode
    if (serverId !== 'home') {
      setActiveConversationId(null);
      setActiveFriendUsername('');
    }

    // Try to find a matching channel in the new server before clearing
    if (newServer && activeChannelId) {
      const allChannels = newServer.channels.flatMap((cat) => cat.channels);
      const matchingChannel = allChannels.find((ch) => ch.id === activeChannelId);
      if (matchingChannel) {
        // Keep the same channel if it exists in the new server
        return;
      }
    }

    // Reset channel selection only if no matching channel found
    // The useEffect below will auto-select a channel
    if (serverId !== 'home') {
      setActiveChannelId(null);
    }
  };

  const handleChannelSelect = (channelId: string) => {
    setActiveChannelId(channelId);
    // Close mobile menu on component selection usually handled by parent or self
    // We can close it here to be safe
    if (window.innerWidth < 768) {
      setMobileMenuOpen(false);
    }
  };

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
      <div className={`
        fixed inset-y-0 left-0 z-50 flex h-full transition-transform duration-300 ease-in-out md:relative md:translate-x-0
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:transform-none'}
      `}>
        {/* Server sidebar */}
        <ServerSidebar
          servers={servers}
          activeServerId={activeServerId}
          onServerSelect={handleServerSelect}
          onAddCourse={onAddCourse}
          isLecturer={isLecturer}
          enrolledCourseIds={enrolledCourseIds}
          showDMButton={showDMButton}
        />

        {/* DM Sidebar Container */}
        {isDMMode && (
          <div className="w-60 bg-navy-950/95 md:bg-navy-950/70 border-r border-navy-800/60 flex flex-col h-full shadow-2xl md:shadow-none">
            <div className="flex-1 overflow-hidden min-h-0">
              <DMSidebar
                currentUserId={currentUserId}
                activeConversationId={activeConversationId}
                onConversationSelect={(convoId, friendName) => {
                  setActiveConversationId(convoId);
                  setActiveFriendUsername(friendName);
                  if (window.innerWidth < 768) {
                    setMobileMenuOpen(false);
                  }
                }}
                onAddFriend={() => setShowAddFriendDialog(true)}
              />
            </div>

            {/* User profile footer */}
            <div className="h-14 bg-navy-950/80 px-2 py-2 flex items-center gap-2 border-t border-navy-800/60 flex-shrink-0 mt-auto">
              <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold shadow-soft">
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-100 text-sm font-medium truncate">{userName || 'User'}</div>
                <div className="text-emerald-300 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  {t('chat.online')}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Channels Sidebar Container */}
        {!isDMMode && activeServer && (
          <div className="w-60 bg-navy-950/95 md:bg-navy-950/70 border-r border-navy-800/60 flex flex-col h-full shadow-2xl md:shadow-none">
            {/* Channels Section */}
            <div className={`flex flex-col transition-all ${channelsCollapsed ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}>
              {/* Channels Header with Collapse Button - shown when collapsed */}
              {channelsCollapsed ? (
                <div className="h-12 px-4 border-b border-navy-800/60 flex items-center justify-between bg-navy-950/60 flex-shrink-0">
                  <span className="text-gray-400 text-xs font-semibold tracking-wider">CHANNELS</span>
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
                  />
                </div>
              )}
            </div>

            {/* User profile footer - at the very bottom */}
            <div className="h-14 bg-navy-950/80 px-2 py-2 flex items-center gap-2 border-t border-navy-800/60 flex-shrink-0 mt-auto">
              <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold shadow-soft">
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-100 text-sm font-medium truncate">{userName || 'User'}</div>
                <div className="text-emerald-300 text-xs flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                  {t('chat.online')}
                </div>
              </div>
              <div className="flex gap-0.5">
                <button className="h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-200 rounded-lg border border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
                <button className="h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-200 rounded-lg border border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat area */}
      <ChatErrorBoundary>
        {isDMMode ? (
          <DMChatArea
            conversationId={activeConversationId}
            currentUserId={currentUserId}
            friendUsername={activeFriendUsername}
            onMobileMenuClick={() => setMobileMenuOpen(true)}
          />
        ) : (
          <ChatArea
            channel={activeChannel}
            currentUserId={currentUserId}
            isLecturer={isLecturer}
            onSendMessage={onSendMessage || (() => { })}
            onReaction={onReaction}
            isEnrollmentExpired={isEnrollmentExpired}
            enrollmentInfo={enrollmentInfo}
            onReEnrollRequest={onReEnrollRequest}
            onMobileMenuClick={() => setMobileMenuOpen(true)}
          />
        )}
      </ChatErrorBoundary>

      {/* Add Friend Dialog */}
      <AddFriendDialog
        isOpen={showAddFriendDialog}
        onClose={() => setShowAddFriendDialog(false)}
        currentUserId={currentUserId}
      />
    </div>
  );
}
