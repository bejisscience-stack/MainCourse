"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/I18nContext";
import { useUser } from "@/hooks/useUser";
import { useProjectAccess } from "@/hooks/useProjectAccess";
import { useEnrollments } from "@/hooks/useEnrollments";

interface ProjectsCtaPanelProps {
  onSubscribeClick: () => void;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Role-aware action card for the projects hub. Exactly one state renders:
 * loading → guest → lecturer → admin → active access → pending payment → subscribe.
 */
export default function ProjectsCtaPanel({
  onSubscribeClick,
}: ProjectsCtaPanelProps) {
  const { t, language } = useI18n();
  const { user, role, isLoading: userLoading } = useUser();
  const {
    hasProjectAccess,
    subscription,
    projectAccessExpiresAt,
    isLoading: accessLoading,
  } = useProjectAccess(user?.id);
  const { enrolledCourseIds } = useEnrollments(user?.id ?? null);

  const cardShell =
    "max-w-3xl mx-auto mb-12 bg-white/70 dark:bg-navy-800/60 rounded-3xl border border-charcoal-100/60 dark:border-navy-700/60 p-6 md:p-8 text-center shadow-soft";

  const primaryButton =
    "inline-flex items-center justify-center gap-2 px-6 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white rounded-xl font-semibold hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-colors";

  const secondaryButton =
    "inline-flex items-center justify-center gap-2 px-6 py-3 bg-charcoal-100 dark:bg-navy-700 text-charcoal-950 dark:text-white rounded-xl font-semibold hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-colors";

  if (userLoading || (user && accessLoading)) {
    return (
      <div className={cardShell}>
        <div className="animate-pulse space-y-3">
          <div className="h-5 w-48 mx-auto bg-charcoal-100 dark:bg-navy-700 rounded" />
          <div className="h-4 w-72 max-w-full mx-auto bg-charcoal-100 dark:bg-navy-700 rounded" />
          <div className="h-11 w-44 mx-auto bg-charcoal-100 dark:bg-navy-700 rounded-xl" />
        </div>
      </div>
    );
  }

  // Guest
  if (!user) {
    return (
      <div className={cardShell}>
        <h2 className="text-xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t("projectsPage.ctaGuestTitle")}
        </h2>
        <p className="text-charcoal-600 dark:text-gray-400 mb-5">
          {t("projectsPage.ctaGuestDescription")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/login?redirect=/projects" className={primaryButton}>
            {t("nav.logIn")}
          </Link>
          <Link href="/signup?redirect=/projects" className={secondaryButton}>
            {t("nav.signUp")}
          </Link>
        </div>
      </div>
    );
  }

  // Lecturer
  if (role === "lecturer") {
    return (
      <div className={cardShell}>
        <h2 className="text-xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t("projectsPage.ctaLecturerTitle")}
        </h2>
        <p className="text-charcoal-600 dark:text-gray-400 mb-5">
          {t("projectsPage.ctaLecturerDescription")}
        </p>
        <Link href="/lecturer/projects" className={primaryButton}>
          {t("projectsPage.ctaManageProjects")}
        </Link>
      </div>
    );
  }

  // Admin
  if (role === "admin") {
    return (
      <div className={cardShell}>
        <h2 className="text-xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t("projectsPage.ctaAdminTitle")}
        </h2>
        <p className="text-charcoal-600 dark:text-gray-400 mb-5">
          {t("projectsPage.ctaAdminDescription")}
        </p>
        <Link href="/admin" className={primaryButton}>
          {t("projectsPage.ctaAdminButton")}
        </Link>
      </div>
    );
  }

  // Active access — show the later of the two expiry sources
  if (hasProjectAccess) {
    const now = Date.now();
    const expiryCandidates = [projectAccessExpiresAt, subscription?.expires_at]
      .map((d) => (d ? new Date(d).getTime() : NaN))
      .filter((ts) => !Number.isNaN(ts) && ts > now);
    const expiryTs = expiryCandidates.length
      ? Math.max(...expiryCandidates)
      : null;
    const expiryFormatted = expiryTs
      ? new Date(expiryTs).toLocaleDateString(
          language === "ge" ? "ka-GE" : "en-US",
          { day: "numeric", month: "long", year: "numeric" },
        )
      : null;
    const expiresSoon = expiryTs != null && expiryTs - now <= SEVEN_DAYS_MS;

    return (
      <div className={cardShell}>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-emerald-600 dark:text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t("projectsPage.ctaAccessActiveTitle")}
        </h2>
        {expiryFormatted && (
          <p className="text-charcoal-600 dark:text-gray-400">
            {t("projectsPage.ctaAccessActiveUntil", {
              date: expiryFormatted,
            })}
          </p>
        )}
        {expiresSoon && (
          <button
            type="button"
            onClick={onSubscribeClick}
            className={`${secondaryButton} mt-5`}
          >
            {t("projectsPage.ctaRenew")}
          </button>
        )}
      </div>
    );
  }

  // Pending payment — realtime flips this on approval. Keepz pendings get a
  // retry button (the row is created before checkout, so an abandoned Keepz
  // page would otherwise strand the user with no way back into the modal).
  if (subscription?.status === "pending") {
    const isKeepzPending = subscription.payment_method === "keepz";
    return (
      <div className={cardShell}>
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-amber-600 dark:text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-charcoal-950 dark:text-white mb-2">
          {t("projectsPage.ctaPendingTitle")}
        </h2>
        <p className="text-charcoal-600 dark:text-gray-400">
          {isKeepzPending
            ? t("projectsPage.ctaPendingKeepzDescription")
            : t("projectsPage.ctaPendingDescription")}
        </p>
        {isKeepzPending && (
          <button
            type="button"
            onClick={onSubscribeClick}
            className={`${secondaryButton} mt-5`}
          >
            {t("projectSubscription.retryPayment")}
          </button>
        )}
      </div>
    );
  }

  // No access (including expired / rejected subscription)
  const hadAccessBefore =
    subscription?.status === "expired" ||
    (projectAccessExpiresAt != null &&
      new Date(projectAccessExpiresAt).getTime() <= Date.now());

  return (
    <div className={cardShell}>
      <h2 className="text-xl font-bold text-charcoal-950 dark:text-white mb-2">
        {t("projectsPage.ctaNoAccessTitle")}
      </h2>
      <p className="text-charcoal-600 dark:text-gray-400 mb-1">
        {t("projectsPage.ctaNoAccessDescription")}
      </p>
      {hadAccessBefore && (
        <p className="text-sm text-charcoal-500 dark:text-gray-500 mb-1">
          {t("projectsPage.ctaExpiredHint")}
        </p>
      )}
      {enrolledCourseIds.size > 0 && (
        <p className="text-sm text-charcoal-500 dark:text-gray-500 mb-1">
          {t("projectsPage.ctaEnrolledHint")}
        </p>
      )}
      <button
        type="button"
        onClick={onSubscribeClick}
        className={`${primaryButton} mt-4`}
      >
        {t("activeProjects.subscribeToProjects")}
      </button>
    </div>
  );
}
