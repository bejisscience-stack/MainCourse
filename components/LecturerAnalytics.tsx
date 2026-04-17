"use client";

import { memo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useLecturerAnalytics,
  type LecturerDateRangeKey,
} from "@/hooks/useLecturerAnalytics";
import { useI18n } from "@/contexts/I18nContext";
import type { LecturerCoursePerformance } from "@/types/analytics";

function formatCurrency(amount: number): string {
  return `₾${amount.toFixed(2)}`;
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + "…" : str;
}

// ─── Skeleton Components ────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-navy-800/80 rounded animate-pulse ${className}`} />
  );
}

function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-navy-900/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-800/60 p-6">
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
    <div className="bg-white dark:bg-navy-900/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-800/60 p-6">
      <Skeleton className="h-5 w-40 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white dark:bg-navy-900/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-800/60 p-6">
      <Skeleton className="h-5 w-48 mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full mb-2" />
      ))}
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

function StatCard({ label, value, icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-navy-900/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-800/60 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-charcoal-500 dark:text-navy-400">
            {label}
          </p>
          <p className={`text-3xl font-bold mt-2 ${iconColor}`}>{value}</p>
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

// ─── SVG Icons ──────────────────────────────────────────────────────
const Icons = {
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
  course: (cls: string) => (
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
  wallet: (cls: string) => (
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
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  ),
};

// ─── Chart Tooltip ──────────────────────────────────────────────────
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CurrencyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-navy-900/90 border border-charcoal-200 dark:border-navy-800/60 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-charcoal-900 dark:text-gray-100 mb-1">
        {label}
      </p>
      <p className="text-charcoal-600 dark:text-navy-400">
        {formatCurrency(payload[0].value)}
      </p>
    </div>
  );
}

// ─── Date Range Picker ──────────────────────────────────────────────
const PRESET_RANGES: { key: LecturerDateRangeKey; labelKey: string }[] = [
  { key: "7d", labelKey: "lecturerAnalytics.preset7d" },
  { key: "30d", labelKey: "lecturerAnalytics.preset30d" },
  { key: "90d", labelKey: "lecturerAnalytics.preset90d" },
  { key: "all", labelKey: "lecturerAnalytics.presetAll" },
];

function DateRangePicker({
  value,
  onChange,
}: {
  value: LecturerDateRangeKey;
  onChange: (k: LecturerDateRangeKey) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex gap-1 bg-charcoal-100 dark:bg-navy-800/50 rounded-lg p-1">
      {PRESET_RANGES.map(({ key, labelKey }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            value === key
              ? "bg-white dark:bg-navy-700 text-charcoal-900 dark:text-gray-100 shadow-sm"
              : "text-charcoal-500 dark:text-navy-400 hover:text-charcoal-900 dark:hover:text-gray-100"
          }`}
        >
          {t(labelKey)}
        </button>
      ))}
    </div>
  );
}

// ─── Star Rating ────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <svg
        className="w-4 h-4 text-yellow-500"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
      </svg>
      <span className="text-sm text-charcoal-600 dark:text-navy-400">
        {rating > 0 ? rating.toFixed(1) : "—"}
      </span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────
function LecturerAnalytics() {
  const { t } = useI18n();
  const { data, isLoading, error, dateRangeKey, setDateRangeKey } =
    useLecturerAnalytics();

  // Error state
  if (error) {
    return (
      <div className="mb-12">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-700 dark:text-red-300 font-medium mb-2">
            {t("lecturerAnalytics.errorLoading")}
          </p>
          <p className="text-red-600 dark:text-red-400 text-sm">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="mb-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <Skeleton className="h-7 w-32 mb-2" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  if (!data) {
    // Data hasn't loaded yet (SWR initial state before fetch starts)
    return (
      <div className="mb-12 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white">
              {t("lecturerAnalytics.title")}
            </h2>
            <p className="text-charcoal-600 dark:text-gray-400 mt-1">
              {t("lecturerAnalytics.subtitle")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <ChartSkeleton />
        <TableSkeleton />
      </div>
    );
  }

  const { overview, coursePerformance, revenueOverTime } = data;

  return (
    <div className="mb-12 space-y-6">
      {/* Header + Date Range */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white">
            {t("lecturerAnalytics.title")}
          </h2>
          <p className="text-charcoal-600 dark:text-gray-400 mt-1">
            {t("lecturerAnalytics.subtitle")}
          </p>
        </div>
        <DateRangePicker value={dateRangeKey} onChange={setDateRangeKey} />
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("lecturerAnalytics.totalRevenue")}
          value={formatCurrency(overview.totalRevenue)}
          icon={Icons.currency("text-green-600")}
          iconBg="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600"
        />
        <StatCard
          label={t("lecturerAnalytics.totalEnrollments")}
          value={overview.totalEnrollments}
          icon={Icons.enrollment("text-purple-600")}
          iconBg="bg-purple-100 dark:bg-purple-900/30"
          iconColor="text-purple-600"
        />
        <StatCard
          label={t("lecturerAnalytics.activeCourses")}
          value={overview.activeCourses}
          icon={Icons.course("text-blue-600")}
          iconBg="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600"
        />
        <StatCard
          label={t("lecturerAnalytics.currentBalance")}
          value={formatCurrency(overview.currentBalance)}
          icon={Icons.wallet("text-emerald-600")}
          iconBg="bg-emerald-100 dark:bg-emerald-900/30"
          iconColor="text-emerald-600"
        />
      </div>

      {/* Revenue Over Time Chart */}
      <div className="bg-white dark:bg-navy-900/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-800/60 p-6">
        <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-4">
          {t("lecturerAnalytics.revenueOverTime")}
        </h3>
        {revenueOverTime.length === 0 ? (
          <p className="text-charcoal-500 dark:text-navy-400 text-center py-16">
            {t("lecturerAnalytics.noRevenueData")}
          </p>
        ) : (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueOverTime}>
                <defs>
                  <linearGradient
                    id="revenueGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => {
                    const d = new Date(v);
                    return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
                  }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => `₾${v}`}
                />
                <Tooltip content={<CurrencyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Course Performance Table */}
      <div className="bg-white dark:bg-navy-900/50 rounded-2xl border border-charcoal-100/50 dark:border-navy-800/60 p-6">
        <h3 className="text-lg font-semibold text-charcoal-900 dark:text-gray-100 mb-4">
          {t("lecturerAnalytics.coursePerformance")}
        </h3>
        {coursePerformance.length === 0 ? (
          <p className="text-charcoal-500 dark:text-navy-400 text-center py-8">
            {t("lecturerAnalytics.noCourses")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-charcoal-200 dark:border-navy-700">
                  <th className="text-left py-3 px-4 font-semibold text-charcoal-700 dark:text-gray-300">
                    {t("lecturerAnalytics.course")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-charcoal-700 dark:text-gray-300">
                    {t("lecturerAnalytics.enrollments")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-charcoal-700 dark:text-gray-300">
                    {t("lecturerAnalytics.revenue")}
                  </th>
                  <th className="text-right py-3 px-4 font-semibold text-charcoal-700 dark:text-gray-300">
                    {t("lecturerAnalytics.rating")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {coursePerformance.map((course: LecturerCoursePerformance) => (
                  <tr
                    key={course.courseId}
                    className="border-b border-charcoal-100 dark:border-navy-800/40 hover:bg-charcoal-50 dark:hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 text-charcoal-900 dark:text-gray-200 font-medium">
                      {truncate(course.title, 40)}
                    </td>
                    <td className="py-3 px-4 text-right text-charcoal-600 dark:text-navy-400">
                      {course.enrollmentCount}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                      {formatCurrency(course.revenue)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end">
                        <StarRating rating={course.rating} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {coursePerformance.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-charcoal-200 dark:border-navy-700">
                    <td className="py-3 px-4 font-bold text-charcoal-900 dark:text-gray-100">
                      {t("lecturerAnalytics.total")}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-charcoal-900 dark:text-gray-100">
                      {coursePerformance.reduce(
                        (sum, c) => sum + c.enrollmentCount,
                        0,
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-green-600">
                      {formatCurrency(
                        coursePerformance.reduce(
                          (sum, c) => sum + c.revenue,
                          0,
                        ),
                      )}
                    </td>
                    <td className="py-3 px-4" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(LecturerAnalytics);
