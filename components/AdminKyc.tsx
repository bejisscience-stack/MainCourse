"use client";

import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAdminKycQueue } from "@/hooks/useAdminKycQueue";
import { useKycSignedUrls } from "@/hooks/useKycSignedUrls";
import type { KycSubmission } from "@/types/kyc";

type StatusFilter = "all" | "pending" | "verified" | "rejected";

export default function AdminKyc() {
  const { t } = useI18n();
  const {
    submissions: allSubs,
    isLoading,
    error,
    approveSubmission,
    rejectSubmission,
  } = useAdminKycQueue();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [showRejectModal, setShowRejectModal] = useState<KycSubmission | null>(
    null,
  );
  const [showApproveModal, setShowApproveModal] =
    useState<KycSubmission | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNotes, setApproveNotes] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered =
    statusFilter === "all"
      ? allSubs
      : allSubs.filter((s) => s.status === statusFilter);

  const counts = {
    all: allSubs.length,
    pending: allSubs.filter((s) => s.status === "pending").length,
    verified: allSubs.filter((s) => s.status === "verified").length,
    rejected: allSubs.filter((s) => s.status === "rejected").length,
  };

  const docTypeLabel = (type: string) => {
    if (type === "id_card") return t("adminKyc.docTypeIdCard") || "ID Card";
    if (type === "passport") return t("adminKyc.docTypePassport") || "Passport";
    if (type === "drivers_license")
      return t("adminKyc.docTypeDriversLicense") || "Driver's License";
    return type;
  };

  const handleApprove = async () => {
    if (!showApproveModal) return;
    const id = showApproveModal.id;
    setProcessingIds((prev) => new Set(prev).add(id));
    setActionError(null);
    try {
      await approveSubmission(id, approveNotes || undefined);
      setShowApproveModal(null);
      setApproveNotes("");
    } catch (err: any) {
      setActionError(err.message || t("adminKyc.approveError"));
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
      await rejectSubmission(id, rejectReason.trim());
      setShowRejectModal(null);
      setRejectReason("");
    } catch (err: any) {
      setActionError(err.message || t("adminKyc.rejectError"));
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
      verified: "bg-green-100 text-green-800",
      rejected: "bg-red-100 text-red-800",
    };
    const label =
      status === "pending"
        ? t("adminKyc.statusPending") || "Pending"
        : status === "verified"
          ? t("adminKyc.statusVerified") || "Verified"
          : status === "rejected"
            ? t("adminKyc.statusRejected") || "Rejected"
            : status.charAt(0).toUpperCase() + status.slice(1);
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}
      >
        {label}
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
            ["all", t("adminKyc.filterAll") || "All"],
            ["pending", t("adminKyc.filterPending") || "Pending"],
            ["verified", t("adminKyc.filterVerified") || "Verified"],
            ["rejected", t("adminKyc.filterRejected") || "Rejected"],
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
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-lg">
            {statusFilter === "all"
              ? t("adminKyc.noSubmissions") || "No KYC submissions yet."
              : t("adminKyc.noSubmissionsForFilter", {
                  status: statusFilter,
                }) || `No ${statusFilter} submissions.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.username") || "Username"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.email") || "Email"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.docType") || "Document"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.phone") || "Phone"}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.status") || "Status"}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.submittedAt") || "Submitted"}
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t("adminKyc.actions") || "Actions"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((sub) => (
                  <SubmissionRow
                    key={sub.id}
                    sub={sub}
                    expanded={expandedId === sub.id}
                    onToggle={() =>
                      setExpandedId(expandedId === sub.id ? null : sub.id)
                    }
                    docTypeLabel={docTypeLabel}
                    statusBadge={statusBadge}
                    formatDate={formatDate}
                    processing={processingIds.has(sub.id)}
                    onApproveClick={() => {
                      setShowApproveModal(sub);
                      setApproveNotes("");
                      setActionError(null);
                    }}
                    onRejectClick={() => {
                      setShowRejectModal(sub);
                      setRejectReason("");
                      setActionError(null);
                    }}
                  />
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
              {t("adminKyc.approveTitle") || "Approve KYC submission?"}
            </h3>
            <p className="text-sm text-gray-600">
              {t("adminKyc.approveMessage", {
                username:
                  showApproveModal.profiles?.username ||
                  t("adminKyc.unknown") ||
                  "user",
              }) ||
                `Approve identity verification for ${showApproveModal.profiles?.username || "user"}?`}
            </p>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder={
                t("adminKyc.approveNotesPlaceholder") ||
                "Optional notes for internal records"
              }
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
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleApprove}
                disabled={processingIds.has(showApproveModal.id)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processingIds.has(showApproveModal.id)
                  ? t("adminKyc.processing") || "Processing..."
                  : t("adminKyc.confirmApprove") || "Approve"}
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
              {t("adminKyc.rejectTitle") || "Reject KYC submission?"}
            </h3>
            <p className="text-sm text-gray-600">
              {t("adminKyc.rejectMessage", {
                username:
                  showRejectModal.profiles?.username ||
                  t("adminKyc.unknown") ||
                  "user",
              }) ||
                `Reject identity verification for ${showRejectModal.profiles?.username || "user"}?`}
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("adminKyc.rejectReason") || "Reason"} *
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder={
                  t("adminKyc.rejectReasonPlaceholder") ||
                  "Explain why this submission is being rejected"
                }
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                rows={3}
                required
              />
              {rejectReason.length === 0 && (
                <p className="text-xs text-red-500 mt-1">
                  {t("adminKyc.rejectReasonRequired") ||
                    "A reason is required."}
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
                {t("common.cancel") || "Cancel"}
              </button>
              <button
                onClick={handleReject}
                disabled={
                  !rejectReason.trim() || processingIds.has(showRejectModal.id)
                }
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processingIds.has(showRejectModal.id)
                  ? t("adminKyc.processing") || "Processing..."
                  : t("adminKyc.confirmReject") || "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  sub: KycSubmission;
  expanded: boolean;
  onToggle: () => void;
  docTypeLabel: (type: string) => string;
  statusBadge: (status: string) => React.ReactNode;
  formatDate: (s: string) => string;
  processing: boolean;
  onApproveClick: () => void;
  onRejectClick: () => void;
}

function SubmissionRow({
  sub,
  expanded,
  onToggle,
  docTypeLabel,
  statusBadge,
  formatDate,
  processing,
  onApproveClick,
  onRejectClick,
}: RowProps) {
  const { t } = useI18n();
  // Lazy: only fetch signed URLs when this row is expanded
  const {
    frontUrl,
    backUrl,
    selfieUrl,
    isLoading: urlsLoading,
  } = useKycSignedUrls(expanded ? sub.id : null);

  return (
    <>
      <tr
        className="hover:bg-gray-50 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-sm font-medium text-gray-900">
          {sub.profiles?.username || t("adminKyc.unknown") || "—"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">
          {sub.profiles?.email || "—"}
        </td>
        <td className="px-4 py-3 text-sm text-gray-700">
          {docTypeLabel(sub.doc_type)}
        </td>
        <td className="px-4 py-3 text-sm font-mono text-gray-700">
          {sub.phone}
        </td>
        <td className="px-4 py-3 text-center">{statusBadge(sub.status)}</td>
        <td className="px-4 py-3 text-sm text-gray-500">
          {formatDate(sub.created_at)}
        </td>
        <td
          className="px-4 py-3 text-center"
          onClick={(e) => e.stopPropagation()}
        >
          {sub.status === "pending" ? (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onApproveClick}
                disabled={processing}
                className="px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {processing
                  ? t("adminKyc.processing") || "Processing..."
                  : t("adminKyc.approve") || "Approve"}
              </button>
              <button
                onClick={onRejectClick}
                disabled={processing}
                className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {t("adminKyc.reject") || "Reject"}
              </button>
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              {sub.admin_notes && (
                <p
                  className="text-gray-500 italic max-w-[200px] truncate"
                  title={sub.admin_notes}
                >
                  {sub.admin_notes}
                </p>
              )}
              {sub.reviewed_at && <p>{formatDate(sub.reviewed_at)}</p>}
            </div>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={7} className="bg-gray-50 px-4 py-4">
            {urlsLoading ? (
              <p className="text-sm text-gray-500">
                {t("adminKyc.loadingSignedUrls") || "Loading documents..."}
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <DocPreview
                  label={t("adminKyc.docFront") || "Front"}
                  url={frontUrl}
                />
                {sub.doc_type !== "passport" && (
                  <DocPreview
                    label={t("adminKyc.docBack") || "Back"}
                    url={backUrl}
                  />
                )}
                <DocPreview
                  label={t("adminKyc.selfie") || "Selfie"}
                  url={selfieUrl}
                />
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function DocPreview({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3">
        <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
        <div className="h-48 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
          —
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-500 mb-2">{label}</p>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="h-48 w-full object-contain rounded bg-gray-50"
        />
      </a>
    </div>
  );
}
