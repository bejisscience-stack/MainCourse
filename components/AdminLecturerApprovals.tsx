"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAdminLecturerApprovals } from "@/hooks/useAdminLecturerApprovals";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

export default function AdminLecturerApprovals() {
  const { t } = useI18n();
  const {
    lecturers,
    allLecturers,
    isLoading,
    error,
    approveLecturer,
    rejectLecturer,
  } = useAdminLecturerApprovals();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showRejectModal, setShowRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const filteredLecturers = (() => {
    if (statusFilter === "all") return allLecturers;
    if (statusFilter === "pending")
      return allLecturers.filter((l) => l.lecturer_status === "pending");
    if (statusFilter === "approved")
      return allLecturers.filter((l) => l.lecturer_status === "approved");
    if (statusFilter === "rejected")
      return allLecturers.filter((l) => l.lecturer_status === "rejected");
    return allLecturers;
  })();

  const counts = {
    all: allLecturers.length,
    pending: allLecturers.filter((l) => l.lecturer_status === "pending").length,
    approved: allLecturers.filter((l) => l.lecturer_status === "approved")
      .length,
    rejected: allLecturers.filter((l) => l.lecturer_status === "rejected")
      .length,
  };

  const handleApprove = async (lecturerId: string) => {
    setProcessingIds((prev) => new Set(prev).add(lecturerId));
    setActionError(null);
    try {
      await approveLecturer(lecturerId);
    } catch (err: any) {
      setActionError(err.message || t("adminLecturers.approveError"));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(lecturerId);
        return next;
      });
    }
  };

  const handleReject = async () => {
    if (!showRejectModal) return;
    const id = showRejectModal;
    setProcessingIds((prev) => new Set(prev).add(id));
    setActionError(null);
    try {
      await rejectLecturer(id, rejectReason.trim() || undefined);
      setShowRejectModal(null);
      setRejectReason("");
    } catch (err: any) {
      setActionError(err.message || t("adminLecturers.rejectError"));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
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

  const statusBadge = (lecturerStatus: string | null) => {
    if (lecturerStatus === "approved") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400">
          {t("adminLecturers.approved")}
        </span>
      );
    }
    if (lecturerStatus === "rejected") {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400">
          {t("adminLecturers.rejected")}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400">
        {t("adminLecturers.pending")}
      </span>
    );
  };

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

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(
          [
            ["all", t("adminLecturers.filterAll")],
            ["pending", t("adminLecturers.filterPending")],
            ["approved", t("adminLecturers.filterApproved")],
            ["rejected", t("adminLecturers.filterRejected")],
          ] as [StatusFilter, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === key
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-navy-800/50 text-navy-300 hover:bg-navy-800/70"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredLecturers.length === 0 ? (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-12 text-center">
          <p className="text-navy-400 text-lg">
            {t("adminLecturers.noLecturers")}
          </p>
        </div>
      ) : (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-navy-800/60">
              <thead className="bg-navy-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminLecturers.name")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminLecturers.email")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminLecturers.username")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminLecturers.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminLecturers.signupDate")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminLecturers.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {filteredLecturers.map((lecturer) => (
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
                      {statusBadge(lecturer.lecturer_status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-400">
                      {formatDate(lecturer.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {lecturer.lecturer_status === "pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleApprove(lecturer.id)}
                            disabled={processingIds.has(lecturer.id)}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-md hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {processingIds.has(lecturer.id)
                              ? t("adminLecturers.processing")
                              : t("adminLecturers.approve")}
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectModal(lecturer.id);
                              setRejectReason("");
                              setActionError(null);
                            }}
                            disabled={processingIds.has(lecturer.id)}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-md hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t("adminLecturers.reject")}
                          </button>
                        </div>
                      ) : lecturer.lecturer_status === "approved" ? (
                        <span className="text-xs text-navy-400">
                          {t("adminLecturers.alreadyApproved")}
                        </span>
                      ) : (
                        <span className="text-xs text-red-400">
                          {t("adminLecturers.rejected")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-800/60 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-100">
              {t("adminLecturers.rejectTitle")}
            </h3>
            <p className="text-sm text-navy-300">
              {t("adminLecturers.rejectMessage")}
            </p>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">
                {t("adminLecturers.rejectReasonLabel")} ({t("common.optional")})
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("adminLecturers.rejectReasonPlaceholder")}
                className="w-full border border-navy-700 bg-navy-800/50 text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
            {actionError && (
              <p className="text-sm text-red-400">{actionError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(null);
                  setActionError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-navy-300 bg-navy-800 rounded-lg hover:bg-navy-700 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReject}
                disabled={processingIds.has(showRejectModal)}
                className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/20 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processingIds.has(showRejectModal)
                  ? t("adminLecturers.processing")
                  : t("adminLecturers.confirmReject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
