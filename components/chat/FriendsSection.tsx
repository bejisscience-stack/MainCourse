'use client';

import { useState, useCallback, useEffect } from 'react';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useFriendships } from '@/hooks/useFriendships';
import { useDMConversations } from '@/hooks/useDMConversations';
import { useRealtimeFriends } from '@/hooks/useRealtimeFriends';
import type { DMConversation } from '@/types/dm';

interface FriendsSectionProps {
  currentUserId: string;
  activeConversationId: string | null;
  onConversationSelect: (conversationId: string, friendUsername: string) => void;
  onAddFriend: () => void;
}

export default function FriendsSection({
  currentUserId,
  activeConversationId,
  onConversationSelect,
  onAddFriend,
}: FriendsSectionProps) {
  const [sectionExpanded, setSectionExpanded] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('friendsSectionExpanded');
      return stored !== null ? stored === 'true' : true;
    }
    return true;
  });
  const [requestsExpanded, setRequestsExpanded] = useState(true);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const [removingFriendId, setRemovingFriendId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('friendsSectionExpanded', String(sectionExpanded));
    }
  }, [sectionExpanded]);

  const {
    sent,
    received,
    mutate: mutateFriendRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    isSubmitting: isRequestSubmitting,
  } = useFriendRequests(currentUserId);

  const {
    friendships,
    mutate: mutateFriendships,
    removeFriend,
  } = useFriendships(currentUserId);

  const {
    conversations,
    mutate: mutateConversations,
    getOrCreateConversation,
  } = useDMConversations(currentUserId);

  useRealtimeFriends({
    userId: currentUserId,
    onFriendRequestChange: () => {
      mutateFriendRequests();
    },
    onFriendshipChange: () => {
      mutateFriendships();
      mutateConversations();
    },
  });

  const totalPendingRequests = sent.length + received.length;

  const conversationFriendIds = new Set(conversations.map(c => c.friendId));
  const friendsWithoutConvo = friendships.filter(f => !conversationFriendIds.has(f.friendId));

  const handleFriendClick = useCallback(async (friendId: string, friendUsername: string) => {
    try {
      const convo = await getOrCreateConversation(friendId);
      onConversationSelect(convo.id, friendUsername);
    } catch (err) {
      console.error('Failed to open conversation:', err);
    }
  }, [getOrCreateConversation, onConversationSelect]);

  const handleRemoveFriend = useCallback(async (friendshipId: string) => {
    setRemovingFriendId(friendshipId);
    try {
      await removeFriend(friendshipId);
    } catch (err) {
      console.error('Failed to remove friend:', err);
    } finally {
      setRemovingFriendId(null);
    }
  }, [removeFriend]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div>
      {/* Section Header */}
      <div className="w-full flex items-center justify-between px-1 py-1.5 text-gray-500 hover:text-emerald-300 text-[11px] font-semibold uppercase tracking-wider group cursor-pointer">
        <button
          onClick={() => setSectionExpanded(!sectionExpanded)}
          className="flex-1 flex items-center gap-1 text-left"
        >
          <svg
            className={`w-3 h-3 transition-transform duration-200 ${sectionExpanded ? 'rotate-90' : ''}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          <span>Friends &amp; DMs</span>
          {totalPendingRequests > 0 && (
            <span className="bg-amber-500/90 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-auto shadow-soft">
              {totalPendingRequests}
            </span>
          )}
        </button>
        <button
          onClick={onAddFriend}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-300 p-0.5 rounded-md hover:bg-navy-800/60"
          title="Add Friend"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        </button>
      </div>

      {sectionExpanded && (
        <div>
          {/* Pending Friend Requests */}
          {totalPendingRequests > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setRequestsExpanded(!requestsExpanded)}
                className="w-full flex items-center gap-1 px-1 py-1.5 text-gray-500 hover:text-emerald-300 text-[11px] font-semibold uppercase tracking-wider"
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${requestsExpanded ? 'rotate-90' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span>Pending Requests</span>
                <span className="bg-amber-500/90 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-auto shadow-soft">
                  {totalPendingRequests}
                </span>
              </button>

              {requestsExpanded && (
                <div className="space-y-1 mt-1">
                  {received.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-navy-900/30 border border-navy-800/40"
                    >
                      <div className="w-7 h-7 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {req.senderUsername?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="flex-1 text-gray-200 text-xs font-medium truncate">
                        {req.senderUsername || 'User'}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => acceptFriendRequest(req.id)}
                          disabled={isRequestSubmitting}
                          className="text-emerald-300 hover:text-emerald-200 p-1 rounded hover:bg-emerald-500/15 transition-colors disabled:opacity-50"
                          title="Accept"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => rejectFriendRequest(req.id)}
                          disabled={isRequestSubmitting}
                          className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-500/15 transition-colors disabled:opacity-50"
                          title="Reject"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}

                  {sent.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-navy-900/30 border border-navy-800/40"
                    >
                      <div className="w-7 h-7 rounded-full bg-navy-700/70 flex items-center justify-center text-gray-300 text-xs font-semibold flex-shrink-0">
                        {req.receiverUsername?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <span className="flex-1 text-gray-300 text-xs font-medium truncate">
                        {req.receiverUsername || 'User'}
                      </span>
                      <span className="text-amber-300/70 text-[10px] mr-1">Pending</span>
                      <button
                        onClick={() => cancelFriendRequest(req.id)}
                        disabled={isRequestSubmitting}
                        className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors disabled:opacity-50"
                        title="Cancel request"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DM Conversations */}
          {conversations.length > 0 && (
            <div className="mb-3">
              <div className="px-1 py-1.5 text-gray-500 text-[11px] font-semibold uppercase tracking-wider">
                Conversations
              </div>
              <div className="space-y-0.5">
                {conversations.map((convo: DMConversation) => {
                  const isActive = activeConversationId === convo.id;
                  return (
                    <button
                      key={convo.id}
                      onClick={() => onConversationSelect(convo.id, convo.friendUsername)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all border border-transparent ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft'
                          : 'text-gray-400 hover:bg-navy-800/40 hover:text-gray-200 hover:border-navy-700/50'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {convo.friendUsername?.charAt(0).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-medium truncate ${isActive ? 'text-emerald-200' : 'text-gray-200'}`}>
                            {convo.friendUsername}
                          </span>
                          {convo.lastMessageAt && (
                            <span className="text-[10px] text-gray-500 flex-shrink-0">
                              {formatTime(convo.lastMessageAt)}
                            </span>
                          )}
                        </div>
                      </div>
                      {isActive && (
                        <div className="w-1 h-4 bg-emerald-400 rounded-full flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Friends without conversations */}
          {friendsWithoutConvo.length > 0 && (
            <div className="mb-3">
              <button
                onClick={() => setFriendsExpanded(!friendsExpanded)}
                className="w-full flex items-center gap-1 px-1 py-1.5 text-gray-500 hover:text-emerald-300 text-[11px] font-semibold uppercase tracking-wider"
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${friendsExpanded ? 'rotate-90' : ''}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span>Friends</span>
              </button>

              {friendsExpanded && (
                <div className="space-y-0.5 mt-1">
                  {friendsWithoutConvo.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm text-gray-400 hover:bg-navy-800/40 hover:text-gray-200 transition-all group"
                    >
                      <button
                        onClick={() => handleFriendClick(friend.friendId, friend.friendUsername)}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                      >
                        <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                          {friend.friendUsername?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span className="text-sm font-medium truncate text-gray-300">
                          {friend.friendUsername}
                        </span>
                      </button>
                      <button
                        onClick={() => handleRemoveFriend(friend.id)}
                        disabled={removingFriendId === friend.id}
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-all disabled:opacity-50"
                        title="Remove friend"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {conversations.length === 0 && friendships.length === 0 && totalPendingRequests === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-gray-500">
              <svg className="w-10 h-10 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-xs text-gray-300 mb-1">No friends yet</p>
              <button
                onClick={onAddFriend}
                className="text-emerald-200 text-xs font-medium px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/40 rounded-lg hover:bg-emerald-500/25 transition-colors"
              >
                Add Friend
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
