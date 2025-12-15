import useSWR from 'swr';
import { supabase } from '@/lib/supabase';
import type { EnrollmentRequest } from './useEnrollmentRequests';

async function fetchAdminEnrollmentRequests(status?: string): Promise<EnrollmentRequest[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = status
    ? `/api/admin/enrollment-requests?status=${status}`
    : '/api/admin/enrollment-requests';

  try {
    console.log('[Admin Hook] Fetching enrollment requests, status:', status || 'all');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store', // Ensure we always get fresh data
    });

    // Clone the response to avoid "body stream already read" error
    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = `Failed to fetch enrollment requests (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error || errorData?.details || errorMessage;
        console.error('[Admin Hook] API error:', errorData);
      } catch (e) {
        // If response is not JSON, try to get text from clone
        try {
          const text = await responseClone.text();
          if (text) {
            errorMessage = `Server error (${response.status}): ${text}`;
          }
        } catch (textError) {
          // If both fail, use status text
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const requests = data.requests || [];
    console.log('[Admin Hook] ========================================');
    console.log('[Admin Hook] Successfully fetched', requests.length, 'enrollment requests');
    console.log('[Admin Hook] Response data:', JSON.stringify(data, null, 2));
    console.log('[Admin Hook] Request IDs:', requests.map(r => r.id));
    console.log('[Admin Hook] Request statuses:', requests.map(r => r.status));
    console.log('[Admin Hook] Request courses:', requests.map(r => r.courses?.title || r.course_id));
    return requests;
  } catch (error: any) {
    console.error('[Admin Hook] Error fetching admin enrollment requests:', error);
    // Re-throw with more context if it's not already an Error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error.message || 'Failed to fetch enrollment requests');
  }
}

export function useAdminEnrollmentRequests(status?: string) {
  const { data, error, isLoading, mutate } = useSWR<EnrollmentRequest[]>(
    ['admin-enrollment-requests', status],
    () => fetchAdminEnrollmentRequests(status),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000, // Reduced to 1 second to check more frequently
      refreshInterval: 5000, // Auto-refresh every 5 seconds to catch new requests faster
      fallbackData: [],
      onError: (error) => {
        console.error('[Admin Hook] SWR error:', error);
      },
      onSuccess: (data) => {
        console.log('[Admin Hook] SWR success, received', data?.length || 0, 'requests');
      },
    }
  );

  // Helper to mutate all status filters
  const mutateAll = async () => {
    // Mutate current filter
    await mutate();
    // Also mutate other common filters to ensure UI updates
    await mutate(undefined, { revalidate: true });
  };

  const approveRequest = async (requestId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/admin/enrollment-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Clone response to avoid stream issues
    const responseClone = response.clone();

    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // If not JSON, try to get text for error message
      const text = await responseClone.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to approve request');
    }

    // Optimistically update the UI by removing the approved request from pending
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.filter(req => req.id !== requestId);
    }, false);

    // Then revalidate to get fresh data
    await mutateAll();
    
    return data;
  };

  const rejectRequest = async (requestId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/admin/enrollment-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // Clone response to avoid stream issues
    const responseClone = response.clone();

    // Check content type before parsing
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // If not JSON, try to get text for error message
      const text = await responseClone.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to reject request');
    }

    // Optimistically update the UI by removing the rejected request from pending
    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.filter(req => req.id !== requestId);
    }, false);

    // Then revalidate to get fresh data
    await mutateAll();
    
    return data;
  };

  return {
    requests: data || [],
    isLoading,
    error,
    mutate,
    approveRequest,
    rejectRequest,
  };
}

