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

          // Check if payload.new exists and has an id
          if (!payload.new || typeof payload.new !== 'object' || !('id' in payload.new)) {
            console.error('Invalid payload: missing new.id');
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
              courses (
                id,
                title,
                thumbnail_url
              )
            `)
            .eq('id', (payload.new as { id: string }).id)
            .single();

          if (error || !request) {
            console.error('Error fetching updated enrollment request:', error);
            return;
          }

          // Transform the data to match the expected type
          // Supabase returns courses as an array, but we expect a single object
          const transformedRequest: EnrollmentRequest = {
            ...request,
            courses: Array.isArray(request.courses)
              ? (request.courses.length > 0 ? request.courses[0] : null)
              : request.courses ?? null,
          };

          // Call the appropriate callback based on status change
          if (payload.eventType === 'UPDATE') {
            const oldStatus = (payload.old as { status?: string } | null)?.status;
            const newStatus = (payload.new as { status?: string })?.status;

            // Status changed
            if (oldStatus !== newStatus) {
              if (newStatus === 'approved' && onRequestApproved) {
                onRequestApproved(transformedRequest);
              } else if (newStatus === 'rejected' && onRequestRejected) {
                onRequestRejected(transformedRequest);
              }
            }

            // Always call onRequestUpdated for any update
            if (onRequestUpdated) {
              onRequestUpdated(transformedRequest);
            }
          } else if (payload.eventType === 'INSERT' && onRequestUpdated) {
            // New request created
            onRequestUpdated(transformedRequest);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, onRequestUpdated, onRequestApproved, onRequestRejected]);
}












