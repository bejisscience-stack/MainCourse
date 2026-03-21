"use client";

import { memo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";
import {
  useAdminAnalytics,
  type DateRangeKey,
} from "@/hooks/useAdminAnalytics";
import type {
  CourseRevenue,
  ReferralByCourse,
  ProjectByCourse,
  PlatformCount,
  TopReferrer,
} from "@/types/analytics";

const PIE_COLORS = [
  "#1e3a5f",
  "#f59e0b",
  "#6366f1",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
];
const ROLE_COLORS: Record<string, string> = {
  student: "#3b82f6",
  lecturer: "#f59e0b",
  admin: "#ef4444",
  unknown: "#9ca3af",
};

function formatCurrency(amount: number): string {
  return `₾${amount.toFixed(2)}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function ageColor(hours: number): string {
  if (hours < 24) return "text-green-600";
  if (hours < 72) return "text-yellow-600";
  return "text-red-600";
}

function ageBg(hours: number): string {
  if (hours < 24) return "bg-green-100";
  if (hours < 72) return "bg-yellow-100";
  return "bg-red-100";
}

// ─── Skeleton placeholder ────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-gray-200 rounded animate-pulse ${className}`} />;
}

function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="w-12 h-12 rounded-lg" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <Skeleton className="h-5 w-40 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <Skeleton className="h-5 w-48 mb-4" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full mb-2" />
      ))}
    </div>
  );
}

// ─── Summary Card ────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  subtitle?: string;
}

function StatCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  subtitle,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{label}</p>
          <p className={`text-3xl font-bold mt-2 ${iconColor}`}>{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div
          className={`w-12 h-12 ${iconBg} rounded-lg flex items-center justify-center`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="space-y-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-xl font-bold text-navy-900 hover:text-navy-700 transition-colors"
      >
        <svg
          className={`w-5 h-5 transform transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        {title}
      </button>
      {open && children}
    </div>
  );
}

// ─── SVG Icons ───────────────────────────────────────────────────────
const Icons = {
  users: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  ),
  currency: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
  enrollment: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
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
  ),
  referral: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  ),
  project: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  ),
  budget: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
    </svg>
  ),
  chart: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  ),
  clock: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
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
  ),
  trending: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
      />
    </svg>
  ),
  alert: (cls: string) => (
    <svg
      className={`w-6 h-6 ${cls}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
};

// ─── Custom Tooltips ──────────────────────────────────────────────────
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}

function CurrencyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-600">
          {p.name ? `${p.name}: ` : ""}
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-gray-600">
          {p.name ? `${p.name}: ` : ""}
          {p.value}
        </p>
      ))}
    </div>
  );
}

