'use client';

import { useState, useRef, useEffect } from 'react';

// Launch date - March 11, 2026 at midnight Georgia time (GMT+4)
const LAUNCH_DATE = new Date('2026-03-11T00:00:00+04:00');

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function calculateTimeLeft(launchDate: Date): TimeLeft {
  const difference = launchDate.getTime() - new Date().getTime();

  if (difference <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / 1000 / 60) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  };
}

export default function ComingSoonPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => calculateTimeLeft(LAUNCH_DATE));
  const videoRef = useRef<HTMLVideoElement>(null);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(LAUNCH_DATE));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes('@')) {
      setSubmitStatus('error');
      setErrorMessage('გთხოვთ შეიყვანოთ სწორი ელ-ფოსტის მისამართი');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch('/api/coming-soon/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'გამოწერა ვერ მოხერხდა');
      }

      setSubmitStatus('success');
      setEmail('');
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'დაფიქსირდა შეცდომა');
    } finally {
      setIsSubmitting(false);
    }
  };

  const TimeBlock = ({ value, label }: { value: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div className="bg-navy-900/80 backdrop-blur-md border border-navy-700/50 rounded-2xl p-4 md:p-6 min-w-[80px] md:min-w-[120px]">
        <span className="text-4xl md:text-6xl font-bold text-white tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="text-emerald-400 text-sm md:text-base mt-2 font-medium uppercase tracking-wider">
        {label}
      </span>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-navy-900 to-charcoal-950 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 w-full max-w-6xl mx-auto flex flex-col items-center gap-8 md:gap-12">
        {/* Logo/Title */}
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-2">
            swavleba<span className="text-emerald-400">.ge</span>
          </h1>
          <p className="text-navy-300 text-lg md:text-xl">
            რაღაც განსაკუთრებული მოდის
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="flex gap-3 md:gap-6">
          <TimeBlock value={timeLeft.days} label="დღე" />
          <TimeBlock value={timeLeft.hours} label="საათი" />
          <TimeBlock value={timeLeft.minutes} label="წუთი" />
          <TimeBlock value={timeLeft.seconds} label="წამი" />
        </div>

        {/* Email Subscription Form - Prominent Section */}
        <div className="w-full max-w-2xl">
          <div className="relative">
            {/* Glowing border effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/40 via-emerald-400/20 to-emerald-500/40 rounded-3xl blur-lg"></div>
            <div className="relative bg-navy-900/80 backdrop-blur-xl border border-emerald-500/30 rounded-3xl p-8 md:p-10">
              <div className="flex flex-col items-center">
                {/* Mail icon */}
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>

                <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-2">
                  შეგვატყობინე გაშვებისას
                </h2>
                <p className="text-navy-300 text-center mb-8 text-base md:text-lg max-w-md">
                  იყავი პირველი, ვინც გაიგებს swavleba.ge-ს გაშვების შესახებ
                </p>

                {submitStatus === 'success' ? (
                  <div className="text-center py-4">
                    <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                      <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-emerald-400 font-semibold text-xl">გმადლობთ გამოწერისთვის!</p>
                    <p className="text-navy-400 text-sm mt-2">ჩვენ შეგატყობინებთ გაშვებისას.</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="w-full space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative">
                        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
                          <svg className="w-5 h-5 text-navy-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                          </svg>
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="შეიყვანეთ ელ-ფოსტა"
                          className="w-full pl-12 pr-4 py-4 bg-navy-800/60 border-2 border-navy-600/50 rounded-2xl text-white text-lg placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                          disabled={isSubmitting}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-bold text-lg rounded-2xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 whitespace-nowrap"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            იგზავნება...
                          </span>
                        ) : (
                          'შემატყობინე'
                        )}
                      </button>
                    </div>

                    {submitStatus === 'error' && (
                      <p className="text-red-400 text-sm text-center">{errorMessage}</p>
                    )}

                    <p className="text-navy-500 text-xs text-center">
                      სპამს არ გამოგიგზავნით. მხოლოდ გაშვების შეტყობინება.
                    </p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Video Section */}
        <div className="w-full max-w-5xl">
          <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-navy-700/30 bg-navy-950">
            {/* Gradient halo */}
            <div className="absolute -inset-1 rounded-3xl blur-xl -z-10 bg-gradient-to-r from-emerald-500/20 via-emerald-400/10 to-emerald-500/20"></div>

            <div className="relative aspect-video">
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

              {/* Play Button Overlay */}
              {!isPlaying && (
                <button
                  onClick={handlePlay}
                  className="absolute inset-0 flex items-center justify-center group"
                  aria-label="ვიდეოს დაკვრა"
                >
                  <div className="w-20 h-20 md:w-28 md:h-28 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/20 transform transition-all duration-300 group-hover:scale-110 group-active:scale-95">
                    <svg
                      className="w-8 h-8 md:w-12 md:h-12 text-emerald-500 ml-1"
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
        </div>
      </div>
    </div>
  );
}
