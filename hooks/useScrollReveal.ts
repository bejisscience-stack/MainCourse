'use client';

import { useEffect, useRef, useState } from 'react';

interface UseScrollRevealOptions {
  threshold?: number;
  rootMargin?: string;
  delay?: number;
  duration?: number;
  once?: boolean;
  mobileReduced?: boolean;
}

export function useScrollReveal(options: UseScrollRevealOptions = {}) {
  const {
    threshold = 0.1,
    rootMargin = '0px 0px -50px 0px',
    delay = 0,
    duration = 500,
    once = true,
    mobileReduced = true,
  } = options;

  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    
    const element = elementRef.current;
    if (!element) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Check if mobile and reduce motion
    const isMobile = window.innerWidth < 768;
    const shouldReduce = mobileReduced && isMobile;
    
    // If reduced motion, skip animation
    if (prefersReducedMotion) {
      setIsVisible(true);
      setHasAnimated(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
            if (once) {
              setHasAnimated(true);
            }
          } else if (!once) {
            setIsVisible(false);
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [isMounted, threshold, rootMargin, once, mobileReduced]);

  // Adjust animation based on mobile/reduced motion
  const prefersReducedMotion = isMounted && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = isMounted && window.innerWidth < 768;
  const finalDuration = prefersReducedMotion ? 0 : (mobileReduced && isMobile ? duration * 0.7 : duration);
  const finalTransform = isVisible
    ? 'translateY(0) scale(1)'
    : prefersReducedMotion
    ? 'translateY(0) scale(1)'
    : 'translateY(20px) scale(0.98)';

  return {
    ref: elementRef,
    isVisible,
    hasAnimated,
    style: {
      opacity: isVisible ? 1 : (prefersReducedMotion ? 1 : 0),
      transform: finalTransform,
      transition: prefersReducedMotion || !isMounted
        ? 'none'
        : `opacity ${finalDuration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms, transform ${finalDuration}ms cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
    },
  };
}
