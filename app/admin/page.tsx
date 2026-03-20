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
const AdminLecturerApprovals = dynamic(
  () => import("@/components/AdminLecturerApprovals"),
  { ssr: false },
);
const AdminSettings = dynamic(() => import("@/components/AdminSettings"), {
  ssr: false,
});
import { useUser } from "@/hooks/useUser";
import { useCourses } from "@/hooks/useCourses";
import { supabase } from "@/lib/supabase";
import type { Course } from "@/components/CourseCard";

type TabType =
  | "overview"
  | "view-bot"
  | "withdrawals"
  | "lecturers"
  | "courses"
  | "notifications"
  | "analytics"
  | "settings";

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
      console.error(
        `[Admin Page] Attempt ${attempt + 1}/${maxRetries} failed:`,
        error.message,
      );

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[Admin Page] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

export default function AdminDashboard() {
  const router = useRouter();
  const {
    user,
    role: userRole,
    isLoading: userLoading,
    mutate: mutateUser,
  } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isAdminVerified, setIsAdminVerified] = useState<boolean | null>(null); // Direct DB verification
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  const { courses, isLoading: coursesLoading } = useCourses("All");

  // Direct database check on mount - bypass hook cache
  // Only run once on mount, not when dependencies change
  useEffect(() => {
    let isMounted = true;

    const verifyAdminDirectly = async () => {
      setIsCheckingAdmin(true);
      console.log("[Admin Page] === DIRECT ADMIN VERIFICATION ===");

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

        console.log("[Admin Page] Session check:", {
          hasSession: !!session,
          userId: session?.user?.id,
        });

        if (!session?.user) {
          console.log("[Admin Page] No session, redirecting to login");
          if (isMounted) {
            setIsAdminVerified(false);
            setIsCheckingAdmin(false);
            router.push("/login");
          }
          return;
        }

        const userId = session.user.id;
        console.log("[Admin Page] Checking admin status for user:", userId);

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

        console.log("[Admin Page] RPC check_is_admin result:", { isAdmin });

        if (isAdmin === true) {
          console.log("[Admin Page] DIRECT VERIFICATION: User IS admin!");
          setIsAdminVerified(true);
        } else {
          console.log("[Admin Page] DIRECT VERIFICATION: User is NOT admin");
          setIsAdminVerified(false);
        }
      } catch (err: any) {
        console.error(
          "[Admin Page] Error in direct admin verification after retries:",
          err,
        );
        if (isMounted) {
          // On persistent failure, check if hook has admin status as fallback
          if (userRole === "admin") {
            console.log("[Admin Page] Using hook fallback - user is admin");
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

    // If hook also confirms admin, allow access (fallback)
    if (userRole === "admin" && !userLoading) {
      hasRedirected.current = false;
      return;
    }

    // If direct verification failed AND hook doesn't confirm admin, redirect (only once)
    if (
      isAdminVerified === false &&
      userRole !== "admin" &&
      !userLoading &&
      !hasRedirected.current
    ) {
      hasRedirected.current = true;
      if (userRole === "lecturer") {
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
  }, [isAdminVerified, isCheckingAdmin, user, userRole, userLoading, router]);

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

  // Show loading while checking admin status via direct DB query
  if (isCheckingAdmin || (isAdminVerified === null && userLoading)) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900 mb-4"></div>
            <p className="text-navy-700">Verifying admin access...</p>
          </div>
        </div>
      </main>
    );
  }

  // If direct verification failed, show nothing (redirect happens in useEffect)
  if (isAdminVerified === false) {
    return null;
  }

  // Only render if admin is verified (either by direct check or hook confirms admin)
  if (isAdminVerified !== true && userRole !== "admin") {
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
            <div className="flex items-center gap-3 mb-4">
              <h1 className="text-4xl md:text-5xl font-bold text-navy-900">
                Admin Dashboard
              </h1>
            </div>
            <p className="text-lg text-navy-600">
              Manage courses and system access
            </p>
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-3 mb-8 border-b border-navy-200">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "overview"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab("view-bot")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "view-bot"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              View Bot
            </button>
            <button
              onClick={() => setActiveTab("withdrawals")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "withdrawals"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              Withdrawals
            </button>
            <button
              onClick={() => setActiveTab("lecturers")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "lecturers"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              Lecturers
            </button>
            <button
              onClick={() => setActiveTab("courses")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "courses"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              All Courses ({totalCourses})
            </button>
            <button
              onClick={() => setActiveTab("notifications")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "notifications"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              Send Notifications
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "analytics"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
                activeTab === "settings"
                  ? "text-navy-900 border-navy-900"
                  : "text-navy-600 border-transparent hover:text-navy-900 hover:border-navy-300"
              }`}
            >
              Settings
            </button>
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
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">
                          Total Courses
                        </p>
                        <p className="text-3xl font-bold text-navy-900 mt-2">
                          {totalCourses}
                        </p>
                      </div>
                      <div className="w-12 h-12 bg-navy-100 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-navy-900"
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
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <h2 className="text-xl font-bold text-navy-900 mb-4">
                    Quick Actions
                  </h2>
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={() => setActiveTab("courses")}
                      className="px-6 py-3 bg-navy-900 text-white rounded-lg font-semibold hover:bg-navy-800 transition-colors"
                    >
                      View All Courses
                    </button>
                  </div>
                </div>
              </div>
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
                    <p className="text-navy-700">Loading courses...</p>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="bg-navy-50 border border-navy-100 rounded-lg p-8 text-center text-navy-700">
                    <p className="text-lg font-medium">No courses found</p>
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
                              ${course.price}
                            </span>
                            <Link
                              href={`/courses/${course.id}/chat`}
                              className="px-4 py-2 bg-navy-900 text-white rounded-lg hover:bg-navy-800 transition-colors text-sm font-semibold"
                            >
                              Open Chat
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
