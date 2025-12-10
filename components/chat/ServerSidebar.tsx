'use client';

import { useState } from 'react';
import type { Server } from '@/types/server';

interface ServerSidebarProps {
  servers: Server[];
  activeServerId: string | null;
  onServerSelect: (serverId: string) => void;
  onAddCourse?: () => void;
  isLecturer?: boolean;
}

export default function ServerSidebar({
  servers,
  activeServerId,
  onServerSelect,
  onAddCourse,
  isLecturer = false,
}: ServerSidebarProps) {
  const [hoveredServerId, setHoveredServerId] = useState<string | null>(null);

  return (
    <div className="w-16 bg-gray-900 flex flex-col items-center py-3 space-y-2 overflow-y-auto">
      {/* Home/Direct Messages button */}
      <button
        className={`w-12 h-12 rounded-full bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 flex items-center justify-center text-white font-bold text-lg ${
          activeServerId === 'home' ? 'rounded-2xl' : ''
        }`}
        onClick={() => onServerSelect('home')}
        onMouseEnter={() => setHoveredServerId('home')}
        onMouseLeave={() => setHoveredServerId(null)}
      >
        <span>DM</span>
      </button>

      <div className="w-8 h-0.5 bg-gray-700"></div>

      {/* Server list */}
      {servers.map((server) => {
        const isActive = activeServerId === server.id;
        const isHovered = hoveredServerId === server.id;

        return (
          <div key={server.id} className="relative group">
            <button
              className={`w-12 h-12 rounded-full transition-all duration-200 flex items-center justify-center text-white font-semibold text-sm bg-gray-700 hover:bg-indigo-600 ${
                isActive ? 'rounded-2xl bg-indigo-600' : ''
              }`}
              onClick={() => onServerSelect(server.id)}
              onMouseEnter={() => setHoveredServerId(server.id)}
              onMouseLeave={() => setHoveredServerId(null)}
            >
              {server.icon || server.name.charAt(0).toUpperCase()}
            </button>

            {/* Tooltip */}
            {isHovered && (
              <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-gray-900 text-white text-sm rounded whitespace-nowrap z-50 pointer-events-none">
                {server.name}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-gray-900"></div>
              </div>
            )}

            {/* Active indicator */}
            {isActive && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-white rounded-r"></div>
            )}
          </div>
        );
      })}

      {/* Add Course button (lecturer only) */}
      {isLecturer && onAddCourse && (
        <button
          className="w-12 h-12 rounded-full bg-gray-700 hover:bg-green-600 transition-all duration-200 flex items-center justify-center text-green-500 hover:text-white text-2xl font-light"
          title="Create Course"
          onClick={onAddCourse}
        >
          +
        </button>
      )}
    </div>
  );
}
