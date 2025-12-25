'use client';

import { useState, useEffect } from 'react';

interface WindowDimensions {
  width: number;
  height: number;
}

export function useWindowDimensions(): WindowDimensions {
  const [dimensions, setDimensions] = useState<WindowDimensions>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    function updateDimensions() {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    // Set initial dimensions
    updateDimensions();

    // Add event listener for window resize
    window.addEventListener('resize', updateDimensions, { passive: true });

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  return dimensions;
}