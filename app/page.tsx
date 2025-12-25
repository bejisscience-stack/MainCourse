'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import Navigation from '@/components/Navigation';
import Hero from '@/components/Hero';
import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import FirstLoginCoursePopup from '@/components/FirstLoginCoursePopup';

// Lazy load heavy components that are below the fold
const VideoSection = dynamic(() => import('@/components/VideoSection'), {
  loading: () => <div className="h-96" />, // Placeholder height
});

const CoursesCarousel = dynamic(() => import('@/components/CoursesCarousel'), {
  loading: () => (
    <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
      <div className="max-w-7xl mx-auto">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    </section>
  ),
});


export default function Home() {
  const router = useRouter();
  const { user, profile, role: userRole, isLoading: userLoading } = useUser();

  // Redirect lecturers
  useEffect(() => {
    if (!userLoading && userRole === 'lecturer') {
      router.push('/lecturer/dashboard');
    }
  }, [userRole, userLoading, router]);

  // Show first-login popup if user was referred for a course
  const shouldShowPopup = 
    !userLoading && 
    user && 
    profile && 
    profile.referred_for_course_id && 
    profile.signup_referral_code && 
    !profile.first_login_completed &&
    userRole !== 'lecturer'; // Don't show for lecturers

  return (
    <main className="relative min-h-screen">
      <Navigation />
      <div className="relative z-10">
        <Hero />
        <VideoSection />
        <CoursesCarousel />
      </div>
      {/* First Login Course Popup */}
      {shouldShowPopup && profile.referred_for_course_id && profile.signup_referral_code && (
        <FirstLoginCoursePopup
          courseId={profile.referred_for_course_id}
          referralCode={profile.signup_referral_code}
        />
      )}
    </main>
  );
}

