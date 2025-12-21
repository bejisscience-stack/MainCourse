import { useState, useEffect } from 'react';

export function useActiveChannel() {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeChannelId');
    }
    return null;
  });

  useEffect(() => {
    if (activeChannelId && typeof window !== 'undefined') {
      localStorage.setItem('activeChannelId', activeChannelId);
    }
  }, [activeChannelId]);

  return [activeChannelId, setActiveChannelId] as const;
}









