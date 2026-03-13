'use client';

import { useEffect, useState, useRef } from 'react';

interface Signal {
  id: number;
  x: number;
  y: number;
  delay: number;
  duration: number;
}

export function DataSignals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [lastMilestone, setLastMilestone] = useState<number | null>(null);
  const signalIdRef = useRef(0);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? Math.min(Math.max(scrollTop / scrollHeight, 0), 1) : 0;
      setScrollProgress(progress);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Trigger signals at specific scroll milestones
  useEffect(() => {
    if (isReducedMotion) return;

    const milestones = [0.3, 0.45, 0.6, 0.8];
    const currentMilestone = milestones.find(m => 
      scrollProgress >= m && scrollProgress < m + 0.05 && m !== lastMilestone
    );

    if (currentMilestone) {
      setLastMilestone(currentMilestone);
      
      const newSignal: Signal = {
        id: signalIdRef.current++,
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        delay: Math.random() * 200,
        duration: 1500 + Math.random() * 1000,
      };
      
      setSignals(prev => [...prev, newSignal]);

      // Remove signal after animation
      setTimeout(() => {
        setSignals(prev => prev.filter(s => s.id !== newSignal.id));
      }, newSignal.duration);
    }
  }, [scrollProgress, isReducedMotion, lastMilestone]);

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {signals.map(signal => (
        <div
          key={signal.id}
          className="absolute"
          style={{
            left: `${signal.x}px`,
            top: `${signal.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.08,
            animation: `signalPulse ${signal.duration}ms ease-out ${signal.delay}ms forwards`,
          }}
        >
          {/* Pulse dot */}
          <div className="relative">
            <div className="absolute inset-0 bg-emerald-500 dark:bg-emerald-400 rounded-full opacity-30 animate-ping"></div>
            <div className="relative w-2 h-2 bg-emerald-500 dark:bg-emerald-400 rounded-full"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
