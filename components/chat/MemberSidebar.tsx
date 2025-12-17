'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useFriends } from '@/hooks/useFriends';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import type { Member } from '@/types/member';

interface MemberSidebarProps {
  members: Member[];
  onlineMembers: Member[];
  offlineMembers: Member[];
  onCollapse?: () => void;
}

export default function MemberSidebar({
  members,
  onlineMembers,
  offlineMembers,
  onCollapse,
}: MemberSidebarProps) {
  const [friendRequestsExpanded, setFriendRequestsExpanded] = useState(true);
  const [friendsExpanded, setFriendsExpanded] = useState(true);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedFriendId, setExpandedFriendId] = useState<string | null>(null);
  
  const { friends, removeFriend, isLoading: friendsLoading, error: friendsError } = useFriends();
  const { sentRequests, receivedRequests, acceptRequest, rejectRequest, cancelRequest, isLoading: requestsLoading, error: requestsError, refetch: refetchRequests } = useFriendRequests();

  // Debug logging
  useEffect(() => {
    if (receivedRequests.length > 0) {
      console.log('Received requests in component:', receivedRequests.map(r => ({ 
        id: r.id, 
        sender_id: r.sender_id,
        username: r.user?.username, 
        hasUser: !!r.user,
        userObject: r.user 
      })));
    }
    if (sentRequests.length > 0) {
      console.log('Sent requests in component:', sentRequests.map(r => ({ 
        id: r.id, 
        receiver_id: r.receiver_id,
        username: r.user?.username, 
        hasUser: !!r.user,
        userObject: r.user 
      })));
    }
  }, [receivedRequests, sentRequests]);

  const getStatusColor = (status: Member['status']) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'away':
        return 'bg-yellow-500';
      case 'busy':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      await acceptRequest(requestId);
    } catch (error) {
      console.error('Failed to accept friend request:', error);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await rejectRequest(requestId);
    } catch (error) {
      console.error('Failed to reject friend request:', error);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    try {
      await cancelRequest(requestId);
    } catch (error) {
      console.error('Failed to cancel friend request:', error);
    }
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (confirm('Are you sure you want to remove this friend?')) {
      try {
        await removeFriend(friendId);
      } catch (error) {
        console.error('Failed to remove friend:', error);
      }
    }
  };

  return (
    <div className="w-full h-full bg-gray-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center gap-2 flex-shrink-0">
        <input
          type="text"
          placeholder="Search"
          className="bg-gray-700 text-gray-300 text-sm px-3 py-1.5 rounded flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="text-gray-400 hover:text-gray-300 transition-colors p-1 flex-shrink-0"
            title="Collapse members"
          >
            <svg
              className="w-4 h-4 transition-transform rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Members list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
        {/* Friend Requests Section - Always show */}
        <div className="mb-4">
          <div className="w-full px-2 py-1 text-gray-400 text-xs font-semibold uppercase tracking-wide flex items-center justify-between">
            <button
              onClick={() => setFriendRequestsExpanded(!friendRequestsExpanded)}
              className="flex items-center gap-2 hover:text-gray-300 transition-colors flex-1"
            >
              <span>
                Friend Requests — {sentRequests.length + receivedRequests.length}
              </span>
              <svg
                className={`w-3 h-3 transition-transform ${friendRequestsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => refetchRequests()}
              disabled={requestsLoading}
              className="p-1 text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
              title="Refresh friend requests"
            >
              <svg className={`w-3 h-3 ${requestsLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          
          {friendRequestsExpanded && (
            <div className="mt-1 space-y-1">
              {requestsLoading ? (
                <div className="px-2 py-2 text-xs text-gray-500 text-center">
                  Loading requests...
                </div>
              ) : requestsError ? (
                <div className="px-2 py-2 text-xs text-red-400 text-center space-y-2">
                  <div>Error loading requests</div>
                  <button
                    onClick={() => refetchRequests()}
                    className="text-indigo-400 hover:text-indigo-300 underline text-xs"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {/* Received Requests */}
                  {receivedRequests.length > 0 ? (
                receivedRequests.map((request) => (
                  <div key={request.id} className="mb-1">
                    <div
                      className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 group cursor-pointer"
                      onClick={(e) => {
                        // Only expand if clicking on the main area, not buttons
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.tagName === 'BUTTON' || target.closest('svg') || target.closest('path')) {
                          return;
                        }
                        const newExpandedId = expandedRequestId === request.id ? null : request.id;
                        console.log('Expanding request:', newExpandedId);
                        setExpandedRequestId(newExpandedId);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {request.user?.avatarUrl ? (
                          <img
                            src={request.user.avatarUrl}
                            alt={request.user?.username || 'User'}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          (request.user?.username && request.user.username !== 'User' ? request.user.username : request.user?.email?.charAt(0) || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-300 truncate font-medium" title={request.user?.username || request.user?.email || ''}>
                          {request.user?.username && request.user.username !== 'User' ? request.user.username : (request.user?.email ? request.user.email.split('@')[0] : 'User')}
                        </div>
                        <div className="text-xs text-gray-500">Wants to be friends</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptRequest(request.id);
                          }}
                          className="p-1 text-green-400 hover:text-green-300 hover:bg-gray-600 rounded transition-colors"
                          title="Accept"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectRequest(request.id);
                          }}
                          className="p-1 text-red-400 hover:text-red-300 hover:bg-gray-600 rounded transition-colors"
                          title="Reject"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRequestId(expandedRequestId === request.id ? null : request.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded transition-colors"
                          title="View profile"
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform ${expandedRequestId === request.id ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Expanded Profile View - Received Requests */}
                    {expandedRequestId === request.id && (
                      <div className="px-2 py-2 ml-10 mr-2 mb-2 bg-gray-700/50 rounded border border-gray-600 animate-in fade-in duration-200">
                        <div className="space-y-1.5">
                          {request.user ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-16">Username:</span>
                                <span className="text-sm text-gray-200 font-medium">
                                  {request.user?.username && request.user.username !== 'User' 
                                    ? request.user.username 
                                    : (request.user?.email ? request.user.email.split('@')[0] : 'Not available')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-16">Email:</span>
                                <span className="text-sm text-gray-300">
                                  {request.user?.email || 'Not available'}
                                </span>
                              </div>
                              <div className="pt-2 border-t border-gray-600 flex items-center gap-2">
                                <button
                                  onClick={() => handleAcceptRequest(request.id)}
                                  className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Accept
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.id)}
                                  className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded transition-colors flex items-center justify-center gap-1"
                                >
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                  Reject
                                </button>
                              </div>
                              <div className="pt-1">
                                <div className="text-xs text-gray-400">Request sent: {new Date(request.created_at).toLocaleDateString()}</div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-400">Loading profile...</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-gray-500 text-center">
                  No incoming requests
                </div>
              )}
              
              {/* Sent Requests */}
              {sentRequests.length > 0 ? (
                sentRequests.map((request) => (
                  <div key={request.id} className="mb-1">
                    <div
                      className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 group opacity-75 cursor-pointer"
                      onClick={(e) => {
                        // Only expand if clicking on the main area, not buttons
                        const target = e.target as HTMLElement;
                        if (target.closest('button') || target.tagName === 'BUTTON' || target.closest('svg') || target.closest('path')) {
                          return;
                        }
                        const newExpandedId = expandedRequestId === request.id ? null : request.id;
                        console.log('Expanding request:', newExpandedId);
                        setExpandedRequestId(newExpandedId);
                      }}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {request.user?.avatarUrl ? (
                          <img
                            src={request.user.avatarUrl}
                            alt={request.user?.username || 'User'}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          (request.user?.username && request.user.username !== 'User' ? request.user.username : request.user?.email?.charAt(0) || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-300 truncate font-medium" title={request.user?.username || request.user?.email || ''}>
                          {request.user?.username && request.user.username !== 'User' ? request.user.username : (request.user?.email ? request.user.email.split('@')[0] : 'User')}
                        </div>
                        <div className="text-xs text-gray-500">Request sent</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRequestId(expandedRequestId === request.id ? null : request.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded transition-colors"
                          title="View profile"
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform ${expandedRequestId === request.id ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRequest(request.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors"
                          title="Cancel request"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Expanded Profile View */}
                    {expandedRequestId === request.id && (
                      <div className="px-2 py-2 ml-10 mr-2 mb-2 bg-gray-700/50 rounded border border-gray-600 animate-in fade-in duration-200">
                        <div className="space-y-1.5">
                          {request.user ? (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-16">Username:</span>
                                <span className="text-sm text-gray-200 font-medium">
                                  {request.user?.username && request.user.username !== 'User' 
                                    ? request.user.username 
                                    : (request.user?.email ? request.user.email.split('@')[0] : 'Not available')}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-16">Email:</span>
                                <span className="text-sm text-gray-300">
                                  {request.user?.email || 'Not available'}
                                </span>
                              </div>
                              <div className="pt-1 border-t border-gray-600">
                                <div className="text-xs text-gray-400">Request sent: {new Date(request.created_at).toLocaleDateString()}</div>
                              </div>
                            </>
                          ) : (
                            <div className="text-xs text-gray-400">Loading profile...</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-2 py-2 text-xs text-gray-500 text-center">
                  No sent requests
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Friends Section - Always show */}
        <div className="mb-4">
            <button
              onClick={() => setFriendsExpanded(!friendsExpanded)}
              className="w-full px-2 py-1 text-gray-400 text-xs font-semibold uppercase tracking-wide flex items-center justify-between hover:text-gray-300 transition-colors"
            >
              <span>Friends — {friends.length}</span>
              <svg
                className={`w-3 h-3 transition-transform ${friendsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {friendsExpanded && (
              <div className="mt-1 space-y-1">
                {friendsLoading ? (
                  <div className="px-2 py-2 text-xs text-gray-500 text-center">
                    Loading friends...
                  </div>
                ) : friendsError ? (
                  <div className="px-2 py-2 text-xs text-red-400 text-center">
                    Error loading friends
                  </div>
                ) : friends.length > 0 ? (
                  friends.map((friend) => (
                  <div key={friend.id} className="mb-1">
                    <div
                      className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 group cursor-pointer"
                      onClick={() => setExpandedFriendId(expandedFriendId === friend.id ? null : friend.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                        {friend.avatarUrl ? (
                          <img
                            src={friend.avatarUrl}
                            alt={friend.username || 'Friend'}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          (friend.username || 'F').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-300 truncate font-medium">
                          {friend.username || 'User'}
                        </div>
                        {friend.commonCourses > 0 && (
                          <div className="text-xs text-gray-500">
                            {friend.commonCourses} {friend.commonCourses === 1 ? 'course' : 'courses'} in common
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedFriendId(expandedFriendId === friend.id ? null : friend.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-300 hover:bg-gray-600 rounded transition-colors"
                          title="View profile"
                        >
                          <svg 
                            className={`w-4 h-4 transition-transform ${expandedFriendId === friend.id ? 'rotate-180' : ''}`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFriend(friend.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-600 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Remove friend"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    {/* Expanded Profile View */}
                    {expandedFriendId === friend.id && (
                      <div className="px-2 py-2 ml-10 mr-2 mb-2 bg-gray-700/50 rounded border border-gray-600">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16">Username:</span>
                            <span className="text-sm text-gray-200 font-medium">{friend.username || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-16">Email:</span>
                            <span className="text-sm text-gray-300">{friend.email || 'N/A'}</span>
                          </div>
                          {friend.commonCourses > 0 && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-16">Courses:</span>
                              <span className="text-sm text-gray-300">{friend.commonCourses} in common</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))
                ) : (
                  <div className="px-2 py-2 text-xs text-gray-500 text-center">
                    No friends yet. Send friend requests from messages!
                  </div>
                )}
              </div>
            )}
          </div>

        {/* Online members */}
        {onlineMembers.length > 0 && (
          <div className="mb-4">
            <div className="px-2 py-1 text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Online — {onlineMembers.length}
            </div>
            {onlineMembers.map((member) => (
              <div
                key={member.id}
                className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 cursor-pointer group"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(
                      member.status
                    )}`}
                  ></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      member.roleColor ? `text-[${member.roleColor}]` : 'text-gray-300'
                    }`}
                    style={member.roleColor ? { color: member.roleColor } : {}}
                  >
                    {member.username}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offline members */}
        {offlineMembers.length > 0 && (
          <div>
            <div className="px-2 py-1 text-gray-400 text-xs font-semibold uppercase tracking-wide">
              Offline — {offlineMembers.length}
            </div>
            {offlineMembers.map((member) => (
              <div
                key={member.id}
                className="px-2 py-1.5 rounded flex items-center gap-2 hover:bg-gray-700 cursor-pointer group opacity-60"
              >
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-white text-xs font-semibold">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.username}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      member.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-gray-800 ${getStatusColor(
                      member.status
                    )}`}
                  ></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      member.roleColor ? `text-[${member.roleColor}]` : 'text-gray-300'
                    }`}
                    style={member.roleColor ? { color: member.roleColor } : {}}
                  >
                    {member.username}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {members.length === 0 && (
          <div className="px-2 py-4 text-center text-gray-400 text-sm">
            No members found
          </div>
        )}
      </div>
    </div>
  );
}



