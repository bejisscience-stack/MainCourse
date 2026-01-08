import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { WithdrawalRequest } from '@/types/balance';

interface UseRealtimeWithdrawalRequestsOptions {
  userId: string | null;
  onRequestUpdated?: (request: WithdrawalRequest) => void;
  onRequestApproved?: (request: WithdrawalRequest) => void;
  onRequestRejected?: (request: WithdrawalRequest) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook to subscribe to real-time updates for a user's withdrawal requests
 * Notifies when a withdrawal request status changes (approved/rejected)
 */
export function useRealtimeWithdrawalRequests({
  userId,
  onRequestUpdated,
  onRequestApproved,
  onRequestRejected,
  onConnectionChange,
}: UseRealtimeWithdrawalRequestsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Use refs to avoid recreating subscription on callback changes
  const onRequestUpdatedRef = useRef(onRequestUpdated);
  const onRequestApprovedRef = useRef(onRequestApproved);
  const onRequestRejectedRef = useRef(onRequestRejected);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onRequestUpdatedRef.current = onRequestUpdated;
    onRequestApprovedRef.current = onRequestApproved;
    onRequestRejectedRef.current = onRequestRejected;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onRequestUpdated, onRequestApproved, onRequestRejected, onConnectionChange]);

  useEffect(() => {
    if (!userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    console.log('[RT Withdrawal] Setting up subscription for user:', userId);

    // Subscribe to changes in withdrawal_requests table for this user
    const channel = supabase
      .channel(`withdrawal_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[RT Withdrawal] INSERT received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Withdrawal] Invalid INSERT payload');
            return;
          }

          // For INSERT, just call onRequestUpdated with the payload data
          if (onRequestUpdatedRef.current) {
            onRequestUpdatedRef.current(payload.new as WithdrawalRequest);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'withdrawal_requests',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[RT Withdrawal] UPDATE received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Withdrawal] Invalid UPDATE payload');
            return;
          }

          const newData = payload.new as WithdrawalRequest;
          const oldStatus = (payload.old as { status?: string } | null)?.status;
          const newStatus = newData.status;

          console.log('[RT Withdrawal] Status change:', oldStatus, '->', newStatus);

          // Status changed - call specific callbacks
          if (oldStatus !== newStatus) {
            if ((newStatus === 'approved' || newStatus === 'completed') && onRequestApprovedRef.current) {
              console.log('[RT Withdrawal] Calling onRequestApproved');
              onRequestApprovedRef.current(newData);
            } else if (newStatus === 'rejected' && onRequestRejectedRef.current) {
              console.log('[RT Withdrawal] Calling onRequestRejected');
              onRequestRejectedRef.current(newData);
            }
          }

          // Always call onRequestUpdated for any update
          if (onRequestUpdatedRef.current) {
            console.log('[RT Withdrawal] Calling onRequestUpdated');
            onRequestUpdatedRef.current(newData);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[RT Withdrawal] Subscription status:', status, err);

        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        onConnectionChangeRef.current?.(connected);

        if (status === 'CHANNEL_ERROR') {
          console.error('[RT Withdrawal] Channel error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[RT Withdrawal] Connection timed out, will retry...');
        } else if (status === 'CLOSED') {
          console.log('[RT Withdrawal] Channel closed');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[RT Withdrawal] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  return { isConnected };
}
