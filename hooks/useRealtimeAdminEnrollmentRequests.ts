import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { EnrollmentRequest } from './useEnrollmentRequests';

interface UseRealtimeAdminEnrollmentRequestsOptions {
  enabled?: boolean;
  onInsert?: (request: EnrollmentRequest) => void;
  onUpdate?: (request: EnrollmentRequest, oldRequest: Partial<EnrollmentRequest>) => void;
  onConnectionChange?: (connected: boolean) => void;
}

/**
 * Hook to subscribe to real-time updates for ALL enrollment requests (admin view)
 * Unlike the user-side hook, this subscribes to all requests without filtering by user_id
 */
export function useRealtimeAdminEnrollmentRequests({
  enabled = true,
  onInsert,
  onUpdate,
  onConnectionChange,
}: UseRealtimeAdminEnrollmentRequestsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Use refs to avoid recreating subscription on callback changes
  const onInsertRef = useRef(onInsert);
  const onUpdateRef = useRef(onUpdate);
  const onConnectionChangeRef = useRef(onConnectionChange);

  // Update refs when callbacks change
  useEffect(() => {
    onInsertRef.current = onInsert;
    onUpdateRef.current = onUpdate;
    onConnectionChangeRef.current = onConnectionChange;
  }, [onInsert, onUpdate, onConnectionChange]);

  useEffect(() => {
    if (!enabled) {
      // Clean up if disabled
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    console.log('[RT Admin Enrollment] Setting up subscription');

    const channel = supabase
      .channel('admin:enrollment_requests')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'enrollment_requests',
        },
        async (payload) => {
          console.log('[RT Admin Enrollment] INSERT received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Admin Enrollment] Invalid payload: missing new.id');
            return;
          }

          // Fetch the full request with related data for proper display
          const { data: request, error } = await supabase
            .from('enrollment_requests')
            .select(`
              id,
              user_id,
              course_id,
              status,
              created_at,
              updated_at,
              reviewed_by,
              reviewed_at,
              payment_screenshots,
              referral_code,
              courses (
                id,
                title,
                thumbnail_url
              ),
              profiles (
                id,
                username,
                email
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Admin Enrollment] Error fetching request details:', error);
            // Still trigger callback to revalidate
            onInsertRef.current?.(payload.new as EnrollmentRequest);
            return;
          }

          // Transform to match expected type
          const transformedRequest: EnrollmentRequest = {
            ...request,
            courses: Array.isArray(request.courses)
              ? (request.courses.length > 0 ? request.courses[0] : null)
              : request.courses ?? null,
            profiles: Array.isArray(request.profiles)
              ? (request.profiles.length > 0 ? request.profiles[0] : undefined)
              : request.profiles ?? undefined,
          };

          onInsertRef.current?.(transformedRequest);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'enrollment_requests',
        },
        async (payload) => {
          console.log('[RT Admin Enrollment] UPDATE received:', payload);

          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Admin Enrollment] Invalid payload: missing new.id');
            return;
          }

          // Fetch the full request with related data
          const { data: request, error } = await supabase
            .from('enrollment_requests')
            .select(`
              id,
              user_id,
              course_id,
              status,
              created_at,
              updated_at,
              reviewed_by,
              reviewed_at,
              payment_screenshots,
              referral_code,
              courses (
                id,
                title,
                thumbnail_url
              ),
              profiles (
                id,
                username,
                email
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Admin Enrollment] Error fetching request details:', error);
            // Still trigger callback to revalidate
            onUpdateRef.current?.(payload.new as EnrollmentRequest, payload.old as Partial<EnrollmentRequest>);
            return;
          }

          // Transform to match expected type
          const transformedRequest: EnrollmentRequest = {
            ...request,
            courses: Array.isArray(request.courses)
              ? (request.courses.length > 0 ? request.courses[0] : null)
              : request.courses ?? null,
            profiles: Array.isArray(request.profiles)
              ? (request.profiles.length > 0 ? request.profiles[0] : undefined)
              : request.profiles ?? undefined,
          };

          onUpdateRef.current?.(transformedRequest, payload.old as Partial<EnrollmentRequest>);
        }
      )
      .subscribe((status, err) => {
        console.log('[RT Admin Enrollment] Subscription status:', status, err);

        const connected = status === 'SUBSCRIBED';
        setIsConnected(connected);
        onConnectionChangeRef.current?.(connected);

        if (status === 'CHANNEL_ERROR') {
          console.error('[RT Admin Enrollment] Channel error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[RT Admin Enrollment] Connection timed out, will retry...');
        } else if (status === 'CLOSED') {
          console.log('[RT Admin Enrollment] Channel closed');
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[RT Admin Enrollment] Cleaning up subscription');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled]);

  return { isConnected };
}
