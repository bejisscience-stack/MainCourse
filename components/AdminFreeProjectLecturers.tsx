"use client";

import { useState } from "react";
import {
  AlertCircle,
  Loader2,
  Sparkles,
  UserMinus,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import {
  useAdminFreeProjectLecturers,
  type FreeProjectLecturer,
} from "@/hooks/useAdminFreeProjectLecturers";

type Filter = "all" | "free";

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

function initialOf(lecturer: FreeProjectLecturer) {
  const source =
    lecturer.full_name?.trim() ||
    lecturer.username?.trim() ||
    lecturer.email?.trim() ||
    "";
  const ch = source.charAt(0).toUpperCase();
  return ch || "?";
}

function primaryName(lecturer: FreeProjectLecturer, fallback: string) {
  return lecturer.full_name?.trim() || lecturer.username?.trim() || fallback;
}

export default function AdminFreeProjectLecturers() {
  const { t } = useI18n();
  const { lecturers, isLoading, error, setExempt } =
    useAdminFreeProjectLecturers();

  const [filter, setFilter] = useState<Filter>("all");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredLecturers =
    filter === "free"
      ? lecturers.filter((l) => l.can_create_free_projects)
      : lecturers;

  const counts = {
    all: lecturers.length,
    free: lecturers.filter((l) => l.can_create_free_projects).length,
  };
  const paidCount = counts.all - counts.free;

  const handleToggle = async (lecturerId: string, allowed: boolean) => {
    setProcessingIds((prev) => new Set(prev).add(lecturerId));
    setActionError(null);
    try {
      await setExempt(lecturerId, allowed);
    } catch (err: any) {
      setActionError(
        err.message ||
          (allowed
            ? t("adminProjects.grantError")
            : t("adminProjects.revokeError")),
      );
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(lecturerId);
        return next;
      });
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-6 w-72 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
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
      label: t("adminProjects.kpi.totalApproved"),
      value: counts.all,
      icon: Users,
      iconBg: "bg-navy-100",
      iconText: "text-navy-900",
    },
    {
      label: t("adminProjects.kpi.freeAccess"),
      value: counts.free,
      icon: Sparkles,
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-700",
    },
    {
      label: t("adminProjects.kpi.paidAccess"),
      value: paidCount,
      icon: Wallet,
      iconBg: "bg-gray-100",
      iconText: "text-gray-700",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-navy-900">
            {t("adminProjects.title")}
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            {t("adminProjects.subtitle")}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 self-start">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
          </span>
          {t("adminProjects.liveSync")}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Action error banner */}
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

      {/* Filter segmented control */}
      <div className="inline-flex p-1 bg-gray-100 rounded-lg">
        {(
          [
            ["all", t("adminProjects.filterAll"), counts.all, "bg-gray-400"],
            [
              "free",
              t("adminProjects.filterFree"),
              counts.free,
              "bg-emerald-500",
            ],
          ] as [Filter, string, number, string][]
        ).map(([key, label, count, dot]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
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

      {/* Table */}
      {filteredLecturers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-base font-medium">
            {t("adminProjects.noLecturers")}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminProjects.name")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminProjects.email")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminProjects.username")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminProjects.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminProjects.signupDate")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminProjects.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLecturers.map((lecturer) => {
                  const isFree = lecturer.can_create_free_projects;
                  const isProcessing = processingIds.has(lecturer.id);
                  const swatch = avatarSwatch(lecturer.id);
                  const name = primaryName(
                    lecturer,
                    t("adminProjects.unnamedLecturer"),
                  );
                  const showSecondaryUsername =
                    !!lecturer.full_name?.trim() && !!lecturer.username?.trim();
                  return (
                    <tr
                      key={lecturer.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${swatch.bg} ${swatch.text}`}
                          >
                            {initialOf(lecturer)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {name}
                            </div>
                            {showSecondaryUsername && (
                              <div className="text-xs text-gray-500 truncate">
                                @{lecturer.username}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lecturer.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {lecturer.username || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isFree ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {t("adminProjects.badgeFree")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                            {t("adminProjects.badgePaid")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(lecturer.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(lecturer.id, !isFree)}
                          disabled={isProcessing}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isFree
                              ? "bg-red-600 text-white hover:bg-red-700"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isFree ? (
                            <UserMinus className="h-3.5 w-3.5" />
                          ) : (
                            <UserPlus className="h-3.5 w-3.5" />
                          )}
                          <span>
                            {isProcessing
                              ? t("adminProjects.processing")
                              : isFree
                                ? t("adminProjects.revoke")
                                : t("adminProjects.grant")}
                          </span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
