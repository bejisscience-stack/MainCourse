"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCourses } from "@/hooks/useCourses";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useUser } from "@/hooks/useUser";
import CourseEnrollmentCard from "@/components/CourseEnrollmentCard";
import { useI18n } from "@/contexts/I18nContext";
import { ScrollReveal } from "@/components/ScrollReveal";

const categoryOrder = [
  { key: "editing", type: "Editing" },
  { key: "contentCreation", type: "Content Creation" },
  { key: "websiteCreation", type: "Website Creation" },
] as const;

export default function LandingCourseShowcase() {
  const { t } = useI18n();
  const { user } = useUser();
  const { courses, isLoading, error } = useCourses("All");
  const { enrolledCourseIds, getEnrollmentInfo } = useEnrollments(
    user?.id || null,
  );

  const popularCourses = useMemo(() => {
    const withScore = courses.map((course) => {
      const discountScore =
        course.original_price && course.original_price > course.price ? 2 : 0;
      const bestsellerScore = course.is_bestseller ? 4 : 0;
      const ratingScore = course.rating * 2;
      const reviewsScore = Math.min(
        3,
        Math.log10((course.review_count || 0) + 1),
      );
      return {
        course,
        score: bestsellerScore + ratingScore + reviewsScore + discountScore,
      };
    });

    return withScore
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.course);
  }, [courses]);

  const groupedCourses = useMemo(
    () =>
      categoryOrder.map((entry) => ({
        ...entry,
        courses: courses
          .filter((course) => course.course_type === entry.type)
          .slice(0, 8),
      })),
    [courses],
  );

  if (isLoading && courses.length === 0) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-500" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400 px-6 py-4 rounded-2xl max-w-2xl mx-auto text-center shadow-soft">
            <p className="font-semibold mb-2">
              {t("home.courseShowcase.errorTitle")}
            </p>
            <p className="text-sm">
              {error.message || t("home.courseShowcase.errorBody")}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (courses.length === 0) {
    return null;
  }

  return (
    <section className="px-4 sm:px-6 lg:px-8 pb-20 md:pb-28">
      <div className="max-w-7xl mx-auto space-y-16">
        <ScrollReveal delay={0} duration={600}>
          <div className="text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white tracking-tight">
              {t("home.courseShowcase.title")}
            </h2>
            <p className="mt-3 text-base md:text-lg text-charcoal-600 dark:text-gray-300">
              {t("home.courseShowcase.subtitle")}
            </p>
          </div>
        </ScrollReveal>

        <div>
          <div className="flex items-end justify-between mb-5">
            <div>
              <h3 className="text-2xl font-bold text-charcoal-950 dark:text-white">
                {t("home.courseShowcase.popularTitle")}
              </h3>
              <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-1">
                {t("home.courseShowcase.popularSubtitle")}
              </p>
            </div>
            <Link
              href="/courses"
              className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
            >
              {t("home.courseShowcase.viewAll")}
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {popularCourses.map((course) => {
              const enrollmentInfo = getEnrollmentInfo(course.id);
              return (
                <CourseEnrollmentCard
                  key={course.id}
                  course={course}
                  isEnrolled={enrolledCourseIds.has(course.id)}
                  showEnrollButton={true}
                  userId={user?.id || null}
                  isExpired={enrollmentInfo?.isExpired}
                  expiresAt={enrollmentInfo?.expiresAt}
                  daysRemaining={enrollmentInfo?.daysRemaining}
                />
              );
            })}
          </div>
        </div>

        {groupedCourses.map((group) => (
          <div key={group.type}>
            <div className="flex items-end justify-between mb-5">
              <div>
                <h3 className="text-xl md:text-2xl font-bold text-charcoal-950 dark:text-white">
                  {t(`home.courseShowcase.rows.${group.key}.title`)}
                </h3>
                <p className="text-sm text-charcoal-500 dark:text-gray-400 mt-1">
                  {t(`home.courseShowcase.rows.${group.key}.subtitle`)}
                </p>
              </div>
              <Link
                href={`/courses?filter=${encodeURIComponent(group.type)}`}
                className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500"
              >
                {t("home.courseShowcase.viewCategory")}
              </Link>
            </div>
            <div className="flex gap-5 overflow-x-auto pb-2 snap-x scrollbar-thin">
              {group.courses.map((course) => {
                const enrollmentInfo = getEnrollmentInfo(course.id);
                return (
                  <div
                    key={course.id}
                    className="min-w-[280px] max-w-[320px] snap-start flex-1"
                  >
                    <CourseEnrollmentCard
                      course={course}
                      isEnrolled={enrolledCourseIds.has(course.id)}
                      showEnrollButton={true}
                      userId={user?.id || null}
                      isExpired={enrollmentInfo?.isExpired}
                      expiresAt={enrollmentInfo?.expiresAt}
                      daysRemaining={enrollmentInfo?.daysRemaining}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
