'use client';

import { useEffect, useState, useRef } from 'react';

interface Drop {
  id: number;
  x: number;
  rotation: number;
  delay: number;
  duration: number;
}

export function BitcoinDrops() {
  const [drops, setDrops] = useState<Drop[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [lastMilestone, setLastMilestone] = useState<number | null>(null);
  const dropIdRef = useRef(0);

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

  // Trigger drops at specific scroll milestones
  useEffect(() => {
    if (isReducedMotion) return;

    const milestones = [0.2, 0.4, 0.6, 0.8];
    const currentMilestone = milestones.find(m => 
      scrollProgress >= m && scrollProgress < m + 0.05 && m !== lastMilestone
    );

    if (currentMilestone) {
      setLastMilestone(currentMilestone);
      
      const newDrop: Drop = {
        id: dropIdRef.current++,
        x: Math.random() * window.innerWidth,
        rotation: Math.random() * 360,
        delay: 0,
        duration: 3000 + Math.random() * 2000,
      };
      
      setDrops(prev => [...prev, newDrop]);

      // Remove drop after animation
      setTimeout(() => {
        setDrops(prev => prev.filter(d => d.id !== newDrop.id));
      }, newDrop.duration);
    }
  }, [scrollProgress, isReducedMotion, lastMilestone]);

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {drops.map(drop => (
        <div
          key={drop.id}
          className="absolute"
          style={{
            left: `${drop.x}px`,
            top: '-50px',
            transform: `translate(-50%, -50%) rotate(${drop.rotation}deg)`,
            opacity: 0.05,
            animation: `bitcoinDrop ${drop.duration}ms ease-in ${drop.delay}ms forwards`,
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className="text-emerald-500 dark:text-emerald-400"
          >
            <circle
              cx="12"
              cy="12"
              r="8"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
            <path
              d="M9 8h3c0.5 0 1 0.5 1 1s-0.5 1-1 1H9m0-2h-0.5m0.5 2h-0.5m0 0h3c0.5 0 1 0.5 1 1s-0.5 1-1 1H9"
              stroke="currentColor"
              strokeWidth="0.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
      ))}
    </div>
  );
}
