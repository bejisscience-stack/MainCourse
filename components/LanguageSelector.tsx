'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { languages } from '@/lib/i18n';

export default function LanguageSelector() {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const currentLanguage = languages.find(lang => lang.code === language) || languages[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 rounded-xl hover:bg-charcoal-50/50 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-charcoal-200 focus:ring-offset-2"
        aria-label="Select language"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="text-xl" role="img" aria-label={currentLanguage.name}>
          {currentLanguage.flag}
        </span>
        <span className="hidden sm:inline text-sm font-medium text-charcoal-600">
          {currentLanguage.code.toUpperCase()}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-charcoal-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-soft-xl border border-charcoal-100/50 py-2 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-2 text-sm transition-colors ${
                language === lang.code
                  ? 'bg-charcoal-50/50 text-charcoal-950 font-medium'
                  : 'text-charcoal-600 hover:bg-charcoal-50/50'
              }`}
            >
              <span className="text-xl" role="img" aria-label={lang.name}>
                {lang.flag}
              </span>
              <span className="flex-1 text-left">{lang.name}</span>
              {language === lang.code && (
                <svg
                  className="w-4 h-4 text-charcoal-950"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}



