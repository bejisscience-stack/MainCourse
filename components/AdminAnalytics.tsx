"use client";

import { memo, useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import {
  useAdminAnalytics,
  type DateRangeKey,
} from "@/hooks/useAdminAnalytics";
import type { CourseRevenue, TopReferrer } from "@/types/analytics";

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
  if (hours < 24) return "text-green-400";
  if (hours < 72) return "text-yellow-400";
  return "text-red-400";
}

function ageBadgeBg(hours: number): string {
  if (hours < 24) return "bg-green-500/20 text-green-400";
  if (hours < 72) return "bg-yellow-500/20 text-yellow-400";
  return "bg-red-500/20 text-red-400";
}

// ─── Skeleton placeholder ────────────────────────────────────────────
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-navy-800/80 rounded animate-pulse ${className}`} />
  );
}

function CardSkeleton() {
  return (
    <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-6">
      <Skeleton className="h-5 w-40 mb-6" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-6">
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
  accent?: string;
  subtitle?: string;
}

function StatCard({
  label,
  value,
  accent = "text-gray-100",
  subtitle,
}: StatCardProps) {
  return (
    <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-5">
      <p className="text-sm font-medium text-navy-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      {subtitle && <p className="text-xs text-navy-500 mt-1">{subtitle}</p>}
    </div>
  );
}

// ─── Custom Tooltips ──────────────────────────────────────────────────
interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name?: string; color?: string }>;
  label?: string;
}

function CurrencyTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-navy-900 border border-navy-700 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-100 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-navy-300">
          {p.name ? `${p.name}: ` : ""}
          {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ─── Chart Wrapper ──────────────────────────────────────────────────
function ChartBox({
  title,
  children,
  empty,
  emptyText = "No data for this period",
}: {
  title: string;
  children: React.ReactNode;
  empty: boolean;
  emptyText?: string;
}) {
  return (
    <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-6">
      <h3 className="text-lg font-semibold text-gray-100 mb-4">{title}</h3>
      {empty ? (
        <p className="text-navy-500 text-center py-16">{emptyText}</p>
      ) : (
        <div style={{ width: "100%", height: 300 }}>{children}</div>
      )}
    </div>
  );
}

// ─── Date Range Picker ──────────────────────────────────────────────
const PRESET_RANGES: { key: DateRangeKey; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "30D" },
  { key: "90d", label: "90D" },
  { key: "1y", label: "1Y" },
  { key: "all", label: "All" },
];

function DateRangePicker({
  value,
  onChange,
  customFrom,
  customTo,
  onCustomChange,
}: {
  value: DateRangeKey;
  onChange: (k: DateRangeKey) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const [showCustom, setShowCustom] = useState(value === "custom");
  const [fromInput, setFromInput] = useState(customFrom);
  const [toInput, setToInput] = useState(customTo);

  const handlePreset = (key: DateRangeKey) => {
    setShowCustom(false);
    onChange(key);
  };

  const handleCustomToggle = () => {
    setShowCustom(true);
    if (!fromInput) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFromInput(d.toISOString().split("T")[0]);
    }
    if (!toInput) {
      setToInput(new Date().toISOString().split("T")[0]);
    }
  };

  const handleApplyCustom = () => {
    if (fromInput && toInput && fromInput <= toInput) {
      onCustomChange(fromInput, toInput);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 bg-navy-800/50 rounded-lg p-1">
        {PRESET_RANGES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handlePreset(key)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              value === key && !showCustom
                ? "bg-navy-700 text-gray-100"
                : "text-navy-400 hover:text-gray-100"
            }`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={handleCustomToggle}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            showCustom
              ? "bg-navy-700 text-gray-100"
              : "text-navy-400 hover:text-gray-100"
          }`}
        >
          Custom
        </button>
      </div>
      {showCustom && (
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={fromInput}
            onChange={(e) => setFromInput(e.target.value)}
            className="px-3 py-1.5 text-sm border border-navy-700 bg-navy-800/50 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <span className="text-navy-400 text-sm">to</span>
          <input
            type="date"
            value={toInput}
            onChange={(e) => setToInput(e.target.value)}
            className="px-3 py-1.5 text-sm border border-navy-700 bg-navy-800/50 text-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleApplyCustom}
            disabled={!fromInput || !toInput || fromInput > toInput}
            className="px-4 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Last Updated Indicator ──────────────────────────────────────────
function LastUpdated({ timestamp }: { timestamp: number | undefined }) {
  const [ago, setAgo] = useState("");

  useEffect(() => {
    if (!timestamp) return;
    const update = () => {
      const seconds = Math.floor((Date.now() - timestamp) / 1000);
      if (seconds < 5) setAgo("just now");
      else if (seconds < 60) setAgo(`${seconds}s ago`);
      else setAgo(`${Math.floor(seconds / 60)}m ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [timestamp]);

  if (!timestamp) return null;
  return (
    <span className="text-xs text-navy-500 flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Updated {ago}
    </span>
  );
}

