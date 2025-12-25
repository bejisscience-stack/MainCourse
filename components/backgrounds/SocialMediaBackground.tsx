'use client';

import { useEffect, useState, useRef } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface SocialElement {
  id: number;
  x: number;
  y: number;
  type: 'icon' | 'metric' | 'notification';
  content: string | JSX.Element;
  size: number;
  delay: number;
  duration: number;
  direction: 'up' | 'down' | 'left' | 'right';
}

const SOCIAL_ICONS = [
  { name: 'Instagram', symbol: '📷' },
  { name: 'YouTube', symbol: '▶️' },
  { name: 'TikTok', symbol: '🎵' },
  { name: 'Twitter', symbol: '🐦' },
  { name: 'LinkedIn', symbol: '💼' },
  { name: 'Facebook', symbol: '👥' },
];

const ENGAGEMENT_METRICS = [
  '1.2K', '5.8K', '12K', '24K', '156K', '892K', '1.5M',
  '+127', '+1.2K', '+4.8K', '+12K',
  '❤️ 2.5K', '💬 342', '🔄 1.1K', '👁️ 45K'
];

export function SocialMediaBackground() {
  const [elements, setElements] = useState<SocialElement[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const elementIdRef = useRef(0);

  const getIntensityMultiplier = () => {
    switch (intensity) {
      case 'low': return 0.4;
      case 'medium': return 0.7;
      case 'high': return 1.1;
      default: return 0.7;
    }
  };

  const getSocialIconSVG = (name: string, size: number) => {
    const commonProps = {
      width: size,
      height: size,
      viewBox: '0 0 24 24',
      fill: 'none',
      className: 'text-emerald-500 dark:text-emerald-400',
    };

    switch (name) {
      case 'Instagram':
        return (
          <svg {...commonProps}>
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="17" cy="7" r="1" fill="currentColor" />
          </svg>
        );
      case 'YouTube':
        return (
          <svg {...commonProps}>
            <path d="M22 8.5c0 1.5-.5 2.5-1 3s-1.5 1-3 1h-12c-1.5 0-2-.5-2.5-1S2 10 2 8.5v7c0 1.5.5 2.5 1 3s1.5 1 2.5 1h12c1.5 0 2-.5 2.5-1s1-1.5 1-3v-7z" stroke="currentColor" strokeWidth="1.5" />
            <polygon points="10,8 16,12 10,16" fill="currentColor" />
          </svg>
        );
      case 'TikTok':
        return (
          <svg {...commonProps}>
            <path d="M19 6.5a4.5 4.5 0 01-4.5-4.5H12v12a3 3 0 11-3-3v-2a5 5 0 105 5V8.5a6.5 6.5 0 003.5 1H19V6.5z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
      default:
        return (
          <svg {...commonProps}>
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        );
    }
  };

  useEffect(() => {
    if (isReducedMotion) return;

    const multiplier = getIntensityMultiplier();
    const baseInterval = 1500;
    const intervalTime = Math.max(800, baseInterval / multiplier);

    const interval = setInterval(() => {
      const elementType = Math.random() > 0.6 ? 'metric' : Math.random() > 0.5 ? 'icon' : 'notification';
      const directions: SocialElement['direction'][] = ['up', 'down', 'left', 'right'];
      const direction = directions[Math.floor(Math.random() * directions.length)];

      let content: string | JSX.Element;
      let x: number, y: number;

      // Position based on direction
      switch (direction) {
        case 'up':
          x = Math.random() * window.innerWidth;
          y = window.innerHeight + 50;
          break;
        case 'down':
          x = Math.random() * window.innerWidth;
          y = -50;
          break;
        case 'left':
          x = window.innerWidth + 50;
          y = Math.random() * window.innerHeight;
          break;
        case 'right':
          x = -50;
          y = Math.random() * window.innerHeight;
          break;
      }

      if (elementType === 'icon') {
        const icon = SOCIAL_ICONS[Math.floor(Math.random() * SOCIAL_ICONS.length)];
        content = getSocialIconSVG(icon.name, 20);
      } else if (elementType === 'metric') {
        content = ENGAGEMENT_METRICS[Math.floor(Math.random() * ENGAGEMENT_METRICS.length)];
      } else {
        content = '🔔';
      }

      const newElement: SocialElement = {
        id: elementIdRef.current++,
        x,
        y,
        type: elementType,
        content,
        size: 14 + Math.random() * 8,
        delay: Math.random() * 1000,
        duration: 3000 + Math.random() * 4000,
        direction,
      };

      setElements(prev => [...prev, newElement]);

      setTimeout(() => {
        setElements(prev => prev.filter(e => e.id !== newElement.id));
      }, newElement.duration + newElement.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensity, isReducedMotion]);

  if (isReducedMotion) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
      {/* Social network grid */}
      <div
        className="absolute inset-0 opacity-[0.002] dark:opacity-[0.004]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Ccircle cx='40' cy='40' r='2' fill='%2310b981' opacity='0.3'/%3E%3Cline x1='20' y1='20' x2='40' y2='40' stroke='%2310b981' stroke-width='0.5' opacity='0.2'/%3E%3Cline x1='40' y1='40' x2='60' y2='60' stroke='%2310b981' stroke-width='0.5' opacity='0.2'/%3E%3Cline x1='60' y1='20' x2='40' y2='40' stroke='%2310b981' stroke-width='0.5' opacity='0.1'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'networkPulse 15s ease-in-out infinite',
        }}
      />

      {/* Social elements */}
      {elements.map(element => (
        <div
          key={element.id}
          className="absolute flex items-center justify-center"
          style={{
            left: `${element.x}px`,
            top: `${element.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: element.type === 'icon' ? 0.06 : 0.08,
            animation: `socialMove${element.direction.charAt(0).toUpperCase() + element.direction.slice(1)} ${element.duration}ms ease-out ${element.delay}ms forwards`,
          }}
        >
          {element.type === 'icon' ? (
            element.content
          ) : (
            <span
              className="text-xs font-semibold text-emerald-500 dark:text-emerald-400 bg-emerald-50/10 dark:bg-emerald-950/10 px-2 py-1 rounded-full"
              style={{ fontSize: `${element.size}px` }}
            >
              {element.content}
            </span>
          )}
        </div>
      ))}

      {/* Engagement pulse rings */}
      <div className="absolute inset-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-emerald-500/10"
            style={{
              left: `${20 + i * 20}%`,
              top: `${30 + i * 15}%`,
              width: `${40 + i * 20}px`,
              height: `${40 + i * 20}px`,
              animation: `engagementPulse ${4000 + i * 1000}ms ease-in-out infinite`,
              animationDelay: `${i * 800}ms`,
              transform: 'translate(-50%, -50%)',
            }}
          />
        ))}
      </div>

      {/* Social media metrics dashboard */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.003] dark:opacity-[0.005]">
        <defs>
          <linearGradient id="socialGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0"/>
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <rect x="10%" y="80%" width="80%" height="2" fill="url(#socialGradient)" className="animate-pulse-subtle"/>
        <rect x="15%" y="85%" width="60%" height="1" fill="url(#socialGradient)" className="animate-pulse-subtle" style={{ animationDelay: '1s' }}/>
      </svg>
    </div>
  );
}