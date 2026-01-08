import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { BundleEnrollmentRequest } from './useAdminBundleEnrollmentRequests';

interface UseRealtimeAdminBundleEnrollmentRequestsOptions {
  enabled?: boolean;
  onInsert?: (request: BundleEnrollmentRequest) => void;
  onUpdate?: (request: BundleEnrollmentRequest, oldRequest: Partial<BundleEnrollmentRequest>) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook to subscribe to real-time updates for ALL bundle enrollment requests (admin view)
 * Subscribes to all requests without filtering by user_id
 */
export function useRealtimeAdminBundleEnrollmentRequests({
  enabled = true,
  onInsert,
  onUpdate,
  onConnectionChange,
}: UseRealtimeAdminBundleEnrollmentRequestsOptions) {
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

    console.log('[RT Admin Bundle] Setting up subscription');

    const channel = supabase
      .channel('admin:bundle_enrollment_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'bundle_enrollment_requests',
        },
        async (payload) => {
          console.log('[RT Admin Bundle] INSERT received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Admin Bundle] Invalid payload: missing new.id');
            return;
          }

          // Fetch the full request with related data
          const { data: request, error } = await supabase
            .from('bundle_enrollment_requests')
            .select(`
              id,
              user_id,
              bundle_id,
              status,
              created_at,
              updated_at,
              reviewed_by,
              reviewed_at,
              payment_screenshots,
              profiles (
                id,
                username,
                email
              ),
              course_bundles (
                id,
                title,
                price
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Admin Bundle] Error fetching request details:', error);
            onInsertRef.current?.(payload.new as BundleEnrollmentRequest);
            return;
          }

          // Transform to match expected type
          const transformedRequest: BundleEnrollmentRequest = {
            ...request,
            profiles: Array.isArray(request.profiles) && request.profiles.length > 0
              ? request.profiles[0]
              : request.profiles,
            bundles: Array.isArray(request.course_bundles) && request.course_bundles.length > 0
              ? request.course_bundles[0]
              : request.course_bundles,
          };

          onInsertRef.current?.(transformedRequest);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'bundle_enrollment_requests',
        },
        async (payload) => {
          console.log('[RT Admin Bundle] UPDATE received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Admin Bundle] Invalid payload: missing new.id');
            return;
          }

          // Fetch the full request with related data
          const { data: request, error } = await supabase
            .from('bundle_enrollment_requests')
            .select(`
              id,
              user_id,
              bundle_id,
              status,
              created_at,
              updated_at,
              reviewed_by,
              reviewed_at,
              payment_screenshots,
              profiles (
                id,
                username,
                email
              ),
              course_bundles (
                id,
                title,
                price
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Admin Bundle] Error fetching request details:', error);
            onUpdateRef.current?.(payload.new as BundleEnrollmentRequest, payload.old as Partial<BundleEnrollmentRequest>);
            return;
          }

          // Transform to match expected type
          const transformedRequest: BundleEnrollmentRequest = {
            ...request,
            profiles: Array.isArray(request.profiles) && request.profiles.length > 0
              ? request.profiles[0]
              : request.profiles,
            bundles: Array.isArray(request.course_bundles) && request.course_bundles.length > 0
              ? request.course_bundles[0]
              : request.course_bundles,
          };

          onUpdateRef.current?.(transformedRequest, payload.old as Partial<BundleEnrollmentRequest>);
        }
      )
      .subscribe((status, err) => {
        console.log('[RT Admin Bundle] Subscription status:', status, err);

        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        onConnectionChangeRef.current?.(connected);

        if (status === 'CHANNEL_ERROR') {
          console.error('[RT Admin Bundle] Channel error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[RT Admin Bundle] Connection timed out, will retry...');
        } else if (status === 'CLOSED') {
          console.log('[RT Admin Bundle] Channel closed');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[RT Admin Bundle] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return { isConnected };
}
