"use client";

import { useEffect } from "react";
import {
  useChatTweaks,
  type ChatDensity,
  type ChatMessageStyle,
  type ChatTheme,
} from "@/contexts/ChatTweaksContext";
import { useI18n } from "@/contexts/I18nContext";

interface TweaksPanelProps {
  open: boolean;
  onClose: () => void;
  showMembers: boolean;
  onToggleMembers: () => void;
}

const ACCENT_HUES = [
  { name: "Emerald", h: 165 },
  { name: "Amber", h: 75 },
  { name: "Rose", h: 15 },
  { name: "Violet", h: 295 },
  { name: "Steel", h: 235 },
];

const THEMES: { name: string; v: ChatTheme }[] = [
  { name: "Dark", v: "dark" },
  { name: "Warm", v: "warm" },
  { name: "Light", v: "light" },
];

const DENSITIES: { name: string; v: ChatDensity }[] = [
  { name: "Compact", v: "compact" },
  { name: "Default", v: "default" },
  { name: "Cozy", v: "cozy" },
];

const MESSAGE_STYLES: { name: string; v: ChatMessageStyle }[] = [
  { name: "Rows", v: "rows" },
  { name: "Bubbles", v: "bubbles" },
];

export default function TweaksPanel({
  open,
  onClose,
  showMembers,
  onToggleMembers,
}: TweaksPanelProps) {
  const { tweaks, update, reset } = useChatTweaks();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Chat tweaks"
      className="fixed bottom-5 right-5 w-[320px] bg-navy-900/95 backdrop-blur-xl border border-navy-800/70 rounded-[16px] p-4 shadow-soft-xl z-[80] animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500">
          Tweaks
        </span>
        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 inline-flex items-center justify-center rounded-lg text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60 transition-colors"
          aria-label="Close"
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
              d="M6 6l12 12M18 6L6 18"
            />
          </svg>
        </button>
      </div>

      {/* Accent */}
      <Group label="Accent">
        <div className="flex gap-2">
          {ACCENT_HUES.map((hue) => {
            const isActive = tweaks.accentHue === hue.h;
            return (
              <button
                key={hue.h}
                type="button"
                onClick={() => update({ accentHue: hue.h })}
                title={hue.name}
                aria-label={hue.name}
                aria-pressed={isActive}
                className={`w-7 h-7 rounded-full transition-transform ${isActive ? "ring-2 ring-white/90 ring-offset-2 ring-offset-navy-900 scale-110" : "hover:scale-105"}`}
                style={{
                  background: `oklch(0.78 0.14 ${hue.h})`,
                }}
              />
            );
          })}
        </div>
      </Group>

      {/* Theme */}
      <Group label="Theme">
        <Segmented
          options={THEMES}
          value={tweaks.theme}
          onChange={(v) => update({ theme: v })}
        />
      </Group>

      {/* Density */}
      <Group label="Density">
        <Segmented
          options={DENSITIES}
          value={tweaks.density}
          onChange={(v) => update({ density: v })}
        />
      </Group>

      {/* Message style */}
      <Group label="Message style">
        <Segmented
          options={MESSAGE_STYLES}
          value={tweaks.messageStyle}
          onChange={(v) => update({ messageStyle: v })}
        />
      </Group>

      {/* Members toggle */}
      <Group label={t("chat.members")}>
        <button
          type="button"
          onClick={onToggleMembers}
          className={`w-full px-3 py-2 rounded-[10px] text-[12px] font-medium text-left border transition-colors ${
            showMembers
              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-200"
              : "bg-navy-800/60 border-navy-800/80 text-gray-400"
          }`}
          aria-pressed={showMembers}
        >
          {showMembers ? "Visible" : "Hidden"}
        </button>
      </Group>

      <button
        type="button"
        onClick={reset}
        className="w-full mt-3 py-2 rounded-[10px] border border-navy-800/80 text-gray-400 text-[11px] font-mono uppercase tracking-[0.1em] hover:text-emerald-300 hover:bg-navy-800/60 transition-colors"
      >
        Reset
      </button>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-gray-500 mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { name: string; v: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex p-0.5 bg-navy-800/60 border border-navy-800/80 rounded-[10px]">
      {options.map((opt) => {
        const isActive = opt.v === value;
        return (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`flex-1 px-2 py-1.5 rounded-[8px] text-[12px] font-medium transition-colors ${
              isActive
                ? "bg-emerald-500/20 text-emerald-200"
                : "text-gray-400 hover:text-gray-200"
            }`}
            aria-pressed={isActive}
          >
            {opt.name}
          </button>
        );
      })}
    </div>
  );
}
