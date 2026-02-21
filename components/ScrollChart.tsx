'use client';

import { useEffect, useState, useRef } from 'react';

export function ScrollChart() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const pathRef = useRef<SVGPathElement>(null);
  const [pathLength, setPathLength] = useState(0);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setIsReducedMotion(mediaQuery.matches);

    const handleResize = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? Math.min(Math.max(scrollTop / scrollHeight, 0), 1) : 0;
      setScrollProgress(progress);
    };

    handleResize();
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Calculate path length when dimensions change
  useEffect(() => {
    if (pathRef.current && dimensions.width > 0) {
      const length = pathRef.current.getTotalLength();
      setPathLength(length);
    }
  }, [dimensions]);

  // Don't render if reduced motion or dimensions not set
  if (isReducedMotion || dimensions.width === 0) {
    return null;
  }

  const isMobile = dimensions.width < 768;
  const padding = isMobile ? 40 : Math.min(80, dimensions.width * 0.1, dimensions.height * 0.1);
  
  // START: LEFT BOTTOM corner
  const startX = padding;
  const startY = dimensions.height - padding;
  
  // END: RIGHT TOP corner
  const endX = dimensions.width - padding;
  const endY = padding;

  // Create zigzag/wave pattern with smooth Bezier curves
  const createZigzagPath = () => {
    const segments = isMobile ? 4 : 6; // Fewer segments on mobile
    const segmentWidth = (endX - startX) / segments;
    const segmentHeight = (startY - endY) / segments;
    const waveAmplitude = isMobile ? 60 : 100; // Wave height
    
    let path = `M ${startX} ${startY}`;
    
    for (let i = 1; i <= segments; i++) {
      const x = startX + segmentWidth * i;
      const baseY = startY - segmentHeight * i;
      
      // Alternate up and down for zigzag effect
      const waveOffset = Math.sin((i / segments) * Math.PI * 2) * waveAmplitude;
      const y = baseY + waveOffset;
      
      // Use smooth quadratic curves between points
      const controlX = startX + segmentWidth * (i - 0.5);
      const prevY = i === 1 
        ? startY 
        : startY - segmentHeight * (i - 1) + Math.sin(((i - 1) / segments) * Math.PI * 2) * waveAmplitude;
      
      path += ` Q ${controlX} ${(prevY + y) / 2} ${x} ${y}`;
    }
    
    return path;
  };

  const path = createZigzagPath();

  // Calculate current point on path based on scroll progress
  const getCurrentPoint = (progress: number) => {
    if (!pathRef.current || pathLength === 0) {
      return { x: startX, y: startY };
    }
    
    const distance = pathLength * progress;
    const point = pathRef.current.getPointAtLength(distance);
    return { x: point.x, y: point.y };
  };

  const currentPoint = getCurrentPoint(scrollProgress);
  const dashOffset = pathLength > 0 ? pathLength * (1 - scrollProgress) : 0;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden="true"
    >
      <svg
        className="w-full h-full"
        style={{ opacity: 1 }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(16, 185, 129)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="rgb(16, 185, 129)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(16, 185, 129)" stopOpacity="1" />
          </linearGradient>
          <linearGradient id="lineGradientDark" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(34, 211, 238)" stopOpacity="0.6" />
            <stop offset="50%" stopColor="rgb(34, 211, 238)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(34, 211, 238)" stopOpacity="1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Hidden path for length calculation */}
        <path
          ref={pathRef}
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="2.5"
          style={{ visibility: 'hidden' }}
        />
        
        {/* Animated zigzag line path - Light mode */}
        <path
          d={path}
          fill="none"
          stroke="url(#lineGradient)"
          strokeWidth={isMobile ? "2" : "2.5"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="dark:hidden"
          filter="url(#glow)"
          style={{
            strokeDasharray: pathLength > 0 ? `${pathLength}` : 'none',
            strokeDashoffset: dashOffset,
            transition: 'stroke-dashoffset 0.15s ease-out',
            opacity: 0.12,
          }}
        />
        
        {/* Animated zigzag line path - Dark mode */}
        <path
          d={path}
          fill="none"
          stroke="url(#lineGradientDark)"
          strokeWidth={isMobile ? "2" : "2.5"}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hidden dark:block"
          filter="url(#glow)"
          style={{
            strokeDasharray: pathLength > 0 ? `${pathLength}` : 'none',
            strokeDashoffset: dashOffset,
            transition: 'stroke-dashoffset 0.15s ease-out',
            opacity: 0.15,
          }}
        />
      </svg>

      {/* Bitcoin icon at the head of the line */}
      <div
        className="absolute transition-all duration-150 ease-out"
        style={{
          left: `${currentPoint.x}px`,
          top: `${currentPoint.y}px`,
          transform: 'translate(-50%, -50%)',
          opacity: scrollProgress > 0.01 ? Math.min(scrollProgress * 2, isMobile ? 0.3 : 0.35) : 0,
        }}
      >
        <svg
          width={isMobile ? "24" : "28"}
          height={isMobile ? "24" : "28"}
          viewBox="0 0 24 24"
          fill="none"
          className="text-emerald-500 dark:text-emerald-400"
        >
          {/* Bitcoin symbol - minimal outline style */}
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            opacity="0.9"
          />
          <path
            d="M9.5 8.5h3.5c1.1 0 2 .9 2 2s-.9 2-2 2h-3.5m0-4h-1m1 4h-1m0 0h3.5c1.1 0 2 .9 2 2s-.9 2-2 2h-3.5m0-4h-1m1 4h-1"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M10 6v3m0 3v3m4-6v3m0 3v3"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}
