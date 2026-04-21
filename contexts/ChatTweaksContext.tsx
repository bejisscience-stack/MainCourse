"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ChatTheme = "dark" | "warm" | "light";
export type ChatDensity = "compact" | "default" | "cozy";
export type ChatMessageStyle = "rows" | "bubbles";

export interface ChatTweaks {
  accentHue: number;
  theme: ChatTheme;
  density: ChatDensity;
  messageStyle: ChatMessageStyle;
}

export const DEFAULT_TWEAKS: ChatTweaks = {
  accentHue: 165,
  theme: "dark",
  density: "default",
  messageStyle: "rows",
};

const STORAGE_KEY = "chatTweaks";

interface ChatTweaksValue {
  tweaks: ChatTweaks;
  update: (patch: Partial<ChatTweaks>) => void;
  reset: () => void;
}

const ChatTweaksContext = createContext<ChatTweaksValue | null>(null);

export function useChatTweaks(): ChatTweaksValue {
  const ctx = useContext(ChatTweaksContext);
  if (!ctx) {
    // Provide a default when not wrapped (defensive).
    return {
      tweaks: DEFAULT_TWEAKS,
      update: () => {},
      reset: () => {},
    };
  }
  return ctx;
}

export function ChatTweaksProvider({ children }: { children: ReactNode }) {
  const [tweaks, setTweaks] = useState<ChatTweaks>(DEFAULT_TWEAKS);

  // Hydrate from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ChatTweaks>;
      setTweaks((prev) => ({ ...prev, ...parsed }));
    } catch {
      // ignore malformed
    }
  }, []);

  // Persist
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tweaks));
    } catch {
      // ignore quota errors
    }
  }, [tweaks]);

  const update = useCallback((patch: Partial<ChatTweaks>) => {
    setTweaks((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => setTweaks(DEFAULT_TWEAKS), []);

  const value = useMemo(
    () => ({ tweaks, update, reset }),
    [tweaks, update, reset],
  );

  return (
    <ChatTweaksContext.Provider value={value}>
      {children}
    </ChatTweaksContext.Provider>
  );
}
