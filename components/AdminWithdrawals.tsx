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
      pending: "bg-yellow-100 text-yellow-800",
      completed: "bg-green-100 text-green-800",
      approved: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-gray-200 rounded animate-pulse w-96" />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
        {error.message || t("common.error")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action error banner */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 font-bold"
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
                ? "bg-navy-900 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {statusFilter === "all"
              ? t("adminWithdrawals.noRequests")
              : t("adminWithdrawals.noRequestsForFilter", {
                  status: statusFilter,
                })}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.username")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.email")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.role")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.bankAccount")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.amount")}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.currentBalance")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.status")}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.requestDate")}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminWithdrawals.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {req.profiles?.username || t("adminWithdrawals.unknown")}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {req.profiles?.email || "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {req.user_type}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">
                      {req.profiles?.bank_account_number ||
                        req.bank_account_number ||
                        "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      ₾{req.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      ₾{req.profiles?.balance?.toFixed(2) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusBadge(req.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
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
                            className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                            className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t("adminWithdrawals.reject")}
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          {req.admin_notes && (
                            <p
                              className="text-gray-500 italic max-w-[200px] truncate"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {t("adminWithdrawals.approveTitle")}
            </h3>
            <p className="text-sm text-gray-600">
              {t("adminWithdrawals.approveMessage", {
                amount: showApproveModal.amount.toFixed(2),
                username:
                  showApproveModal.profiles?.username ||
                  t("adminWithdrawals.unknown"),
              })}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-medium">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleApprove}
                disabled={processingIds.has(showApproveModal.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">
              {t("adminWithdrawals.rejectTitle")}
            </h3>
            <p className="text-sm text-gray-600">
              {t("adminWithdrawals.rejectMessage", {
                amount: showRejectModal.amount.toFixed(2),
                username:
                  showRejectModal.profiles?.username ||
                  t("adminWithdrawals.unknown"),
              })}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("adminWithdrawals.rejectReason")} *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={t("adminWithdrawals.rejectReasonPlaceholder")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
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
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleReject}
                disabled={
                  !rejectReason.trim() || processingIds.has(showRejectModal.id)
                }
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
