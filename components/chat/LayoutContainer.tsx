'use client';

import { useState, useEffect } from 'react';
import ServerSidebar from './ServerSidebar';
import ChannelSidebar from './ChannelSidebar';
import ChatArea from './ChatArea';
import MemberSidebar from './MemberSidebar';
import { useActiveServer } from '@/hooks/useActiveServer';
import { useActiveChannel } from '@/hooks/useActiveChannel';
import { useMembers } from '@/hooks/useMembers';
import type { Server, Channel } from '@/types/server';
import type { Member } from '@/types/member';

interface LayoutContainerProps {
  servers: Server[];
  currentUserId: string;
  initialMembers?: Member[];
  isLecturer?: boolean;
  onSendMessage?: (channelId: string, content: string) => void;
  onReaction?: (messageId: string, emoji: string) => void;
  onChannelCreate?: (channel: Omit<Channel, 'id'>) => Promise<void>;
  onChannelUpdate?: (channelId: string, updates: Partial<Channel>) => Promise<void>;
  onChannelDelete?: (channelId: string) => Promise<void>;
}

export default function LayoutContainer({
  servers,
  currentUserId,
  initialMembers = [],
  isLecturer = false,
  onSendMessage,
  onReaction,
  onChannelCreate,
  onChannelUpdate,
  onChannelDelete,
}: LayoutContainerProps) {
  const [activeServerId, setActiveServerId] = useActiveServer();
  const [activeChannelId, setActiveChannelId] = useActiveChannel();
  const [showMembers, setShowMembers] = useState(true);

  const activeServer = servers.find((s) => s.id === activeServerId) || null;
  const activeChannel =
    activeServer?.channels
      .flatMap((cat) => cat.channels)
      .find((ch) => ch.id === activeChannelId) || null;

  const { members, onlineMembers, offlineMembers } = useMembers(
    activeServerId,
    initialMembers
  );

  // Auto-select first server and channel if none selected
  useEffect(() => {
    if (!activeServerId && servers.length > 0) {
      setActiveServerId(servers[0].id);
    }
  }, [activeServerId, servers, setActiveServerId]);

  useEffect(() => {
    if (activeServer && !activeChannelId) {
      // Prefer lectures channel first, then text channels
      const allChannels = activeServer.channels.flatMap((cat) => cat.channels);
      const lecturesChannel = allChannels.find((ch) => ch.type === 'lectures');
      const textChannel = allChannels.find((ch) => ch.type === 'text');
      const firstChannel = lecturesChannel || textChannel || allChannels[0];
      if (firstChannel) {
        setActiveChannelId(firstChannel.id);
      }
    }
  }, [activeServer, activeChannelId, setActiveChannelId]);

  const handleServerSelect = (serverId: string) => {
    setActiveServerId(serverId);
    // Reset channel selection when switching servers
    setActiveChannelId(null);
  };

  const handleChannelSelect = (channelId: string) => {
    setActiveChannelId(channelId);
  };

  return (
    <div className="flex h-full bg-gray-900 text-white overflow-hidden">
      {/* Server sidebar */}
      <ServerSidebar
        servers={servers}
        activeServerId={activeServerId}
        onServerSelect={handleServerSelect}
      />

      {/* Channel sidebar */}
      <ChannelSidebar
        server={activeServer}
        activeChannelId={activeChannelId}
        onChannelSelect={handleChannelSelect}
        onChannelCreate={onChannelCreate}
        onChannelUpdate={onChannelUpdate}
        onChannelDelete={onChannelDelete}
        isLecturer={isLecturer}
      />

      {/* Chat area */}
      <ChatArea
        channel={activeChannel}
        currentUserId={currentUserId}
        isLecturer={isLecturer}
        onSendMessage={onSendMessage || (() => {})}
        onReaction={onReaction}
      />

      {/* Member sidebar - hidden on mobile */}
      {showMembers && (
        <>
          <MemberSidebar
            members={members}
            onlineMembers={onlineMembers}
            offlineMembers={offlineMembers}
          />
          {/* Toggle button for mobile */}
          <button
            onClick={() => setShowMembers(false)}
            className="lg:hidden fixed right-4 bottom-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </>
      )}

      {/* Show members button when hidden */}
      {!showMembers && (
        <button
          onClick={() => setShowMembers(true)}
          className="lg:hidden fixed right-4 bottom-4 bg-indigo-600 text-white p-2 rounded-full shadow-lg"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
