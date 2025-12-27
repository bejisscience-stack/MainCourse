'use client';

import { useEffect, useState, useRef, memo, useMemo } from 'react';

function SimpleBackgroundAnimation() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const dimensionsRef = useRef({ width: 0, height: 0 });
  const particleIdRef = useRef(0);

  // Cache window dimensions
  useEffect(() => {
    if (typeof window !== 'undefined') {
      dimensionsRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
  }, []);

  useEffect(() => {
    // Slower interval for better performance (1500ms instead of 500ms)
    const interval = setInterval(() => {
      const id = particleIdRef.current++;
      const newParticle = {
        id,
        x: Math.random() * (dimensionsRef.current.width || 1920),
        y: (dimensionsRef.current.height || 1080) + 10
      };

      // Limit to max 5 particles (instead of 10)
      setParticles(prev => [...prev.slice(-4), newParticle]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, 3000);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Memoize particle elements
  const particleElements = useMemo(() => 
    particles.map(particle => (
      <div
        key={particle.id}
        className="absolute w-1 h-1 bg-emerald-500 opacity-20 rounded-full"
        style={{
          left: particle.x,
          top: particle.y,
          animation: 'simpleFloat 3s ease-out forwards',
          willChange: 'transform, opacity',
        }}
      />
    )), [particles]);

  return (
    <div className="fixed inset-0 pointer-events-none z-0" style={{ contain: 'strict' }}>
      {/* Subtle animated particles only */}
      {particleElements}

      {/* Subtle moving line across screen */}
      <div
        className="absolute h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-10"
        style={{
          width: '200px',
          top: '60%',
          animation: 'moveLine 4s ease-in-out infinite',
          willChange: 'transform',
        }}
      />
    </div>
  );
}

export default memo(SimpleBackgroundAnimation);