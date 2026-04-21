"use client";

import { useI18n } from "@/contexts/I18nContext";
import type { Server } from "@/types/server";

interface MobileBottomTabsProps {
  activeServer: Server | null;
  activeChannelId: string | null;
  onChannelSelect: (channelId: string) => void;
  onOpenMyMenu?: () => void;
}

// Mobile-only 4-tab nav (lecture / chat / project / me). Visible only on
// small screens; matches the design's mobile frame.
export default function MobileBottomTabs({
  activeServer,
  activeChannelId,
  onChannelSelect,
  onOpenMyMenu,
}: MobileBottomTabsProps) {
  const { t } = useI18n();
  if (!activeServer) return null;

  const allChannels = activeServer.channels.flatMap((cat) => cat.channels);
  const lectureCh = allChannels.find((c) => c.type === "lectures");
  const projectCh = allChannels.find(
    (c) => c.name.toLowerCase() === "projects",
  );
  const generalCh =
    allChannels.find(
      (c) => c.type === "text" && c.name.toLowerCase() === "general",
    ) || allChannels.find((c) => c.type === "text");

  const tabs: {
    id: string;
    label: string;
    icon: string;
    active: boolean;
    onClick: () => void;
    disabled: boolean;
  }[] = [
    {
      id: "lecture",
      label: t("chat.learningGroup"),
      icon: "M6 4l14 8-14 8z",
      active: !!lectureCh && activeChannelId === lectureCh.id,
      onClick: () => lectureCh && onChannelSelect(lectureCh.id),
      disabled: !lectureCh,
    },
    {
      id: "chat",
      label: t("chat.conversationGroup"),
      icon: "M5 9h14M5 15h14M10 4l-2 16M16 4l-2 16",
      active: !!generalCh && activeChannelId === generalCh.id,
      onClick: () => generalCh && onChannelSelect(generalCh.id),
      disabled: !generalCh,
    },
    {
      id: "project",
      label: t("chat.activeProject"),
      icon: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
      active: !!projectCh && activeChannelId === projectCh.id,
      onClick: () => projectCh && onChannelSelect(projectCh.id),
      disabled: !projectCh,
    },
    {
      id: "me",
      label: t("chat.myProfile"),
      icon: "M6 3h12v18l-6-4-6 4z",
      active: false,
      onClick: () => onOpenMyMenu?.(),
      disabled: !onOpenMyMenu,
    },
  ];

  return (
    <nav className="md:hidden border-t border-navy-800/70 bg-navy-900/95 backdrop-blur-xl grid grid-cols-4 gap-1 px-3 pb-safe pt-2 pb-3">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={tab.onClick}
          disabled={tab.disabled}
          className={`flex flex-col items-center gap-1 py-1.5 rounded-[10px] transition-colors ${
            tab.active
              ? "bg-emerald-500/15 text-emerald-200"
              : tab.disabled
                ? "text-gray-600"
                : "text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60"
          }`}
          aria-pressed={tab.active}
        >
          <svg
            className="w-[18px] h-[18px]"
            fill={tab.id === "lecture" ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
          </svg>
          <span className="text-[10px] font-medium">{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