// ─── Main Component ──────────────────────────────────────────────────
function AdminAnalytics() {
  const {
    overview,
    revenue,
    referrals,
    financial,
    operational,
    isLoading,
    error,
    dateRangeKey,
    setDateRangeKey,
    customFrom,
    customTo,
    setCustomDateRange,
    lastUpdated,
  } = useAdminAnalytics();

  // ── Error State ──
  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Analytics</h2>
          <p className="text-navy-400 mt-1">Platform analytics and insights</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 font-medium mb-3">
            Failed to load analytics data
          </p>
          <p className="text-red-400/70 text-sm mb-4">{error.message}</p>
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
          <h2 className="text-2xl font-bold text-gray-100">Analytics</h2>
          <p className="text-navy-400 mt-1">Platform analytics and insights</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <TableSkeleton />
      </div>
    );
  }

  // ── Derived data ──
  const totalRevenue =
    (overview?.totalRevenue ?? 0) + (overview?.totalBundleRevenue ?? 0);
  const totalEnrollments =
    (overview?.totalEnrollments ?? 0) + (overview?.totalBundleEnrollments ?? 0);

  const revenueChartData = (revenue?.courses ?? [])
    .filter((c: CourseRevenue) => c.totalRevenue > 0)
    .map((c: CourseRevenue) => ({
      name: truncate(c.courseTitle, 18),
      fullName: c.courseTitle,
      revenue: c.totalRevenue,
    }));

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

  return (
    <div className="space-y-8">
      {/* Header + Date Range + Last Updated */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-100">Analytics</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-navy-400">Platform analytics and insights</p>
            <LastUpdated timestamp={lastUpdated} />
          </div>
        </div>
        <DateRangePicker
          value={dateRangeKey}
          onChange={setDateRangeKey}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={setCustomDateRange}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          OVERVIEW CARDS
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          accent="text-emerald-400"
          subtitle={
            overview?.totalBundleRevenue
              ? `incl. ₾${overview.totalBundleRevenue.toFixed(2)} bundles`
              : undefined
          }
        />
        <StatCard
          label="Total Enrollments"
          value={totalEnrollments}
          accent="text-blue-400"
          subtitle={
            overview?.totalBundleEnrollments
              ? `incl. ${overview.totalBundleEnrollments} bundle enrollments`
              : undefined
          }
        />
        <StatCard
          label="Total Users"
          value={overview?.totalUsers ?? 0}
          accent="text-indigo-400"
        />
        <StatCard
          label="Outstanding Balances"
          value={
            financial ? formatCurrency(financial.outstandingBalances) : "₾0.00"
          }
          accent="text-yellow-400"
          subtitle="Current lecturer payables"
        />
        <StatCard
          label="Total Paid Out"
          value={financial ? formatCurrency(financial.totalPaidOut) : "₾0.00"}
          accent="text-red-400"
          subtitle="Approved withdrawals"
        />
        <StatCard
          label="Active Referrals"
          value={referrals?.totalActivations ?? 0}
          accent="text-orange-400"
          subtitle={
            topReferrers.length > 0
              ? `Top: ${topReferrers[0].username}`
              : undefined
          }
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════
          ACTION QUEUE — Pending items requiring admin attention
          ═══════════════════════════════════════════════════════════ */}
      <div>
        <h3 className="text-lg font-semibold text-gray-100 mb-3">
          Action Queue
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pending Enrollments */}
          <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-5">
            <p className="text-sm font-medium text-navy-400 mb-2">
              Pending Enrollments
            </p>
            <p className="text-2xl font-bold text-gray-100">
              {operational?.pendingEnrollments.count ?? 0}
            </p>
            {operational && operational.pendingEnrollments.count > 0 ? (
              <span
                className={`inline-block text-xs mt-2 px-2 py-0.5 rounded-full ${ageBadgeBg(operational.pendingEnrollments.oldestAgeHours)}`}
              >
                Oldest:{" "}
                {formatHours(operational.pendingEnrollments.oldestAgeHours)}
              </span>
            ) : (
              <p className="text-xs text-emerald-500 mt-2">All clear</p>
            )}
          </div>

          {/* Pending Withdrawals */}
          <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-5">
            <p className="text-sm font-medium text-navy-400 mb-2">
              Pending Withdrawals
            </p>
            <p className="text-2xl font-bold text-gray-100">
              {operational?.pendingWithdrawals.count ?? 0}
            </p>
            {operational && operational.pendingWithdrawals.count > 0 ? (
              <>
                <p className="text-xs text-navy-400 mt-1">
                  Total:{" "}
                  {formatCurrency(operational.pendingWithdrawals.totalAmount)}
                </p>
                <span
                  className={`inline-block text-xs mt-1 px-2 py-0.5 rounded-full ${ageBadgeBg(operational.pendingWithdrawals.oldestAgeHours)}`}
                >
                  Oldest:{" "}
                  {formatHours(operational.pendingWithdrawals.oldestAgeHours)}
                </span>
              </>
            ) : (
              <p className="text-xs text-emerald-500 mt-2">All clear</p>
            )}
          </div>

          {/* Pending Lecturers */}
          <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-5">
            <p className="text-sm font-medium text-navy-400 mb-2">
              Pending Lecturers
            </p>
            <p className="text-2xl font-bold text-gray-100">
              {operational?.pendingLecturers.count ?? 0}
            </p>
            {operational && operational.pendingLecturers.count > 0 ? (
              <span
                className={`inline-block text-xs mt-2 px-2 py-0.5 rounded-full ${ageBadgeBg(operational.pendingLecturers.oldestAgeHours)}`}
              >
                Oldest:{" "}
                {formatHours(operational.pendingLecturers.oldestAgeHours)}
              </span>
            ) : (
              <p className="text-xs text-emerald-500 mt-2">All clear</p>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CHARTS
          ═══════════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartBox
          title="Revenue Over Time"
          empty={(financial?.revenueOverTime?.length ?? 0) === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={financial?.revenueOverTime}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#64748b" }}
                stroke="#334155"
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                stroke="#334155"
              />
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
        </ChartBox>

        <ChartBox
          title="Revenue by Course"
          empty={revenueChartData.length === 0}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#64748b" }}
                stroke="#334155"
              />
              <YAxis
                tick={{ fontSize: 12, fill: "#64748b" }}
                stroke="#334155"
              />
              <Tooltip content={<CurrencyTooltip />} />
              <Bar
                dataKey="revenue"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                name="Revenue"
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          DETAIL TABLES
          ═══════════════════════════════════════════════════════════ */}

      {/* Course Revenue Table */}
      <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-navy-800/60">
          <h3 className="text-lg font-semibold text-gray-100">
            Course Revenue
          </h3>
        </div>
        {courseRevenueRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-800/50 text-left">
                  <th className="px-6 py-3 font-semibold text-navy-300">
                    Course
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300">
                    Type
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300 text-right">
                    Price
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300 text-right">
                    Enrollments
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300 text-right">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/40">
                {courseRevenueRows.map((c) => (
                  <tr
                    key={c.courseId}
                    className="hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="px-6 py-3 font-medium text-gray-100">
                      {c.courseTitle}
                    </td>
                    <td className="px-6 py-3 text-navy-400">{c.courseType}</td>
                    <td className="px-6 py-3 text-right text-navy-400">
                      {formatCurrency(c.price)}
                    </td>
                    <td className="px-6 py-3 text-right text-navy-400">
                      {c.enrollmentCount}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-100">
                      {formatCurrency(c.totalRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-navy-800/50 font-semibold">
                  <td className="px-6 py-3 text-gray-100">Total</td>
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3" />
                  <td className="px-6 py-3 text-right text-gray-100">
                    {totalCourseEnrollments}
                  </td>
                  <td className="px-6 py-3 text-right text-gray-100">
                    {formatCurrency(totalCourseRevenue)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-navy-500 text-center py-8">
            No revenue data available
          </p>
        )}
      </div>

      {/* Top Referrers Table */}
      {topReferrers.length > 0 && (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 overflow-hidden">
          <div className="px-6 py-4 border-b border-navy-800/60">
            <h3 className="text-lg font-semibold text-gray-100">
              Top Referrers
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-800/50 text-left">
                  <th className="px-6 py-3 font-semibold text-navy-300">
                    User
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300">
                    Referral Code
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300 text-right">
                    Activations
                  </th>
                  <th className="px-6 py-3 font-semibold text-navy-300 text-right">
                    Commission Earned
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/40">
                {topReferrers.map((r: TopReferrer) => (
                  <tr
                    key={r.userId}
                    className="hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="px-6 py-3">
                      <p className="font-medium text-gray-100">
                        {r.username || r.email.split("@")[0]}
                      </p>
                      <p className="text-xs text-navy-500">{r.email}</p>
                    </td>
                    <td className="px-6 py-3">
                      <code className="text-xs bg-navy-800/50 px-2 py-1 rounded text-navy-300">
                        {r.referralCode}
                      </code>
                    </td>
                    <td className="px-6 py-3 text-right text-navy-400">
                      {r.activationCount}
                    </td>
                    <td className="px-6 py-3 text-right font-medium text-gray-100">
                      {formatCurrency(r.totalCommission)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AdminAnalytics);
