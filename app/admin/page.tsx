"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
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
const AdminEmailManager = dynamic(
  () => import("@/components/AdminEmailManager"),
  { ssr: false },
);
const AdminOverview = dynamic(() => import("@/components/AdminOverview"), {
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
  | "email-manager"
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
      if (process.env.NODE_ENV === "development") {
        console.error(
          `[Admin Page] Attempt ${attempt + 1}/${maxRetries} failed:`,
          error.message,
        );
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
}

const NAV_ITEMS: { key: TabType; label: string; icon: React.ReactNode }[] = [
  {
    key: "overview",
    label: "Overview",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </svg>
    ),
  },
  {
    key: "view-bot",
    label: "View Bot",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
  {
    key: "withdrawals",
    label: "Withdrawals",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
        />
      </svg>
    ),
  },
  {
    key: "lecturers",
    label: "Lecturers",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5"
        />
      </svg>
    ),
  },
  {
    key: "courses",
    label: "All Courses",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
        />
      </svg>
    ),
  },
  {
    key: "notifications",
    label: "Notifications",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
        />
      </svg>
    ),
  },
  {
    key: "email-manager",
    label: "Email Manager",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
        />
      </svg>
    ),
  },
  {
    key: "analytics",
    label: "Analytics",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
        />
      </svg>
    ),
  },
  {
    key: "settings",
    label: "Settings",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

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
  const [isAdminVerified, setIsAdminVerified] = useState<boolean | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const { courses, isLoading: coursesLoading } = useCourses("All");

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab);
    setMobileSidebarOpen(false);
  }, []);

  // Direct database check on mount - bypass hook cache
  // Only run once on mount, not when dependencies change
  useEffect(() => {
    let isMounted = true;

    const verifyAdminDirectly = async () => {
      setIsCheckingAdmin(true);
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

        if (!session?.user) {
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
          // On persistent failure, check if hook has admin status as fallback
          if (userRole === "admin") {
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

  const activeNavItem = NAV_ITEMS.find((item) => item.key === activeTab);

  // Show loading while checking admin status via direct DB query
  if (isCheckingAdmin || (isAdminVerified === null && userLoading)) {
    return (
      <main className="relative min-h-screen bg-navy-950 overflow-hidden">
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mb-4"></div>
            <p className="text-navy-300">Verifying admin access...</p>
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
    <main className="relative min-h-screen bg-navy-950 overflow-hidden">
      <Navigation />
      <div className="relative z-10 pt-16 md:pt-20 flex min-h-screen">
        {/* Mobile sidebar backdrop */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setMobileSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed lg:sticky top-16 md:top-20 left-0 z-50 lg:z-10 h-[calc(100vh-4rem)] md:h-[calc(100vh-5rem)] bg-navy-900/80 backdrop-blur-xl border-r border-navy-800/60 flex flex-col transition-all duration-300 ease-in-out ${
            mobileSidebarOpen
              ? "translate-x-0 w-64"
              : "-translate-x-full lg:translate-x-0"
          } ${sidebarCollapsed ? "lg:w-[72px]" : "lg:w-60"}`}
        >
          {/* Sidebar header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-navy-800/60">
            {!sidebarCollapsed && (
              <span className="text-sm font-semibold text-navy-200 uppercase tracking-wider">
                Admin
              </span>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg text-navy-400 hover:text-navy-200 hover:bg-navy-800/50 transition-colors"
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5L8.25 12l7.5-7.5"
                />
              </svg>
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => handleTabChange(item.key)}
                  className={`w-full flex items-center gap-3 rounded-xl transition-all duration-200 ${
                    sidebarCollapsed
                      ? "justify-center px-2 py-3"
                      : "px-3 py-2.5"
                  } ${
                    isActive
                      ? "bg-emerald-500/15 text-emerald-400 shadow-sm shadow-emerald-500/10"
                      : "text-navy-300 hover:text-navy-100 hover:bg-navy-800/50"
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!sidebarCollapsed && (
                    <span className="text-sm font-medium truncate">
                      {item.label}
                      {item.key === "courses" && ` (${totalCourses})`}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer */}
          <div className="px-3 py-3 border-t border-navy-800/60">
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2 px-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-navy-400">System Online</span>
              </div>
            )}
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
          {/* Content header */}
          <div className="sticky top-16 md:top-20 z-30 bg-navy-950/90 backdrop-blur-md border-b border-navy-800/40">
            <div className="flex items-center gap-4 px-4 sm:px-6 lg:px-8 py-4">
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg text-navy-300 hover:text-navy-100 hover:bg-navy-800/50 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                  />
                </svg>
              </button>

              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-gray-100 truncate">
                  {activeNavItem?.label || "Admin Dashboard"}
                </h1>
                <p className="text-sm text-navy-400 hidden sm:block">
                  Manage your platform
                </p>
              </div>
            </div>
          </div>

          {/* Page content */}
          <div className="p-4 sm:p-6 lg:p-8">
            {/* Messages */}
            {error && (
              <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="mb-6 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 px-4 py-3 rounded-xl">
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
                  console.error(
                    "[Admin Dashboard] Courses section error:",
                    error,
                  )
                }
              >
                <div>
                  {coursesLoading ? (
                    <div className="bg-navy-900/50 border border-navy-800/60 rounded-2xl p-12 text-center">
                      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mb-4"></div>
                      <p className="text-navy-300">Loading courses...</p>
                    </div>
                  ) : courses.length === 0 ? (
                    <div className="bg-navy-900/50 border border-navy-800/60 rounded-2xl p-8 text-center">
                      <p className="text-lg font-medium text-navy-300">
                        No courses found
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {courses.map((course: Course) => (
                        <div
                          key={course.id}
                          className="bg-navy-900/50 border border-navy-800/60 rounded-2xl overflow-hidden hover:bg-navy-800/50 hover:border-navy-700/60 transition-all duration-200"
                        >
                          <div className="p-6">
                            <h3 className="text-lg font-bold text-gray-100 mb-2">
                              {course.title}
                            </h3>
                            <p className="text-sm text-navy-400 mb-4">
                              {course.author}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xl font-bold text-emerald-400">
                                ${course.price}
                              </span>
                              <Link
                                href={`/courses/${course.id}/chat?channel=lectures`}
                                className="px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-xl hover:bg-emerald-500/25 transition-colors text-sm font-semibold"
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
      </div>
    </main>
  );
}
