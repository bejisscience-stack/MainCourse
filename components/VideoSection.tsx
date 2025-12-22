'use client';

import { useState, memo } from 'react';
import { useI18n } from '@/contexts/I18nContext';

function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useI18n();

  return (
    <section data-video-section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
      <div className="max-w-4xl mx-auto">
        {/* Video Thumbnail */}
        <div className="relative mb-8 rounded-2xl overflow-hidden shadow-2xl">
          <div className="relative aspect-video bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900">
            {/* Video thumbnail overlay */}
            <div className="absolute inset-0 bg-black/40"></div>
            
            {/* Play Button */}
            <button
              onClick={() => setIsPlaying(true)}
              className="absolute inset-0 flex items-center justify-center group"
              aria-label={t('videoSection.enrollNow')}
            >
              <div className="w-20 h-20 md:w-24 md:h-24 bg-white/95 rounded-full flex items-center justify-center shadow-xl transform transition-transform group-hover:scale-110 group-active:scale-95">
                <svg
                  className="w-8 h-8 md:w-10 md:h-10 text-navy-900 ml-1"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </button>

            {/* Video placeholder - replace with actual video when ready */}
            {isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <p className="text-white text-lg">{t('videoSection.videoPlayerPlaceholder')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(VideoSection);

