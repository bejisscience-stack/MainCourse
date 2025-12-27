'use client';

import { useEffect, useRef, useCallback } from 'react';

export default function ScrollPrevention() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<number>(0);
  
  // Debounced check function - only runs once per 100ms max
  const checkForModals = useCallback(() => {
    const now = Date.now();
    // Throttle: skip if called within 100ms of last check
    if (now - lastCheckRef.current < 100) {
      return;
    }
    lastCheckRef.current = now;
    
    const body = document.body;
    const html = document.documentElement;
    
    // Check if any modal is open by looking for elements with very high z-index
    // Use a more specific selector to reduce query scope
    const modals = document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal-open');
    const hasOpenModal = modals.length > 0 && Array.from(modals).some(el => {
      const styles = window.getComputedStyle(el);
      return styles.display !== 'none' && styles.visibility !== 'hidden';
    });
    
    // Only prevent scroll if modal is open AND content is short
    if (hasOpenModal) {
      const contentHeight = Math.max(body.scrollHeight, html.scrollHeight);
      const viewportHeight = window.innerHeight;
      
      if (contentHeight <= viewportHeight + 10) {
        body.style.overflowY = 'hidden';
      } else {
        body.style.overflowY = '';
      }
    } else {
      // Always allow scroll when no modal is open
      body.style.overflowY = '';
      html.style.overflowY = '';
    }
  }, []);

  useEffect(() => {
    // Debounced mutation handler
    const handleMutation = () => {
      // Clear any pending timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Schedule check after a small delay to batch rapid mutations
      timeoutRef.current = setTimeout(checkForModals, 50);
    };
    
    // Use MutationObserver with minimal scope
    const observer = new MutationObserver(handleMutation);
    
    // Only observe direct children of body, not the entire subtree
    // This dramatically reduces the number of mutation events
    observer.observe(document.body, {
      childList: true,
      subtree: false, // Changed from true to false - major performance improvement
      attributes: false, // Disabled attribute watching
    });
    
    // Initial check
    checkForModals();
    
    // Cleanup
    return () => {
      observer.disconnect();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, [checkForModals]);

  return null;
}

