'use client';

import { useState, useEffect } from 'react';
import type { Server, ChannelCategory, Channel } from '@/types/server';
import ChannelManagement from './ChannelManagement';

interface ChannelSidebarProps {
  server: Server | null;
  activeChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  onChannelCreate?: (channel: Omit<Channel, 'id'>) => Promise<void>;
  onChannelUpdate?: (channelId: string, updates: Partial<Channel>) => Promise<void>;
  onChannelDelete?: (channelId: string) => Promise<void>;
  isLecturer?: boolean;
}

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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('collapsedCategories', JSON.stringify([...collapsedCategories]));
    }
  }, [collapsedCategories]);

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  if (!server) {
    return (
      <div className="w-60 bg-gray-800 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-white font-semibold">Select a server</h2>
        </div>
      </div>
    );
  }

  // Sort channels: lectures first, then by displayOrder
  const sortChannels = (channels: Channel[]) => {
    return [...channels].sort((a, b) => {
      // Lectures always first
      if (a.type === 'lectures' && b.type !== 'lectures') return -1;
      if (b.type === 'lectures' && a.type !== 'lectures') return 1;
      // Then by displayOrder
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    });
  };

  const allChannels = server.channels.flatMap((cat) => cat.channels);

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      {/* Server header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between shadow-lg">
        <h2 className="text-white font-semibold text-sm truncate">{server.name}</h2>
        {isLecturer && (
          <button
            onClick={() => setShowChannelManagement(true)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700 transition-colors"
            title="Manage Channels"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Channels list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {server.channels.map((category: ChannelCategory) => {
          const isCollapsed = collapsedCategories.has(category.id);

          return (
            <div key={category.id} className="mb-4">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full flex items-center justify-between px-2 py-1 text-gray-400 hover:text-gray-300 text-xs font-semibold uppercase tracking-wide group"
              >
                <span className="flex items-center gap-1">
                  <svg
                    className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M7.293 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L7 12.586l3.707-3.707a1 1 0 011.414 1.414l-4 4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {category.name}
                </span>
              </button>

              {/* Channels in category */}
              {!isCollapsed &&
                sortChannels(category.channels).map((channel) => {
                  const isActive = activeChannelId === channel.id;

                  return (
                    <button
                      key={channel.id}
                      onClick={() => onChannelSelect(channel.id)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors group ${
                        isActive
                          ? 'bg-gray-700 text-white'
                          : 'text-gray-400 hover:bg-gray-700 hover:text-gray-300'
                      }`}
                    >
                      <span className="text-lg">
                        {channel.type === 'text' ? '#' : channel.type === 'voice' ? '🔊' : '📹'}
                      </span>
                      <span className="flex-1 text-left truncate">{channel.name}</span>
                    </button>
                  );
                })}
            </div>
          );
        })}
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

      {/* User profile footer */}
      <div className="h-14 bg-gray-900 px-2 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
          U
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-white text-sm font-medium truncate">Username</div>
          <div className="text-gray-400 text-xs truncate">Online</div>
        </div>
        <div className="flex gap-1">
          <button className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
          </button>
          <button className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
  );
}
