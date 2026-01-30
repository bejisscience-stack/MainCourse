'use client';

import type { Member } from '@/types/member';

interface MemberSidebarProps {
  members: Member[];
  onlineMembers: Member[];
  offlineMembers: Member[];
  onCollapse?: () => void;
}

export default function MemberSidebar({
  members,
  onlineMembers,
  offlineMembers,
  onCollapse,
}: MemberSidebarProps) {
  const statusClasses: Record<Member['status'], string> = {
    online: 'bg-emerald-400',
    away: 'bg-amber-400',
    busy: 'bg-red-400',
    offline: 'bg-gray-500',
  };

  const renderMember = (member: Member, isMuted: boolean) => (
    <div
      key={member.id}
      className={`flex items-center gap-2.5 px-2 py-2 rounded-lg border border-transparent transition-all ${
        isMuted
          ? 'opacity-70 hover:opacity-100 hover:bg-navy-800/30'
          : 'hover:bg-navy-800/40'
      }`}
      title={member.username}
    >
      <div className="relative w-8 h-8 rounded-full bg-navy-900/70 border border-navy-800/60 flex items-center justify-center text-[11px] font-semibold text-emerald-200 overflow-hidden">
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.username}
            className="w-full h-full object-cover"
          />
        ) : (
          member.username.charAt(0).toUpperCase()
        )}
        <span
          className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-navy-950 ${statusClasses[member.status]}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm truncate ${isMuted ? 'text-gray-400' : 'text-gray-200'}`}>
          {member.username}
        </div>
        {member.role && (
          <div
            className="text-[11px] truncate"
            style={{ color: member.roleColor || 'rgba(var(--muted), 0.85)' }}
          >
            {member.role}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="w-full h-full bg-navy-950/70 flex flex-col overflow-hidden">
      <div className="h-11 px-3 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Members
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{members.length}</span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
              title="Collapse members"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 chat-scrollbar">
        {members.length === 0 && (
          <div className="px-2 py-6 text-center text-sm text-gray-500">
            No members to display.
          </div>
        )}

        {onlineMembers.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-gray-500">
              Online ({onlineMembers.length})
            </div>
            <div className="space-y-1">
              {onlineMembers.map((member) => renderMember(member, false))}
            </div>
          </div>
        )}

        {offlineMembers.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-gray-500">
              Offline ({offlineMembers.length})
            </div>
            <div className="space-y-1">
              {offlineMembers.map((member) => renderMember(member, true))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



