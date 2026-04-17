"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useCourses } from "@/hooks/useCourses";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { useEnrollments } from "@/hooks/useEnrollments";
import { formatPriceInGel } from "@/lib/currency";

export default function FeaturedCoursesHero() {
  const { t, isReady } = useI18n();
  const { user, role } = useUser();
  const { courses, isLoading, error } = useCourses("All");
  const { isEnrollmentActive } = useEnrollments(user?.id ?? null);
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
        <div className="max-w-7xl mx-auto rounded-3xl bg-charcoal-950/90 dark:bg-navy-900/90 min-h-[520px] lg:min-h-0 lg:h-[600px] flex items-center justify-center">
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

  const primaryCta = ((): { label: string; href: string } => {
    if (role === "lecturer") {
      return {
        label: isReady
          ? t("home.featuredCarousel.lecturerCta")
          : "Open Dashboard",
        href: "/lecturer/dashboard",
      };
    }
    if (!user) {
      return {
        label: isReady
          ? t("home.featuredCarousel.primaryCta_guest")
          : "Register Now",
        href: `/signup?redirect=${encodeURIComponent(`/courses?pendingEnroll=course:${course.id}`)}`,
      };
    }
    if (isEnrollmentActive(course.id)) {
      return {
        label: isReady ? t("courses.goToCourse") : "Go To Course",
        href: `/courses/${course.id}/chat?channel=lectures`,
      };
    }
    return {
      label: isReady ? t("home.featuredCarousel.primaryCta_buy") : "Buy",
      href: `/courses?pendingEnroll=course:${course.id}`,
    };
  })();

  return (
    <section className="pt-24 md:pt-28 px-4 sm:px-6 lg:px-8 pb-10 md:pb-12">
      <div className="max-w-7xl mx-auto relative">
        <div className="rounded-3xl overflow-hidden bg-charcoal-950 dark:bg-navy-900 shadow-soft-2xl">
          <div className="grid lg:grid-cols-2 lg:h-[600px]">
            <div className="px-6 py-7 md:px-10 md:py-9 lg:px-16 lg:py-12 lg:h-full flex flex-col text-white bg-charcoal-950 dark:bg-navy-900 order-2 lg:order-1">
              <p className="text-xs uppercase tracking-[0.22em] text-emerald-300 mb-3 md:mb-4">
                {isReady ? t("home.featuredCarousel.badge") : "Featured Course"}
              </p>
              <h1 className="text-2xl md:text-3xl lg:text-5xl font-bold leading-tight line-clamp-2 min-h-[64px] md:min-h-[80px] lg:min-h-[116px]">
                {course.title}
              </h1>

              {course.creator && (
                <p className="mt-2 text-sm text-charcoal-300 dark:text-gray-300">
                  {isReady
                    ? t("home.featuredCarousel.byAuthor", {
                        name: course.creator,
                      })
                    : `by ${course.creator}`}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-3 min-h-[28px]">
                {course.review_count > 0 && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <svg
                      className="w-4 h-4 text-amber-400 fill-current"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.367 2.446a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.366-2.446a1 1 0 00-1.176 0l-3.366 2.446c-.784.57-1.838-.197-1.539-1.118l1.286-3.957a1 1 0 00-.364-1.118L2.06 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
                    </svg>
                    <span className="font-semibold text-white">
                      {course.rating.toFixed(1)}
                    </span>
                    <span className="text-charcoal-400">
                      (
                      {isReady
                        ? t("home.featuredCarousel.reviewsCount", {
                            count: course.review_count.toLocaleString(),
                          })
                        : `${course.review_count} reviews`}
                      )
                    </span>
                  </div>
                )}
                {course.is_bestseller && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 text-xs font-semibold border border-amber-500/30">
                    🔥 {isReady ? t("courses.bestseller") : "Bestseller"}
                  </span>
                )}
                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 text-xs font-semibold border border-emerald-500/30 whitespace-nowrap truncate max-w-[180px]">
                  {course.course_type}
                </span>
              </div>

              <p className="mt-3 text-charcoal-300 dark:text-gray-300 text-sm md:text-base leading-relaxed line-clamp-2 min-h-[40px] md:min-h-[48px]">
                {course.description ||
                  (isReady
                    ? t("home.featuredCarousel.defaultDescription")
                    : "Learn practical digital skills with expert guidance.")}
              </p>

              {hasDiscount && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-bold text-red-300">
                  🔥{" "}
                  {isReady
                    ? t("home.featuredCarousel.limitedOffer")
                    : "Limited time offer"}
                </p>
              )}

              <div className="mt-3 h-10 flex items-center gap-3">
                <span className="text-3xl md:text-4xl font-bold leading-none shrink-0">
                  {formatPriceInGel(course.price)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-charcoal-400 line-through text-base md:text-lg shrink-0">
                      {formatPriceInGel(course.original_price!)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-300 text-xs md:text-sm font-semibold shrink-0">
                      -{discountPercent}%
                    </span>
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link
                  href={primaryCta.href}
                  className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 transition-all duration-200"
                >
                  {primaryCta.label}
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </Link>
                <Link
                  href="/courses"
                  className="text-sm font-semibold text-white/70 hover:text-white underline-offset-4 hover:underline transition-colors"
                >
                  {isReady
                    ? t("home.featuredCarousel.secondaryCta")
                    : "Browse courses"}
                </Link>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-charcoal-400">
                <span className="inline-flex items-center gap-1.5">
                  <svg
                    className="w-3.5 h-3.5 text-emerald-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {isReady
                    ? t("home.featuredCarousel.lifetimeAccess")
                    : "Lifetime access"}
                </span>
              </div>
            </div>

            <div className="relative bg-charcoal-950 dark:bg-navy-900 p-3 md:p-4 lg:p-6 lg:h-full order-1 lg:order-2">
              {course.thumbnail_url ? (
                <img
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-full h-[220px] md:h-[280px] lg:h-full object-cover rounded-2xl"
                  loading="eager"
                />
              ) : (
                <div className="w-full h-[220px] md:h-[280px] lg:h-full bg-gradient-to-br from-emerald-500/10 via-charcoal-900 to-charcoal-950 dark:from-emerald-500/10 dark:via-navy-950 dark:to-navy-900 rounded-2xl" />
              )}
              {hasDiscount && discountPercent !== null && (
                <div className="absolute top-5 left-5 md:top-8 md:left-8 bg-red-500 text-white px-2.5 py-1 md:px-4 md:py-2 rounded-lg shadow-lg text-xs md:text-base font-bold tracking-wide uppercase">
                  -{discountPercent}% {isReady ? t("courses.sale") : "Sale"}
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
              className="hidden md:flex absolute left-0 lg:-left-6 xl:-left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 border-white/30 bg-transparent text-white items-center justify-center hover:border-white/60 hover:bg-white/10 transition-all duration-200"
              aria-label={
                isReady ? t("home.featuredCarousel.previous") : "Previous"
              }
            >
              <svg
                className="w-4 h-4 lg:w-5 lg:h-5"
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
              className="hidden md:flex absolute right-0 lg:-right-6 xl:-right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 lg:w-12 lg:h-12 rounded-full border-2 border-white/30 bg-transparent text-white items-center justify-center hover:border-white/60 hover:bg-white/10 transition-all duration-200"
              aria-label={isReady ? t("home.featuredCarousel.next") : "Next"}
            >
              <svg
                className="w-4 h-4 lg:w-5 lg:h-5"
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
                className={`rounded-full transition-all duration-200 ${
                  index === currentIndex
                    ? "w-4 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
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
