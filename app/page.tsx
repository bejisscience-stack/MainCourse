'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import VideoSection from '@/components/VideoSection';
import CoursesCarousel from '@/components/CoursesCarousel';
import BackgroundShapes from '@/components/BackgroundShapes';
import { ScrollChart } from '@/components/ScrollChart';
import { BitcoinDrops } from '@/components/BitcoinDrops';
import { SocialIconFlow } from '@/components/SocialIconFlow';
import { AIParticles } from '@/components/AIParticles';
import { DataSignals } from '@/components/DataSignals';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';

// Lazy load BackgroundShapes as it's not critical for initial render
const LazyBackgroundShapes = dynamic(() => import('@/components/BackgroundShapes'), {
  ssr: true,
});

export default function Home() {
  const router = useRouter();
  const { role: userRole, isLoading: userLoading } = useUser();

  // Redirect lecturers
  useEffect(() => {
    if (!userLoading && userRole === 'lecturer') {
      router.push('/lecturer/dashboard');
    }
  }, [userRole, userLoading, router]);

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
      {/* Base gradient layer */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none"></div>
      
      {/* Subtle radial gradients for depth */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[800px] h-[800px] blur-3xl bg-gradient-radial from-emerald-500/3 via-emerald-500/1 to-transparent dark:from-emerald-400/4 dark:via-emerald-400/2 dark:to-transparent"></div>
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] blur-3xl bg-gradient-radial from-charcoal-200/2 via-transparent to-transparent dark:from-navy-400/2 dark:via-transparent dark:to-transparent"></div>
      </div>
      
      <LazyBackgroundShapes />
      <ScrollChart />
      <BitcoinDrops />
      <SocialIconFlow />
      <AIParticles />
      <DataSignals />
      <Navigation />
      <div className="relative z-10">
        <Hero />
        <VideoSection />
        <CoursesCarousel />
      </div>
    </main>
  );
}

