"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Infinity as InfinityIcon,
  Loader2,
  Search,
  ShieldX,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import {
  useAdminStudentProjectAccess,
  type StudentProjectAccess,
} from "@/hooks/useAdminStudentProjectAccess";

type Filter = "all" | "active" | "expiringSoon" | "expired" | "never";

const LIFETIME_YEAR_THRESHOLD = 9000;
const LIFETIME_DATE = "9999-12-31T00:00:00.000Z";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SEARCH_DEBOUNCE_MS = 300;

const AVATAR_PALETTE: Array<{ bg: string; text: string }> = [
  { bg: "bg-navy-100", text: "text-navy-900" },
  { bg: "bg-emerald-100", text: "text-emerald-800" },
  { bg: "bg-amber-100", text: "text-amber-800" },
  { bg: "bg-sky-100", text: "text-sky-800" },
  { bg: "bg-rose-100", text: "text-rose-800" },
];

function avatarSwatch(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function initialOf(s: StudentProjectAccess) {
  const source =
    s.full_name?.trim() || s.username?.trim() || s.email?.trim() || "";
  return source.charAt(0).toUpperCase() || "?";
}

function primaryName(s: StudentProjectAccess, fallback: string) {
  return s.full_name?.trim() || s.username?.trim() || fallback;
}

type StatusKind = "active" | "expiringSoon" | "expired" | "never" | "lifetime";

interface StatusInfo {
  kind: StatusKind;
  expiresAtMs: number | null;
}

function classifyStatus(expiresAt: string | null): StatusInfo {
  if (!expiresAt) return { kind: "never", expiresAtMs: null };
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t)) return { kind: "never", expiresAtMs: null };
  const year = new Date(t).getUTCFullYear();
  if (year >= LIFETIME_YEAR_THRESHOLD)
    return { kind: "lifetime", expiresAtMs: t };
  const now = Date.now();
  if (t <= now) return { kind: "expired", expiresAtMs: t };
  if (t - now <= SEVEN_DAYS_MS) return { kind: "expiringSoon", expiresAtMs: t };
  return { kind: "active", expiresAtMs: t };
}

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDateShort = (dateString: string) =>
  new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

interface PresetOption {
  key: string;
  labelKey: string;
  days?: number;
  isLifetime?: boolean;
}

const PRESETS: PresetOption[] = [
  { key: "1w", labelKey: "preset1Week", days: 7 },
  { key: "1m", labelKey: "preset1Month", days: 30 },
  { key: "3m", labelKey: "preset3Months", days: 90 },
  { key: "6m", labelKey: "preset6Months", days: 180 },
  { key: "1y", labelKey: "preset1Year", days: 365 },
  { key: "lifetime", labelKey: "presetLifetime", isLifetime: true },
];

function isoFromPreset(preset: PresetOption): string {
  if (preset.isLifetime) return LIFETIME_DATE;
  return new Date(
    Date.now() + (preset.days || 0) * 24 * 60 * 60 * 1000,
  ).toISOString();
}

