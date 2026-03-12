"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { Language, getStoredLanguage, setStoredLanguage } from "@/lib/i18n";
import enTranslations from "@/locales/en.json";
import geTranslations from "@/locales/ge.json";

type Translations = typeof enTranslations;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isReady: boolean;
}

const translations: Record<Language, Translations> = {
  en: enTranslations,
  ge: geTranslations,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

interface I18nProviderProps {
  children: ReactNode;
  initialLanguage: Language;
}

export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  // Use initialLanguage from server to prevent hydration mismatch
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  // Start ready so components never block - sync happens in useEffect
  const [isReady, setIsReady] = useState(true);

  useEffect(() => {
    // After hydration, sync with cookie if user changed language in another tab
    const storedLang = getStoredLanguage();
    if (storedLang !== language) {
      setLanguageState(storedLang);
    }
  }, []);

  useEffect(() => {
    // Update HTML lang attribute whenever language changes
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
    document.documentElement.lang = lang;
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const keys = key.split(".");
      let value: any = translations[language];

      for (const k of keys) {
        value = value?.[k];
      }

      if (typeof value !== "string") {
        let fallback: any = translations.en;
        for (const k of keys) {
          fallback = fallback?.[k];
        }
        if (typeof fallback === "string") {
          value = fallback;
        } else {
          let georgianFallback: any = translations.ge;
          for (const k of keys) {
            georgianFallback = georgianFallback?.[k];
          }
          if (typeof georgianFallback === "string") {
            value = georgianFallback;
          } else {
            return key;
          }
        }
      }

      if (params) {
        return value.replace(/\{\{(\w+)\}\}/g, (match: string, k: string) => {
          return params[k]?.toString() || match;
        });
      }
      return value;
    },
    [language],
  );

  const contextValue = useMemo(
    () => ({ language, setLanguage, t, isReady }),
    [language, setLanguage, t, isReady],
  );

  return (
    <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
