"use client";

import { useState, useMemo, memo, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { useAdminEmails, type AdminEmailEntry } from "@/hooks/useAdminEmails";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />,
});

type SourceFilter = "all" | "profile" | "coming_soon";
type RegistrationFilter = "all" | "registered" | "not_registered";
type CourseFilter = "all" | "has_courses" | "no_courses";
type EmailHistoryFilter = "all" | "never_emailed" | "emailed_before";
type DeliveryStatusFilter =
  | "all"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "failed"
  | "complained"
  | "not_sent";
type RoleFilter = "all" | "student" | "lecturer" | "admin";
type SortKey =
  | "email"
  | "registered_at"
  | "enrolled_courses_count"
  | "last_email_sent_at"
  | "total_emails_sent";

function AdminEmailManager() {
  const { emails, isLoading, error, mutate } = useAdminEmails();

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [registrationFilter, setRegistrationFilter] =
    useState<RegistrationFilter>("all");
  const [courseFilter, setCourseFilter] = useState<CourseFilter>("all");
  const [emailHistoryFilter, setEmailHistoryFilter] =
    useState<EmailHistoryFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("email");
  const [sortAsc, setSortAsc] = useState(true);

  // Selection
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());

  // Compose modal
  const [showCompose, setShowCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [messageHtml, setMessageHtml] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Email history modal
  const [historyEmail, setHistoryEmail] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Resend delivery statuses
  const [resendStatuses, setResendStatuses] = useState<
    Record<string, { status: string; subject: string; date: string }>
  >({});
  const [resendLoading, setResendLoading] = useState(false);
  const [deliveryStatusFilter, setDeliveryStatusFilter] =
    useState<DeliveryStatusFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function fetchResendStatuses() {
      setResendLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) return;

        const response = await fetch("/api/admin/emails/resend-status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setResendStatuses(data.statuses || {});
      } catch {
        // Silently fail — statuses are non-critical
      } finally {
        if (!cancelled) setResendLoading(false);
      }
    }
    fetchResendStatuses();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtered + sorted emails
  const filteredEmails = useMemo(() => {
    let result = [...emails];

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (e) =>
          e.email.toLowerCase().includes(q) ||
          (e.full_name && e.full_name.toLowerCase().includes(q)) ||
          (e.username && e.username.toLowerCase().includes(q)),
      );
    }

    // Source filter
    if (sourceFilter !== "all") {
      result = result.filter(
        (e) => e.source === sourceFilter || e.source === "both",
      );
    }

    // Registration
    if (registrationFilter === "registered") {
      result = result.filter((e) => e.is_registered);
    } else if (registrationFilter === "not_registered") {
      result = result.filter((e) => !e.is_registered);
    }

    // Courses
    if (courseFilter === "has_courses") {
      result = result.filter((e) => e.has_enrollment);
    } else if (courseFilter === "no_courses") {
      result = result.filter((e) => !e.has_enrollment);
    }

    // Email history
    if (emailHistoryFilter === "never_emailed") {
      result = result.filter((e) => e.total_emails_sent === 0);
    } else if (emailHistoryFilter === "emailed_before") {
      result = result.filter((e) => e.total_emails_sent > 0);
    }

    // Role
    if (roleFilter !== "all") {
      result = result.filter((e) => e.role === roleFilter);
    }

    // Delivery status
    if (deliveryStatusFilter !== "all") {
      result = result.filter((e) => {
        const rs = resendStatuses[e.email.toLowerCase()];
        if (deliveryStatusFilter === "not_sent") return !rs;
        return rs?.status === deliveryStatusFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "registered_at":
          cmp = (a.registered_at || "").localeCompare(b.registered_at || "");
          break;
        case "enrolled_courses_count":
          cmp = a.enrolled_courses_count - b.enrolled_courses_count;
          break;
        case "last_email_sent_at":
          cmp = (a.last_email_sent_at || "").localeCompare(
            b.last_email_sent_at || "",
          );
          break;
        case "total_emails_sent":
          cmp = a.total_emails_sent - b.total_emails_sent;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [
    emails,
    search,
    sourceFilter,
    registrationFilter,
    courseFilter,
    emailHistoryFilter,
    roleFilter,
    deliveryStatusFilter,
    resendStatuses,
    sortKey,
    sortAsc,
  ]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleEmail = (email: string) => {
    setSelectedEmails((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedEmails.size === filteredEmails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(filteredEmails.map((e) => e.email)));
    }
  };

  const openCompose = () => {
    if (selectedEmails.size === 0) return;
    setShowCompose(true);
    setSendResult(null);
  };

  const closeCompose = () => {
    setShowCompose(false);
    setSubject("");
    setMessageHtml("");
    setSendResult(null);
  };

  const handleSend = useCallback(async () => {
    if (selectedEmails.size === 0) return;

    if (!subject.trim()) {
      setSendResult({ type: "error", message: "Subject is required" });
      return;
    }

    setIsSending(true);
    setSendResult(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const payload = {
        target_type: "all" as const,
        title: { en: subject.trim(), ge: "" },
        message: { en: "", ge: "" },
        channel: "email" as const,
        language: "en" as const,
        email_target: "specific" as const,
        target_emails: Array.from(selectedEmails),
        message_html: { en: messageHtml || undefined },
      };

      const response = await fetch("/api/admin/notifications/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send");

      setSendResult({
        type: "success",
        message: `Sent ${data.email_count || 0} email(s)${data.email_failed_count ? `, ${data.email_failed_count} failed` : ""}`,
      });

      mutate();
    } catch (err: any) {
      setSendResult({
        type: "error",
        message: err.message || "Failed to send",
      });
    } finally {
      setIsSending(false);
    }
  }, [selectedEmails, subject, messageHtml, mutate]);

  const fetchEmailHistory = useCallback(async (email: string) => {
    setHistoryEmail(email);
    setHistoryLoading(true);
    setHistoryData(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const response = await fetch(
        `/api/admin/emails/status?email=${encodeURIComponent(email)}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      setHistoryData(data.history || []);
    } catch {
      setHistoryData([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const sourceBadge = (source: string) => {
    switch (source) {
      case "profile":
        return (
          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
            Registered
          </span>
        );
      case "coming_soon":
        return (
          <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
            Subscriber
          </span>
        );
      case "both":
        return (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
            Both
          </span>
        );
      default:
        return null;
    }
  };

  const statusBadge = (status: string | null) => {
    if (!status) return <span className="text-xs text-gray-400">—</span>;
    const map: Record<string, { bg: string; text: string; label: string }> = {
      delivered: {
        bg: "bg-green-100",
        text: "text-green-700",
        label: "Delivered",
      },
      opened: { bg: "bg-blue-100", text: "text-blue-700", label: "Opened" },
      clicked: {
        bg: "bg-indigo-100",
        text: "text-indigo-700",
        label: "Clicked",
      },
      bounced: { bg: "bg-red-100", text: "text-red-700", label: "Bounced" },
      complained: {
        bg: "bg-orange-100",
        text: "text-orange-700",
        label: "Complained",
      },
      sent: { bg: "bg-gray-100", text: "text-gray-600", label: "Sent" },
      queued: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Queued" },
      failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
      delivery_delayed: {
        bg: "bg-yellow-100",
        text: "text-yellow-700",
        label: "Delayed",
      },
      canceled: { bg: "bg-gray-100", text: "text-gray-600", label: "Canceled" },
    };
    const s = map[status] || {
      bg: "bg-gray-100",
      text: "text-gray-600",
      label: status,
    };
    return (
      <span className={`text-xs ${s.bg} ${s.text} px-1.5 py-0.5 rounded`}>
        {s.label}
      </span>
    );
  };

  const filterSelectClass =
    "px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-navy-500 focus:border-navy-500";

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u2191" : " \u2193";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Failed to load email list: {error.message || "Unknown error"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-navy-900">Email Manager</h2>
          <p className="text-gray-600 mt-1">
            {emails.length} total emails &middot; {filteredEmails.length} shown
            &middot; {selectedEmails.size} selected
          </p>
        </div>
        <button
          type="button"
          onClick={openCompose}
          disabled={selectedEmails.size === 0}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Send Email to Selected ({selectedEmails.size})
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email, name..."
              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as SourceFilter)}
              className={filterSelectClass}
            >
              <option value="all">All Sources</option>
              <option value="profile">Registered</option>
              <option value="coming_soon">Subscribers</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Registration
            </label>
            <select
              value={registrationFilter}
              onChange={(e) =>
                setRegistrationFilter(e.target.value as RegistrationFilter)
              }
              className={filterSelectClass}
            >
              <option value="all">All</option>
              <option value="registered">Registered</option>
              <option value="not_registered">Not Registered</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Courses
            </label>
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value as CourseFilter)}
              className={filterSelectClass}
            >
              <option value="all">All</option>
              <option value="has_courses">Has Courses</option>
              <option value="no_courses">No Courses</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Email History
            </label>
            <select
              value={emailHistoryFilter}
              onChange={(e) =>
                setEmailHistoryFilter(e.target.value as EmailHistoryFilter)
              }
              className={filterSelectClass}
            >
              <option value="all">All</option>
              <option value="never_emailed">Never Emailed</option>
              <option value="emailed_before">Emailed Before</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className={filterSelectClass}
            >
              <option value="all">All Roles</option>
              <option value="student">Student</option>
              <option value="lecturer">Lecturer</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Delivery Status{resendLoading ? " ..." : ""}
            </label>
            <select
              value={deliveryStatusFilter}
              onChange={(e) =>
                setDeliveryStatusFilter(e.target.value as DeliveryStatusFilter)
              }
              className={filterSelectClass}
            >
              <option value="all">All Statuses</option>
              <option value="delivered">Delivered</option>
              <option value="opened">Opened</option>
              <option value="clicked">Clicked</option>
              <option value="bounced">Bounced</option>
              <option value="failed">Failed</option>
              <option value="complained">Complained</option>
              <option value="not_sent">Not Sent</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={
                      filteredEmails.length > 0 &&
                      selectedEmails.size === filteredEmails.length
                    }
                    onChange={toggleAll}
                    className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                  />
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-navy-900"
                  onClick={() => handleSort("email")}
                >
                  Email{sortIcon("email")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Name
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Source
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700">
                  Role
                </th>
                <th
                  className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:text-navy-900"
                  onClick={() => handleSort("enrolled_courses_count")}
                >
                  Courses{sortIcon("enrolled_courses_count")}
                </th>
                <th
                  className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:text-navy-900"
                  onClick={() => handleSort("last_email_sent_at")}
                >
                  Last Emailed{sortIcon("last_email_sent_at")}
                </th>
                <th
                  className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:text-navy-900"
                  onClick={() => handleSort("total_emails_sent")}
                >
                  Sent{sortIcon("total_emails_sent")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredEmails.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-gray-500"
                  >
                    No emails match the current filters
                  </td>
                </tr>
              ) : (
                filteredEmails.map((entry) => (
                  <tr
                    key={entry.email}
                    className={`transition-colors ${selectedEmails.has(entry.email) ? "bg-navy-50" : "hover:bg-gray-50"}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(entry.email)}
                        onChange={() => toggleEmail(entry.email)}
                        className="w-4 h-4 text-navy-600 border-gray-300 rounded focus:ring-navy-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {entry.email}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.full_name || entry.username || "-"}
                    </td>
                    <td className="px-4 py-3">{sourceBadge(entry.source)}</td>
                    <td className="px-4 py-3 text-gray-700 capitalize">
                      {entry.role || "-"}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {entry.enrolled_courses_count}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {entry.total_emails_sent > 0 ? (
                        <button
                          type="button"
                          onClick={() => fetchEmailHistory(entry.email)}
                          className="text-navy-600 hover:text-navy-800 hover:underline"
                        >
                          {formatDate(entry.last_email_sent_at)}
                        </button>
                      ) : (
                        formatDate(entry.last_email_sent_at)
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {entry.total_emails_sent}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusBadge(
                        resendStatuses[entry.email.toLowerCase()]?.status ||
                          null,
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCompose();
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-navy-900">
                Compose Email ({selectedEmails.size} recipient
                {selectedEmails.size !== 1 ? "s" : ""})
              </h3>
              <button
                type="button"
                onClick={closeCompose}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {sendResult && (
              <div
                className={`px-4 py-3 rounded-lg text-sm ${sendResult.type === "success" ? "bg-green-50 border border-green-200 text-green-700" : "bg-red-50 border border-red-200 text-red-700"}`}
              >
                {sendResult.message}
              </div>
            )}

            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                maxLength={200}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-500 focus:border-navy-500 text-gray-900"
              />
            </div>

            {/* Message body (Rich Text) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Message
              </label>
              <RichTextEditor
                content={messageHtml}
                onChange={setMessageHtml}
                placeholder="Compose your email message..."
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-200">
              <button
                type="button"
                onClick={closeCompose}
                className="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="px-6 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSending
                  ? "Sending..."
                  : `Send to ${selectedEmails.size} recipient(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email History Modal */}
      {historyEmail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setHistoryEmail(null);
              setHistoryData(null);
            }
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-navy-900">
                  Email History
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">{historyEmail}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryEmail(null);
                  setHistoryData(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
              >
                &times;
              </button>
            </div>

            {historyLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-navy-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historyData && historyData.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {historyData.map((entry: any) => (
                  <div
                    key={entry.id}
                    className="py-3 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {entry.subject}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(entry.sent_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      {statusBadge(entry.resend_status)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-500 py-8">
                No email history found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(AdminEmailManager);
