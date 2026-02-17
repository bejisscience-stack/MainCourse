'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import { useFriendRequests } from '@/hooks/useFriendRequests';

interface AddFriendDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

interface SearchResult {
  id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
}

type SearchMode = 'username' | 'email';

export default function AddFriendDialog({ isOpen, onClose, currentUserId }: AddFriendDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [searchMode, setSearchMode] = useState<SearchMode>('username');
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const { sent, received, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, isSubmitting } = useFriendRequests(currentUserId);

  // Track friend IDs for status display
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const pendingSentIds = new Set(sent.map(r => r.receiverId));
  const pendingReceivedMap = new Map(received.map(r => [r.senderId, r.id]));

  useEffect(() => {
    setMounted(true);
    return () => {
      setMounted(false);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Load existing friends
  useEffect(() => {
    if (!isOpen || !currentUserId) return;

    (async () => {
      const [asUser1, asUser2] = await Promise.all([
        supabase.from('friendships').select('user2_id').eq('user1_id', currentUserId),
        supabase.from('friendships').select('user1_id').eq('user2_id', currentUserId),
      ]);

      const ids = new Set<string>();
      (asUser1.data || []).forEach((r: any) => ids.add(r.user2_id));
      (asUser2.data || []).forEach((r: any) => ids.add(r.user1_id));
      setFriendIds(ids);
    })();
  }, [isOpen, currentUserId]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setSearchQuery('');
      setResults([]);
      setSuccessMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  const searchUsers = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      if (searchMode === 'email') {
        // Use RPC to search by email — joins auth.users for reliable results
        const { data, error } = await supabase.rpc('search_users_by_email', {
          search_query: query,
          exclude_user_id: currentUserId,
          result_limit: 10,
        });

        if (error) throw error;
        setResults(data || []);
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, email, avatar_url')
          .ilike('username', `%${query}%`)
          .neq('id', currentUserId)
          .limit(10);

        if (error) throw error;
        setResults(data || []);
      }
    } catch (err) {
      console.error('Search error:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [currentUserId, searchMode]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setSuccessMessage(null);
    setErrorMessage(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(value), 300);
  };

  const handleSendRequest = async (userId: string, username: string) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (userId === currentUserId) {
      setErrorMessage("You can't send a friend request to yourself.");
      return;
    }

    try {
      await sendFriendRequest(userId);
      setSuccessMessage(`Friend request sent to ${username}!`);
    } catch (err: any) {
      const msg = err.message || 'Failed to send request';
      if (msg.includes('duplicate') || msg.includes('unique') || msg.includes('already exists')) {
        setErrorMessage('A friend request already exists for this user.');
      } else {
        setErrorMessage(msg);
      }
    }
  };

  const handleAcceptRequest = async (requestId: string, username: string) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await acceptFriendRequest(requestId);
      setSuccessMessage(`You are now friends with ${username}!`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to accept request');
    }
  };

  const handleRejectRequest = async (requestId: string, username: string) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      await rejectFriendRequest(requestId);
      setSuccessMessage(`Friend request from ${username} declined.`);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to decline request');
    }
  };

  const getStatus = (userId: string): 'friend' | 'pending_sent' | 'pending_received' | 'available' => {
    if (friendIds.has(userId)) return 'friend';
    if (pendingSentIds.has(userId)) return 'pending_sent';
    if (pendingReceivedMap.has(userId)) return 'pending_received';
    return 'available';
  };

  // Re-trigger search when mode changes
  useEffect(() => {
    if (searchQuery.length >= 2) {
      searchUsers(searchQuery);
    }
  }, [searchMode]);

  if (!isOpen || !mounted) return null;

  const dialog = (
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
            className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-navy-800/60"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search mode toggle + input */}
        <div className="px-6 py-4">
          {/* Search mode toggle */}
          <div className="flex gap-1 mb-3 p-1 bg-navy-900/60 rounded-lg">
            <button
              onClick={() => setSearchMode('username')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                searchMode === 'username'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Username
            </button>
            <button
              onClick={() => setSearchMode('email')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                searchMode === 'email'
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Email
            </button>
          </div>

          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={searchMode === 'email' ? 'Search by email...' : 'Search by username...'}
              className="w-full pl-10 pr-4 py-2.5 bg-navy-900/70 border border-navy-800/60 rounded-xl text-gray-100 placeholder-gray-500 text-sm focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
            />
          </div>
          <p className="text-gray-500 text-xs mt-2">Enter at least 2 characters to search</p>
        </div>

        {/* Feedback messages */}
        {successMessage && (
          <div className="mx-6 mb-3 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm rounded-xl">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="mx-6 mb-3 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-200 text-sm rounded-xl">
            {errorMessage}
          </div>
        )}

        {/* Results */}
        <div className="px-6 pb-6 max-h-64 overflow-y-auto chat-scrollbar">
          {isSearching && (
            <div className="flex items-center justify-center py-4 text-gray-400 text-sm">
              <svg className="w-4 h-4 animate-spin mr-2" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Searching...
            </div>
          )}

          {!isSearching && searchQuery.length >= 2 && results.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No users found matching &ldquo;{searchQuery}&rdquo;
            </div>
          )}

          {results.map((user) => {
            const status = getStatus(user.id);
            const receivedRequestId = pendingReceivedMap.get(user.id);
            return (
              <div
                key={user.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-navy-800/40 transition-colors"
              >
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                  {user.username?.charAt(0).toUpperCase() || 'U'}
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <span className="text-gray-200 text-sm font-medium truncate block">
                    {user.username}
                  </span>
                  {searchMode === 'email' && user.email && (
                    <span className="text-gray-500 text-xs truncate block">
                      {user.email}
                    </span>
                  )}
                </div>

                {/* Action */}
                {status === 'friend' && (
                  <span className="text-emerald-300 text-xs font-medium px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Friends
                  </span>
                )}
                {status === 'pending_sent' && (
                  <span className="text-amber-300 text-xs font-medium px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                    Request Sent
                  </span>
                )}
                {status === 'pending_received' && receivedRequestId && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleAcceptRequest(receivedRequestId, user.username)}
                      disabled={isSubmitting}
                      className="text-emerald-200 text-xs font-medium px-2.5 py-1.5 bg-emerald-500/15 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRejectRequest(receivedRequestId, user.username)}
                      disabled={isSubmitting}
                      className="text-red-200 text-xs font-medium px-2.5 py-1.5 bg-red-500/15 border border-red-500/40 rounded-lg hover:bg-red-500/25 transition-colors disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                )}
                {status === 'available' && (
                  <button
                    onClick={() => handleSendRequest(user.id, user.username)}
                    disabled={isSubmitting}
                    className="text-emerald-200 text-xs font-medium px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                  >
                    Send Request
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
