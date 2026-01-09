import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { BundleEnrollmentRequest } from './useAdminBundleEnrollmentRequests';

interface UseRealtimeBundleEnrollmentRequestsOptions {
  userId: string | null;
  onRequestUpdated?: (request: BundleEnrollmentRequest) => void;
  onRequestApproved?: (request: BundleEnrollmentRequest) => void;
  onRequestRejected?: (request: BundleEnrollmentRequest) => void;
}

/**
 * Hook to subscribe to real-time updates for a user's bundle enrollment requests
 * Notifies when a bundle enrollment request status changes (approved/rejected)
 */
export function useRealtimeBundleEnrollmentRequests({
  userId,
  onRequestUpdated,
  onRequestApproved,
  onRequestRejected,
}: UseRealtimeBundleEnrollmentRequestsOptions) {
  // Use refs to avoid recreating subscription on callback changes
  const onRequestUpdatedRef = useRef(onRequestUpdated);
  const onRequestApprovedRef = useRef(onRequestApproved);
  const onRequestRejectedRef = useRef(onRequestRejected);

  useEffect(() => {
    onRequestUpdatedRef.current = onRequestUpdated;
    onRequestApprovedRef.current = onRequestApproved;
    onRequestRejectedRef.current = onRequestRejected;
  }, [onRequestUpdated, onRequestApproved, onRequestRejected]);

  useEffect(() => {
    if (!userId) return;

    console.log('[RT Bundle Enrollment] Setting up subscription for user:', userId);

    // Subscribe to changes in bundle_enrollment_requests table for this user
    const channel = supabase
      .channel(`bundle_enrollment_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bundle_enrollment_requests',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('[RT Bundle Enrollment] Real-time update received:', payload);

          // Check if payload.new exists and has an id
          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('[RT Bundle Enrollment] Invalid payload: missing new.id');
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
              course_bundles (
                id,
                title,
                price
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('[RT Bundle Enrollment] Error fetching updated request:', error);
            return;
          }

          // Transform to match expected type
          const transformedRequest: BundleEnrollmentRequest = {
            ...request,
            bundles: Array.isArray(request.course_bundles)
              ? (request.course_bundles.length > 0 ? request.course_bundles[0] : null)
              : request.course_bundles ?? null,
          };

          // Call the appropriate callback based on status change
          if (payload.eventType === 'UPDATE') {
            const oldStatus = (payload.old as { status?: string } | null)?.status;
            const newStatus = (payload.new as { status?: string })?.status;

            // Status changed
            if (oldStatus !== newStatus) {
              if (newStatus === 'approved' && onRequestApprovedRef.current) {
                onRequestApprovedRef.current(transformedRequest);
              } else if (newStatus === 'rejected' && onRequestRejectedRef.current) {
                onRequestRejectedRef.current(transformedRequest);
              }
            }

            // Always call onRequestUpdated for any update
            if (onRequestUpdatedRef.current) {
              onRequestUpdatedRef.current(transformedRequest);
            }
          } else if (payload.eventType === 'INSERT' && onRequestUpdatedRef.current) {
            // New request created
            onRequestUpdatedRef.current(transformedRequest);
          }
        }
      )
      .subscribe((status, err) => {
        console.log('[RT Bundle Enrollment] Subscription status:', status, err);

        if (status === 'SUBSCRIBED') {
          console.log('[RT Bundle Enrollment] Successfully subscribed');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[RT Bundle Enrollment] Channel error:', err);
        } else if (status === 'TIMED_OUT') {
          console.warn('[RT Bundle Enrollment] Connection timed out');
        }
      });

    return () => {
      console.log('[RT Bundle Enrollment] Cleaning up subscription');
      supabase.removeChannel(channel);
    };
  }, [userId]);
}
