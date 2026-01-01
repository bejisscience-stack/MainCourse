'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Language, getStoredLanguage, setStoredLanguage, defaultLanguage } from '@/lib/i18n';
import enTranslations from '@/locales/en.json';
import geTranslations from '@/locales/ge.json';

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

// Get initial language synchronously on client side
function getInitialLanguage(): Language {
  if (typeof window === 'undefined') return defaultLanguage;
  return getStoredLanguage();
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Mark as ready after first render to ensure correct language is loaded
    setIsReady(true);
    // Update HTML lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations[language];

    for (const k of keys) {
      value = value?.[k];
    }

    if (typeof value !== 'string') {
      // Fallback to English if translation missing in current language
      let fallback: any = translations.en;
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      if (typeof fallback === 'string') {
        value = fallback;
      } else {
        // Final fallback to Georgian if English translation is missing
        let georgianFallback: any = translations.ge;
        for (const k of keys) {
          georgianFallback = georgianFallback?.[k];
        }
        if (typeof georgianFallback === 'string') {
          value = georgianFallback;
        } else {
          return key; // Return key if no translation found
        }
      }
    }

    return params ? replaceParams(value, params) : value;
  };

  function replaceParams(str: string, params: Record<string, string | number>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key]?.toString() || match;
    });
  }

  return (
    <I18nContext.Provider value={{ language, setLanguage, t, isReady }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

