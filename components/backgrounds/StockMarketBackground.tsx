'use client';

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface Candle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isGreen: boolean;
  delay: number;
  duration: number;
}

interface Ticker {
  id: number;
  symbol: string;
  price: string;
  change: string;
  isPositive: boolean;
  x: number;
  y: number;
  speed: number;
}

const STOCK_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'META', 'NVDA', 'NFLX'];

// Max elements to prevent memory issues
const MAX_CANDLES = 5;
const MAX_TICKERS = 3;

function StockMarketBackgroundComponent() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const candleIdRef = useRef(0);
  const tickerIdRef = useRef(0);
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

  // Generate candlestick charts - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const { width: w, height: h } = dimensionsRef.current;
    const intervalTime = Math.max(5000, 8000 / intensityMultiplier);

    const interval = setInterval(() => {
      const id = candleIdRef.current++;
      const newCandle: Candle = {
        id,
        x: Math.random() * w,
        y: Math.random() * h,
        width: 2 + Math.random() * 4,
        height: 10 + Math.random() * 30,
        isGreen: Math.random() > 0.5,
        delay: Math.random() * 1000,
        duration: 4000 + Math.random() * 3000,
      };

      setCandles(prev => [...prev.slice(-MAX_CANDLES + 1), newCandle]);

      setTimeout(() => {
        setCandles(prev => prev.filter(c => c.id !== id));
      }, newCandle.duration + newCandle.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  // Generate ticker symbols - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const { width: w, height: h } = dimensionsRef.current;
    const intervalTime = Math.max(4000, 6000 / intensityMultiplier);

    const interval = setInterval(() => {
      const id = tickerIdRef.current++;
      const symbol = STOCK_SYMBOLS[Math.floor(Math.random() * STOCK_SYMBOLS.length)];
      const isPositive = Math.random() > 0.4;
      const price = (Math.random() * 500 + 50).toFixed(2);
      const changePercent = (Math.random() * 5).toFixed(2);

      const newTicker: Ticker = {
        id,
        symbol,
        price: `$${price}`,
        change: `${isPositive ? '+' : '-'}${changePercent}%`,
        isPositive,
        x: w + 200,
        y: 50 + Math.random() * (h - 100),
        speed: 30 + Math.random() * 40,
      };

      setTickers(prev => [...prev.slice(-MAX_TICKERS + 1), newTicker]);

      setTimeout(() => {
        setTickers(prev => prev.filter(t => t.id !== id));
      }, ((w + 400) / newTicker.speed) * 1000 + 1000);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  if (isReducedMotion) return null;

  const { width: fallbackWidth, height: fallbackHeight } = dimensionsRef.current;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true" style={{ contain: 'strict' }}>
      {/* Candlestick Charts */}
      {candles.map(candle => (
        <div
          key={candle.id}
          className="absolute"
          style={{
            left: `${candle.x}px`,
            top: `${candle.y}px`,
            width: `${candle.width}px`,
            height: `${candle.height}px`,
            backgroundColor: candle.isGreen ? '#10b981' : '#ef4444',
            opacity: 0.9,
            borderRadius: '1px',
            boxShadow: `0 0 ${candle.width * 2}px ${candle.isGreen ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)'}`,
            animation: `stockFadeIn ${candle.duration}ms ease-out ${candle.delay}ms forwards`,
            willChange: 'transform, opacity',
          }}
        />
      ))}

      {/* Moving Stock Chart Line */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.15] dark:opacity-[0.20]"
        style={{ filter: 'blur(0.5px)' }}
      >
        <defs>
          <linearGradient id="stockGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.1"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path
          d={`M0 ${fallbackHeight * 0.6} Q${fallbackWidth * 0.2} ${fallbackHeight * 0.4}, ${fallbackWidth * 0.4} ${fallbackHeight * 0.5} T${fallbackWidth * 0.8} ${fallbackHeight * 0.3} L${fallbackWidth} ${fallbackHeight * 0.35}`}
          stroke="#10b981"
          strokeWidth="1"
          fill="none"
          className="animate-pulse-subtle"
        />
        <path
          d={`M0 ${fallbackHeight * 0.6} Q${fallbackWidth * 0.2} ${fallbackHeight * 0.4}, ${fallbackWidth * 0.4} ${fallbackHeight * 0.5} T${fallbackWidth * 0.8} ${fallbackHeight * 0.3} L${fallbackWidth} ${fallbackHeight * 0.35} L${fallbackWidth} ${fallbackHeight} L0 ${fallbackHeight} Z`}
          fill="url(#stockGradient)"
        />
      </svg>

      {/* Scrolling Ticker */}
      {tickers.map(ticker => (
        <div
          key={ticker.id}
          className="absolute flex items-center space-x-2 text-sm font-mono font-semibold"
          style={{
            left: `${ticker.x}px`,
            top: `${ticker.y}px`,
            animation: `tickerScroll ${((fallbackWidth + 400) / ticker.speed)}s linear forwards`,
            opacity: 1,
            textShadow: '0 0 4px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.3)',
            willChange: 'transform',
          }}
        >
          <span className="text-emerald-400 dark:text-emerald-300 font-bold">
            {ticker.symbol}
          </span>
          <span className="text-white dark:text-gray-200">
            {ticker.price}
          </span>
          <span className={ticker.isPositive ? 'text-emerald-400 dark:text-emerald-300' : 'text-red-400 dark:text-red-300'}>
            {ticker.change}
          </span>
        </div>
      ))}

      {/* Grid Pattern for Chart Background */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(16, 185, 129, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(16, 185, 129, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}

export const StockMarketBackground = memo(StockMarketBackgroundComponent);