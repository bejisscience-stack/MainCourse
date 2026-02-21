'use client';

import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

interface ChartElement {
  id: number;
  x: number;
  y: number;
  type: 'bar' | 'pie' | 'line' | 'area';
  size: number;
  data: number[];
  delay: number;
  duration: number;
}

interface DataPoint {
  id: number;
  x: number;
  y: number;
  value: number;
  delay: number;
  duration: number;
}

const MAX_CHARTS = 3;
const MAX_DATA_POINTS = 4;

function AnalyticsBackgroundComponent() {
  const [charts, setCharts] = useState<ChartElement[]>([]);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const { intensity, isReducedMotion } = useBackground();
  const chartIdRef = useRef(0);
  const dataPointIdRef = useRef(0);
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
      case 'high': return 1.0;
      default: return 0.7;
    }
  }, [intensity]);

  // Generate floating charts - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const { width, height } = dimensionsRef.current;
    const intervalTime = Math.max(6000, 8000 / intensityMultiplier);

    const interval = setInterval(() => {
      const id = chartIdRef.current++;
      const types: ChartElement['type'][] = ['bar', 'pie', 'line', 'area'];
      const type = types[Math.floor(Math.random() * types.length)];

      const newChart: ChartElement = {
        id,
        x: Math.random() * width,
        y: Math.random() * height,
        type,
        size: 40 + Math.random() * 60,
        data: Array.from({ length: 5 }, () => Math.random() * 100),
        delay: Math.random() * 2000,
        duration: 6000 + Math.random() * 4000,
      };

      setCharts(prev => [...prev.slice(-MAX_CHARTS + 1), newChart]);

      setTimeout(() => {
        setCharts(prev => prev.filter(c => c.id !== id));
      }, newChart.duration + newChart.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  // Generate data particles - slower interval
  useEffect(() => {
    if (isReducedMotion) return;

    const { width, height } = dimensionsRef.current;
    const intervalTime = Math.max(2000, 3000 / intensityMultiplier);

    const interval = setInterval(() => {
      const id = dataPointIdRef.current++;
      const newDataPoint: DataPoint = {
        id,
        x: Math.random() * width,
        y: Math.random() * height,
        value: Math.random() * 100,
        delay: Math.random() * 1000,
        duration: 3000 + Math.random() * 3000,
      };

      setDataPoints(prev => [...prev.slice(-MAX_DATA_POINTS + 1), newDataPoint]);

      setTimeout(() => {
        setDataPoints(prev => prev.filter(d => d.id !== id));
      }, newDataPoint.duration + newDataPoint.delay);
    }, intervalTime);

    return () => clearInterval(interval);
  }, [intensityMultiplier, isReducedMotion]);

  const renderChart = (chart: ChartElement) => {
    const { size, data, type } = chart;

    switch (type) {
      case 'bar':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" className="text-emerald-500 dark:text-emerald-400">
            {data.slice(0, 4).map((value, i) => (
              <rect
                key={i}
                x={i * 20 + 10}
                y={100 - value}
                width="15"
                height={value}
                fill="currentColor"
                opacity="0.3"
              />
            ))}
          </svg>
        );

      case 'pie':
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" className="text-emerald-500 dark:text-emerald-400">
            <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.2"/>
            <circle
              cx="50"
              cy="50"
              r="30"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              opacity="0.4"
              strokeDasharray={`${data[0] * 1.88} ${188 - data[0] * 1.88}`}
              transform="rotate(-90 50 50)"
            />
          </svg>
        );

      case 'line':
        const points = data.slice(0, 5).map((value, i) => `${i * 20 + 10},${100 - value}`).join(' ');
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" className="text-emerald-500 dark:text-emerald-400">
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity="0.4"
            />
            {data.slice(0, 5).map((value, i) => (
              <circle
                key={i}
                cx={i * 20 + 10}
                cy={100 - value}
                r="2"
                fill="currentColor"
                opacity="0.5"
              />
            ))}
          </svg>
        );

      case 'area':
        const areaPoints = data.slice(0, 5).map((value, i) => `${i * 20 + 10},${100 - value}`).join(' ');
        return (
          <svg width={size} height={size} viewBox="0 0 100 100" className="text-emerald-500 dark:text-emerald-400">
            <defs>
              <linearGradient id={`areaGrad${chart.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="currentColor" stopOpacity="0.1"/>
              </linearGradient>
            </defs>
            <polygon
              points={`10,100 ${areaPoints} 90,100`}
              fill={`url(#areaGrad${chart.id})`}
            />
            <polyline
              points={areaPoints}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              opacity="0.4"
            />
          </svg>
        );

      default:
        return null;
    }
  };

  if (isReducedMotion) return null;

  const { width, height } = dimensionsRef.current;

  return (
    <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true" style={{ contain: 'strict' }}>
      {/* Dashboard grid background */}
      <div
        className="absolute inset-0 opacity-[0.002] dark:opacity-[0.004]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='80' viewBox='0 0 80 80' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none'%3E%3Cpath d='M0 0h80v80H0z' stroke='%2310b981' stroke-width='0.3' opacity='0.1'/%3E%3Cpath d='M20 20h40v40H20z' stroke='%2310b981' stroke-width='0.3' opacity='0.15'/%3E%3C/g%3E%3C/svg%3E")`,
          animation: 'dashboardGrid 20s ease-in-out infinite',
        }}
      />

      {/* Floating charts */}
      {charts.map(chart => (
        <div
          key={chart.id}
          className="absolute"
          style={{
            left: `${chart.x}px`,
            top: `${chart.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.04,
            animation: `chartFloat ${chart.duration}ms ease-in-out ${chart.delay}ms forwards`,
            willChange: 'transform, opacity',
          }}
        >
          {renderChart(chart)}
        </div>
      ))}

      {/* Data points and particles */}
      {dataPoints.map(point => (
        <div
          key={point.id}
          className="absolute flex items-center justify-center text-xs font-mono text-emerald-500 dark:text-emerald-400"
          style={{
            left: `${point.x}px`,
            top: `${point.y}px`,
            transform: 'translate(-50%, -50%)',
            opacity: 0.06,
            animation: `dataPointFade ${point.duration}ms ease-out ${point.delay}ms forwards`,
            willChange: 'transform, opacity',
          }}
        >
          {Math.round(point.value)}%
        </div>
      ))}

      {/* Analytics dashboard wireframe */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.003] dark:opacity-[0.005]">
        <defs>
          <pattern id="analyticsPattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            <rect x="10" y="10" width="40" height="25" stroke="#10b981" strokeWidth="0.5" fill="none" opacity="0.2"/>
            <rect x="70" y="10" width="40" height="40" stroke="#10b981" strokeWidth="0.5" fill="none" opacity="0.2"/>
            <rect x="10" y="70" width="100" height="20" stroke="#10b981" strokeWidth="0.5" fill="none" opacity="0.2"/>
            <rect x="15" y="25" width="4" height="10" fill="#10b981" opacity="0.1"/>
            <rect x="22" y="20" width="4" height="15" fill="#10b981" opacity="0.1"/>
            <rect x="29" y="27" width="4" height="8" fill="#10b981" opacity="0.1"/>
            <rect x="36" y="18" width="4" height="17" fill="#10b981" opacity="0.1"/>
            <circle cx="90" cy="30" r="12" stroke="#10b981" strokeWidth="1" fill="none" opacity="0.1"/>
            <path d="M 90 18 A 12 12 0 0 1 102 30 Z" fill="#10b981" opacity="0.08"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#analyticsPattern)"/>
      </svg>

      {/* Performance indicators - reduced count */}
      <div className="absolute inset-0">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * 25}%`,
              top: `${10 + i * 20}%`,
            }}
          >
            <div
              className="w-8 h-1 bg-emerald-500 opacity-[0.02] dark:opacity-[0.04]"
              style={{
                animation: `performanceBar ${2000 + i * 400}ms ease-in-out infinite`,
                animationDelay: `${i * 300}ms`,
              }}
            />
            <div
              className="w-6 h-1 bg-emerald-400 mt-1 opacity-[0.03] dark:opacity-[0.05]"
              style={{
                animation: `performanceBar ${2500 + i * 400}ms ease-in-out infinite`,
                animationDelay: `${i * 300 + 200}ms`,
              }}
            />
          </div>
        ))}
      </div>

      {/* KPI indicators */}
      <div className="absolute inset-0">
        <div
          className="absolute top-1/4 right-1/4 text-xs font-mono text-emerald-500/[0.04] dark:text-emerald-400/[0.06]"
          style={{ animation: 'kpiPulse 3s ease-in-out infinite' }}
        >
          ↗ 127%
        </div>
        <div
          className="absolute bottom-1/3 left-1/3 text-xs font-mono text-emerald-500/[0.04] dark:text-emerald-400/[0.06]"
          style={{ animation: 'kpiPulse 4s ease-in-out infinite', animationDelay: '1s' }}
        >
          💹 +24.5K
        </div>
      </div>

      {/* Data flow lines - static paths */}
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="dataFlowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0"/>
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.02"/>
            <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0, 1].map((i) => (
          <path
            key={i}
            d={`M0 ${height * (0.2 + i * 0.4)} Q${width * 0.3} ${height * (0.1 + i * 0.4)} ${width * 0.6} ${height * (0.25 + i * 0.4)} T${width} ${height * (0.2 + i * 0.4)}`}
            stroke="url(#dataFlowGradient)"
            strokeWidth="1"
            fill="none"
            className="animate-pulse-subtle"
            style={{ animationDelay: `${i * 0.7}s` }}
          />
        ))}
      </svg>
    </div>
  );
}

export const AnalyticsBackground = memo(AnalyticsBackgroundComponent);