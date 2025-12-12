import { useState, useEffect } from 'react';

export function useActiveServer() {
  const [activeServerId, setActiveServerId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('activeServerId');
    }
    return null;
  });

  useEffect(() => {
    if (activeServerId && typeof window !== 'undefined') {
      localStorage.setItem('activeServerId', activeServerId);
    }
  }, [activeServerId]);

  return [activeServerId, setActiveServerId] as const;
}




