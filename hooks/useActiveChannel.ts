import { useState, useEffect, useCallback } from 'react';

export function useActiveChannel() {
  // Initialize with null to avoid hydration mismatch
  // localStorage will be read after mount
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('activeChannelId');
      if (stored) {
        setActiveChannelIdState(stored);
      }
      setIsHydrated(true);
    }
  }, []);

  // Save to localStorage when value changes (but only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      if (activeChannelId) {
        localStorage.setItem('activeChannelId', activeChannelId);
      }
    }
  }, [activeChannelId, isHydrated]);

  // Memoize setter to prevent unnecessary re-renders
  const setActiveChannelId = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
    setActiveChannelIdState(value);
  }, []);

  return [activeChannelId, setActiveChannelId] as const;
}















