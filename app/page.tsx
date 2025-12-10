'use client';

import { useState, useEffect } from 'react';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import VideoSection from '@/components/VideoSection';
import FloatingButton from '@/components/FloatingButton';
import BackgroundShapes from '@/components/BackgroundShapes';
import { getCurrentUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [studentCount, setStudentCount] = useState(12543);

  useEffect(() => {
    // Check if user is lecturer and redirect
    const checkUserRole = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', currentUser.id)
            .single();

          const resolvedRole = profile?.role || currentUser.user_metadata?.role || null;
          
          if (resolvedRole === 'lecturer') {
            window.location.href = '/lecturer/dashboard';
            return;
          }
        }
      } catch (error) {
        // Ignore errors, just continue showing home page
        console.error('Error checking user role:', error);
      }
    };

    checkUserRole();

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

