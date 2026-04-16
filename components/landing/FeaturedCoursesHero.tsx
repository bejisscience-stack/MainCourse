"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCourses } from "@/hooks/useCourses";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { formatPriceInGel } from "@/lib/currency";

export default function FeaturedCoursesHero() {
  const { t, isReady } = useI18n();
  const { user, role } = useUser();
  const { courses, isLoading, error } = useCourses("All");
  const [currentIndex, setCurrentIndex] = useState(0);

  const featuredCourses = useMemo(() => {
    return [...courses]
      .sort((a, b) => {
        const aScore =
          (a.is_bestseller ? 3 : 0) + a.rating + a.review_count / 100;
        const bScore =
          (b.is_bestseller ? 3 : 0) + b.rating + b.review_count / 100;
        return bScore - aScore;
      })
      .slice(0, 10);
  }, [courses]);

  useEffect(() => {
    if (featuredCourses.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredCourses.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [featuredCourses.length]);

  useEffect(() => {
    if (currentIndex >= featuredCourses.length) {
      setCurrentIndex(0);
    }
  }, [featuredCourses.length, currentIndex]);

  if (isLoading && courses.length === 0) {
    return (
      <section className="pt-24 md:pt-28 px-4 sm:px-6 lg:px-8 pb-10 md:pb-12">
        <div className="max-w-7xl mx-auto rounded-3xl bg-charcoal-950/90 dark:bg-navy-900/90 h-[360px] flex items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
        </div>
      </section>
    );
  }

  if (error || featuredCourses.length === 0) {
    return null;
  }

  const course = featuredCourses[currentIndex];
  const hasDiscount =
    course.original_price &&
    course.original_price > 0 &&
    course.original_price > course.price;
  const discountPercent = hasDiscount
    ? Math.round(
        ((course.original_price! - course.price) / course.original_price!) *
          100,
      )
    : null;
  const enrollmentHref = !user
    ? `/signup?redirect=${encodeURIComponent(`/courses?pendingEnroll=course:${course.id}`)}`
    : `/courses?pendingEnroll=course:${course.id}`;

  return (
    <section className="pt-24 md:pt-28 px-4 sm:px-6 lg:px-8 pb-10 md:pb-12">
      <div className="max-w-7xl mx-auto relative">
        <div className="rounded-3xl overflow-hidden bg-charcoal-950 dark:bg-navy-900 border border-charcoal-800 dark:border-navy-700 shadow-soft-2xl">
          <div className="grid lg:grid-cols-2 min-h-[380px] md:min-h-[420px]">
            <div className="p-7 md:p-10 lg:p-12 flex flex-col justify-center text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-4">
                {isReady ? t("home.featuredCarousel.badge") : "Featured Course"}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
                {course.title}
              </h1>
              <p className="text-charcoal-300 dark:text-gray-300 text-sm md:text-base leading-relaxed mb-6 line-clamp-3">
                {course.description ||
                  (isReady
                    ? t("home.featuredCarousel.defaultDescription")
                    : "Learn practical digital skills with expert guidance.")}
              </p>

              <div className="flex items-center gap-4 text-sm text-charcoal-300 mb-6">
                <span className="inline-flex items-center gap-1">
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.08 3.324a1 1 0 00.95.69h3.494c.969 0 1.371 1.24.588 1.81l-2.827 2.055a1 1 0 00-.364 1.118l1.08 3.323c.3.922-.755 1.688-1.54 1.118l-2.827-2.055a1 1 0 00-1.176 0l-2.827 2.055c-.784.57-1.838-.196-1.539-1.118l1.08-3.323a1 1 0 00-.364-1.118L2.98 8.75c-.783-.57-.38-1.81.588-1.81h3.494a1 1 0 00.95-.69l1.08-3.324z" />
                  </svg>
                  {course.rating > 0 ? course.rating.toFixed(1) : "4.8"}
                </span>
                <span>
                  {course.review_count.toLocaleString()}{" "}
                  {isReady ? t("courseCard.ratings") : "ratings"}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-xs">
                  {course.course_type}
                </span>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold">
                  {formatPriceInGel(course.price)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-charcoal-400 line-through text-lg">
                      {formatPriceInGel(course.original_price!)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-sm font-semibold">
                      -{discountPercent}%
                    </span>
                  </>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                {role === "lecturer" ? (
                  <Link
                    href="/lecturer/dashboard"
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors"
                  >
                    {isReady
                      ? t("home.featuredCarousel.lecturerCta")
                      : "Open Dashboard"}
                  </Link>
                ) : (
                  <Link
                    href={enrollmentHref}
                    className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-white text-charcoal-950 hover:bg-gray-200 font-semibold transition-colors"
                  >
                    {isReady
                      ? t("home.featuredCarousel.primaryCta")
                      : "Enroll now"}
                  </Link>
                )}
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-white/30 text-white hover:bg-white/10 font-medium transition-colors"
                >
                  {isReady
                    ? t("home.featuredCarousel.secondaryCta")
                    : "Browse courses"}
                </Link>
              </div>
            </div>

            <div className="relative bg-charcoal-900 dark:bg-navy-950">
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500/20 to-charcoal-900 flex items-center justify-center text-white/70">
                  {isReady
                    ? t("home.featuredCarousel.imageFallback")
                    : "Course preview"}
                </div>
              )}
            </div>
          </div>
        </div>

        {featuredCourses.length > 1 && (
          <>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex(
                  (prev) =>
                    (prev - 1 + featuredCourses.length) %
                    featuredCourses.length,
                )
              }
              className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-charcoal-900 items-center justify-center shadow-soft hover:bg-white transition-colors"
              aria-label={
                isReady ? t("home.featuredCarousel.previous") : "Previous"
              }
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((prev) => (prev + 1) % featuredCourses.length)
              }
              className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-charcoal-900 items-center justify-center shadow-soft hover:bg-white transition-colors"
              aria-label={isReady ? t("home.featuredCarousel.next") : "Next"}
            >
              <svg
                className="w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </>
        )}

        {featuredCourses.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-4">
            {featuredCourses.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? "w-6 bg-charcoal-900 dark:bg-white"
                    : "w-2 bg-charcoal-300 dark:bg-gray-600"
                }`}
                aria-label={`${isReady ? t("home.featuredCarousel.goToSlide") : "Go to slide"} ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
