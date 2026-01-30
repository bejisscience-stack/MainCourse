import Cookies from 'js-cookie';

export type Language = 'en' | 'ge';

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ge', name: 'ქართული', flag: '🇬🇪' },
];

export const defaultLanguage: Language = 'ge';
export const LANGUAGE_COOKIE_NAME = 'language';

/**
 * Get the stored language from cookies (client-side)
 * Falls back to default language if not set
 */
export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return defaultLanguage;
  const stored = Cookies.get(LANGUAGE_COOKIE_NAME);
  return (stored === 'en' || stored === 'ge') ? stored : defaultLanguage;
}

/**
 * Set the language in cookies (client-side)
 * Cookie expires in 1 year
 */
export function setStoredLanguage(language: Language): void {
  if (typeof window === 'undefined') return;
  Cookies.set(LANGUAGE_COOKIE_NAME, language, {
    expires: 365, // 1 year
    path: '/',
    sameSite: 'lax'
  });
}

