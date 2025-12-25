'use client';

import { useEffect, useState, useRef } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';
import { useWindowDimensions } from '@/hooks/useWindowDimensions';

interface CryptoDrop {
  id: number;
  x: number;
  symbol: string;
  size: number;
  rotation: number;
  delay: number;
  duration: number;
  color: string;
}

const CRYPTO_SYMBOLS = [
  { symbol: '₿', name: 'Bitcoin', color: '#f7931a' },
  { symbol: 'Ξ', name: 'Ethereum', color: '#627eea' },
  { symbol: '◈', name: 'ADA', color: '#0033ad' },
  { symbol: '●', name: 'DOT', color: '#e6007a' },
  { symbol: '◊', name: 'LTC', color: '#345d9d' },
  { symbol: '◉', name: 'BNB', color: '#f3ba2f' },
  { symbol: '⬟', name: 'SOL', color: '#9945ff' },
  { symbol: '△', name: 'AVAX', color: '#e84142' },
];

export function CryptoRainBackground() {
  const [drops, setDrops] = useState<CryptoDrop[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const { width, height } = useWindowDimensions();
  const dropIdRef = useRef(0);

  const getIntensityMultiplier = () => {
    switch (intensity) {
      case 'low': return 0.4;
      case 'medium': return 0.7;
      case 'high': return 1.2;
      default: return 0.7;
    }
  };

  useEffect(() => {
    if (isReducedMotion) return;

    const w = width || 1920;

    const multiplier = getIntensityMultiplier();
    const baseInterval = 800;
    const intervalTime = Math.max(400, baseInterval / multiplier);

    const interval = setInterval(() => {
      const crypto = CRYPTO_SYMBOLS[Math.floor(Math.random() * CRYPTO_SYMBOLS.length)];

      const newDrop: CryptoDrop = {
        id: dropIdRef.current++,
        x: Math.random() * w,
        symbol: crypto.symbol,
        size: 12 + Math.random() * 8,
        rotation: Math.random() * 360,
        delay: Math.random() * 500,
        duration: 3000 + Math.random() * 4000,
        color: crypto.color,
      };

      setDrops(prev => [...prev, newDrop]);

      setTimeout(() => {
        setDrops(prev => prev.filter(d => d.id !== newDrop.id));
      }, newDrop.duration + newDrop.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensity, isReducedMotion]);

  console.log('CryptoRainBackground render:', { isReducedMotion, width, height, drops: drops.length });

  if (isReducedMotion) return null;

  const fallbackWidth = width || 1920;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {/* Matrix-style background pattern */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M20 20v-8h8' stroke='%2310b981' stroke-width='0.5' opacity='0.2'/%3E%3Cpath d='M12 20h8v8' stroke='%2310b981' stroke-width='0.5' opacity='0.1'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'matrixScroll 20s linear infinite',
        }}
      />

      {/* Falling crypto symbols */}
      {drops.map(drop => (
        <div
          key={drop.id}
          className="absolute font-bold"
          style={{
            left: `${drop.x}px`,
            top: '-50px',
            fontSize: `${drop.size}px`,
            color: drop.color,
            transform: `translate(-50%, -50%) rotate(${drop.rotation}deg)`,
            opacity: 0.25,
            animation: `cryptoFall ${drop.duration}ms ease-in ${drop.delay}ms forwards`,
            textShadow: `0 0 10px ${drop.color}20`,
          }}
        >
          {drop.symbol}
        </div>
      ))}

      {/* Subtle crypto code rain effect */}
      <div className="absolute inset-0">
        {Array.from({ length: Math.floor(fallbackWidth / 60) }).map((_, i) => (
          <div
            key={i}
            className="absolute opacity-[0.1] dark:opacity-[0.15] text-xs font-mono text-emerald-500"
            style={{
              left: `${i * 60 + Math.random() * 40}px`,
              top: 0,
              animation: `codeRain ${5000 + Math.random() * 5000}ms linear infinite`,
              animationDelay: `${Math.random() * 5000}ms`,
            }}
          >
            {Array.from({ length: 20 }).map((_, j) => (
              <div key={j} className="h-4">
                {Math.random() > 0.7 ? CRYPTO_SYMBOLS[Math.floor(Math.random() * CRYPTO_SYMBOLS.length)].symbol : ''}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Blockchain connection lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.03] dark:opacity-[0.05]">
        <defs>
          <pattern id="blockchain" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="50" cy="50" r="2" fill="#10b981" opacity="0.3">
              <animate attributeName="r" values="1;3;1" dur="4s" repeatCount="indefinite"/>
            </circle>
            <line x1="25" y1="25" x2="50" y2="50" stroke="#10b981" strokeWidth="0.5" opacity="0.2"/>
            <line x1="50" y1="50" x2="75" y2="75" stroke="#10b981" strokeWidth="0.5" opacity="0.2"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#blockchain)"/>
      </svg>
    </div>
  );
}