'use client';

import { useI18n } from '@/contexts/I18nContext';
import { languages } from '@/lib/i18n';

export default function LanguageSelector() {
  const { language, setLanguage } = useI18n();

  // Toggle between English and Georgian
  const handleToggleLanguage = () => {
    const nextLanguage = language === 'en' ? 'ge' : 'en';
    setLanguage(nextLanguage);
  };

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];
  const nextLanguage = languages.find(lang => lang.code !== language) || languages[1];

  return (
    <button
      onClick={handleToggleLanguage}
      className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-charcoal-100/50 dark:hover:bg-navy-800/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 dark:focus:ring-offset-navy-900"
      aria-label={`Switch to ${nextLanguage.name}`}
      title={`Switch to ${nextLanguage.name}`}
    >
      <span className="text-xl" role="img" aria-label={currentLanguage.name}>
        {currentLanguage.flag}
      </span>
      <span className="hidden sm:inline text-sm font-medium text-charcoal-600 dark:text-gray-400">
        {currentLanguage.code.toUpperCase()}
      </span>
    </button>
  );
}



