import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { WithdrawalRequest } from '@/types/balance';

interface UseRealtimeAdminWithdrawalRequestsOptions {
  enabled?: boolean;
  onInsert?: (request: WithdrawalRequest) => void;
  onUpdate?: (request: WithdrawalRequest, oldRequest: Partial<WithdrawalRequest>) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook to subscribe to real-time updates for ALL withdrawal requests (admin view)
 * Subscribes to all requests without filtering by user_id
 */
export function useRealtimeAdminWithdrawalRequests({
  enabled = true,
  onInsert,
  onUpdate,
  onConnectionChange,
}: UseRealtimeAdminWithdrawalRequestsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Use refs to avoid recreating subscription on callback changes
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onInsert, onUpdate, onConnectionChange]);

  useEffect(() => {
    if (!enabled) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    console.log('[RT Admin Withdrawal] Setting up subscription');

    const channel = supabase
      .channel('admin:withdrawal_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'withdrawal_requests',
        },
        async (payload) => {
          console.log('[RT Admin Withdrawal] INSERT received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Admin Withdrawal] Invalid payload: missing new.id');
            return;
          }

          // Fetch the full request with related data
          const { data: request, error } = await supabase
            .from('withdrawal_requests')
            .select(`
              id,
              user_id,
              user_type,
              amount,
              bank_account_number,
              status,
              admin_notes,
              processed_at,
              processed_by,
              created_at,
              updated_at,
              profiles (
                id,
                email,
                username,
                role,
                balance
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Admin Withdrawal] Error fetching request details:', error);
            onInsertRef.current?.(payload.new as WithdrawalRequest);
            return;
          }

          // Transform to match expected type
          const transformedRequest: WithdrawalRequest = {
            ...request,
            profiles: Array.isArray(request.profiles) && request.profiles.length > 0
              ? request.profiles[0]
              : request.profiles,
          };

          onInsertRef.current?.(transformedRequest);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'withdrawal_requests',
        },
        async (payload) => {
          console.log('[RT Admin Withdrawal] UPDATE received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Admin Withdrawal] Invalid payload: missing new.id');
            return;
          }

          // Fetch the full request with related data
          const { data: request, error } = await supabase
            .from('withdrawal_requests')
            .select(`
              id,
              user_id,
              user_type,
              amount,
              bank_account_number,
              status,
              admin_notes,
              processed_at,
              processed_by,
              created_at,
              updated_at,
              profiles (
                id,
                email,
                username,
                role,
                balance
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Admin Withdrawal] Error fetching request details:', error);
            onUpdateRef.current?.(payload.new as WithdrawalRequest, payload.old as Partial<WithdrawalRequest>);
            return;
          }

          // Transform to match expected type
          const transformedRequest: WithdrawalRequest = {
            ...request,
            profiles: Array.isArray(request.profiles) && request.profiles.length > 0
              ? request.profiles[0]
              : request.profiles,
          };

          onUpdateRef.current?.(transformedRequest, payload.old as Partial<WithdrawalRequest>);
        }
      )
      .subscribe((status, err) => {
        console.log('[RT Admin Withdrawal] Subscription status:', status, err);

        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        onConnectionChangeRef.current?.(connected);

        if (status === 'CHANNEL_ERROR') {
          console.error('[RT Admin Withdrawal] Channel error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[RT Admin Withdrawal] Connection timed out, will retry...');
        } else if (status === 'CLOSED') {
          console.log('[RT Admin Withdrawal] Channel closed');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[RT Admin Withdrawal] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return { isConnected };
}
