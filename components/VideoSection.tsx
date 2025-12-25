'use client';

import { useState, memo } from 'react';
import Image from 'next/image';
import { useI18n } from '@/contexts/I18nContext';
import { ScrollReveal } from './ScrollReveal';

function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useI18n();

  return (
    <section data-video-section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32 relative">
      {/* Subtle radial gradient halo behind video */}
      <div className="absolute inset-0 top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[400px] pointer-events-none blur-3xl">
        <div className="w-full h-full bg-gradient-radial from-emerald-500/4 via-emerald-500/1 to-transparent dark:from-emerald-400/6 dark:via-emerald-400/2 dark:to-transparent"></div>
      </div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <ScrollReveal delay={0} duration={600}>
          {/* Video Container with soft shadow, rounded corners, and transparent background */}
          <div className={`relative rounded-3xl overflow-hidden shadow-soft-2xl border border-charcoal-100/30 dark:border-navy-700/30 transition-all duration-500 ${
            isPlaying 
              ? 'bg-white dark:bg-navy-800' 
              : 'bg-transparent'
          }`}>
            {/* Subtle gradient halo around the container */}
            <div className="absolute -inset-1 rounded-3xl blur-xl -z-10 bg-gradient-radial from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-400/15 dark:via-emerald-400/8 dark:to-transparent"></div>
            
            <div 
              className={`relative aspect-video transition-all duration-500 overflow-hidden ${
                isPlaying 
                  ? 'bg-gradient-to-br from-charcoal-50 via-white to-emerald-50/20 dark:from-navy-900 dark:via-navy-800 dark:to-emerald-500/5' 
                  : 'bg-transparent'
              }`}
              style={{ zIndex: 1 }}
            >
              {/* Thumbnail Image - visible when not playing */}
              {!isPlaying && (
                <div 
                  className="absolute inset-0 w-full h-full"
                  style={{ 
                    zIndex: 2,
                  }}
                >
                  <Image
                    src="/supabase/font.png"
                    alt="Video thumbnail"
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1200px"
                    className="object-cover transition-opacity duration-500"
                    style={{ 
                      opacity: 0.6,
                    }}
                    priority
                    unoptimized
                  />
                </div>
              )}
              
              {/* Soft gradient overlay - only when playing */}
              {isPlaying && (
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/5 dark:from-navy-950/10 via-transparent to-transparent"></div>
              )}
              
              {/* Play Button */}
              {!isPlaying && (
                <button
                  onClick={() => setIsPlaying(true)}
                  className="absolute inset-0 flex items-center justify-center group"
                  style={{ zIndex: 10 }}
                  aria-label={t('videoSection.enrollNow')}
                >
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white/90 dark:bg-navy-800/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-soft-xl border border-charcoal-100/50 dark:border-navy-700/50 transform transition-all duration-300 group-hover:scale-110 group-hover:shadow-glow dark:group-hover:shadow-glow-dark group-active:scale-95 will-change-transform" style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}>
                    <svg
                      className="w-7 h-7 md:w-9 md:h-9 text-emerald-500 dark:text-emerald-400 ml-1"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </button>
              )}

              {/* Video placeholder - replace with actual video when ready */}
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-charcoal-950 dark:bg-navy-950 z-10">
                  <p className="text-white dark:text-gray-300 text-lg">{t('videoSection.videoPlayerPlaceholder')}</p>
                </div>
              )}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default memo(VideoSection);
