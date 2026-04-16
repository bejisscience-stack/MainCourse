"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Navigation from "@/components/Navigation";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import Footer from "@/components/Footer";
import PromoBanner from "@/components/landing/PromoBanner";

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

const FeaturedCoursesHero = dynamic(
  () => import("@/components/landing/FeaturedCoursesHero"),
  {
    loading: () => (
      <section className="pt-24 md:pt-28 px-4 sm:px-6 lg:px-8 pb-10 md:pb-12">
        <div className="max-w-7xl mx-auto rounded-3xl bg-charcoal-950/90 dark:bg-navy-900/90 h-[400px] md:h-[480px] lg:h-[540px] flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500"></div>
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
        <LandingCourseShowcase />
      </div>
      <Footer />
    </main>
  );
}
