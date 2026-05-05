"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import type { FriendCandidate } from "@/types/friends";

interface AddFriendDialogProps {
  open: boolean;
  onClose: () => void;
  onSearch: (q: string, signal?: AbortSignal) => Promise<FriendCandidate[]>;
  onSendRequest: (userId: string) => Promise<void>;
  onCancelRequest: (userId: string) => Promise<void>;
  onAcceptRequest: (userId: string) => Promise<void>;
}

export default function AddFriendDialog({
  open,
  onClose,
  onSearch,
  onSendRequest,
  onCancelRequest,
  onAcceptRequest,
}: AddFriendDialogProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<FriendCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setCandidates([]);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (acRef.current) acRef.current.abort();

    if (query.trim().length < 2) {
      setCandidates([]);
      setIsLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const ac = new AbortController();
      acRef.current = ac;
      setIsLoading(true);
      setError(null);
      try {
        const results = await onSearch(query, ac.signal);
        if (!ac.signal.aborted) {
          setCandidates(results);
          setIsLoading(false);
        }
      } catch (e: unknown) {
        if (ac.signal.aborted) return;
        setError(e instanceof Error ? e.message : "Search failed");
        setIsLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (acRef.current) acRef.current.abort();
    };
  }, [query, open, onSearch]);

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleAction = async (
    candidate: FriendCandidate,
    action: "send" | "cancel" | "accept",
  ) => {
    setBusy(candidate.id, true);
    try {
      if (action === "send") await onSendRequest(candidate.id);
      else if (action === "cancel") await onCancelRequest(candidate.id);
      else if (action === "accept") await onAcceptRequest(candidate.id);

      const newStatus =
        action === "send"
          ? "pending_out"
          : action === "cancel"
            ? "none"
            : "friends";
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidate.id ? { ...c, status: newStatus } : c,
        ),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(candidate.id, false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-navy-950/95 border border-navy-800/60 rounded-2xl shadow-soft-xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-12 px-4 border-b border-navy-800/60 flex items-center justify-between bg-navy-950/60">
          <h3 className="text-gray-100 font-semibold text-sm">
            {t("friends.addFriend")}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-emerald-300 p-1 rounded-md hover:bg-navy-800/60"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-navy-800/60">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("friends.searchPlaceholder")}
            className="w-full bg-navy-900/70 border border-navy-800/60 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 outline-none focus:ring-2 focus:ring-emerald-400/40"
          />
          {query.trim().length > 0 && query.trim().length < 2 && (
            <div className="mt-2 text-xs text-gray-500">
              {t("friends.searchMinChars")}
            </div>
          )}
          {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
        </div>

        <div className="flex-1 overflow-y-auto chat-scrollbar">
          {isLoading && (
            <div className="px-4 py-3 text-xs text-gray-500">…</div>
          )}
          {!isLoading &&
            query.trim().length >= 2 &&
            candidates.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-500 text-center">
                {t("friends.noResults")}
              </div>
            )}
          {candidates.map((c) => {
            const busy = busyIds.has(c.id);
            return (
              <div
                key={c.id}
                className="px-4 py-2.5 border-b border-navy-800/40 flex items-center gap-3"
              >
                {c.avatarUrl ? (
                  <img
                    src={c.avatarUrl}
                    alt={c.username}
                    className="w-8 h-8 rounded-full object-cover shadow-soft"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold">
                    {c.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-gray-100 text-sm font-medium truncate">
                    {c.username}
                  </div>
                  {c.status === "pending_out" && (
                    <div className="text-emerald-300 text-xs">
                      {t("friends.status.pendingOut")}
                    </div>
                  )}
                  {c.status === "pending_in" && (
                    <div className="text-emerald-300 text-xs">
                      {t("friends.status.pendingIn")}
                    </div>
                  )}
                  {c.status === "friends" && (
                    <div className="text-gray-500 text-xs">
                      {t("friends.status.friends")}
                    </div>
                  )}
                </div>
                {c.status === "none" && (
                  <button
                    disabled={busy}
                    onClick={() => handleAction(c, "send")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white disabled:opacity-60"
                  >
                    {t("friends.actions.add")}
                  </button>
                )}
                {c.status === "pending_out" && (
                  <button
                    disabled={busy}
                    onClick={() => handleAction(c, "cancel")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-navy-900/60 border border-navy-800/60 text-gray-300 hover:text-white hover:border-emerald-400/40 disabled:opacity-60"
                  >
                    {t("friends.actions.cancel")}
                  </button>
                )}
                {c.status === "pending_in" && (
                  <button
                    disabled={busy}
                    onClick={() => handleAction(c, "accept")}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-500/90 hover:bg-emerald-500 text-white disabled:opacity-60"
                  >
                    {t("friends.actions.accept")}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
