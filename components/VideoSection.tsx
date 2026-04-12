"use client";

import { memo } from "react";
import dynamic from "next/dynamic";
import { ScrollReveal } from "./ScrollReveal";

const VideoPlayer = dynamic(() => import("./VideoPlayer"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-video bg-navy-900/50 rounded-xl animate-pulse" />
  ),
});

const VIDEO_SRC =
  "https://nbecbsbuerdtakxkrduw.supabase.co/storage/v1/object/public/course-videos/intro-video.mp4";

function VideoSection() {
  return (
    <section
      data-video-section
      className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32 relative z-[1] overflow-hidden"
    >
      <div className="max-w-5xl mx-auto relative z-10">
        <ScrollReveal delay={0} duration={600}>
          <VideoPlayer src={VIDEO_SRC} />
        </ScrollReveal>
      </div>
    </section>
  );
}

export default memo(VideoSection);
