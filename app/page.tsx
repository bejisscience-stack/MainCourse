"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import Footer from "@/components/Footer";
import PromoBanner from "@/components/landing/PromoBanner";
import TrustStrip from "@/components/landing/TrustStrip";
import ValuePropsGrid from "@/components/landing/ValuePropsGrid";
import SocialProofStats from "@/components/landing/SocialProofStats";
import TestimonialsSection from "@/components/landing/TestimonialsSection";
import FaqSection from "@/components/landing/FaqSection";
import FinalEnrollCta from "@/components/landing/FinalEnrollCta";

// Lazy load heavy components that are below the fold
const LandingCourseShowcase = dynamic(
  () => import("@/components/landing/LandingCourseShowcase"),
  {
    loading: () => (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </section>
    ),
  },
);

const ActiveProjectsCarousel = dynamic(
  () => import("@/components/ActiveProjectsCarousel"),
  {
    loading: () => (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </section>
    ),
  },
);

const FeaturedCoursesHero = dynamic(
  () => import("@/components/landing/FeaturedCoursesHero"),
  {
    loading: () => (
      <section className="px-4 sm:px-6 lg:px-8 pb-24 md:pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
          </div>
        </div>
      </section>
    ),
  },
);

export default function Home() {
  const router = useRouter();
  const { role: userRole, isLoading: userLoading } = useUser();

  // Redirect lecturers
  useEffect(() => {
    if (!userLoading && userRole === "lecturer") {
      router.push("/lecturer/dashboard");
    }
  }, [userRole, userLoading, router]);

  return (
    <main className="relative min-h-screen flex flex-col">
      <PromoBanner />
      <Navigation />
      <div className="relative z-10 flex-1">
        <FeaturedCoursesHero />
        <TrustStrip />
        <LandingCourseShowcase />
        <ValuePropsGrid />
        <SocialProofStats />
        <ActiveProjectsCarousel />
        <TestimonialsSection />
        <FaqSection />
        <FinalEnrollCta />
      </div>
      <Footer />
    </main>
  );
}
