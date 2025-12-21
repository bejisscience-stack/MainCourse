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
}

const translations: Record<Language, Translations> = {
  en: enTranslations,
  ge: geTranslations,
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(defaultLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = getStoredLanguage();
    setLanguageState(stored);
    // Update HTML lang attribute
    document.documentElement.lang = stored;
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    setStoredLanguage(lang);
    document.documentElement.lang = lang;
  };

  const t = (key: string, params?: Record<string, string | number>): string => {
    if (!mounted) {
      // Return English translation during SSR
      const keys = key.split('.');
      let value: any = translations.en;
      for (const k of keys) {
        value = value?.[k];
      }
      if (typeof value !== 'string') return key;
      return params ? replaceParams(value, params) : value;
    }

    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    if (typeof value !== 'string') {
      // Fallback to English if translation missing
      let fallback: any = translations.en;
      for (const k of keys) {
        fallback = fallback?.[k];
      }
      if (typeof fallback === 'string') {
        value = fallback;
      } else {
        return key; // Return key if no translation found
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
    <I18nContext.Provider value={{ language, setLanguage, t }}>
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

