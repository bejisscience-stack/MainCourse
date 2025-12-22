import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { EnrollmentRequest } from './useEnrollmentRequests';

interface UseRealtimeEnrollmentRequestsOptions {
  userId: string | null;
  onRequestUpdated?: (request: EnrollmentRequest) => void;
  onRequestApproved?: (request: EnrollmentRequest) => void;
  onRequestRejected?: (request: EnrollmentRequest) => void;
}

/**
 * Hook to subscribe to real-time updates for enrollment requests
 * Notifies when a user's enrollment request status changes
 */
export function useRealtimeEnrollmentRequests({
  userId,
  onRequestUpdated,
  onRequestApproved,
  onRequestRejected,
}: UseRealtimeEnrollmentRequestsOptions) {
  useEffect(() => {
    if (!userId) return;

    // Subscribe to changes in enrollment_requests table
    const channel = supabase
      .channel(`enrollment_requests:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'enrollment_requests',
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          console.log('Enrollment request real-time update:', payload);

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
              courses (
                id,
                title,
                thumbnail_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (error || !request) {
            console.error('Error fetching updated enrollment request:', error);
            return;
          }

          // Call the appropriate callback based on status change
          if (payload.eventType === 'UPDATE') {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;

            // Status changed
            if (oldStatus !== newStatus) {
              if (newStatus === 'approved' && onRequestApproved) {
                onRequestApproved(request as EnrollmentRequest);
              } else if (newStatus === 'rejected' && onRequestRejected) {
                onRequestRejected(request as EnrollmentRequest);
              }
            }

            // Always call onRequestUpdated for any update
            if (onRequestUpdated) {
              onRequestUpdated(request as EnrollmentRequest);
            }
          } else if (payload.eventType === 'INSERT' && onRequestUpdated) {
            // New request created
            onRequestUpdated(request as EnrollmentRequest);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onRequestUpdated, onRequestApproved, onRequestRejected]);
}









