"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAdminFreeProjectLecturers } from "@/hooks/useAdminFreeProjectLecturers";

type Filter = "all" | "free";

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
      <div className="space-y-4">
        <div className="h-10 bg-navy-800/50 rounded animate-pulse w-96" />
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-navy-800/50 rounded animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/15 border border-red-500/30 text-red-400 px-6 py-4 rounded-2xl">
        {error.message || t("common.error")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-100">
          {t("adminProjects.title")}
        </h2>
        <p className="text-sm text-navy-300 mt-1">
          {t("adminProjects.subtitle")}
        </p>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="bg-red-500/15 border border-red-500/30 text-red-400 px-4 py-3 rounded-2xl flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-300 font-bold"
          >
            &times;
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["all", t("adminProjects.filterAll"), counts.all],
            ["free", t("adminProjects.filterFree"), counts.free],
          ] as [Filter, string, number][]
        ).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === key
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-navy-800/50 text-navy-300 hover:bg-navy-800/70"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredLecturers.length === 0 ? (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-12 text-center">
          <p className="text-navy-400 text-lg">
            {t("adminProjects.noLecturers")}
          </p>
        </div>
      ) : (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-navy-800/60">
              <thead className="bg-navy-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminProjects.name")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminProjects.email")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminProjects.username")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminProjects.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminProjects.signupDate")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminProjects.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {filteredLecturers.map((lecturer) => {
                  const isFree = lecturer.can_create_free_projects;
                  const isProcessing = processingIds.has(lecturer.id);
                  return (
                    <tr
                      key={lecturer.id}
                      className="hover:bg-navy-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-100">
                        {lecturer.full_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-400">
                        {lecturer.email || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-400">
                        {lecturer.username || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isFree ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400">
                            {t("adminProjects.badgeFree")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-navy-700/50 text-navy-300">
                            {t("adminProjects.badgePaid")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-navy-400">
                        {formatDate(lecturer.created_at)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleToggle(lecturer.id, !isFree)}
                          disabled={isProcessing}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            isFree
                              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                          }`}
                        >
                          {isProcessing
                            ? t("adminProjects.processing")
                            : isFree
                              ? t("adminProjects.revoke")
                              : t("adminProjects.grant")}
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
