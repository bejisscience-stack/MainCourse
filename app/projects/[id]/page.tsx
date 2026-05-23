"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import Navigation from "@/components/Navigation";
import BudgetPoolCard from "@/components/projects/BudgetPoolCard";
import HowItWorks from "@/components/projects/HowItWorks";
import CriteriaGrid from "@/components/projects/CriteriaGrid";
import RecentSubmissions from "@/components/projects/RecentSubmissions";
import ProjectSubscriptionModal from "@/components/ProjectSubscriptionModal";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { useEnrollments } from "@/hooks/useEnrollments";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useSignedChatMediaUrl } from "@/hooks/useSignedChatMediaUrl";
import { useProjectCountdown } from "@/hooks/useProjectCountdown";
import { useProjectById } from "@/hooks/useProjectById";

function isChatMediaStoragePath(value: string | null | undefined): boolean {
  return !!value && !value.includes("://");
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params?.id;
  const { t } = useI18n();
  const router = useRouter();
  const { user } = useUser();
  const { project, isLoading } = useProjectById(projectId);
  const { enrolledCourseIds } = useEnrollments(user?.id || null);
  const { hasProjectAccess } = useProjectAccess(user?.id);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  const countdown = useProjectCountdown(project?.start_date, project?.end_date);

  // Resolve reference video — chat-media path → signed URL; YouTube/external passes through
  const videoLinkPath = isChatMediaStoragePath(project?.video_link)
    ? (project?.video_link ?? null)
    : null;
  const { signedUrl: signedVideoLink } = useSignedChatMediaUrl(videoLinkPath);
  const resolvedVideoLink = videoLinkPath
    ? signedVideoLink
    : (project?.video_link ?? null);

  const isEnrolled = useMemo(() => {
    if (!project?.course_id) return false;
    return enrolledCourseIds.has(project.course_id);
  }, [project, enrolledCourseIds]);

  const canAccessProject = isEnrolled || hasProjectAccess;

  const handleGoToProject = useCallback(() => {
    if (!project) return;
    router.push(`/courses/${project.course_id}/chat?channel=projects`);
  }, [project, router]);

  const handleSubscribeClick = useCallback(() => {
    if (!user) {
      router.push(`/login?redirect=/projects/${projectId}`);
      return;
    }
    setShowSubscriptionModal(true);
  }, [user, router, projectId]);

  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      window.fbq("track", "ViewContent", {
        content_type: "product",
        content_name: project?.name || "Project",
      });
    }
  }, [project?.name]);

  // 404 / loading states
  if (!isLoading && !project) {
    return (
      <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900">
        <Navigation />
        <div className="pt-32 pb-16 text-center px-6">
          <h1 className="text-3xl font-bold text-charcoal-950 dark:text-white mb-3">
            {t("projectsPage.noProjects") || "Project not found"}
          </h1>
          <p className="text-charcoal-600 dark:text-gray-400 mb-6">
            {t("projectsPage.noProjectsDescription")}
          </p>
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-charcoal-950 dark:bg-emerald-500 text-white rounded-xl font-semibold hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors"
          >
            ← {t("projectDetail.breadcrumbProjects") || "Projects"}
          </Link>
        </div>
      </main>
    );
  }

  const statusPill = project
    ? countdown.isExpired
      ? {
          label: t("projectsPage.statusExpired") || "Expired",
          cls: "bg-charcoal-200 text-charcoal-700 dark:bg-navy-700 dark:text-gray-300",
        }
      : countdown.timeRemaining.days <= 3 && countdown.isStarted
        ? {
            label: t("projectsPage.statusEndingSoon") || "Ending soon",
            cls: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
          }
        : {
            label: t("projectsPage.statusActive") || "Active",
            cls: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
          }
    : null;

  const lecturerName =
    project?.lecturer_full_name ||
    project?.lecturer_username ||
    t("activeProjects.unknownLecturer");

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900">
      <div className="fixed inset-0 bg-gradient-to-b from-[#fafafa] via-white to-[#fafafa] dark:from-navy-950 dark:via-navy-900 dark:to-navy-950 pointer-events-none" />
      <Navigation />

      <div className="relative z-10 pt-20 pb-24">
        {/* Hero */}
        <div className="relative">
          <div className="relative h-[300px] md:h-[420px] w-full overflow-hidden bg-gradient-to-br from-charcoal-200 via-white to-emerald-50 dark:from-navy-800 dark:via-navy-900 dark:to-navy-800">
            {project?.course_thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.course_thumbnail_url}
                alt={project.course_title ?? ""}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            {/* Gradient overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/95 via-charcoal-950/55 to-charcoal-950/20 dark:from-navy-950/95 dark:via-navy-950/60 dark:to-navy-950/30" />
            <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-charcoal-950/50 to-transparent dark:from-navy-950/60" />
          </div>

          {/* Overlay content positioned absolutely on hero */}
          <div className="absolute inset-x-0 bottom-0 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 md:pb-10">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-xs md:text-sm text-white/80 mb-4">
              <Link href="/" className="hover:text-white transition-colors">
                {t("projectDetail.breadcrumbHome") || "Home"}
              </Link>
              <span className="text-white/40">›</span>
              <Link
                href="/projects"
                className="hover:text-white transition-colors"
              >
                {t("projectDetail.breadcrumbProjects") || "Projects"}
              </Link>
              <span className="text-white/40">›</span>
              <span className="text-white truncate max-w-[200px] md:max-w-none">
                {project?.name || "…"}
              </span>
            </nav>

            {/* Status + course chips */}
            {project && (
              <div className="flex items-center gap-2 flex-wrap mb-3">
                {statusPill && (
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide backdrop-blur-sm ${statusPill.cls}`}
                  >
                    {statusPill.label}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white/15 text-white backdrop-blur-sm border border-white/15">
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                  {project.course_title}
                </span>
              </div>
            )}

            {/* Title */}
            <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight drop-shadow-lg max-w-4xl">
              {isLoading ? "…" : project?.name}
            </h1>
            {project && (
              <p className="mt-2 text-white/75 text-sm md:text-base flex items-center gap-2">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {lecturerName}
              </p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
          {isLoading || !project ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-40 bg-white dark:bg-navy-800 rounded-3xl" />
                <div className="h-64 bg-white dark:bg-navy-800 rounded-3xl" />
              </div>
              <div className="h-80 bg-white dark:bg-navy-800 rounded-3xl" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left column */}
              <div className="lg:col-span-2 space-y-10">
                {/* About */}
                <section>
                  <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white mb-4">
                    {t("projectDetail.about") || "About this project"}
                  </h2>
                  <p className="text-charcoal-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {project.description}
                  </p>
                </section>

                {/* How it works */}
                <HowItWorks />

                {/* Criteria */}
                {project.criteria.length > 0 && (
                  <CriteriaGrid criteria={project.criteria} />
                )}

                {/* Recent Submissions */}
                <RecentSubmissions projectId={project.id} />
              </div>

              {/* Right column */}
              <div className="lg:col-span-1">
                <div className="lg:sticky lg:top-24">
                  <BudgetPoolCard
                    project={project}
                    primaryAction={
                      canAccessProject
                        ? {
                            label: t("activeProjects.goToProject"),
                            onClick: handleGoToProject,
                            icon: (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                                />
                              </svg>
                            ),
                          }
                        : {
                            label: t("activeProjects.subscribeToProjects"),
                            onClick: handleSubscribeClick,
                            icon: (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                              </svg>
                            ),
                          }
                    }
                    referenceVideoUrl={resolvedVideoLink}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky CTA */}
      {project && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-white via-white/95 to-white/0 dark:from-navy-950 dark:via-navy-950/95 dark:to-transparent">
          <button
            onClick={
              canAccessProject ? handleGoToProject : handleSubscribeClick
            }
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-2xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 shadow-lg transition-colors"
          >
            {canAccessProject
              ? t("activeProjects.goToProject")
              : t("activeProjects.subscribeToProjects")}
          </button>
        </div>
      )}

      <ProjectSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={() => setShowSubscriptionModal(false)}
      />
    </main>
  );
}
