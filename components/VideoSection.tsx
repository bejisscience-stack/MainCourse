'use client';

import { useState, useRef, memo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { ScrollReveal } from './ScrollReveal';

function VideoSection() {
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { t } = useI18n();

  const handlePlay = () => {
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play();
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.muted = true;
    }
  };

  return (
    <section data-video-section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32 relative">
      {/* Subtle radial gradient halo behind video */}
      <div className="absolute inset-0 top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[400px] pointer-events-none blur-3xl">
        <div className="w-full h-full bg-gradient-radial from-emerald-500/4 via-emerald-500/1 to-transparent dark:from-emerald-400/6 dark:via-emerald-400/2 dark:to-transparent"></div>
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <ScrollReveal delay={0} duration={600}>
          {/* Video Container with soft shadow, rounded corners, and transparent background */}
          <div className="relative rounded-3xl overflow-hidden shadow-soft-2xl border border-charcoal-100/30 dark:border-navy-700/30 transition-all duration-500 bg-charcoal-950 dark:bg-navy-950">
            {/* Subtle gradient halo around the container */}
            <div className="absolute -inset-1 rounded-3xl blur-xl -z-10 bg-gradient-radial from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-emerald-400/15 dark:via-emerald-400/8 dark:to-transparent"></div>

            <div
              className="relative aspect-video transition-all duration-500 overflow-hidden"
              style={{ zIndex: 1 }}
            >
              {/* Video element - always present */}
              <video
                ref={videoRef}
                src="https://nbecbsbuerdtakxkrduw.supabase.co/storage/v1/object/public/course-videos/intro-video.mp4"
                muted
                playsInline
                controls={isPlaying}
                className="absolute inset-0 w-full h-full object-cover"
                onEnded={handleEnded}
              >
                Your browser does not support the video tag.
              </video>

              {/* Play Button Overlay - visible when not playing */}
              {!isPlaying && (
                <button
                  onClick={handlePlay}
                  className="absolute inset-0 flex items-center justify-center group z-10"
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
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

export default memo(VideoSection);
