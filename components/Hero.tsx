'use client';

import { memo } from 'react';
import { useI18n } from '@/contexts/I18nContext';

function Hero() {
  const { t } = useI18n();
  
  return (
    <section className="pt-32 md:pt-40 pb-16 md:pb-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-navy-900 mb-6 leading-tight">
          {t('home.title')}
          <br />
          <span className="text-navy-600">{t('home.titleSubtext')}</span>
        </h1>
        <p className="text-lg sm:text-xl md:text-2xl text-navy-700 max-w-2xl mx-auto font-medium">
          {t('home.subtitle')}
        </p>
      </div>
    </section>
  );
}

export default memo(Hero);

