'use client';

import { memo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import Link from 'next/link';
import { ScrollReveal } from './ScrollReveal';

function Hero() {
  const { t } = useI18n();
  
  return (
    <section className="pt-32 md:pt-48 pb-20 md:pb-32 px-4 sm:px-6 lg:px-8 relative">
      {/* Subtle radial gradient halo behind content */}
      <div className="absolute inset-0 top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-[600px] pointer-events-none blur-3xl">
        <div className="w-full h-full bg-gradient-radial from-emerald-500/5 via-emerald-500/2 to-transparent dark:from-emerald-400/8 dark:via-emerald-400/3 dark:to-transparent"></div>
      </div>
      
      <div className="max-w-5xl mx-auto text-center relative z-10">
        <ScrollReveal delay={0} duration={600}>
          <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold text-charcoal-950 dark:text-white mb-6 leading-[1.1] tracking-tight">
            {t('home.title')}
            <br />
            <span className="text-charcoal-700 dark:text-gray-300 font-semibold">{t('home.titleSubtext')}</span>
          </h1>
        </ScrollReveal>
        
        <ScrollReveal delay={100} duration={600}>
          <p className="text-lg sm:text-xl md:text-2xl text-charcoal-600 dark:text-gray-400 max-w-2xl mx-auto font-normal leading-relaxed mb-12">
            {t('home.subtitle')}
          </p>
        </ScrollReveal>
        
        <ScrollReveal delay={200} duration={600}>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/courses"
              className="group px-8 py-4 bg-charcoal-950 dark:bg-emerald-500 text-white rounded-full font-medium text-base hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-300 hover:shadow-soft-xl dark:hover:shadow-glow-dark hover:-translate-y-0.5 active:translate-y-0"
            >
              {t('home.enrollNow')}
              <span className="inline-block ml-2 transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default memo(Hero);
