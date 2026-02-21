'use client';

import { memo } from 'react';

function BackgroundShapes() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Soft radial gradient blobs - extremely low opacity */}
      <div className="absolute top-20 -left-20 w-[600px] h-[600px] bg-emerald-500/3 dark:bg-emerald-400/3 rounded-full blur-3xl animate-float"></div>
      <div className="absolute top-40 right-10 w-[500px] h-[500px] bg-emerald-400/2 dark:bg-emerald-300/2 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
      <div className="absolute bottom-20 left-1/4 w-[550px] h-[550px] bg-charcoal-200/2 dark:bg-navy-400/2 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-40 right-1/4 w-[450px] h-[450px] bg-emerald-500/2 dark:bg-emerald-400/2 rounded-full blur-3xl animate-float" style={{ animationDelay: '0.5s' }}></div>

      {/* Abstract financial growth - soft curved chart lines - even lower opacity */}
      <div className="absolute top-1/3 left-1/4 w-64 h-40 md:w-80 md:h-48 opacity-[0.008] dark:opacity-[0.012] blur-xl">
        <svg viewBox="0 0 200 120" fill="none" className="w-full h-full text-emerald-500 dark:text-emerald-400">
          <defs>
            <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="currentColor" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path 
            d="M10 90 Q30 70, 50 60 T90 40 T130 30 T170 20" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round"
            fill="none"
          />
          <path 
            d="M10 90 Q30 70, 50 60 T90 40 T130 30 T170 20 L170 120 L10 120 Z" 
            fill="url(#chartGradient)"
          />
        </svg>
      </div>

      {/* Abstract digital value / crypto - circular shapes - even lower opacity */}
      <div className="absolute top-1/2 right-1/3 w-32 h-32 md:w-48 md:h-48 opacity-[0.008] dark:opacity-[0.015] blur-2xl">
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-emerald-500 dark:text-emerald-400">
          <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3"/>
          <circle cx="50" cy="50" r="25" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.2"/>
          <circle cx="50" cy="50" r="10" fill="currentColor" opacity="0.25"/>
          <path d="M30 50 L50 30 L70 50 L50 70 Z" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.2"/>
        </svg>
      </div>

      {/* Abstract opportunity & access - key-like outlines - even lower opacity */}
      <div className="absolute bottom-1/3 right-1/5 w-24 h-24 md:w-32 md:h-32 opacity-[0.008] dark:opacity-[0.015] blur-2xl">
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-charcoal-600 dark:text-navy-300">
          <rect x="40" y="30" width="20" height="30" rx="2" stroke="currentColor" strokeWidth="1" fill="none"/>
          <circle cx="50" cy="60" r="8" stroke="currentColor" strokeWidth="1" fill="none"/>
          <path d="M50 20 L50 30" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
          <circle cx="50" cy="20" r="3" fill="currentColor" opacity="0.3"/>
        </svg>
      </div>

      {/* Abstract social platforms - dots or minimal nodes - even lower opacity */}
      <div className="absolute top-1/4 right-1/4 w-40 h-40 md:w-56 md:h-56 opacity-[0.008] dark:opacity-[0.015] blur-xl">
        <svg viewBox="0 0 100 100" fill="none" className="w-full h-full text-charcoal-600 dark:text-navy-300">
          <circle cx="20" cy="20" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="50" cy="20" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="80" cy="20" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="20" cy="50" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="50" cy="50" r="4" fill="currentColor" opacity="0.3"/>
          <circle cx="80" cy="50" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="20" cy="80" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="50" cy="80" r="3" fill="currentColor" opacity="0.25"/>
          <circle cx="80" cy="80" r="3" fill="currentColor" opacity="0.25"/>
          <path d="M20 20 L50 50 L80 20" stroke="currentColor" strokeWidth="0.3" opacity="0.15"/>
          <path d="M20 50 L50 50 L80 50" stroke="currentColor" strokeWidth="0.3" opacity="0.15"/>
          <path d="M20 80 L50 50 L80 80" stroke="currentColor" strokeWidth="0.3" opacity="0.15"/>
        </svg>
      </div>

      {/* Additional soft geometric shapes - even more subtle */}
      <div className="absolute top-1/3 left-1/2 w-32 h-32 md:w-48 md:h-48 opacity-[0.01] dark:opacity-[0.015]">
        <div className="w-full h-full bg-emerald-500/3 dark:bg-emerald-400/3 rotate-45 rounded-2xl blur-2xl"></div>
      </div>
      <div className="absolute bottom-1/4 left-1/2 w-24 h-24 md:w-40 md:h-40 opacity-[0.008] dark:opacity-[0.012]">
        <div className="w-full h-full bg-charcoal-300/2 dark:bg-navy-400/2 -rotate-12 rounded-3xl blur-2xl"></div>
      </div>
    </div>
  );
}

export default memo(BackgroundShapes);
