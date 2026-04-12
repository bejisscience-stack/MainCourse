"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { normalizeProfileUsername } from "@/lib/username";

interface AddFriendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSendRequest: (userId: string) => Promise<void>;
  currentUserId: string;
  existingFriendIds: string[];
}

interface SearchResult {
  id: string;
  username: string;
  avatarUrl: string;
  role?: string;
}

export default function AddFriendDialog({
  isOpen,
  onClose,
  onSendRequest,
  currentUserId,
  existingFriendIds,
}: AddFriendDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery("");
      setResults([]);
      setSentTo(new Set());
      setError(null);
    }
  }, [isOpen]);

  const searchUsers = useCallback(
    async (searchQuery: string) => {
      if (searchQuery.trim().length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const { data, error: searchError } = await supabase
          .from("profiles")
          .select("id, username, avatar_url, role")
          .ilike("username", `%${searchQuery.trim()}%`)
          .neq("id", currentUserId)
          .limit(10);

        if (searchError) throw searchError;

        setResults(
          (data || []).map((p: any) => ({
            id: p.id,
            username: normalizeProfileUsername(p),
            avatarUrl: p.avatar_url || "",
            role: p.role,
          })),
        );
      } catch (err: any) {
        console.error("Search error:", err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [currentUserId],
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(value), 300);
  };

  const handleSendRequest = async (userId: string) => {
    setSendingTo(userId);
    setError(null);
    try {
      await onSendRequest(userId);
      setSentTo((prev) => new Set(prev).add(userId));
    } catch (err: any) {
      setError(err.message || "Failed to send request");
    } finally {
      setSendingTo(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-navy-950/95 border border-navy-800/60 rounded-2xl shadow-soft-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-navy-800/60 flex items-center justify-between">
          <h2 className="text-gray-100 font-semibold text-lg">Add Friend</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 p-1 rounded-lg hover:bg-navy-800/60 transition-colors"
          >
            <svg
              className="w-5 h-5"
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

        {/* Search input */}
        <div className="px-6 py-4">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search by username..."
              className="w-full pl-10 pr-4 py-2.5 bg-navy-900/70 border border-navy-800/60 rounded-xl text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-500/50 transition-all"
            />
          </div>
          {error && <p className="mt-2 text-red-400 text-xs">{error}</p>}
        </div>

        {/* Results */}
        <div className="px-6 pb-6 max-h-80 overflow-y-auto chat-scrollbar">
          {isSearching && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
            </div>
          )}

          {!isSearching && query.length >= 2 && results.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No users found
            </div>
          )}

          {!isSearching && results.length > 0 && (
            <div className="space-y-1">
              {results.map((user) => {
                const isFriend = existingFriendIds.includes(user.id);
                const isSent = sentTo.has(user.id);
                const isSending = sendingTo === user.id;

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-navy-800/40 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-navy-900/70 border border-navy-800/60 flex items-center justify-center text-xs font-semibold text-emerald-200 overflow-hidden flex-shrink-0">
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.username}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        user.username.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-gray-200 text-sm font-medium truncate">
                        {user.username}
                      </div>
                      {user.role && user.role !== "student" && (
                        <div className="text-[11px] text-emerald-400/80 capitalize">
                          {user.role}
                        </div>
                      )}
                    </div>
                    {isFriend ? (
                      <span className="text-xs text-gray-500 px-3 py-1">
                        Already friends
                      </span>
                    ) : isSent ? (
                      <span className="text-xs text-emerald-400 px-3 py-1 flex items-center gap-1">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        Sent
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSendRequest(user.id)}
                        disabled={isSending}
                        className="text-xs text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all disabled:opacity-50"
                      >
                        {isSending ? (
                          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-emerald-400" />
                        ) : (
                          "Add Friend"
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!isSearching && query.length < 2 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
