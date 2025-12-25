'use client';

import { memo } from 'react';
import { useBackground } from '@/contexts/BackgroundContext';
import BackgroundShapes from '@/components/BackgroundShapes';
import { StockMarketBackground } from '@/components/backgrounds/StockMarketBackground';
import { CryptoRainBackground } from '@/components/backgrounds/CryptoRainBackground';
import { MoneyFlowBackground } from '@/components/backgrounds/MoneyFlowBackground';
import { SocialMediaBackground } from '@/components/backgrounds/SocialMediaBackground';
import { AINetworkBackground } from '@/components/backgrounds/AINetworkBackground';
import { GlobalCommerceBackground } from '@/components/backgrounds/GlobalCommerceBackground';
import { AnalyticsBackground } from '@/components/backgrounds/AnalyticsBackground';
import SimpleBackgroundAnimation from '@/components/SimpleBackgroundAnimation';

function GlobalBackgroundManager() {
  const { isReducedMotion } = useBackground();

  // Don't render anything if user prefers reduced motion
  if (isReducedMotion) {
    return null;
  }

  // Render all background animations simultaneously for a rich, layered effect
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none z-0" aria-hidden="true" style={{ maxWidth: '100vw', maxHeight: '100vh' }}>
      {/* Base background shapes - always visible */}
      <BackgroundShapes />
      
      {/* Simple background animation - always visible */}
      <SimpleBackgroundAnimation />
      
      {/* All theme-specific backgrounds rendered simultaneously with visible opacity for layering */}
      <div className="absolute inset-0 opacity-60">
        <StockMarketBackground />
      </div>
      <div className="absolute inset-0 opacity-50">
        <CryptoRainBackground />
      </div>
      <div className="absolute inset-0 opacity-45">
        <MoneyFlowBackground />
      </div>
      <div className="absolute inset-0 opacity-50">
        <SocialMediaBackground />
      </div>
      <div className="absolute inset-0 opacity-45">
        <AINetworkBackground />
      </div>
      <div className="absolute inset-0 opacity-50">
        <GlobalCommerceBackground />
      </div>
      <div className="absolute inset-0 opacity-45">
        <AnalyticsBackground />
      </div>
    </div>
  );
}

export default memo(GlobalBackgroundManager);