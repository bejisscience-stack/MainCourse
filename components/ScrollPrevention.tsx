'use client';

import { useEffect } from 'react';

export default function ScrollPrevention() {
  useEffect(() => {
    // Only prevent scroll when there's a modal open (detected by checking for modals with high z-index)
    // This prevents the aggressive scroll blocking that was causing issues
    function checkForModals() {
      const body = document.body;
      const html = document.documentElement;
      
      // Check if any modal is open by looking for elements with very high z-index
      const modals = document.querySelectorAll('[class*="z-[999"], [class*="z-50"]');
      const hasOpenModal = Array.from(modals).some(el => {
        const styles = window.getComputedStyle(el);
        return styles.display !== 'none' && styles.visibility !== 'hidden' && styles.opacity !== '0';
      });
      
      // Only prevent scroll if modal is open AND content is short
      if (hasOpenModal) {
        const contentHeight = Math.max(
          body.scrollHeight,
          html.scrollHeight
        );
        const viewportHeight = window.innerHeight;
        
        // Only prevent scroll if content is actually shorter than viewport
        if (contentHeight <= viewportHeight + 10) { // Small buffer for rounding
          body.style.overflowY = 'hidden';
        } else {
          body.style.overflowY = '';
        }
      } else {
        // Always allow scroll when no modal is open
        body.style.overflowY = '';
        html.style.overflowY = '';
        body.style.height = '';
        html.style.height = '';
      }
    }
    
    // Use MutationObserver to watch for modal changes instead of constant checking
    const observer = new MutationObserver(() => {
      checkForModals();
    });
    
    // Observe changes to the body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
    
    // Initial check
    checkForModals();
    
    // Cleanup
    return () => {
      observer.disconnect();
      // Restore scroll on unmount
      document.body.style.overflowY = '';
      document.documentElement.style.overflowY = '';
    };
  }, []);

  return null;
}

