'use client';

import { useState, useRef, useEffect } from 'react';

// Calculate launch date (21 days from initial deployment)
const LAUNCH_DATE = new Date();
LAUNCH_DATE.setDate(LAUNCH_DATE.getDate() + 21);
LAUNCH_DATE.setHours(0, 0, 0, 0);

// Store the launch date in localStorage to persist across refreshes
const getLaunchDate = (): Date => {
  if (typeof window === 'undefined') return LAUNCH_DATE;

  const stored = localStorage.getItem('swavleba_launch_date');
  if (stored) {
    return new Date(stored);
  }

  const launchDate = new Date();
  launchDate.setDate(launchDate.getDate() + 21);
  launchDate.setHours(0, 0, 0, 0);
  localStorage.setItem('swavleba_launch_date', launchDate.toISOString());
  return launchDate;
};

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
  const [launchDate, setLaunchDate] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 21, hours: 0, minutes: 0, seconds: 0 });
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize launch date on client side
  useEffect(() => {
    const date = getLaunchDate();
    setLaunchDate(date);
    setTimeLeft(calculateTimeLeft(date));
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!launchDate) return;

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(launchDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [launchDate]);

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
      setErrorMessage('Please enter a valid email address');
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
        throw new Error(data.error || 'Failed to subscribe');
      }

      setSubmitStatus('success');
      setEmail('');
    } catch (error) {
      setSubmitStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong');
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
            Something amazing is coming
          </p>
        </div>

        {/* Countdown Timer */}
        <div className="flex gap-3 md:gap-6">
          <TimeBlock value={timeLeft.days} label="Days" />
          <TimeBlock value={timeLeft.hours} label="Hours" />
          <TimeBlock value={timeLeft.minutes} label="Minutes" />
          <TimeBlock value={timeLeft.seconds} label="Seconds" />
        </div>

        {/* Video Section - Bigger version */}
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
                  aria-label="Play video"
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

        {/* Email Subscription Form */}
        <div className="w-full max-w-md">
          <div className="bg-navy-900/60 backdrop-blur-md border border-navy-700/50 rounded-2xl p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-semibold text-white text-center mb-2">
              Get notified when we launch
            </h2>
            <p className="text-navy-300 text-center mb-6 text-sm md:text-base">
              Be the first to know when swavleba.ge goes live
            </p>

            {submitStatus === 'success' ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-emerald-400 font-medium">Thank you for subscribing!</p>
                <p className="text-navy-400 text-sm mt-1">We&apos;ll notify you when we launch.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full px-4 py-3 bg-navy-800/50 border border-navy-600/50 rounded-xl text-white placeholder-navy-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    disabled={isSubmitting}
                  />
                </div>

                {submitStatus === 'error' && (
                  <p className="text-red-400 text-sm">{errorMessage}</p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Subscribing...
                    </span>
                  ) : (
                    'Notify Me'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