// <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time.
function toLocalDatetimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export default function AdminStudentProjectAccess() {
  const { t } = useI18n();
  const {
    students,
    counts,
    isLoading,
    error,
    query,
    setQuery,
    setAccess,
    extendAccess,
  } = useAdminStudentProjectAccess();

  const [filter, setFilter] = useState<Filter>("all");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] =
    useState<StudentProjectAccess | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const [searchInput, setSearchInput] = useState(query);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, setQuery]);

  const filteredStudents = useMemo(() => {
    if (filter === "all") return students;
    return students.filter(
      (s) =>
        classifyStatus(s.project_access_expires_at).kind ===
        filterToKind(filter),
    );
  }, [students, filter]);

  const markProcessing = (id: string, on: boolean) => {
    setProcessingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const flashSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(
      () => setActionSuccess((curr) => (curr === msg ? null : curr)),
      3000,
    );
  };

  const handleApply = async (
    studentId: string,
    expiresAt: string | null,
    reason?: string,
    successMsg?: string,
  ) => {
    markProcessing(studentId, true);
    setActionError(null);
    try {
      await setAccess(studentId, expiresAt, reason);
      if (successMsg) flashSuccess(successMsg);
    } catch (err: any) {
      setActionError(err?.message || t("adminStudentProjectAccess.grantError"));
    } finally {
      markProcessing(studentId, false);
    }
  };

  const handleExtend = async (
    studentId: string,
    days: number,
    reason?: string,
  ) => {
    markProcessing(studentId, true);
    setActionError(null);
    try {
      await extendAccess(studentId, days, reason);
      flashSuccess(t("adminStudentProjectAccess.extendSuccess"));
    } catch (err: any) {
      setActionError(err?.message || t("adminStudentProjectAccess.grantError"));
    } finally {
      markProcessing(studentId, false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      const visibleIds = filteredStudents.map((s) => s.id);
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  };

  const handleBulkGrant = async (preset: PresetOption) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    setActionError(null);
    const targetIso = isoFromPreset(preset);
    const ids = Array.from(selectedIds);
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        await setAccess(id, targetIso);
        success += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    if (failed === 0) {
      flashSuccess(
        t("adminStudentProjectAccess.bulkSuccess", { count: success }),
      );
    } else {
      setActionError(
        t("adminStudentProjectAccess.bulkPartial", {
          success,
          failed,
        }),
      );
    }
  };

  if (isLoading && students.length === 0) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-72 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <div className="h-3 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-8 w-16 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse" />
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 bg-gray-200 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-1/4 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-7 w-28 bg-gray-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg flex items-start gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <span>{error.message || t("common.error")}</span>
      </div>
    );
  }

  const kpis: Array<{
    label: string;
    value: number;
    icon: typeof Users;
    iconBg: string;
    iconText: string;
  }> = [
    {
      label: t("adminStudentProjectAccess.kpi.total"),
      value: counts.total,
      icon: Users,
      iconBg: "bg-navy-100",
      iconText: "text-navy-900",
    },
    {
      label: t("adminStudentProjectAccess.kpi.active"),
      value: counts.active,
      icon: CheckCircle2,
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-700",
    },
    {
      label: t("adminStudentProjectAccess.kpi.expiringSoon"),
      value: counts.expiringSoon,
      icon: Clock,
      iconBg: "bg-amber-100",
      iconText: "text-amber-700",
    },
    {
      label: t("adminStudentProjectAccess.kpi.never"),
      value: counts.never,
      icon: ShieldX,
      iconBg: "bg-gray-100",
      iconText: "text-gray-700",
    },
  ];

  const filterPills: Array<{
    key: Filter;
    label: string;
    count: number;
    dot: string;
  }> = [
    {
      key: "all",
      label: t("adminStudentProjectAccess.filterAll"),
      count: counts.total,
      dot: "bg-gray-400",
    },
    {
      key: "active",
      label: t("adminStudentProjectAccess.filterActive"),
      count: counts.active,
      dot: "bg-emerald-500",
    },
    {
      key: "expiringSoon",
      label: t("adminStudentProjectAccess.filterExpiringSoon"),
      count: counts.expiringSoon,
      dot: "bg-amber-500",
    },
    {
      key: "expired",
      label: t("adminStudentProjectAccess.filterExpired"),
      count: counts.expired,
      dot: "bg-red-500",
    },
    {
      key: "never",
      label: t("adminStudentProjectAccess.filterNever"),
      count: counts.never,
      dot: "bg-gray-400",
    },
  ];

  const allVisibleSelected =
    filteredStudents.length > 0 &&
    filteredStudents.every((s) => selectedIds.has(s.id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900">
            {t("adminStudentProjectAccess.title")}
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            {t("adminStudentProjectAccess.subtitle")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 self-start">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          {t("adminStudentProjectAccess.liveSync")}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {kpi.label}
                  </p>
                  <p className="mt-2 text-3xl font-bold text-navy-900">
                    {kpi.value}
                  </p>
                </div>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-lg ${kpi.iconBg}`}
                >
                  <Icon className={`h-6 w-6 ${kpi.iconText}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1 text-sm">{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-lg flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span className="flex-1 text-sm">{actionSuccess}</span>
          <button
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss"
            className="text-emerald-600 hover:text-emerald-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex p-1 bg-gray-100 rounded-lg overflow-x-auto">
          {filterPills.map(({ key, label, count, dot }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                filter === key
                  ? "bg-white text-navy-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              <span>{label}</span>
              <span
                className={`text-xs ${
                  filter === key ? "text-gray-500" : "text-gray-400"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("adminStudentProjectAccess.searchPlaceholder")}
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-300 bg-white"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              aria-label={t("adminStudentProjectAccess.clearSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="bg-navy-50 border border-navy-200 rounded-lg px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-navy-900">
            {t("adminStudentProjectAccess.selectedCount", {
              count: selectedIds.size,
            })}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-navy-600">
              {t("adminStudentProjectAccess.bulkGrant")}
            </span>
            {PRESETS.filter((p) =>
              ["1m", "3m", "6m", "lifetime"].includes(p.key),
            ).map((preset) => (
              <button
                key={preset.key}
                onClick={() => handleBulkGrant(preset)}
                disabled={bulkProcessing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bulkProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : preset.isLifetime ? (
                  <InfinityIcon className="h-3 w-3" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                <span>{t(`adminStudentProjectAccess.${preset.labelKey}`)}</span>
              </button>
            ))}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-navy-700 underline hover:text-navy-900"
            >
              {t("adminStudentProjectAccess.clearSelection")}
            </button>
          </div>
        </div>
      )}

      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-base font-medium">
            {t("adminStudentProjectAccess.noStudents")}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <input
                      type="checkbox"
                      aria-label={t("adminStudentProjectAccess.selectAll")}
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="rounded border-gray-300 text-navy-900 focus:ring-navy-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminStudentProjectAccess.name")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminStudentProjectAccess.email")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminStudentProjectAccess.username")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminStudentProjectAccess.statusHeader")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminStudentProjectAccess.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStudents.map((student) => {
                  const status = classifyStatus(
                    student.project_access_expires_at,
                  );
                  const isProcessing = processingIds.has(student.id);
                  const isSelected = selectedIds.has(student.id);
                  const swatch = avatarSwatch(student.id);
                  const name = primaryName(
                    student,
                    t("adminStudentProjectAccess.unnamedStudent"),
                  );
                  const showSecondaryUsername =
                    !!student.full_name?.trim() && !!student.username?.trim();
                  return (
                    <tr
                      key={student.id}
                      className={`transition-colors ${
                        isSelected ? "bg-navy-50/50" : "hover:bg-gray-50"
                      }`}
                    >
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          aria-label={t("adminStudentProjectAccess.selectRow")}
                          checked={isSelected}
                          onChange={() => toggleSelected(student.id)}
                          className="rounded border-gray-300 text-navy-900 focus:ring-navy-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${swatch.bg} ${swatch.text}`}
                          >
                            {initialOf(student)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {name}
                            </div>
                            {showSecondaryUsername && (
                              <div className="text-xs text-gray-500 truncate">
                                @{student.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-[220px] truncate">
                        {student.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {student.username || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          status={status}
                          tStatusActive={t(
                            "adminStudentProjectAccess.statusActive",
                          )}
                          tStatusExpiringSoon={t(
                            "adminStudentProjectAccess.statusExpiringSoon",
                          )}
                          tStatusExpired={t(
                            "adminStudentProjectAccess.statusExpired",
                          )}
                          tStatusNever={t(
                            "adminStudentProjectAccess.statusNever",
                          )}
                          tStatusLifetime={t(
                            "adminStudentProjectAccess.statusLifetime",
                          )}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          {(status.kind === "active" ||
                            status.kind === "expiringSoon" ||
                            status.kind === "lifetime") && (
                            <button
                              onClick={() => handleExtend(student.id, 30)}
                              disabled={isProcessing}
                              title={t(
                                "adminStudentProjectAccess.extendTooltip",
                              )}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isProcessing ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CalendarClock className="h-3.5 w-3.5" />
                              )}
                              <span>+30d</span>
                            </button>
                          )}
                          <button
                            onClick={() => setActiveStudent(student)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            <span>{t("adminStudentProjectAccess.manage")}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeStudent && (
        <ManageAccessModal
          student={activeStudent}
          status={classifyStatus(activeStudent.project_access_expires_at)}
          isProcessing={processingIds.has(activeStudent.id)}
          onClose={() => setActiveStudent(null)}
          onApply={async (expiresAt, reason) => {
            await handleApply(
              activeStudent.id,
              expiresAt,
              reason,
              expiresAt === null
                ? t("adminStudentProjectAccess.revokeSuccess")
                : t("adminStudentProjectAccess.grantSuccess"),
            );
            setActiveStudent(null);
          }}
        />
      )}
    </div>
  );
}

function filterToKind(filter: Exclude<Filter, "all">): StatusKind {
  if (filter === "active") return "active";
  if (filter === "expiringSoon") return "expiringSoon";
  if (filter === "expired") return "expired";
  return "never";
}

function StatusBadge({
  status,
  tStatusActive,
  tStatusExpiringSoon,
  tStatusExpired,
  tStatusNever,
  tStatusLifetime,
}: {
  status: StatusInfo;
  tStatusActive: string;
  tStatusExpiringSoon: string;
  tStatusExpired: string;
  tStatusNever: string;
  tStatusLifetime: string;
}) {
  if (status.kind === "lifetime") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <InfinityIcon className="h-3 w-3" />
        {tStatusLifetime}
      </span>
    );
  }
  if (status.kind === "active" && status.expiresAtMs) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {tStatusActive}{" "}
        {formatDateShort(new Date(status.expiresAtMs).toISOString())}
      </span>
    );
  }
  if (status.kind === "expiringSoon" && status.expiresAtMs) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
        <Clock className="h-3 w-3" />
        {tStatusExpiringSoon}{" "}
        {formatDateShort(new Date(status.expiresAtMs).toISOString())}
      </span>
    );
  }
  if (status.kind === "expired" && status.expiresAtMs) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
        {tStatusExpired}{" "}
        {formatDateShort(new Date(status.expiresAtMs).toISOString())}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
      {tStatusNever}
    </span>
  );
}

interface ManageAccessModalProps {
  student: StudentProjectAccess;
  status: StatusInfo;
  isProcessing: boolean;
  onClose: () => void;
  onApply: (expiresAt: string | null, reason?: string) => Promise<void>;
}

function ManageAccessModal({
  student,
  status,
  isProcessing,
  onClose,
  onApply,
}: ManageAccessModalProps) {
  const { t } = useI18n();
  const [reason, setReason] = useState("");
  const [customDateTime, setCustomDateTime] = useState(() =>
    toLocalDatetimeInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
  );
  const [customError, setCustomError] = useState<string | null>(null);

  const name = primaryName(
    student,
    t("adminStudentProjectAccess.unnamedStudent"),
  );
  const hasAccess =
    status.kind === "active" ||
    status.kind === "expiringSoon" ||
    status.kind === "lifetime";

  const handlePreset = (preset: PresetOption) => {
    const iso = isoFromPreset(preset);
    void onApply(iso, reason.trim() || undefined);
  };

  const handleCustom = () => {
    setCustomError(null);
    if (!customDateTime) {
      setCustomError(t("adminStudentProjectAccess.invalidDate"));
      return;
    }
    const parsed = new Date(customDateTime);
    if (Number.isNaN(parsed.getTime())) {
      setCustomError(t("adminStudentProjectAccess.invalidDate"));
      return;
    }
    if (parsed.getTime() <= Date.now()) {
      setCustomError(t("adminStudentProjectAccess.dateInPast"));
      return;
    }
    void onApply(parsed.toISOString(), reason.trim() || undefined);
  };

  const handleRevoke = () => {
    void onApply(null, reason.trim() || undefined);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-bold text-navy-900">
              {t("adminStudentProjectAccess.modalTitle")}
            </h3>
            <p className="text-sm text-gray-600 mt-1">{name}</p>
            {student.email && (
              <p className="text-xs text-gray-500">{student.email}</p>
            )}
            {hasAccess && status.expiresAtMs && status.kind !== "lifetime" && (
              <p className="text-xs text-emerald-700 mt-2">
                {t("adminStudentProjectAccess.currentExpiry")}{" "}
                {formatDate(new Date(status.expiresAtMs).toISOString())}
              </p>
            )}
            {status.kind === "lifetime" && (
              <p className="text-xs text-purple-700 mt-2">
                {t("adminStudentProjectAccess.statusLifetime")}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <section>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {t("adminStudentProjectAccess.presetsHeading")}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.key}
                  onClick={() => handlePreset(preset)}
                  disabled={isProcessing}
                  className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-md border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    preset.isLifetime
                      ? "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100"
                      : "bg-white text-navy-900 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {preset.isLifetime ? (
                    <InfinityIcon className="h-3.5 w-3.5" />
                  ) : (
                    <CalendarClock className="h-3.5 w-3.5" />
                  )}
                  {t(`adminStudentProjectAccess.${preset.labelKey}`)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label
              htmlFor="custom-expiry"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
            >
              {t("adminStudentProjectAccess.customExpiry")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="custom-expiry"
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-200"
              />
              <button
                onClick={handleCustom}
                disabled={isProcessing}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-navy-900 text-white hover:bg-navy-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {t("adminStudentProjectAccess.applyCustom")}
              </button>
            </div>
            {customError && (
              <p className="mt-2 text-xs text-red-600">{customError}</p>
            )}
          </section>

          <section>
            <label
              htmlFor="reason"
              className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2"
            >
              {t("adminStudentProjectAccess.reasonLabel")}
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 300))}
              maxLength={300}
              rows={2}
              placeholder={t("adminStudentProjectAccess.reasonPlaceholder")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-navy-200 resize-none"
            />
            <p className="mt-1 text-xs text-gray-400 text-right">
              {reason.length}/300
            </p>
          </section>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-xl">
          {hasAccess ? (
            <button
              onClick={handleRevoke}
              disabled={isProcessing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldX className="h-3.5 w-3.5" />
              )}
              {t("adminStudentProjectAccess.revokeAction")}
            </button>
          ) : (
            <span />
          )}
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
