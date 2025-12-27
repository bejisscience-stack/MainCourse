'use client';

import { ReactNode } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  threshold?: number;
  className?: string;
  mobileReduced?: boolean;
}

export function ScrollReveal({
  children,
  delay = 0,
  duration = 500,
  threshold = 0.1,
  className = '',
  mobileReduced = true,
}: ScrollRevealProps) {
  const { ref, style } = useScrollReveal({
    delay,
    duration,
    threshold,
    mobileReduced,
  });

  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} style={style} className={className}>
      {children}
    </div>
  );
}




