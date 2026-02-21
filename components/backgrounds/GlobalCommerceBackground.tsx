'use client';

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface ConnectionLine {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  delay: number;
  duration: number;
}

interface ShippingIcon {
  id: number;
  x: number;
  y: number;
  type: 'package' | 'plane' | 'ship' | 'truck';
  size: number;
  direction: number;
  delay: number;
  duration: number;
}

const SHIPPING_TYPES = ['package', 'plane', 'ship', 'truck'] as const;
const MAX_CONNECTIONS = 3;
const MAX_SHIPPING_ICONS = 3;

function GlobalCommerceBackgroundComponent() {
  const [globe, setGlobe] = useState({ rotation: 0 });
  const [connections, setConnections] = useState<ConnectionLine[]>([]);
  const [shippingIcons, setShippingIcons] = useState<ShippingIcon[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const connectionIdRef = useRef(0);
  const shippingIdRef = useRef(0);
  const dimensionsRef = useRef({ width: 1920, height: 1080 });

  // Cache dimensions once
  useEffect(() => {
    if (typeof window !== 'undefined') {
      dimensionsRef.current = { width: window.innerWidth, height: window.innerHeight };
    }
  }, []);

  const intensityMultiplier = useMemo(() => {
    switch (intensity) {
      case 'low': return 0.4;
      case 'medium': return 0.7;
      case 'high': return 1.1;
      default: return 0.7;
    }
  }, [intensity]);

  // Rotate globe - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const interval = setInterval(() => {
      setGlobe(prev => ({ rotation: (prev.rotation + 0.3) % 360 }));
    }, 200); // Slower rotation

    return () => clearInterval(interval);
  }, [isReducedMotion]);

  // Generate connection lines - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const { width, height } = dimensionsRef.current;
    const intervalTime = Math.max(5000, 6000 / intensityMultiplier);

    const interval = setInterval(() => {
      const id = connectionIdRef.current++;
      const startX = Math.random() * width;
      const startY = Math.random() * height;
      const endX = Math.random() * width;
      const endY = Math.random() * height;

      const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
      if (distance < 100) return;

      const newConnection: ConnectionLine = {
        id,
        startX,
        startY,
        endX,
        endY,
        delay: Math.random() * 1000,
        duration: 4000 + Math.random() * 3000,
      };

      setConnections(prev => [...prev.slice(-MAX_CONNECTIONS + 1), newConnection]);

      setTimeout(() => {
        setConnections(prev => prev.filter(c => c.id !== id));
      }, newConnection.duration + newConnection.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  // Generate shipping icons - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const { width, height } = dimensionsRef.current;
    const intervalTime = Math.max(4000, 5000 / intensityMultiplier);

    const interval = setInterval(() => {
      const id = shippingIdRef.current++;
      const type = SHIPPING_TYPES[Math.floor(Math.random() * SHIPPING_TYPES.length)];

      const newShippingIcon: ShippingIcon = {
        id,
        x: Math.random() * width,
        y: Math.random() * height,
        type,
        size: 16 + Math.random() * 8,
        direction: Math.random() * 360,
        delay: Math.random() * 1500,
        duration: 5000 + Math.random() * 4000,
      };

      setShippingIcons(prev => [...prev.slice(-MAX_SHIPPING_ICONS + 1), newShippingIcon]);

      setTimeout(() => {
        setShippingIcons(prev => prev.filter(s => s.id !== id));
      }, newShippingIcon.duration + newShippingIcon.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  const getShippingIconSVG = (type: ShippingIcon['type'], size: number) => {
    const commonProps = {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      className: 'text-emerald-500 dark:text-emerald-400',
    };

    switch (type) {
      case 'package':
        return (
          <svg {...commonProps}>
            <path d="M21 8a2 2 0 0 0-1-1.73L12 2 4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73L12 22l8-4.27A2 2 0 0 0 21 16Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="m3.29 7 8.71 5 8.71-5M12 22V12" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      case 'plane':
        return (
          <svg {...commonProps}>
            <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1 .5-3 1-4.5 2.5L13 9l-8.2-1.8c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5.1 1 .6 1.1L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 2.8 5c.1.5.6.8 1.1.6l.5-.3c.4-.2.6-.6.5-1.1Z" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      case 'ship':
        return (
          <svg {...commonProps}>
            <path d="M2 21c.6.5 1.2 1 2.5 1 4.5 0 8-3.5 8-10S9 2 9 2s4.5 5 4.5 10-3.5 10-8 10c-1.3 0-1.9-.5-2.5-1Z" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M19.5 14.5c-.9-2.2-1.4-4.8-1.5-7.5M22 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
      case 'truck':
        return (
          <svg {...commonProps}>
            <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.5c0-.3-.1-.6-.4-.8l-2.6-2.6A1 1 0 0 0 18.5 10H14" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="7" cy="18" r="2" stroke="currentColor" strokeWidth="1.5"/>
            <circle cx="17" cy="18" r="2" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
        );
    }
  };

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true" style={{ contain: 'strict' }}>
      {/* World map outline */}
      <div
        className="absolute inset-0 opacity-[0.002] dark:opacity-[0.004]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='100' viewBox='0 0 200 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M30 30h40v20H30zM80 25h60v30H80zM20 60h30v15H20zM90 65h50v20H90z' stroke='%2310b981' stroke-width='0.3' opacity='0.2'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '400px 200px',
          animation: 'worldMapShift 60s ease-in-out infinite',
        }}
      />

      {/* Rotating globe */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div
          className="w-32 h-32 md:w-48 md:h-48 rounded-full border border-emerald-500/5 dark:border-emerald-400/5"
          style={{ transform: `rotate(${globe.rotation}deg)`, willChange: 'transform' }}
        >
          <div className="absolute inset-2 rounded-full border-2 border-dashed border-emerald-500/8 dark:border-emerald-400/8"></div>
          <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-500/20 rounded-full"></div>
          <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 bg-emerald-500/15 rounded-full"></div>
          <div className="absolute top-1/2 left-1/6 w-1 h-1 bg-emerald-500/25 rounded-full"></div>
        </div>
      </div>

      {/* Connection lines SVG */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="tradeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.01"/>
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.04"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0.01"/>
          </linearGradient>
        </defs>

        {connections.map(connection => (
          <line
            key={connection.id}
            x1={connection.startX}
            y1={connection.startY}
            x2={connection.endX}
            y2={connection.endY}
            stroke="url(#tradeGradient)"
            strokeWidth="1"
            strokeDasharray="5,5"
            style={{
              animation: `connectionPulse ${connection.duration}ms ease-in-out ${connection.delay}ms forwards`,
            }}
          />
        ))}
      </svg>

      {/* Shipping icons */}
      {shippingIcons.map(icon => (
        <div
          key={icon.id}
          className="absolute"
          style={{
            left: `${icon.x}px`,
            top: `${icon.y}px`,
            transform: `translate(-50%, -50%) rotate(${icon.direction}deg)`,
            opacity: 0.06,
            animation: `shippingMove ${icon.duration}ms ease-in-out ${icon.delay}ms forwards`,
            willChange: 'transform, opacity',
          }}
        >
          {getShippingIconSVG(icon.type, icon.size)}
        </div>
      ))}

      {/* Trade route markers - reduced count */}
      <div className="absolute inset-0">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-emerald-500 rounded-full opacity-[0.03] dark:opacity-[0.05]"
            style={{
              left: `${10 + i * 18}%`,
              top: `${20 + (i % 3) * 25}%`,
              animation: `tradePulse ${2000 + i * 500}ms ease-in-out infinite`,
              animationDelay: `${i * 300}ms`,
              boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
            }}
          />
        ))}
      </div>

      {/* Commercial activity indicators */}
      <div
        className="absolute inset-0 opacity-[0.003] dark:opacity-[0.005]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='120' viewBox='0 0 120 120' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Ccircle cx='60' cy='60' r='20' stroke='%2310b981' stroke-width='1' opacity='0.2'/%3E%3Cpath d='M40 40l40 40M80 40l-40 40' stroke='%2310b981' stroke-width='0.5' opacity='0.1'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'commerceActivity 25s ease-in-out infinite',
        }}
      />

      {/* Global economy pulse */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/3 left-1/3 w-4 h-4 rounded-full border-2 border-emerald-500/10"
          style={{
            animation: 'economyPulse 4s ease-in-out infinite',
            transform: 'translate(-50%, -50%)',
          }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-6 h-6 rounded-full border-2 border-emerald-500/8"
          style={{
            animation: 'economyPulse 5s ease-in-out infinite',
            animationDelay: '1s',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
}

export const GlobalCommerceBackground = memo(GlobalCommerceBackgroundComponent);