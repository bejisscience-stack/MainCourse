'use client';

import { memo, lazy, Suspense } from 'react';
import { useBackground, BackgroundTheme } from '@/contexts/BackgroundContext';
import BackgroundShapes from '@/components/BackgroundShapes';

// Lazy load background components - only load what's needed
const StockMarketBackground = lazy(() => import('@/components/backgrounds/StockMarketBackground').then(m => ({ default: m.StockMarketBackground })));
const CryptoRainBackground = lazy(() => import('@/components/backgrounds/CryptoRainBackground').then(m => ({ default: m.CryptoRainBackground })));
const MoneyFlowBackground = lazy(() => import('@/components/backgrounds/MoneyFlowBackground').then(m => ({ default: m.MoneyFlowBackground })));
const SocialMediaBackground = lazy(() => import('@/components/backgrounds/SocialMediaBackground').then(m => ({ default: m.SocialMediaBackground })));
const AINetworkBackground = lazy(() => import('@/components/backgrounds/AINetworkBackground').then(m => ({ default: m.AINetworkBackground })));
const GlobalCommerceBackground = lazy(() => import('@/components/backgrounds/GlobalCommerceBackground').then(m => ({ default: m.GlobalCommerceBackground })));
const AnalyticsBackground = lazy(() => import('@/components/backgrounds/AnalyticsBackground').then(m => ({ default: m.AnalyticsBackground })));

// Map theme to component
const BACKGROUND_COMPONENTS: Record<BackgroundTheme, React.LazyExoticComponent<React.ComponentType> | null> = {
  none: null,
  subtle: null,
  stockMarket: StockMarketBackground,
  cryptoRain: CryptoRainBackground,
  moneyFlow: MoneyFlowBackground,
  socialMedia: SocialMediaBackground,
  aiNetwork: AINetworkBackground,
  globalCommerce: GlobalCommerceBackground,
  analytics: AnalyticsBackground,
};

function GlobalBackgroundManager() {
  const { theme, isReducedMotion } = useBackground();

  // Don't render anything if user prefers reduced motion
  if (isReducedMotion) {
    return null;
  }

  // Get the background component for the selected theme
  const BackgroundComponent = BACKGROUND_COMPONENTS[theme];

  // Render only the selected background for optimal performance
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden pointer-events-none z-0" aria-hidden="true" style={{ maxWidth: '100vw', maxHeight: '100vh', contain: 'strict' }}>
      {/* Base background shapes - lightweight, always visible */}
      <BackgroundShapes />
      
      {/* Only render the selected theme's background */}
      {BackgroundComponent && (
        <Suspense fallback={null}>
          <div className="absolute inset-0 opacity-60">
            <BackgroundComponent />
          </div>
        </Suspense>
      )}
    </div>
  );
}

export default memo(GlobalBackgroundManager);