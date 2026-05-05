"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import BackgroundShapes from "@/components/BackgroundShapes";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import AdminNotificationSender from "@/components/AdminNotificationSender";
import dynamic from "next/dynamic";

const AdminAnalytics = dynamic(() => import("@/components/AdminAnalytics"), {
  ssr: false,
  loading: () => (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-navy-800/50 rounded-xl" />
        ))}
      </div>
      <div className="h-64 bg-navy-800/50 rounded-xl" />
    </div>
  ),
});
const AdminViewBot = dynamic(() => import("@/components/AdminViewBot"), {
  ssr: false,
});
const AdminWithdrawals = dynamic(
  () => import("@/components/AdminWithdrawals"),
  { ssr: false },
);
const AdminKyc = dynamic(() => import("@/components/AdminKyc"), {
  ssr: false,
});
const AdminLecturerApprovals = dynamic(
  () => import("@/components/AdminLecturerApprovals"),
  { ssr: false },
);
const AdminSettings = dynamic(() => import("@/components/AdminSettings"), {
  ssr: false,
});
const AdminEmailManager = dynamic(
  () => import("@/components/AdminEmailManager"),
  { ssr: false },
);
const AdminOverview = dynamic(() => import("@/components/AdminOverview"), {
  ssr: false,
});
const AdminFreeProjectLecturers = dynamic(
  () => import("@/components/AdminFreeProjectLecturers"),
  { ssr: false },
);
import { useUser } from "@/hooks/useUser";
import { useCourses } from "@/hooks/useCourses";
import { useAdminRealtimeInvalidation } from "@/hooks/useAdminRealtimeInvalidation";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/components/CourseCard";

type TabType =
  | "overview"
  | "view-bot"
  | "withdrawals"
  | "kyc"
  | "lecturers"
  | "projects"
  | "courses"
  | "notifications"
  | "email-manager"
  | "analytics"
  | "settings";

const ADMIN_SHELL_LIVE_TABLES = [
  "courses",
  "profiles",
  "platform_settings",
] as const;

