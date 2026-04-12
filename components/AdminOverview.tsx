"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import type { AnalyticsOverview, UserAnalytics } from "@/types/analytics";

// ─── Fetcher (same pattern as useAdminAnalytics) ────────────────────
async function fetchAnalytics<T>(endpoint: string): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const timestamp = Date.now();
  const separator = endpoint.includes("?") ? "&" : "?";
  const response = await fetch(`${endpoint}${separator}t=${timestamp}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error || `Failed to fetch ${endpoint} (${response.status})`,
    );
  }
  return response.json();
}

// ─── StatCard ───────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function StatCard({ label, value, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="bg-navy-900/50 border border-navy-800/60 rounded-2xl p-6 hover:bg-navy-800/50 transition-all duration-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-navy-400">{label}</p>
          <p className={`text-3xl font-bold mt-2 ${iconColor}`}>{value}</p>
        </div>
        <div
          className={`w-12 h-12 ${iconBg} rounded-xl flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ───────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-navy-900/50 border border-navy-800/60 rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-3">
          <div className="h-4 w-24 bg-navy-800/80 rounded animate-pulse" />
          <div className="h-8 w-16 bg-navy-800/80 rounded animate-pulse" />
        </div>
        <div className="w-12 h-12 bg-navy-800/80 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

function SkeletonQuickActions() {
  return (
    <div className="bg-navy-900/50 border border-navy-800/60 rounded-2xl p-6">
      <div className="h-6 w-32 bg-navy-800/80 rounded animate-pulse mb-4" />
      <div className="flex flex-wrap gap-3">
        <div className="h-10 w-36 bg-navy-800/80 rounded-xl animate-pulse" />
        <div className="h-10 w-40 bg-navy-800/80 rounded-xl animate-pulse" />
        <div className="h-10 w-36 bg-navy-800/80 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

// ─── Icons (inline SVG to avoid external deps) ─────────────────────
function BookIcon() {
  return (
    <svg
      className="w-6 h-6 text-sky-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}

function AcademicCapIcon() {
  return (
    <svg
      className="w-6 h-6 text-indigo-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d="M12 14l9-5-9-5-9 5 9 5z" />
      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
      />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg
      className="w-6 h-6 text-amber-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2zM16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"
      />
    </svg>
  );
}

function ClipboardCheckIcon() {
  return (
    <svg
      className="w-6 h-6 text-green-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg
      className="w-6 h-6 text-emerald-300"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
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

interface AdminOverviewProps {
  totalCourses: number;
  setActiveTab: (tab: TabType) => void;
}

export default function AdminOverview({
  totalCourses,
  setActiveTab,
}: AdminOverviewProps) {
  const today = new Date().toISOString().split("T")[0];
  const params = `from=2020-01-01&to=${today}`;

  const { data: overview, isLoading: overviewLoading } =
    useSWR<AnalyticsOverview>(
      `admin-overview-stats-${today}`,
      () =>
        fetchAnalytics<AnalyticsOverview>(
          `/api/admin/analytics/overview?${params}`,
        ),
      { revalidateOnFocus: false, dedupingInterval: 10000 },
    );

  const { data: users, isLoading: usersLoading } = useSWR<UserAnalytics>(
    `admin-overview-users-${today}`,
    () => fetchAnalytics<UserAnalytics>(`/api/admin/analytics/users?${params}`),
    { revalidateOnFocus: false, dedupingInterval: 10000 },
  );

  const isLoading = overviewLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <SkeletonQuickActions />
      </div>
    );
  }

  const studentCount =
    users?.roleDistribution.find((r) => r.role === "student")?.count ?? 0;
  const lecturerCount =
    users?.roleDistribution.find((r) => r.role === "lecturer")?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <StatCard
          label="Total Courses"
          value={totalCourses}
          icon={<BookIcon />}
          iconBg="bg-sky-500/15"
          iconColor="text-sky-300"
        />
        <StatCard
          label="Total Students"
          value={studentCount}
          icon={<AcademicCapIcon />}
          iconBg="bg-indigo-500/15"
          iconColor="text-indigo-300"
        />
        <StatCard
          label="Total Lecturers"
          value={lecturerCount}
          icon={<BriefcaseIcon />}
          iconBg="bg-amber-500/15"
          iconColor="text-amber-300"
        />
        <StatCard
          label="Total Enrollments"
          value={overview?.totalEnrollments ?? 0}
          icon={<ClipboardCheckIcon />}
          iconBg="bg-green-500/15"
          iconColor="text-green-300"
        />
        <StatCard
          label="Total Revenue"
          value={`₾${(overview?.totalRevenue ?? 0).toLocaleString()}`}
          icon={<CurrencyIcon />}
          iconBg="bg-emerald-500/15"
          iconColor="text-emerald-300"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-navy-900/50 border border-navy-800/60 rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">
          Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setActiveTab("courses")}
            className="px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-xl hover:bg-emerald-500/25 transition-colors text-sm font-medium"
          >
            View All Courses
          </button>
          <button
            onClick={() => setActiveTab("withdrawals")}
            className="px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-xl hover:bg-emerald-500/25 transition-colors text-sm font-medium"
          >
            View Withdrawals
          </button>
          <button
            onClick={() => setActiveTab("lecturers")}
            className="px-4 py-2 bg-emerald-500/15 text-emerald-400 rounded-xl hover:bg-emerald-500/25 transition-colors text-sm font-medium"
          >
            View Lecturers
          </button>
        </div>
      </div>
    </div>
  );
}
