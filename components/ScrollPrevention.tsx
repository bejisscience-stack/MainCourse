'use client';

import { useEffect } from 'react';

export default function ScrollPrevention() {
  useEffect(() => {
    function preventExtraScroll() {
      const body = document.body;
      const html = document.documentElement;
      
      // Get actual content height
      const contentHeight = Math.max(
        body.scrollHeight,
        body.offsetHeight,
        html.clientHeight,
        html.scrollHeight,
        html.offsetHeight
      );
      
      // Get viewport height
      const viewportHeight = window.innerHeight;
      
      // Only allow scrolling if content is taller than viewport
      if (contentHeight <= viewportHeight) {
        html.style.height = '100%';
        html.style.overflowY = 'hidden';
        body.style.height = '100%';
        body.style.overflowY = 'hidden';
      } else {
        html.style.height = 'auto';
        html.style.overflowY = 'auto';
        body.style.height = 'auto';
        body.style.overflowY = 'auto';
      }
    }
    
    // Run immediately and on resize/load
    preventExtraScroll();
    
    // Use ResizeObserver for better performance
    const resizeObserver = new ResizeObserver(() => {
      preventExtraScroll();
    });
    
    resizeObserver.observe(document.body);
    
    window.addEventListener('resize', preventExtraScroll);
    window.addEventListener('load', preventExtraScroll);
    
    // Also check after a short delay to catch dynamic content
    const timeoutId = setTimeout(preventExtraScroll, 100);
    
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', preventExtraScroll);
      window.removeEventListener('load', preventExtraScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  return null;
}