// ─── Date Range Picker ──────────────────────────────────────────────
const DATE_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRangeKey;
  onChange: (k: DateRangeKey) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
      {DATE_RANGES.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === key
              ? "bg-white text-navy-900 shadow-sm"
              : "text-gray-600 hover:text-gray-900"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
function AdminAnalytics() {
  const {
    overview,
    revenue,
    referrals,
    projects,
    users,
    engagement,
    financial,
    operational,
    isLoading,
    error,
    dateRangeKey,
    setDateRangeKey,
  } = useAdminAnalytics();

  // ── Error State ──
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Analytics</h2>
          <p className="text-gray-600 mt-1">Platform analytics and insights</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-700 font-medium mb-3">
            Failed to load analytics data
          </p>
          <p className="text-red-600 text-sm mb-4">{error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Loading State ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Analytics</h2>
          <p className="text-gray-600 mt-1">Platform analytics and insights</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <ChartSkeleton key={i} />
          ))}
        </div>
        <TableSkeleton />
        <TableSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  // ── Derived data (existing) ──
  const totalRevenue =
    (overview?.totalRevenue ?? 0) + (overview?.totalBundleRevenue ?? 0);
  const totalEnrollments =
    (overview?.totalEnrollments ?? 0) + (overview?.totalBundleEnrollments ?? 0);

  const revenueChartData = (revenue?.courses ?? []).map((c: CourseRevenue) => ({
    name: truncate(c.courseTitle, 15),
    fullName: c.courseTitle,
    revenue: c.totalRevenue,
  }));

  const referralChartData = (referrals?.referralsByCourse ?? []).map(
    (r: ReferralByCourse) => ({
      name: truncate(r.courseTitle, 15),
      fullName: r.courseTitle,
      count: r.count,
    }),
  );

  const projectChartData = (projects?.projectsByCourse ?? []).map(
    (p: ProjectByCourse) => ({
      name: truncate(p.courseTitle, 15),
      fullName: p.courseTitle,
      count: p.projectCount,
    }),
  );

  const platformData = (projects?.platformDistribution ?? []).map(
    (p: PlatformCount, i: number) => ({
      name: p.platform,
      value: p.count,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }),
  );

  const courseRevenueRows = [...(revenue?.courses ?? [])].sort(
    (a, b) => b.totalRevenue - a.totalRevenue,
  );
  const totalCourseRevenue = courseRevenueRows.reduce(
    (sum, c) => sum + c.totalRevenue,
    0,
  );
  const totalCourseEnrollments = courseRevenueRows.reduce(
    (sum, c) => sum + c.enrollmentCount,
    0,
  );

  const topReferrers = (referrals?.topReferrers ?? []).slice(0, 10);
  const projectRows = [...(projects?.projectsByCourse ?? [])].sort(
    (a, b) => b.projectCount - a.projectCount,
  );

  // ── Derived data (new) ──
  const roleData = (users?.roleDistribution ?? []).map((r, i) => ({
    name: r.role.charAt(0).toUpperCase() + r.role.slice(1),
    value: r.count,
    color: ROLE_COLORS[r.role] || PIE_COLORS[i % PIE_COLORS.length],
  }));

  return (
    <div className="space-y-8">
      {/* Header + Date Range Picker */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Analytics</h2>
          <p className="text-gray-600 mt-1">Platform analytics and insights</p>
        </div>
        <DateRangePicker value={dateRangeKey} onChange={setDateRangeKey} />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          EXISTING: Summary Cards
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard
          label="Waiting List"
          value={overview?.waitingListCount ?? 0}
          icon={Icons.users("text-blue-600")}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          icon={Icons.currency("text-green-600")}
          iconBg="bg-green-100"
          iconColor="text-green-600"
        />
        <StatCard
          label="Total Enrollments"
          value={totalEnrollments}
          icon={Icons.enrollment("text-purple-600")}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
        />
        <StatCard
          label="Active Referrals"
          value={overview?.totalReferrals ?? 0}
          icon={Icons.referral("text-orange-600")}
          iconBg="bg-orange-100"
          iconColor="text-orange-600"
        />
        <StatCard
          label="Total Projects"
          value={overview?.totalProjects ?? 0}
          icon={Icons.project("text-indigo-600")}
          iconBg="bg-indigo-100"
          iconColor="text-indigo-600"
        />
        <StatCard
          label="Total Project Budget"
          value={formatCurrency(overview?.totalProjectBudget ?? 0)}
          icon={Icons.budget("text-emerald-600")}
          iconBg="bg-emerald-100"
          iconColor="text-emerald-600"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          EXISTING: Charts
          ══════════════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">
            Revenue by Course
          </h3>
          {revenueChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                <Tooltip content={<CurrencyTooltip />} />
                <Bar dataKey="revenue" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-16">
              No revenue data available
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">
            Referral Activations by Course
          </h3>
          {referralChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={referralChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                  allowDecimals={false}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-16">
              No referral data available
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">
            Projects by Course
          </h3>
          {projectChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={projectChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke="#6b7280"
                  allowDecimals={false}
                />
                <Tooltip content={<CountTooltip />} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-16">
              No project data available
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-navy-900 mb-4">
            Platform Distribution
          </h3>
          {platformData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={platformData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  nameKey="name"
                  paddingAngle={2}
                >
                  {platformData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value ?? 0}`, name ?? ""]}
                  contentStyle={{
                    borderRadius: "0.5rem",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-sm text-gray-700">{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-16">
              No platform data available
            </p>
          )}
        </div>
      </div>

      {/* ── Existing Detail Tables ── */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-navy-900">
            Course Revenue
          </h3>
        </div>
        {courseRevenueRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 font-semibold text-gray-700">
                    Course
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700">
                    Type
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Price
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Enrollments
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {courseRevenueRows.map((c) => (
                  <tr
                    key={c.courseId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {c.courseTitle}
                    </td>
                    <td className="px-6 py-3 text-gray-600">{c.courseType}</td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {formatCurrency(c.price)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {c.enrollmentCount}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(c.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-6 py-3 text-gray-900">Total</td>
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3 text-right text-gray-900">
                    {totalCourseEnrollments}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-900">
                    {formatCurrency(totalCourseRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No revenue data available
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-navy-900">Top Referrers</h3>
        </div>
        {topReferrers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 font-semibold text-gray-700">
                    User
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700">
                    Referral Code
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Activations
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Commission Earned
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topReferrers.map((r: TopReferrer) => (
                  <tr
                    key={r.userId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-900">
                        {r.username || r.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-gray-500">{r.email}</p>
                    </td>
                    <td className="px-6 py-3">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {r.referralCode}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {r.activationCount}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(r.totalCommission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No referral data available
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-navy-900">
            Projects by Course
          </h3>
        </div>
        {projectRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 font-semibold text-gray-700">
                    Course
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Projects
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Total Budget
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Avg Budget
                  </th>
                  <th className="px-6 py-3 font-semibold text-gray-700 text-right">
                    Submissions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projectRows.map((p: ProjectByCourse) => (
                  <tr
                    key={p.courseId}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {p.courseTitle}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {p.projectCount}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {formatCurrency(p.totalBudget)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {formatCurrency(p.averageBudget)}
                    </td>
                    <td className="px-6 py-3 text-right text-gray-600">
                      {p.submissionCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">
            No project data available
          </p>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          NEW SECTION 1: Users
          ══════════════════════════════════════════════════════════════════ */}
      <Section title="Users">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Total Users"
              value={users?.totalUsers ?? "—"}
              icon={Icons.users("text-blue-600")}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
            />
            <StatCard
              label="Daily Active Users"
              value={users?.dau ?? "—"}
              icon={Icons.chart("text-cyan-600")}
              iconBg="bg-cyan-100"
              iconColor="text-cyan-600"
            />
            <StatCard
              label="Weekly Active Users"
              value={users?.wau ?? "—"}
              icon={Icons.chart("text-teal-600")}
              iconBg="bg-teal-100"
              iconColor="text-teal-600"
            />
            <StatCard
              label="Monthly Active Users"
              value={users?.mau ?? "—"}
              icon={Icons.chart("text-indigo-600")}
              iconBg="bg-indigo-100"
              iconColor="text-indigo-600"
              subtitle={users ? `Stickiness: ${users.stickiness}%` : undefined}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard
              label="Signup Growth Rate"
              value={
                users
                  ? `${users.signupGrowthRate > 0 ? "+" : ""}${users.signupGrowthRate}%`
                  : "—"
              }
              icon={Icons.trending(
                users && users.signupGrowthRate >= 0
                  ? "text-green-600"
                  : "text-red-600",
              )}
              iconBg={
                users && users.signupGrowthRate >= 0
                  ? "bg-green-100"
                  : "bg-red-100"
              }
              iconColor={
                users && users.signupGrowthRate >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }
              subtitle="vs. prior period"
            />
            <StatCard
              label="Profile Completion"
              value={users ? `${users.profileCompletionRate}%` : "—"}
              icon={Icons.users("text-purple-600")}
              iconBg="bg-purple-100"
              iconColor="text-purple-600"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Signup Trend */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Signup Trend
              </h3>
              {(users?.newSignups?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={users!.newSignups}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      allowDecimals={false}
                    />
                    <Tooltip content={<CountTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name="Signups"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No signup data for this period
                </p>
              )}
            </div>

            {/* Role Distribution */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Role Distribution
              </h3>
              {roleData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={roleData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      nameKey="name"
                      paddingAngle={2}
                    >
                      {roleData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value ?? 0}`, name ?? ""]}
                      contentStyle={{
                        borderRadius: "0.5rem",
                        border: "1px solid #e5e7eb",
                      }}
                    />
                    <Legend
                      formatter={(value: string) => (
                        <span className="text-sm text-gray-700">{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No user data available
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          NEW SECTION 2: Engagement
          ══════════════════════════════════════════════════════════════════ */}
      <Section title="Engagement">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Pending Requests"
              value={engagement?.enrollmentFunnel.pending ?? "—"}
              icon={Icons.clock("text-yellow-600")}
              iconBg="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <StatCard
              label="Approved"
              value={engagement?.enrollmentFunnel.approved ?? "—"}
              icon={Icons.enrollment("text-green-600")}
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <StatCard
              label="Rejected"
              value={engagement?.enrollmentFunnel.rejected ?? "—"}
              icon={Icons.alert("text-red-600")}
              iconBg="bg-red-100"
              iconColor="text-red-600"
            />
            <StatCard
              label="Conversion Rate"
              value={engagement ? `${engagement.conversionRate}%` : "—"}
              icon={Icons.trending("text-blue-600")}
              iconBg="bg-blue-100"
              iconColor="text-blue-600"
              subtitle={`Avg ${engagement?.avgEnrollmentsPerUser?.toFixed(1) ?? "—"} enrollments/user`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Messages Per Day */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Messages Per Day
              </h3>
              {(engagement?.messagesPerDay?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagement!.messagesPerDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      allowDecimals={false}
                    />
                    <Tooltip content={<CountTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#6366f1"
                      strokeWidth={2}
                      dot={false}
                      name="Messages"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No message data for this period
                </p>
              )}
            </div>

            {/* Most Active Courses */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Most Active Courses
              </h3>
              {(engagement?.mostActiveCourses?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={engagement!.mostActiveCourses.map((c) => ({
                      name: truncate(c.title, 15),
                      messages: c.messageCount,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      stroke="#6b7280"
                      allowDecimals={false}
                    />
                    <Tooltip content={<CountTooltip />} />
                    <Bar
                      dataKey="messages"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      name="Messages"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No course activity data
                </p>
              )}
            </div>
          </div>

          {/* Courses with Zero Enrollments */}
          {(engagement?.coursesWithZeroEnrollments?.length ?? 0) > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-yellow-800 mb-2">
                Courses with Zero Enrollments (
                {engagement!.coursesWithZeroEnrollments.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {engagement!.coursesWithZeroEnrollments.map((c) => (
                  <span
                    key={c.courseId}
                    className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded"
                  >
                    {c.title}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          NEW SECTION 3: Financials
          ══════════════════════════════════════════════════════════════════ */}
      <Section title="Financials">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label="Avg Order Value"
              value={
                financial ? formatCurrency(financial.averageOrderValue) : "—"
              }
              icon={Icons.currency("text-green-600")}
              iconBg="bg-green-100"
              iconColor="text-green-600"
            />
            <StatCard
              label="Outstanding Balances"
              value={
                financial ? formatCurrency(financial.outstandingBalances) : "—"
              }
              icon={Icons.budget("text-yellow-600")}
              iconBg="bg-yellow-100"
              iconColor="text-yellow-600"
            />
            <StatCard
              label="Total Paid Out"
              value={financial ? formatCurrency(financial.totalPaidOut) : "—"}
              icon={Icons.currency("text-red-600")}
              iconBg="bg-red-100"
              iconColor="text-red-600"
            />
            <StatCard
              label="Total Earned (All Time)"
              value={financial ? formatCurrency(financial.totalEarned) : "—"}
              icon={Icons.trending("text-emerald-600")}
              iconBg="bg-emerald-100"
              iconColor="text-emerald-600"
              subtitle={
                financial
                  ? `Avg withdrawal: ${formatCurrency(financial.avgWithdrawalAmount)}`
                  : undefined
              }
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Over Time */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Revenue Over Time
              </h3>
              {(financial?.revenueOverTime?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={financial!.revenueOverTime}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      name="Revenue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No revenue data for this period
                </p>
              )}
            </div>

            {/* Revenue by Lecturer */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Revenue by Lecturer
              </h3>
              {(financial?.revenueByLecturer?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={financial!.revenueByLecturer.map((l) => ({
                      name: truncate(l.name, 15),
                      revenue: l.revenue,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Bar
                      dataKey="revenue"
                      fill="#f59e0b"
                      radius={[4, 4, 0, 0]}
                      name="Revenue"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No lecturer revenue data
                </p>
              )}
            </div>

            {/* Balance Flow */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Balance Flow by Source
              </h3>
              {(financial?.balanceFlow?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={financial!.balanceFlow}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="referral_commission"
                      stackId="1"
                      fill="#3b82f6"
                      stroke="#3b82f6"
                      fillOpacity={0.6}
                      name="Referral"
                    />
                    <Area
                      type="monotone"
                      dataKey="course_purchase"
                      stackId="1"
                      fill="#10b981"
                      stroke="#10b981"
                      fillOpacity={0.6}
                      name="Course Purchase"
                    />
                    <Area
                      type="monotone"
                      dataKey="withdrawal"
                      stackId="1"
                      fill="#ef4444"
                      stroke="#ef4444"
                      fillOpacity={0.6}
                      name="Withdrawal"
                    />
                    <Area
                      type="monotone"
                      dataKey="admin_adjustment"
                      stackId="1"
                      fill="#f59e0b"
                      stroke="#f59e0b"
                      fillOpacity={0.6}
                      name="Admin Adjust"
                    />
                    <Legend />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No balance flow data for this period
                </p>
              )}
            </div>

            {/* Withdrawal Trend */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-navy-900 mb-4">
                Withdrawal Trend
              </h3>
              {(financial?.withdrawalTrend?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={financial!.withdrawalTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      stroke="#6b7280"
                    />
                    <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" />
                    <Tooltip content={<CurrencyTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Amount"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-gray-500 text-center py-16">
                  No withdrawal data for this period
                </p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          NEW SECTION 4: Operations
          ══════════════════════════════════════════════════════════════════ */}
      <Section title="Operations">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Pending Enrollments */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">
                  Pending Enrollments
                </p>
                <div
                  className={`w-10 h-10 ${operational ? ageBg(operational.pendingEnrollments.oldestAgeHours) : "bg-gray-100"} rounded-lg flex items-center justify-center`}
                >
                  {Icons.enrollment(
                    operational
                      ? ageColor(operational.pendingEnrollments.oldestAgeHours)
                      : "text-gray-400",
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-navy-900">
                {operational?.pendingEnrollments.count ?? "—"}
              </p>
              {operational && operational.pendingEnrollments.count > 0 && (
                <p
                  className={`text-sm mt-1 ${ageColor(operational.pendingEnrollments.oldestAgeHours)}`}
                >
                  Oldest:{" "}
                  {formatHours(operational.pendingEnrollments.oldestAgeHours)}
                </p>
              )}
            </div>

            {/* Pending Withdrawals */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">
                  Pending Withdrawals
                </p>
                <div
                  className={`w-10 h-10 ${operational ? ageBg(operational.pendingWithdrawals.oldestAgeHours) : "bg-gray-100"} rounded-lg flex items-center justify-center`}
                >
                  {Icons.currency(
                    operational
                      ? ageColor(operational.pendingWithdrawals.oldestAgeHours)
                      : "text-gray-400",
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-navy-900">
                {operational?.pendingWithdrawals.count ?? "—"}
              </p>
              {operational && operational.pendingWithdrawals.count > 0 && (
                <>
                  <p className="text-sm text-gray-600 mt-1">
                    Total:{" "}
                    {formatCurrency(operational.pendingWithdrawals.totalAmount)}
                  </p>
                  <p
                    className={`text-sm ${ageColor(operational.pendingWithdrawals.oldestAgeHours)}`}
                  >
                    Oldest:{" "}
                    {formatHours(operational.pendingWithdrawals.oldestAgeHours)}
                  </p>
                </>
              )}
            </div>

            {/* Pending Lecturers */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-gray-600">
                  Pending Lecturers
                </p>
                <div
                  className={`w-10 h-10 ${operational ? ageBg(operational.pendingLecturers.oldestAgeHours) : "bg-gray-100"} rounded-lg flex items-center justify-center`}
                >
                  {Icons.users(
                    operational
                      ? ageColor(operational.pendingLecturers.oldestAgeHours)
                      : "text-gray-400",
                  )}
                </div>
              </div>
              <p className="text-3xl font-bold text-navy-900">
                {operational?.pendingLecturers.count ?? "—"}
              </p>
              {operational && operational.pendingLecturers.count > 0 && (
                <p
                  className={`text-sm mt-1 ${ageColor(operational.pendingLecturers.oldestAgeHours)}`}
                >
                  Oldest:{" "}
                  {formatHours(operational.pendingLecturers.oldestAgeHours)}
                </p>
              )}
            </div>
          </div>

          {/* Processing Time Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <StatCard
              label="Avg Enrollment Processing"
              value={
                operational
                  ? formatHours(operational.avgEnrollmentProcessingHours)
                  : "—"
              }
              icon={Icons.clock("text-blue-600")}
              iconBg="bg-blue-100"
              iconColor={
                operational
                  ? ageColor(operational.avgEnrollmentProcessingHours)
                  : "text-gray-600"
              }
            />
            <StatCard
              label="Avg Withdrawal Processing"
              value={
                operational
                  ? formatHours(operational.avgWithdrawalProcessingHours)
                  : "—"
              }
              icon={Icons.clock("text-purple-600")}
              iconBg="bg-purple-100"
              iconColor={
                operational
                  ? ageColor(operational.avgWithdrawalProcessingHours)
                  : "text-gray-600"
              }
            />
          </div>
        </div>
      </Section>
    </div>
  );
}

export default memo(AdminAnalytics);
