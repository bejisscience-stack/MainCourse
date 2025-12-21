export type Language = 'en' | 'ge';

export const languages: { code: Language; name: string; flag: string }[] = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'ge', name: 'ქართული', flag: '🇬🇪' },
];

export const defaultLanguage: Language = 'ge';

export function getStoredLanguage(): Language {
  if (typeof window === 'undefined') return defaultLanguage;
  const stored = localStorage.getItem('language');
  return (stored === 'en' || stored === 'ge') ? stored : defaultLanguage;
}

export function setStoredLanguage(language: Language): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('language', language);
}

