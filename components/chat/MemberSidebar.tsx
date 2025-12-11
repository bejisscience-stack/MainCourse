'use client';

import type { Member } from '@/types/member';

interface MemberSidebarProps {
  members: Member[];
  onlineMembers: Member[];
  offlineMembers: Member[];
}

export default function MemberSidebar({
  members,
  onlineMembers,
  offlineMembers,
}: MemberSidebarProps) {
  const getStatusColor = (status: Member['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="w-60 bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center">
        <input
          type="text"
          placeholder="Search"
          className="bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded w-full focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {/* Online members */}
        {onlineMembers.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Online — {onlineMembers.length}
            </div>
            {onlineMembers.map((member) => (
              <div
                key={member.id}
                className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(
                      member.status
                    )}`}
                  ></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      member.roleColor ? `text-[${member.roleColor}]` : 'text-gray-300'
                    }`}
                    style={member.roleColor ? { color: member.roleColor } : {}}
                  >
                    {member.username}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offline members */}
        {offlineMembers.length > 0 && (
          <div>
            <div className="px-2 py-1 text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Offline — {offlineMembers.length}
            </div>
            {offlineMembers.map((member) => (
              <div
                key={member.id}
                className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 cursor-pointer group opacity-60"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-semibold">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(
                      member.status
                    )}`}
                  ></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      member.roleColor ? `text-[${member.roleColor}]` : 'text-gray-300'
                    }`}
                    style={member.roleColor ? { color: member.roleColor } : {}}
                  >
                    {member.username}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {members.length === 0 && (
          <div className="px-2 py-4 text-center text-gray-400 text-sm">
            No members found
          </div>
        )}
      </div>
    </div>
  );
}

