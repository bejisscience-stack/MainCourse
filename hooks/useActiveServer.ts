import { useState, useEffect, useCallback } from 'react';

export function useActiveServer() {
  // Initialize with null to avoid hydration mismatch
  // localStorage will be read after mount
  const [activeServerId, setActiveServerIdState] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('activeServerId');
      if (stored) {
        setActiveServerIdState(stored);
      }
      setIsHydrated(true);
    }
  }, []);

  // Save to localStorage when value changes (but only after hydration)
  useEffect(() => {
    if (isHydrated && typeof window !== 'undefined') {
      if (activeServerId) {
        localStorage.setItem('activeServerId', activeServerId);
      }
    }
  }, [activeServerId, isHydrated]);

  // Memoize setter to prevent unnecessary re-renders
  const setActiveServerId = useCallback((value: string | null | ((prev: string | null) => string | null)) => {
    setActiveServerIdState(value);
  }, []);

  return [activeServerId, setActiveServerId] as const;
}















