'use client';

import { memo, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';

function FloatingButton() {
  const { t } = useI18n();
  
  const scrollToEnroll = useCallback(() => {
    const videoSection = document.querySelector('[data-video-section]');
    if (videoSection) {
      videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, []);

  return (
    <button
      onClick={scrollToEnroll}
      className="fixed bottom-6 right-6 z-50 bg-charcoal-950 text-white font-medium text-sm md:text-base px-5 md:px-7 py-3 md:py-3.5 rounded-full shadow-soft-xl hover:bg-charcoal-800 transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center space-x-2 hover:shadow-soft-2xl"
      aria-label={t('home.enrollNow')}
    >
      <span>{t('home.enrollNow')}</span>
      <svg
        className="w-5 h-5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
  );
}

export default memo(FloatingButton);

