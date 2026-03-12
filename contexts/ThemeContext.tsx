"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  ReactNode,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const noop = () => {};

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Always set dark mode
    if (typeof document !== "undefined") {
      const root = document.documentElement;
      root.classList.remove("light");
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  }, []);

  const value = useMemo(
    () => ({ theme: "dark" as const, toggleTheme: noop }),
    [],
  );

  // Always provide dark theme context
  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
