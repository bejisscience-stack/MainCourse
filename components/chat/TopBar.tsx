"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type { Server } from "@/types/server";

interface TopBarProps {
  servers: Server[];
  activeServerId: string | null;
  onServerSelect: (serverId: string) => void;
  onAddCourse?: () => void;
  onOpenMobileMenu?: () => void;
  onOpenFriendRequests?: () => void;
  onOpenTweaks?: () => void;
  userName: string;
  userAvatarUrl?: string | null;
  isLecturer?: boolean;
  serverUnreadCounts?: Map<string, number>;
  dmUnreadCount?: number;
  pendingFriendRequestCount?: number;
  onOpenDM?: () => void;
  isDMMode?: boolean;
}

export default function TopBar({
  servers,
  activeServerId,
  onServerSelect,
  onAddCourse,
  onOpenMobileMenu,
  onOpenFriendRequests,
  onOpenTweaks,
  userName,
  userAvatarUrl,
  isLecturer = false,
  serverUnreadCounts,
  dmUnreadCount = 0,
  pendingFriendRequestCount = 0,
  onOpenDM,
  isDMMode = false,
}: TopBarProps) {
  const { t } = useI18n();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const activeServer =
    activeServerId && activeServerId !== "home"
      ? servers.find((s) => s.id === activeServerId) || null
      : null;
  const activeLetter = activeServer
    ? activeServer.name.charAt(0).toUpperCase()
    : "·";
  const bellBadge = pendingFriendRequestCount + dmUnreadCount;

  return (
    <header className="flex items-center gap-3.5 px-4 sm:px-[18px] py-2.5 bg-navy-900/80 border-b border-navy-800/70 relative z-[5]">
      {/* Mobile menu button */}
      {onOpenMobileMenu && (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden w-9 h-9 inline-flex items-center justify-center rounded-[10px] text-gray-300 hover:text-emerald-300 hover:bg-navy-800/60 transition-colors"
          aria-label={t("chat.openMenu")}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
      )}

      {/* Brand mark */}
      <div className="flex items-center gap-2.5 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-lg grid place-items-center font-mono font-bold text-[13px] text-navy-950"
          style={{
            background:
              "conic-gradient(from 220deg, #34d399, rgba(52,211,153,0.5) 60%, #334e68 100%)",
          }}
          aria-hidden="true"
        >
          S
        </div>
        <div className="hidden sm:block text-gray-100 font-semibold text-[14px] tracking-tight">
          swavleba
        </div>
      </div>

      <div className="hidden sm:block w-px h-[22px] bg-navy-800/70" />

      {/* Course switcher */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1.5 rounded-[12px] bg-navy-800/60 border border-navy-800/80 text-gray-100 text-[13px] font-medium hover:bg-navy-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40"
          aria-haspopup="menu"
          aria-expanded={dropdownOpen}
        >
          <span className="w-[22px] h-[22px] rounded-md bg-emerald-500/15 text-emerald-200 grid place-items-center font-semibold text-[11px]">
            {activeLetter}
          </span>
          <span className="truncate max-w-[160px] hidden sm:inline">
            {isDMMode
              ? t("chat.directMessages")
              : activeServer?.name || t("chat.courseLabel")}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 9l6 6 6-6"
            />
          </svg>
        </button>

        {dropdownOpen && (
          <div
            role="menu"
            className="absolute top-[calc(100%+6px)] left-0 w-[320px] bg-navy-900/95 backdrop-blur-xl border border-navy-800/70 rounded-[14px] p-1.5 shadow-soft-xl z-50"
          >
            <div className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-gray-500">
              {t("chat.myCoursesCount", { count: servers.length })}
            </div>
            {onOpenDM && (
              <button
                type="button"
                onClick={() => {
                  onOpenDM();
                  setDropdownOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] text-gray-200 hover:bg-navy-800/70 transition-colors ${
                  isDMMode ? "bg-navy-800/60" : ""
                }`}
              >
                <span className="w-7 h-7 rounded-lg bg-navy-800/70 border border-navy-800/80 text-emerald-200 grid place-items-center">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 7l9 7 9-7"
                    />
                  </svg>
                </span>
                <span className="flex-1 text-left truncate">
                  {t("chat.directMessages")}
                </span>
                {dmUnreadCount > 0 && (
                  <span className="bg-emerald-500/15 text-emerald-200 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-emerald-500/40">
                    {dmUnreadCount > 9 ? "9+" : dmUnreadCount}
                  </span>
                )}
              </button>
            )}
            {servers.map((server) => {
              const unread = serverUnreadCounts?.get(server.id) || 0;
              const isActive = !isDMMode && server.id === activeServerId;
              return (
                <button
                  key={server.id}
                  type="button"
                  onClick={() => {
                    onServerSelect(server.id);
                    setDropdownOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] text-gray-200 hover:bg-navy-800/70 transition-colors ${
                    isActive ? "bg-navy-800/60" : ""
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-navy-800 text-gray-200 grid place-items-center font-semibold">
                    {server.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 text-left truncate">
                    {server.name}
                  </span>
                  {unread > 0 && (
                    <span className="bg-emerald-500/15 text-emerald-200 text-[11px] px-2 py-0.5 rounded-full font-semibold border border-emerald-500/40">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
              );
            })}
            {onAddCourse && (
              <div className="border-t border-navy-800/70 mt-1 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    onAddCourse();
                    setDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-gray-300 text-[13px] rounded-[10px] hover:bg-navy-800/60 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 5v14M5 12h14"
                    />
                  </svg>
                  {isLecturer
                    ? t("chat.createCourse")
                    : t("chat.discoverMoreCourses")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* Search (UI-only for now) */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-navy-800/60 border border-navy-800/80 rounded-[10px] text-gray-400 text-[13px] md:min-w-[200px] lg:min-w-[280px]">
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 4a7 7 0 1 1-4.95 11.95L3 19M15.95 15.95l5 5"
          />
        </svg>
        <span className="truncate">{t("chat.searchInCourse")}</span>
        <span className="ml-auto font-mono text-[10px] opacity-70">⌘K</span>
      </div>

      {/* Bell (notifications + friend requests) */}
      <button
        type="button"
        onClick={onOpenFriendRequests}
        className="relative w-9 h-9 inline-flex items-center justify-center rounded-[10px] text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60 transition-colors"
        aria-label={t("chat.notifications")}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9zM10 21a2 2 0 0 0 4 0"
          />
        </svg>
        {bellBadge > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-[14px] rounded-full bg-emerald-500 text-navy-950 text-[9px] font-bold grid place-items-center px-1">
            {bellBadge > 9 ? "9+" : bellBadge}
          </span>
        )}
      </button>

      {/* Tweaks button (open TweaksPanel) */}
      {onOpenTweaks && (
        <button
          type="button"
          onClick={onOpenTweaks}
          className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[10px] border border-navy-800/80 text-gray-300 text-[12px] hover:bg-navy-800/60 hover:text-emerald-300 transition-colors"
          aria-label="Open tweaks"
        >
          <span className="font-mono text-[10px] text-gray-500">TWEAKS</span>
        </button>
      )}

      {/* AI sparkle (active, UI-only) */}
      <button
        type="button"
        onClick={() => console.log("TODO: chat.aiAssistant global")}
        className="w-9 h-9 inline-flex items-center justify-center rounded-[10px] bg-emerald-500/15 text-emerald-200 border border-emerald-500/40 hover:bg-emerald-500/25 transition-colors"
        aria-label={t("chat.aiAssistant")}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2zM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"
          />
        </svg>
      </button>

      {/* User avatar */}
      <div className="relative flex-shrink-0">
        {userAvatarUrl ? (
          <img
            src={userAvatarUrl}
            alt={userName}
            className="w-[30px] h-[30px] rounded-full object-cover border border-navy-800/70"
          />
        ) : (
          <div className="w-[30px] h-[30px] rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-500/40 grid place-items-center text-[12px] font-semibold">
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="absolute -right-0.5 -bottom-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-navy-900" />
      </div>
    </header>
  );
}
