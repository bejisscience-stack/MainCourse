'use client';

import { useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import VideoSection from '@/components/VideoSection';
import CoursesCarousel from '@/components/CoursesCarousel';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';


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
    <main className="relative min-h-screen">
      <Navigation />
      <div className="relative z-10">
        <Hero />
        <VideoSection />
        <CoursesCarousel />
      </div>
    </main>
  );
}

