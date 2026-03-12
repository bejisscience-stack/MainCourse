"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";

export type BackgroundTheme =
  | "none"
  | "subtle"
  | "stockMarket"
  | "cryptoRain"
  | "moneyFlow"
  | "socialMedia"
  | "aiNetwork"
  | "globalCommerce"
  | "analytics";

export type AnimationIntensity = "low" | "medium" | "high";

interface BackgroundContextType {
  theme: BackgroundTheme;
  intensity: AnimationIntensity;
  isReducedMotion: boolean;
  setTheme: (theme: BackgroundTheme) => void;
  setIntensity: (intensity: AnimationIntensity) => void;
}

const BackgroundContext = createContext<BackgroundContextType | undefined>(
  undefined,
);

interface BackgroundProviderProps {
  children: ReactNode;
}

export function BackgroundProvider({ children }: BackgroundProviderProps) {
  const [theme, setThemeState] = useState<BackgroundTheme>("stockMarket");
  const [intensity, setIntensityState] = useState<AnimationIntensity>("medium");
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem(
        "backgroundTheme",
      ) as BackgroundTheme;
      const savedIntensity = localStorage.getItem(
        "backgroundIntensity",
      ) as AnimationIntensity;

      if (savedTheme && savedTheme !== theme) {
        setThemeState(savedTheme);
      }
      if (savedIntensity && savedIntensity !== intensity) {
        setIntensityState(savedIntensity);
      }
    } catch (error) {
      // Ignore localStorage errors
    }

    // Check for reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const setTheme = useCallback((newTheme: BackgroundTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("backgroundTheme", newTheme);
    } catch (error) {
      // Ignore localStorage errors
    }
  }, []);

  const setIntensity = useCallback((newIntensity: AnimationIntensity) => {
    setIntensityState(newIntensity);
    try {
      localStorage.setItem("backgroundIntensity", newIntensity);
    } catch (error) {
      // Ignore localStorage errors
    }
  }, []);

  const value = useMemo(
    () => ({ theme, intensity, isReducedMotion, setTheme, setIntensity }),
    [theme, intensity, isReducedMotion, setTheme, setIntensity],
  );

  return (
    <BackgroundContext.Provider value={value}>
      {children}
    </BackgroundContext.Provider>
  );
}

export function useBackground() {
  const context = useContext(BackgroundContext);
  if (context === undefined) {
    throw new Error("useBackground must be used within a BackgroundProvider");
  }
  return context;
}
