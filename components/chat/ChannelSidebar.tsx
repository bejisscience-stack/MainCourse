'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Server, ChannelCategory, Channel } from '@/types/server';
import ChannelManagement from './ChannelManagement';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';

interface ChannelSidebarProps {
  server: Server | null;
  activeChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  onChannelCreate?: (channel: Omit<Channel, 'id'>) => Promise<void>;
  onChannelUpdate?: (channelId: string, updates: Partial<Channel>) => Promise<void>;
  onChannelDelete?: (channelId: string) => Promise<void>;
  isLecturer?: boolean;
}

// Channel icon component
const ChannelIcon = ({ type, name }: { type: string; name: string }) => {
  if (type === 'lectures') {
    return <span className="text-base">📹</span>;
  }
  if (name.toLowerCase() === 'projects') {
    return <span className="text-base">📁</span>;
  }
  if (type === 'voice') {
    return <span className="text-base">🔊</span>;
  }
  return <span className="text-gray-400 text-lg font-medium">#</span>;
};

export default function ChannelSidebar({
  server,
  activeChannelId,
  onChannelSelect,
  onChannelCreate,
  onChannelUpdate,
  onChannelDelete,
  isLecturer = false,
}: ChannelSidebarProps) {
  const [showChannelManagement, setShowChannelManagement] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('collapsedCategories');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    }
    return new Set();
  });

  // Persist collapsed state
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('collapsedCategories', JSON.stringify([...collapsedCategories]));
    }
  }, [collapsedCategories]);

  const toggleCategory = useCallback((categoryId: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  // Calculate channel IDs for unread tracking
  const channelIds = useMemo(() => {
    if (!server) return [];
    return server.channels.flatMap((cat) => cat.channels).map((ch) => ch.id);
  }, [server]);

  // Get unread counts with real-time updates
  const { getUnreadCount, markAsRead, totalUnread } = useUnreadMessages({
    channelIds,
    enabled: !!server,
  });

  // All channels flat list
  const allChannels = useMemo(() => {
    return server?.channels.flatMap((cat) => cat.channels) || [];
  }, [server]);

  // Sort channels: lectures first, then projects, then by displayOrder
  const sortChannels = useCallback((channels: Channel[]) => {
    return [...channels].sort((a, b) => {
      if (a.type === 'lectures' && b.type !== 'lectures') return -1;
      if (b.type === 'lectures' && a.type !== 'lectures') return 1;
      if (a.name.toLowerCase() === 'projects' && b.name.toLowerCase() !== 'projects') return -1;
      if (b.name.toLowerCase() === 'projects' && a.name.toLowerCase() !== 'projects') return 1;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
  }, []);

  // Handle channel selection with marking as read
  const handleChannelClick = useCallback((channelId: string) => {
    onChannelSelect(channelId);
    // Mark as read after a short delay
    setTimeout(() => markAsRead(channelId), 200);
  }, [onChannelSelect, markAsRead]);

  if (!server) {
    return (
      <div className="w-60 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">Select a course</h2>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No course selected
        </div>
      </div>
    );
  }

  return (
    <div className="w-60 bg-gray-800 flex flex-col relative">
      {/* Server header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between shadow-lg flex-shrink-0">
        <h2 className="text-white font-semibold text-sm truncate flex-1">{server.name}</h2>
        {totalUnread > 0 && (
          <span className="bg-indigo-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center mr-2">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        {isLecturer && (
          <button
            onClick={() => setShowChannelManagement(true)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
            title="Manage Channels"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        {server.channels.map((category: ChannelCategory) => {
          const isCollapsed = collapsedCategories.has(category.id);
          const categoryChannels = sortChannels(category.channels);
          const categoryUnread = categoryChannels.reduce((sum, ch) => sum + getUnreadCount(ch.id), 0);

          return (
            <div key={category.id} className="mb-3">
              {/* Category header */}
              <div className="w-full flex items-center justify-between px-1 py-1.5 text-gray-400 hover:text-gray-300 text-xs font-semibold uppercase tracking-wide group cursor-pointer">
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="flex-1 flex items-center gap-1 text-left"
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="truncate">{category.name}</span>
                  {isCollapsed && categoryUnread > 0 && (
                    <span className="bg-indigo-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-auto">
                      {categoryUnread}
                    </span>
                  )}
                </button>
                {isLecturer && onChannelCreate && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChannelManagement(true);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-white p-0.5 rounded hover:bg-gray-700"
                    title="Create Channel"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Channels in category */}
              {!isCollapsed && (
                <div className="space-y-0.5">
                  {categoryChannels.map((channel) => {
                    const isActive = activeChannelId === channel.id;
                    const unreadCount = getUnreadCount(channel.id);
                    const hasUnread = unreadCount > 0;

                    return (
                      <button
                        key={channel.id}
                        onClick={() => handleChannelClick(channel.id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-all group/channel ${
                          isActive
                            ? 'bg-gray-700 text-white'
                            : hasUnread
                            ? 'text-white font-medium hover:bg-gray-700/70'
                            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-300'
                        }`}
                      >
                        <ChannelIcon type={channel.type} name={channel.name} />
                        <span className="flex-1 text-left truncate">{channel.name}</span>
                        
                        {/* Unread badge */}
                        {hasUnread && !isActive && (
                          <span className="bg-indigo-600 text-white text-xs font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-in fade-in duration-200">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </span>
                        )}
                        
                        {/* Active indicator */}
                        {isActive && (
                          <div className="w-1 h-4 bg-indigo-500 rounded-full" />
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

      {/* User profile footer */}
      <div className="h-14 bg-gray-900 px-2 py-2 flex items-center gap-2 border-t border-gray-700 flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
          U
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">Username</div>
          <div className="text-green-400 text-xs flex items-center gap-1">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Online
          </div>
        </div>
        <div className="flex gap-0.5">
          <button className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Channel Management Modal */}
      {showChannelManagement && server && onChannelCreate && onChannelUpdate && onChannelDelete && (
        <div className="absolute inset-0 bg-gray-900 z-50 flex flex-col">
          <ChannelManagement
            courseId={server.id}
            channels={allChannels}
            onChannelCreate={onChannelCreate}
            onChannelUpdate={onChannelUpdate}
            onChannelDelete={onChannelDelete}
            onClose={() => setShowChannelManagement(false)}
          />
        </div>
      )}
    </div>
  );
}
