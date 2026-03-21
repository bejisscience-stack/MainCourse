'use client';

import { useState } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';

export default function TestBackgroundAnimations() {
  const { theme, setTheme } = useBackground();
  const [isVisible, setIsVisible] = useState(false);

  const themes = [
    'stockMarket',
    'cryptoRain',
    'moneyFlow',
    'socialMedia',
    'aiNetwork',
    'globalCommerce',
    'analytics'
  ];

  return (
    <div className="fixed top-4 right-4 z-50 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg border">
      <button
        onClick={() => setIsVisible(!isVisible)}
        className="mb-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
      >
        {isVisible ? 'Hide' : 'Show'} Background Controls
      </button>

      {isVisible && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Current: {theme}</div>
          <div className="grid gap-1">
            {themes.map((themeName) => (
              <button
                key={themeName}
                onClick={() => setTheme(themeName as any)}
                className={`px-2 py-1 text-xs rounded ${
                  theme === themeName
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 hover:bg-gray-300'
                }`}
              >
                {themeName}
              </button>
            ))}
            <button
              onClick={() => setTheme('none')}
              className={`px-2 py-1 text-xs rounded ${
                theme === 'none'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 hover:bg-gray-300'
              }`}
            >
              None
            </button>
          </div>

          <div className="text-xs text-gray-600 mt-2">
            Click themes to test animations
          </div>
        </div>
      )}
    </div>
  );
}