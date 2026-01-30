'use client';

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface MoneyParticle {
  id: number;
  x: number;
  y: number;
  symbol: string;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
  direction: 'up' | 'float';
}

const CURRENCY_SYMBOLS = ['$', '€', '¥', '£', '₹', '₽', '¢', '₩', '₪', '₦'];
const MAX_PARTICLES = 6;

function MoneyFlowBackgroundComponent() {
  const [particles, setParticles] = useState<MoneyParticle[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const particleIdRef = useRef(0);
  const dimensionsRef = useRef({ width: 1920, height: 1080 });

  // Cache dimensions once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      dimensionsRef.current = { width: window.innerWidth, height: window.innerHeight };
    }
  }, []);

  const intensityMultiplier = useMemo(() => {
    switch (intensity) {
      case 'low': return 0.3;
      case 'medium': return 0.6;
      case 'high': return 1.0;
      default: return 0.6;
    }
  }, [intensity]);

  useEffect(() => {
    if (isReducedMotion) return;

    // Slower interval for better performance
    const intervalTime = Math.max(2000, 3000 / intensityMultiplier);
    const { width, height } = dimensionsRef.current;

    const interval = setInterval(() => {
      const id = particleIdRef.current++;
      const symbol = CURRENCY_SYMBOLS[Math.floor(Math.random() * CURRENCY_SYMBOLS.length)];
      const direction = Math.random() > 0.7 ? 'float' : 'up';

      const newParticle: MoneyParticle = {
        id,
        x: Math.random() * width,
        y: direction === 'up' ? height + 50 : Math.random() * height,
        symbol,
        size: 14 + Math.random() * 10,
        rotation: Math.random() * 360,
        delay: Math.random() * 1000,
        duration: 4000 + Math.random() * 3000,
        direction,
      };

      setParticles(prev => [...prev.slice(-MAX_PARTICLES + 1), newParticle]);

      setTimeout(() => {
        setParticles(prev => prev.filter(p => p.id !== id));
      }, newParticle.duration + newParticle.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  if (isReducedMotion) return null;

  const { width, height } = dimensionsRef.current;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true" style={{ contain: 'strict' }}>
      {/* Golden gradient overlay */}
      <div
        className="absolute inset-0 opacity-[0.008] dark:opacity-[0.012]"
        style={{
          background: 'radial-gradient(ellipse at center, #fbbf24 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
      />

      {/* Money particles */}
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute font-bold text-emerald-500 dark:text-emerald-400"
          style={{
            left: `${particle.x}px`,
            top: `${particle.y}px`,
            fontSize: `${particle.size}px`,
            transform: `translate(-50%, -50%) rotate(${particle.rotation}deg)`,
            opacity: 0.05,
            textShadow: '0 0 8px rgba(16, 185, 129, 0.3)',
            animation: particle.direction === 'up'
              ? `moneyRiseUp ${particle.duration}ms ease-out ${particle.delay}ms forwards`
              : `moneyFloat ${particle.duration}ms ease-in-out ${particle.delay}ms forwards`,
            willChange: 'transform, opacity',
          }}
        >
          {particle.symbol}
        </div>
      ))}

      {/* Subtle money pattern background */}
      <div
        className="absolute inset-0 opacity-[0.003] dark:opacity-[0.005]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310b981' fill-opacity='0.1'%3E%3Ccircle cx='30' cy='30' r='1'/%3E%3Cpath d='M25 25h10v10H25z' stroke='%2310b981' stroke-width='0.5'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'patternShift 30s ease-in-out infinite',
        }}
      />

      {/* Flowing stream lines - static SVG paths */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.004] dark:opacity-[0.006]">
        <defs>
          <linearGradient id="moneyGradient" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0"/>
            <stop offset="50%" stopColor="#fbbf24" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M${width * (0.2 + i * 0.25)} ${height} Q${width * (0.25 + i * 0.25)} ${height * 0.7} ${width * (0.2 + i * 0.25)} ${height * 0.4} T${width * (0.2 + i * 0.25)} 0`}
            stroke="url(#moneyGradient)"
            strokeWidth="1"
            fill="none"
            className="animate-pulse-subtle"
            style={{ animationDelay: `${i * 0.5}s` }}
          />
        ))}
      </svg>

      {/* Success indicators */}
      <div className="absolute inset-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute w-2 h-2 bg-emerald-500 rounded-full opacity-[0.03] dark:opacity-[0.05]"
            style={{
              left: `${20 + i * 30}%`,
              top: `${30 + i * 20}%`,
              animation: `successPulse ${3000 + i * 1000}ms ease-in-out infinite`,
              animationDelay: `${i * 1000}ms`,
              boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export const MoneyFlowBackground = memo(MoneyFlowBackgroundComponent);