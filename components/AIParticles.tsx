'use client';

import { useEffect, useState, useRef } from 'react';

interface AIParticle {
  id: number;
  y: number;
  direction: 'left' | 'right';
  delay: number;
  duration: number;
}

export function AIParticles() {
  const [particles, setParticles] = useState<AIParticle[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [lastMilestone, setLastMilestone] = useState<number | null>(null);
  const particleIdRef = useRef(0);

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

  // Trigger particles at specific scroll milestones
  useEffect(() => {
    if (isReducedMotion) return;

    const milestones = [0.25, 0.5, 0.75];
    const currentMilestone = milestones.find(m => 
      scrollProgress >= m && scrollProgress < m + 0.05 && m !== lastMilestone
    );

    if (currentMilestone) {
      setLastMilestone(currentMilestone);
      
      const newParticle: AIParticle = {
        id: particleIdRef.current++,
        y: window.innerHeight * (0.3 + Math.random() * 0.4),
        direction: Math.random() > 0.5 ? 'right' : 'left',
        delay: Math.random() * 300,
        duration: 2500 + Math.random() * 1500,
      };
      
      setParticles(prev => [...prev, newParticle]);

      // Remove particle after animation
      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== newParticle.id));
      }, newParticle.duration);
    }
  }, [scrollProgress, isReducedMotion, lastMilestone]);

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[1]" aria-hidden="true">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute"
          style={{
            left: particle.direction === 'right' ? '-30px' : 'calc(100% + 30px)',
            top: `${particle.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.06,
            animation: `aiSlide${particle.direction === 'right' ? 'Right' : 'Left'} ${particle.duration}ms ease-in-out ${particle.delay}ms forwards`,
          }}
        >
          {/* Minimal AI bot silhouette */}
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            className="text-emerald-500 dark:text-emerald-400"
          >
            {/* Simple robot head */}
            <rect x="6" y="4" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.8" />
            {/* Eyes */}
            <circle cx="10" cy="8" r="1" fill="currentColor" opacity="0.6" />
            <circle cx="14" cy="8" r="1" fill="currentColor" opacity="0.6" />
            {/* Body */}
            <rect x="8" y="14" width="8" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.6" />
          </svg>
        </div>
      ))}
    </div>
  );
}
