'use client';

import { useEffect, useState } from 'react';

export default function SimpleBackgroundAnimation() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number }>>([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const newParticle = {
        id: Date.now(),
        x: Math.random() * window.innerWidth,
        y: window.innerHeight + 10
      };

      setParticles(prev => [...prev.slice(-10), newParticle]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== newParticle.id));
      }, 3000);
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      {/* Subtle animated particles only */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute w-1 h-1 bg-emerald-500 opacity-20 rounded-full"
          style={{
            left: particle.x,
            top: particle.y,
            animation: 'simpleFloat 3s ease-out forwards'
          }}
        />
      ))}

      {/* Subtle moving line across screen */}
      <div
        className="absolute h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-10"
        style={{
          width: '200px',
          top: '60%',
          animation: 'moveLine 4s ease-in-out infinite'
        }}
      />
    </div>
  );
}