'use client';

import { useEffect, useState, useRef } from 'react';

interface SocialIcon {
  id: number;
  x: number;
  type: 'instagram' | 'youtube' | 'tiktok' | 'x';
  delay: number;
  duration: number;
}

export function SocialIconFlow() {
  const [icons, setIcons] = useState<SocialIcon[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [lastMilestone, setLastMilestone] = useState<number | null>(null);
  const iconIdRef = useRef(0);

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

  // Trigger icons at specific scroll milestones
  useEffect(() => {
    if (isReducedMotion) return;

    const milestones = [0.15, 0.35, 0.55, 0.75];
    const currentMilestone = milestones.find(m => 
      scrollProgress >= m && scrollProgress < m + 0.05 && m !== lastMilestone
    );

    if (currentMilestone) {
      setLastMilestone(currentMilestone);
      
      const types: SocialIcon['type'][] = ['instagram', 'youtube', 'tiktok', 'x'];
      const newIcon: SocialIcon = {
        id: iconIdRef.current++,
        x: Math.random() * window.innerWidth * 0.8 + window.innerWidth * 0.1,
        type: types[Math.floor(Math.random() * types.length)],
        delay: Math.random() * 200,
        duration: 4000 + Math.random() * 2000,
      };
      
      setIcons(prev => [...prev, newIcon]);

      // Remove icon after animation
      setTimeout(() => {
        setIcons(prev => prev.filter(i => i.id !== newIcon.id));
      }, newIcon.duration);
    }
  }, [scrollProgress, isReducedMotion, lastMilestone]);

  const getIconSVG = (type: SocialIcon['type']) => {
    const size = 20;
    const commonProps = {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      className: 'text-emerald-500 dark:text-emerald-400',
    };

    switch (type) {
      case 'instagram':
        return (
          <svg {...commonProps}>
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17" cy="7" r="1" fill="currentColor" />
          </svg>
        );
      case 'youtube':
        return (
          <svg {...commonProps}>
            <path d="M22 8.5c0 1.5-.5 2.5-1 3s-1.5 1-3 1h-12c-1.5 0-2-.5-2.5-1S2 10 2 8.5v7c0 1.5.5 2.5 1 3s1.5 1 2.5 1h12c1.5 0 2-.5 2.5-1s1-1.5 1-3v-7z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 9l5 3-5 3V9z" fill="currentColor" />
          </svg>
        );
      case 'tiktok':
        return (
          <svg {...commonProps}>
            <path d="M19.5 6a4.5 4.5 0 01-4.5-4.5v12a4.5 4.5 0 01-4.5 4.5 4.5 4.5 0 01-4.5-4.5V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M15 6h4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
      case 'x':
        return (
          <svg {...commonProps}>
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        );
    }
  };

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {icons.map(icon => (
        <div
          key={icon.id}
          className="absolute"
          style={{
            left: `${icon.x}px`,
            top: 'calc(100vh + 50px)',
            transform: 'translate(-50%, -50%)',
            opacity: 0.08,
            animation: `socialFloat ${icon.duration}ms ease-out ${icon.delay}ms forwards`,
          }}
        >
          {getIconSVG(icon.type)}
        </div>
      ))}
    </div>
  );
}
