"use client";

import { useState, useCallback } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAdminWithdrawalRequests } from "@/hooks/useAdminWithdrawalRequests";
import { useRealtimeAdminWithdrawalRequests } from "@/hooks/useRealtimeAdminWithdrawalRequests";
import type { WithdrawalRequest } from "@/types/balance";

type StatusFilter = "all" | "pending" | "completed" | "rejected";

export default function AdminWithdrawals() {
  const { t } = useI18n();
  const { requests, isLoading, error, mutate, approveRequest, rejectRequest } =
    useAdminWithdrawalRequests();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showRejectModal, setShowRejectModal] =
    useState<WithdrawalRequest | null>(null);
  const [showApproveModal, setShowApproveModal] =
    useState<WithdrawalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  // Real-time updates
  useRealtimeAdminWithdrawalRequests({
    enabled: true,
    onInsert: useCallback(
      (request: WithdrawalRequest) => {
        mutate((current) => {
          if (!current) return [request];
          if (current.some((r) => r.id === request.id)) return current;
          return [request, ...current];
        }, false);
      },
      [mutate],
    ),
    onUpdate: useCallback(
      (request: WithdrawalRequest) => {
        mutate((current) => {
          if (!current) return current;
          return current.map((r) => (r.id === request.id ? request : r));
        }, false);
      },
      [mutate],
    ),
  });

  // Filter requests by status
  const filteredRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  // Counts for filter badges
  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    completed: requests.filter((r) => r.status === "completed").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const handleApprove = async () => {
    if (!showApproveModal) return;
    const id = showApproveModal.id;
    setProcessingIds((prev) => new Set(prev).add(id));
    setActionError(null);
    try {
      await approveRequest(id, approveNotes || undefined);
      setShowApproveModal(null);
      setApproveNotes("");
    } catch (err: any) {
      setActionError(err.message || t("adminWithdrawals.approveError"));
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !rejectReason.trim()) return;
    const id = showRejectModal.id;
    setProcessingIds((prev) => new Set(prev).add(id));
    setActionError(null);
    try {
      await rejectRequest(id, rejectReason.trim());
      setShowRejectModal(null);
      setRejectReason("");
    } catch (err: any) {
      setActionError(err.message || t("adminWithdrawals.rejectError"));
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

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-500/15 text-yellow-400",
      completed: "bg-green-500/15 text-green-400",
      approved: "bg-green-500/15 text-green-400",
      rejected: "bg-red-500/15 text-red-400",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-navy-800/50 text-navy-300"}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
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
            ["all", t("adminWithdrawals.filterAll")],
            ["pending", t("adminWithdrawals.filterPending")],
            ["completed", t("adminWithdrawals.filterCompleted")],
            ["rejected", t("adminWithdrawals.filterRejected")],
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
      {filteredRequests.length === 0 ? (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 p-12 text-center">
          <p className="text-navy-400 text-lg">
            {statusFilter === "all"
              ? t("adminWithdrawals.noRequests")
              : t("adminWithdrawals.noRequestsForFilter", {
                  status: statusFilter,
                })}
          </p>
        </div>
      ) : (
        <div className="bg-navy-900/50 rounded-2xl border border-navy-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-navy-800/60">
              <thead className="bg-navy-800/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.username")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.email")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.role")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.bankAccount")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.amount")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.currentBalance")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.requestDate")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-navy-400 uppercase tracking-wider">
                    {t("adminWithdrawals.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-800/60">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-100">
                      {req.profiles?.username || t("adminWithdrawals.unknown")}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-400">
                      {req.profiles?.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-400 capitalize">
                      {req.user_type}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-navy-300">
                      {req.profiles?.bank_account_number ||
                        req.bank_account_number ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-100">
                      ₾{req.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-navy-400">
                      ₾{req.profiles?.balance?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusBadge(req.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-navy-400">
                      {formatDate(req.created_at)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {req.status === "pending" ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setShowApproveModal(req);
                              setApproveNotes("");
                              setActionError(null);
                            }}
                            disabled={processingIds.has(req.id)}
                            className="px-3 py-1.5 bg-green-500/20 text-green-400 text-xs font-medium rounded-md hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {processingIds.has(req.id)
                              ? t("adminWithdrawals.processing")
                              : t("adminWithdrawals.approve")}
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectModal(req);
                              setRejectReason("");
                              setActionError(null);
                            }}
                            disabled={processingIds.has(req.id)}
                            className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs font-medium rounded-md hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t("adminWithdrawals.reject")}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-navy-400">
                          {req.admin_notes && (
                            <p
                              className="text-navy-400 italic max-w-[200px] truncate"
                              title={req.admin_notes}
                            >
                              {req.admin_notes}
                            </p>
                          )}
                          {req.processed_at && (
                            <p>{formatDate(req.processed_at)}</p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve Modal */}
      {showApproveModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-800/60 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-100">
              {t("adminWithdrawals.approveTitle")}
            </h3>
            <p className="text-sm text-navy-400">
              {t("adminWithdrawals.approveMessage", {
                amount: showApproveModal.amount.toFixed(2),
                username:
                  showApproveModal.profiles?.username ||
                  t("adminWithdrawals.unknown"),
              })}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-navy-400 font-medium">
                IBAN:{" "}
                <span className="font-mono">
                  {showApproveModal.profiles?.bank_account_number ||
                    showApproveModal.bank_account_number ||
                    "—"}
                </span>
              </p>
            </div>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder={t("adminWithdrawals.approveNotesPlaceholder")}
              className="w-full border border-navy-700 bg-navy-800/50 text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              rows={3}
            />
            {actionError && (
              <p className="text-sm text-red-600">{actionError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowApproveModal(null);
                  setActionError(null);
                }}
                className="px-4 py-2 text-sm font-medium text-navy-300 bg-navy-800 rounded-lg hover:bg-navy-700 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleApprove}
                disabled={processingIds.has(showApproveModal.id)}
                className="px-4 py-2 text-sm font-medium text-green-400 bg-green-500/20 rounded-lg hover:bg-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processingIds.has(showApproveModal.id)
                  ? t("adminWithdrawals.processing")
                  : t("adminWithdrawals.confirmApprove")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-navy-900 border border-navy-800/60 rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-100">
              {t("adminWithdrawals.rejectTitle")}
            </h3>
            <p className="text-sm text-navy-400">
              {t("adminWithdrawals.rejectMessage", {
                amount: showRejectModal.amount.toFixed(2),
                username:
                  showRejectModal.profiles?.username ||
                  t("adminWithdrawals.unknown"),
              })}
            </p>
            <div>
              <label className="block text-sm font-medium text-navy-300 mb-1">
                {t("adminWithdrawals.rejectReason")} *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("adminWithdrawals.rejectReasonPlaceholder")}
                className="w-full border border-navy-700 bg-navy-800/50 text-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={3}
                required
              />
              {rejectReason.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {t("adminWithdrawals.rejectReasonRequired")}
                </p>
              )}
            </div>
            {actionError && (
              <p className="text-sm text-red-600">{actionError}</p>
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
                disabled={
                  !rejectReason.trim() || processingIds.has(showRejectModal.id)
                }
                className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/20 rounded-lg hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processingIds.has(showRejectModal.id)
                  ? t("adminWithdrawals.processing")
                  : t("adminWithdrawals.confirmReject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
