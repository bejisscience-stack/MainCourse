'use client';

import { useState, memo, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface VideoSectionProps {
  studentCount: number;
}

function VideoSection({ studentCount }: VideoSectionProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const { t } = useI18n();

  const formatCount = useMemo(() => {
    return (num: number) => num.toLocaleString('en-US');
  }, []);

  const formattedCount = useMemo(() => formatCount(studentCount), [formatCount, studentCount]);

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

        {/* Enroll Button and Student Count */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
          <button className="w-full sm:w-auto bg-navy-900 text-white font-bold text-lg md:text-xl px-8 md:px-12 py-4 md:py-5 rounded-xl hover:bg-navy-800 transition-all transform hover:scale-105 shadow-lg">
            {t('videoSection.enrollNow')}
          </button>
          
          <div className="flex items-center space-x-2 text-navy-700">
            <svg
              className="w-5 h-5 md:w-6 md:h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="font-semibold text-base md:text-lg">
              <span className="text-navy-900">{formattedCount}+</span> {t('videoSection.studentsEnrolled')}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default memo(VideoSection);

