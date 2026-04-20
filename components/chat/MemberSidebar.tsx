"use client";

import { useMemo } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type { Member } from "@/types/member";

interface MemberSidebarProps {
  members: Member[];
  onlineMembers: Member[];
  offlineMembers: Member[];
  onCollapse?: () => void;
  friendIds?: string[];
}

const statusColor: Record<Member["status"], string> = {
  online: "bg-emerald-400",
  away: "bg-amber-400",
  busy: "bg-red-400",
  offline: "bg-gray-500",
};

export default function MemberSidebar({
  members,
  onlineMembers,
  offlineMembers,
  onCollapse,
  friendIds = [],
}: MemberSidebarProps) {
  const { t } = useI18n();
  const friendIdSet = useMemo(() => new Set(friendIds), [friendIds]);

  const isLecturerRole = (member: Member) =>
    (member.role || "").toLowerCase() === "lecturer";

  const lecturerMembers = useMemo(
    () => members.filter(isLecturerRole),
    [members],
  );
  const onlineStudents = useMemo(
    () => onlineMembers.filter((m) => !isLecturerRole(m)),
    [onlineMembers],
  );
  const offlineStudents = useMemo(
    () => offlineMembers.filter((m) => !isLecturerRole(m)),
    [offlineMembers],
  );

  const renderMember = (
    member: Member,
    { muted = false }: { muted?: boolean } = {},
  ) => {
    const isLect = isLecturerRole(member);
    return (
      <div
        key={member.id}
        className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg border border-transparent transition-all ${
          muted
            ? "opacity-60 hover:opacity-100 hover:bg-navy-800/30"
            : "hover:bg-navy-800/40"
        }`}
        title={member.username}
      >
        <div
          className={`relative w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-semibold overflow-hidden flex-shrink-0 ${
            isLect
              ? "bg-amber-500/15 text-amber-200 border border-amber-500/30"
              : "bg-navy-900/70 border border-navy-800/60 text-emerald-200"
          }`}
        >
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
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-navy-950 ${statusColor[member.status]}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`text-[13px] truncate flex items-center gap-1 ${
              muted ? "text-gray-400" : "text-gray-200"
            }`}
          >
            <span className="truncate">{member.username}</span>
            {friendIdSet.has(member.id) && (
              <svg
                className="w-3 h-3 text-amber-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            )}
          </div>
          {member.role && (
            <div className="font-mono text-[10px] truncate text-gray-500">
              {member.role}
            </div>
          )}
        </div>
      </div>
    );
  };

  const groupLabel = (label: string, count: number) => (
    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500 px-2 pt-2 pb-1">
      {label} · {count}
    </div>
  );

  return (
    <div className="w-full h-full bg-navy-950/70 flex flex-col overflow-hidden">
      <div className="h-12 px-3 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between flex-shrink-0">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-gray-500">
          {t("chat.members")}
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-gray-400">
            {members.length}
          </span>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
              title="Collapse members"
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
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 chat-scrollbar">
        {members.length === 0 && (
          <div className="px-2 py-6 text-center text-sm text-gray-500">
            No members to display.
          </div>
        )}

        {lecturerMembers.length > 0 && (
          <div className="mb-2">
            {groupLabel(t("chat.lecturer"), lecturerMembers.length)}
            <div className="space-y-0.5">
              {lecturerMembers.map((m) => renderMember(m))}
            </div>
          </div>
        )}

        {onlineStudents.length > 0 && (
          <div className="mb-2">
            {groupLabel(t("chat.online"), onlineStudents.length)}
            <div className="space-y-0.5">
              {onlineStudents.map((m) => renderMember(m))}
            </div>
          </div>
        )}

        {offlineStudents.length > 0 && (
          <div>
            {groupLabel(t("chat.offline"), offlineStudents.length)}
            <div className="space-y-0.5">
              {offlineStudents.map((m) => renderMember(m, { muted: true }))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
