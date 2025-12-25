'use client';

import { useState } from 'react';
import { useBackground, BackgroundTheme, AnimationIntensity } from '@/contexts/BackgroundContext';

const BACKGROUND_THEMES: Array<{
  value: BackgroundTheme;
  label: string;
  description: string;
  preview: string;
}> = [
  {
    value: 'none',
    label: 'None',
    description: 'No animated background',
    preview: '🚫',
  },
  {
    value: 'subtle',
    label: 'Subtle',
    description: 'Minimal geometric shapes',
    preview: '⭕',
  },
  {
    value: 'stockMarket',
    label: 'Stock Market',
    description: 'Candlestick charts & tickers',
    preview: '📈',
  },
  {
    value: 'cryptoRain',
    label: 'Crypto Rain',
    description: 'Falling cryptocurrency symbols',
    preview: '₿',
  },
  {
    value: 'moneyFlow',
    label: 'Money Flow',
    description: 'Rising currency symbols',
    preview: '💰',
  },
  {
    value: 'socialMedia',
    label: 'Social Media',
    description: 'Social icons & engagement metrics',
    preview: '📱',
  },
  {
    value: 'aiNetwork',
    label: 'AI Network',
    description: 'Neural networks & data flow',
    preview: '🤖',
  },
  {
    value: 'globalCommerce',
    label: 'Global Commerce',
    description: 'World trade & shipping',
    preview: '🌍',
  },
  {
    value: 'analytics',
    label: 'Analytics',
    description: 'Floating charts & data',
    preview: '📊',
  },
];

const INTENSITY_OPTIONS: Array<{
  value: AnimationIntensity;
  label: string;
  description: string;
}> = [
  {
    value: 'low',
    label: 'Low',
    description: 'Minimal animations',
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Balanced animations',
  },
  {
    value: 'high',
    label: 'High',
    description: 'Rich animations',
  },
];

interface BackgroundSelectorProps {
  className?: string;
}

export default function BackgroundSelector({ className = '' }: BackgroundSelectorProps) {
  const { theme, intensity, setTheme, setIntensity, isReducedMotion } = useBackground();
  const [isOpen, setIsOpen] = useState(false);

  if (isReducedMotion) {
    return (
      <div className={`p-4 rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="text-orange-500 dark:text-orange-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
              Reduced Motion Detected
            </h3>
            <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
              Background animations are disabled due to your accessibility preferences.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Background Theme Selector */}
      <div>
        <h3 className="text-lg font-semibold text-charcoal-800 dark:text-navy-200 mb-4">
          Background Theme
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {BACKGROUND_THEMES.map((option) => (
            <button
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={`
                p-4 rounded-lg border-2 text-left transition-all duration-200 hover:shadow-soft
                ${
                  theme === option.value
                    ? 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/20'
                    : 'border-charcoal-200 bg-white hover:border-emerald-300 dark:border-navy-600 dark:bg-navy-800 dark:hover:border-emerald-500'
                }
              `}
            >
              <div className="flex items-center space-x-3 mb-2">
                <span className="text-2xl">{option.preview}</span>
                <div>
                  <div className={`font-medium ${
                    theme === option.value
                      ? 'text-emerald-700 dark:text-emerald-300'
                      : 'text-charcoal-700 dark:text-navy-300'
                  }`}>
                    {option.label}
                  </div>
                </div>
              </div>
              <p className={`text-sm ${
                theme === option.value
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-charcoal-600 dark:text-navy-400'
              }`}>
                {option.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Animation Intensity */}
      {theme !== 'none' && (
        <div>
          <h3 className="text-lg font-semibold text-charcoal-800 dark:text-navy-200 mb-4">
            Animation Intensity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {INTENSITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setIntensity(option.value)}
                className={`
                  p-3 rounded-lg border-2 text-center transition-all duration-200
                  ${
                    intensity === option.value
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-400 dark:bg-emerald-950/20 dark:text-emerald-300'
                      : 'border-charcoal-200 bg-white text-charcoal-700 hover:border-emerald-300 dark:border-navy-600 dark:bg-navy-800 dark:text-navy-300 dark:hover:border-emerald-500'
                  }
                `}
              >
                <div className="font-medium mb-1">{option.label}</div>
                <div className="text-sm opacity-75">{option.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info Panel */}
      <div className="p-4 rounded-lg border border-charcoal-200 bg-charcoal-50 dark:border-navy-600 dark:bg-navy-800/50">
        <div className="flex items-start space-x-3">
          <div className="text-emerald-500 dark:text-emerald-400 mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h4 className="text-sm font-medium text-charcoal-800 dark:text-navy-200">
              Background Information
            </h4>
            <div className="text-sm text-charcoal-600 dark:text-navy-400 mt-1 space-y-1">
              <p>• Backgrounds appear globally across all pages and dialogs</p>
              <p>• Settings are saved automatically in your browser</p>
              <p>• Animations respect your accessibility preferences</p>
              <p>• All backgrounds are optimized for performance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Preview Status */}
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">
            Currently showing: {BACKGROUND_THEMES.find(t => t.value === theme)?.label}
            {theme !== 'none' && ` (${intensity})`}
          </span>
        </div>
      </div>
    </div>
  );
}