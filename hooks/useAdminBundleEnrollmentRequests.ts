import useSWR from 'swr';
import { supabase } from '@/lib/supabase';

export interface BundleEnrollmentRequest {
  id: string;
  user_id: string;
  bundle_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  payment_screenshots?: string[];
  profiles?: {
    id: string;
    username?: string;
    email?: string;
  } | null;
  bundles?: {
    id: string;
    title: string;
    price: number;
  } | null;
}

async function fetchAdminBundleEnrollmentRequests(status?: string): Promise<BundleEnrollmentRequest[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  
  if (!token) {
    throw new Error('Not authenticated');
  }

  const url = status
    ? `/api/admin/bundle-enrollment-requests?status=${status}`
    : '/api/admin/bundle-enrollment-requests';

  try {
    console.log('[Admin Bundle Hook] Fetching bundle enrollment requests, status:', status || 'all');
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    const responseClone = response.clone();

    if (!response.ok) {
      let errorMessage = `Failed to fetch bundle enrollment requests (${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData?.error || errorData?.details || errorMessage;
        console.error('[Admin Bundle Hook] API error:', errorData);
      } catch (e) {
        try {
          const text = await responseClone.text();
          if (text) {
            errorMessage = `Server error (${response.status}): ${text}`;
          }
        } catch (textError) {
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const requests = data.requests || [];
    console.log('[Admin Bundle Hook] Successfully fetched', requests.length, 'bundle enrollment requests');
    return requests;
  } catch (error: any) {
    console.error('[Admin Bundle Hook] Error fetching admin bundle enrollment requests:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error.message || 'Failed to fetch bundle enrollment requests');
  }
}

export function useAdminBundleEnrollmentRequests(status?: string) {
  const { data, error, isLoading, mutate } = useSWR<BundleEnrollmentRequest[]>(
    ['admin-bundle-enrollment-requests', status],
    () => fetchAdminBundleEnrollmentRequests(status),
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 1000,
      refreshInterval: 5000,
      fallbackData: [],
      onError: (error) => {
        console.error('[Admin Bundle Hook] SWR error:', error);
      },
      onSuccess: (data) => {
        console.log('[Admin Bundle Hook] SWR success, received', data?.length || 0, 'requests');
      },
    }
  );

  const mutateAll = async () => {
    await mutate();
    await mutate(undefined, { revalidate: true });
  };

  const approveRequest = async (requestId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/admin/bundle-enrollment-requests/${requestId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseClone = response.clone();
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await responseClone.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to approve request');
    }

    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.filter(req => req.id !== requestId);
    }, false);

    await mutateAll();
    
    return data;
  };

  const rejectRequest = async (requestId: string) => {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/admin/bundle-enrollment-requests/${requestId}/reject`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const responseClone = response.clone();
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await responseClone.text();
      throw new Error(`Server returned non-JSON response (${response.status}): ${text.substring(0, 200)}`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.details || 'Failed to reject request');
    }

    await mutate((currentData) => {
      if (!currentData) return currentData;
      return currentData.filter(req => req.id !== requestId);
    }, false);

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


