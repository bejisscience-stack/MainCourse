'use client';

import { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useFriendRequests } from '@/hooks/useFriendRequests';
import { useFriendships } from '@/hooks/useFriendships';
import { useRealtimeFriends } from '@/hooks/useRealtimeFriends';

export type FriendStatus = 'self' | 'friend' | 'pending_sent' | 'pending_received' | 'none';

interface FriendStatusContextValue {
  getStatusForUser: (userId: string) => FriendStatus;
  sendFriendRequest: (receiverId: string) => Promise<void>;
  acceptFriendRequest: (requestId: string) => Promise<void>;
  rejectFriendRequest: (requestId: string) => Promise<void>;
  getReceivedRequestId: (senderId: string) => string | undefined;
  isSubmitting: boolean;
}

const FriendStatusContext = createContext<FriendStatusContextValue | null>(null);

export function useFriendStatusContext() {
  return useContext(FriendStatusContext);
}

interface FriendStatusProviderProps {
  currentUserId: string;
  children: React.ReactNode;
}

export function FriendStatusProvider({ currentUserId, children }: FriendStatusProviderProps) {
  const {
    sent,
    received,
    sendFriendRequest: sendReq,
    acceptFriendRequest: acceptReq,
    rejectFriendRequest: rejectReq,
    isSubmitting: isReqSubmitting,
    mutate: mutateRequests,
  } = useFriendRequests(currentUserId);

  const {
    friendships,
    mutate: mutateFriendships,
  } = useFriendships(currentUserId);

  // Real-time updates
  useRealtimeFriends({
    userId: currentUserId,
    enabled: true,
    onFriendRequestChange: () => { mutateRequests(); },
    onFriendshipChange: () => { mutateFriendships(); },
  });

  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  const friendIdSet = useMemo(() => {
    return new Set(friendships.map(f => f.friendId));
  }, [friendships]);

  const pendingSentSet = useMemo(() => {
    return new Set(sent.map(r => r.receiverId));
  }, [sent]);

  const pendingReceivedMap = useMemo(() => {
    return new Map(received.map(r => [r.senderId, r.id]));
  }, [received]);

  const getStatusForUser = useCallback((userId: string): FriendStatus => {
    if (userId === currentUserId) return 'self';
    if (friendIdSet.has(userId)) return 'friend';
    if (pendingSentSet.has(userId)) return 'pending_sent';
    if (pendingReceivedMap.has(userId)) return 'pending_received';
    return 'none';
  }, [currentUserId, friendIdSet, pendingSentSet, pendingReceivedMap]);

  const sendFriendRequest = useCallback(async (receiverId: string) => {
    setIsActionSubmitting(true);
    try {
      await sendReq(receiverId);
    } finally {
      setIsActionSubmitting(false);
    }
  }, [sendReq]);

  const acceptFriendRequest = useCallback(async (requestId: string) => {
    setIsActionSubmitting(true);
    try {
      await acceptReq(requestId);
    } finally {
      setIsActionSubmitting(false);
    }
  }, [acceptReq]);

  const rejectFriendRequest = useCallback(async (requestId: string) => {
    setIsActionSubmitting(true);
    try {
      await rejectReq(requestId);
    } finally {
      setIsActionSubmitting(false);
    }
  }, [rejectReq]);

  const getReceivedRequestId = useCallback((senderId: string): string | undefined => {
    return pendingReceivedMap.get(senderId);
  }, [pendingReceivedMap]);

  const value = useMemo<FriendStatusContextValue>(() => ({
    getStatusForUser,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    getReceivedRequestId,
    isSubmitting: isReqSubmitting || isActionSubmitting,
  }), [getStatusForUser, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, getReceivedRequestId, isReqSubmitting, isActionSubmitting]);

  return (
    <FriendStatusContext.Provider value={value}>
      {children}
    </FriendStatusContext.Provider>
  );
}
