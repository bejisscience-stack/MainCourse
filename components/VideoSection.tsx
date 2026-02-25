'use client';

import { memo } from 'react';
import { ScrollReveal } from './ScrollReveal';
import VideoPlayer from './VideoPlayer';

const VIDEO_SRC = "https://nbecbsbuerdtakxkrduw.supabase.co/storage/v1/object/public/course-videos/intro-video.mp4";

function VideoSection() {
  return (
    <section data-video-section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32 relative">
      <div className="max-w-5xl mx-auto relative z-10">
        <ScrollReveal delay={0} duration={600}>
          <VideoPlayer src={VIDEO_SRC} />
        </ScrollReveal>
      </div>
    </section>
  );
}

export default memo(VideoSection);
