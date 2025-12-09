'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import VideoSection from '@/components/VideoSection';
import FloatingButton from '@/components/FloatingButton';
import BackgroundShapes from '@/components/BackgroundShapes';

export default function Home() {
  const [studentCount, setStudentCount] = useState(12543);

  useEffect(() => {
    // Simulate real-time student count updates
    const interval = setInterval(() => {
      setStudentCount(prev => prev + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10">
        <Hero />
        <VideoSection studentCount={studentCount} />
      </div>
      <FloatingButton />
    </main>
  );
}

