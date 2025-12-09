'use client';

export default function FloatingButton() {
  const scrollToEnroll = () => {
    const videoSection = document.querySelector('[data-video-section]');
    if (videoSection) {
      videoSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <button
      onClick={scrollToEnroll}
      className="fixed bottom-6 right-6 z-50 bg-navy-900 text-white font-bold text-base md:text-lg px-6 md:px-8 py-3 md:py-4 rounded-full shadow-2xl hover:bg-navy-800 transition-all transform hover:scale-110 active:scale-95 flex items-center space-x-2"
      aria-label="Enroll Now"
    >
      <span>Enroll Now</span>
      <svg
        className="w-5 h-5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </button>
  );
}

