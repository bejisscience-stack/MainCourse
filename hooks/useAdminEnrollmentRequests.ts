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
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    // Clone the response to avoid "body stream already read" error
    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = `Failed to fetch enrollment requests (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error || errorData?.details || errorMessage;
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
    return data.requests || [];
  } catch (error: any) {
    console.error('Error fetching admin enrollment requests:', error);
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
      dedupingInterval: 3000,
      fallbackData: [],
    }
  );

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to approve request');
    }

    await mutate();
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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to reject request');
    }

    await mutate();
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