// Retry with exponential backoff utility
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[Admin Page] Attempt ${attempt + 1}/${maxRetries} failed:`,
          error.message,
        );
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        if (process.env.NODE_ENV === "development") {
          console.log(`[Admin Page] Retrying in ${delay}ms...`);
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

export default function AdminDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    user,
    profile,
    role: userRole,
    isLoading: userLoading,
    mutate: mutateUser,
  } = useUser();
  // For privilege-bearing checks, trust only the DB-resolved profile.role —
  // never the user_metadata fallback in `userRole`. The fallback is fine for
  // non-protected UI (homepage links, etc.) but must not unlock /admin.
  const profileRole = profile?.role ?? null;
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState<boolean | null>(null); // Direct DB verification
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  const {
    courses,
    isLoading: coursesLoading,
    mutate: mutateCourses,
  } = useCourses("All");
  const { isConnected: isShellLiveConnected } = useAdminRealtimeInvalidation({
    channelName: "admin-dashboard-shell",
    enabled: isAdminVerified === true || profileRole === "admin",
    tables: ADMIN_SHELL_LIVE_TABLES,
    onChange: () => {
      void mutateCourses();
      void mutateUser();
    },
  });

  // Direct database check on mount - bypass hook cache
  // Only run once on mount, not when dependencies change
  useEffect(() => {
    let isMounted = true;

    const verifyAdminDirectly = async () => {
      setIsCheckingAdmin(true);
      if (process.env.NODE_ENV === "development") {
        console.log("[Admin Page] === DIRECT ADMIN VERIFICATION ===");
      }

      try {
        // Get current session with retry
        const session = await retryWithBackoff(
          async () => {
            const {
              data: { session },
              error: sessionError,
            } = await supabase.auth.getSession();
            if (sessionError) {
              throw sessionError;
            }
            return session;
          },
          3,
          500,
        );

        if (!isMounted) return;

        if (process.env.NODE_ENV === "development") {
          console.log("[Admin Page] Session check:", {
            hasSession: !!session,
            userId: session?.user?.id,
          });
        }

        if (!session?.user) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Admin Page] No session, redirecting to login");
          }
          if (isMounted) {
            setIsAdminVerified(false);
            setIsCheckingAdmin(false);
            router.push("/login");
          }
          return;
        }

        const userId = session.user.id;

        // Use RPC function to check admin status (bypasses RLS) with retry
        const isAdmin = await retryWithBackoff(
          async () => {
            const { data, error: rpcError } = await supabase.rpc(
              "check_is_admin",
              { user_id: userId },
            );

            if (rpcError) {
              console.error("[Admin Page] RPC error:", rpcError);
              throw rpcError;
            }
            return data;
          },
          3,
          1000,
        );

        if (!isMounted) return;

        if (isAdmin === true) {
          setIsAdminVerified(true);
        } else {
          setIsAdminVerified(false);
        }
      } catch (err: any) {
        if (process.env.NODE_ENV === "development") {
          console.error(
            "[Admin Page] Error in direct admin verification after retries:",
            err,
          );
        }
        if (isMounted) {
          // On persistent failure, fall back to the DB-loaded profile.role
          // only — never user_metadata.role.
          if (profileRole === "admin") {
            setIsAdminVerified(true);
          } else {
            setIsAdminVerified(false);
          }
        }
      } finally {
        if (isMounted) {
          setIsCheckingAdmin(false);
        }
      }
    };

    verifyAdminDirectly();

    return () => {
      isMounted = false;
    };
  }, []); // Only run once on mount

  // Redirect if not admin - but only if direct verification failed
  // Use a ref to prevent multiple redirects
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Wait for direct verification to complete
    if (isCheckingAdmin) {
      return;
    }

    // If direct verification confirmed admin, allow access
    if (isAdminVerified === true) {
      hasRedirected.current = false;
      return;
    }

    // If profile.role confirms admin (DB-only — no metadata), allow access
    if (profileRole === "admin" && !userLoading) {
      hasRedirected.current = false;
      return;
    }

    // If direct verification failed AND profile.role isn't admin, redirect (only once)
    if (
      isAdminVerified === false &&
      profileRole !== "admin" &&
      !userLoading &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      if (profileRole === "lecturer") {
        router.push("/lecturer/dashboard");
      } else {
        router.push("/");
      }
      return;
    }

    // If no user and not loading, redirect to login (only once)
    if (!userLoading && !user && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push("/login");
      return;
    }
  }, [
    isAdminVerified,
    isCheckingAdmin,
    user,
    profileRole,
    userLoading,
    router,
  ]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const totalCourses = courses.length;
  const formatGel = (amount: number) =>
    `₾${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  const tabs: Array<{ key: TabType; label: string }> = [
    { key: "overview", label: t("adminDashboard.tabs.overview") },
    { key: "view-bot", label: t("adminDashboard.tabs.viewBot") },
    { key: "withdrawals", label: t("adminDashboard.tabs.withdrawals") },
    { key: "kyc", label: t("adminDashboard.tabs.kyc") || "KYC" },
    { key: "lecturers", label: t("adminDashboard.tabs.lecturers") },
    { key: "projects", label: t("adminDashboard.tabs.projects") },
    {
      key: "courses",
      label: t("adminDashboard.tabs.courses", { count: totalCourses }),
    },
    { key: "notifications", label: t("adminDashboard.tabs.notifications") },
    { key: "email-manager", label: t("adminDashboard.tabs.emailManager") },
    { key: "analytics", label: t("adminDashboard.tabs.analytics") },
    { key: "settings", label: t("adminDashboard.tabs.settings") },
  ];

  // Show loading while checking admin status via direct DB query
  if (isCheckingAdmin || (isAdminVerified === null && userLoading)) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
            <p className="text-navy-700">
              {t("adminDashboard.verifyingAccess")}
            </p>
          </div>
        </div>
      </main>
    );
  }

  // If direct verification failed, show nothing (redirect happens in useEffect)
  if (isAdminVerified === false) {
    return null;
  }

  // Only render if admin is verified — DB-only, no metadata fallback.
  if (isAdminVerified !== true && profileRole !== "admin") {
    return null;
  }

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1 className="text-4xl md:text-5xl font-bold text-navy-900">
                {t("adminDashboard.title")}
              </h1>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  isShellLiveConnected
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isShellLiveConnected ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {isShellLiveConnected
                  ? t("adminDashboard.live")
                  : t("adminDashboard.polling")}
              </span>
            </div>
            <p className="text-lg text-navy-600">
              {t("adminDashboard.subtitle")}
            </p>
          </div>

          {/* Tabs */}
          <div className="mb-8 overflow-x-auto border-b border-navy-200">
            <div className="flex min-w-max gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`whitespace-nowrap px-4 sm:px-5 py-3 text-sm sm:text-base font-semibold transition-colors border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 focus-visible:ring-offset-2 ${
                    activeTab === tab.key
                      ? "text-navy-900 border-navy-900"
                      : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {/* Tab Content */}
          {activeTab === "overview" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Overview section error:",
                  error,
                )
              }
            >
              <AdminOverview
                totalCourses={totalCourses}
                setActiveTab={setActiveTab}
              />
            </ErrorBoundary>
          )}

          {activeTab === "view-bot" && (
            <ErrorBoundary
              onError={(error) =>
                console.error("[Admin Dashboard] View Bot error:", error)
              }
            >
              <AdminViewBot />
            </ErrorBoundary>
          )}

          {activeTab === "withdrawals" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Withdrawals section error:",
                  error,
                )
              }
            >
              <AdminWithdrawals />
            </ErrorBoundary>
          )}

          {activeTab === "kyc" && (
            <ErrorBoundary
              onError={(error) =>
                console.error("[Admin Dashboard] KYC section error:", error)
              }
            >
              <AdminKyc />
            </ErrorBoundary>
          )}

          {activeTab === "lecturers" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Lecturers section error:",
                  error,
                )
              }
            >
              <AdminLecturerApprovals />
            </ErrorBoundary>
          )}

          {activeTab === "projects" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Projects section error:",
                  error,
                )
              }
            >
              <AdminFreeProjectLecturers />
            </ErrorBoundary>
          )}

          {activeTab === "courses" && (
            <ErrorBoundary
              onError={(error) =>
                console.error("[Admin Dashboard] Courses section error:", error)
              }
            >
              <div>
                {coursesLoading ? (
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
                    <p className="text-navy-700">
                      {t("adminDashboard.coursesLoading")}
                    </p>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="bg-navy-50 border border-navy-100 rounded-lg p-8 text-center text-navy-700">
                    <p className="text-lg font-medium">
                      {t("adminDashboard.noCourses")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {courses.map((course: Course) => (
                      <div
                        key={course.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="p-6">
                          <h3 className="text-lg font-bold text-navy-900 mb-2">
                            {course.title}
                          </h3>
                          <p className="text-sm text-gray-600 mb-4">
                            {course.author}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xl font-bold text-navy-900">
                              {formatGel(course.price)}
                            </span>
                            <Link
                              href={`/courses/${course.id}/chat?channel=lectures`}
                              className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors text-sm font-semibold"
                            >
                              {t("adminDashboard.openChat")}
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* Notifications Tab Content */}
          {activeTab === "notifications" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Notifications section error:",
                  error,
                )
              }
            >
              <AdminNotificationSender />
            </ErrorBoundary>
          )}

          {activeTab === "email-manager" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Email Manager section error:",
                  error,
                )
              }
            >
              <AdminEmailManager />
            </ErrorBoundary>
          )}

          {activeTab === "analytics" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Analytics section error:",
                  error,
                )
              }
            >
              <AdminAnalytics />
            </ErrorBoundary>
          )}

          {activeTab === "settings" && (
            <ErrorBoundary
              onError={(error) =>
                console.error(
                  "[Admin Dashboard] Settings section error:",
                  error,
                )
              }
            >
              <AdminSettings />
            </ErrorBoundary>
          )}
        </div>
      </div>
    </main>
  );
}
