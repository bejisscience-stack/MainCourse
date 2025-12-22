'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import VideoSection from '@/components/VideoSection';
import CoursesCarousel from '@/components/CoursesCarousel';
import BackgroundShapes from '@/components/BackgroundShapes';
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
    <main className="relative min-h-screen bg-white overflow-hidden">
      <LazyBackgroundShapes />
      <Navigation />
      <div className="relative z-10">
        <Hero />
        <VideoSection />
        <CoursesCarousel />
      </div>
    </main>
  );
}

