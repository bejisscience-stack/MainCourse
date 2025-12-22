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

  // Always fetch all and filter client-side to avoid any server-side cache/filter drift
  // Add timestamp to bust any caching
  const timestamp = Date.now();
  const url = `/api/admin/bundle-enrollment-requests?t=${timestamp}`;

  try {
    console.log('[Admin Bundle Hook] Fetching bundle enrollment requests, status:', status || 'all', 'timestamp:', timestamp);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store', // Ensure we always get fresh data
      next: { revalidate: 0 }, // Disable Next.js caching
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
    let requests: BundleEnrollmentRequest[] = data.requests || [];
    
    // Client-side filter to ensure we reflect latest status changes even if server-side filtering lags
    if (status && status !== 'all') {
      requests = requests.filter(r => r.status === status);
    }
    
    console.log('[Admin Bundle Hook] Successfully fetched', requests.length, 'bundle enrollment requests (filtered from', data.requests?.length || 0, 'total)');
    console.log('[Admin Bundle Hook] Request statuses:', requests.map(r => r.status));
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
  // Always use the same cache key to avoid cache fragmentation
  // We fetch all requests and filter client-side
  const { data, error, isLoading, mutate } = useSWR<BundleEnrollmentRequest[]>(
    'admin-bundle-enrollment-requests-all', // Single cache key for all requests
    () => fetchAdminBundleEnrollmentRequests(undefined), // Always fetch all
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

  // Filter client-side based on status
  const filteredRequests = status && status !== 'all' 
    ? (data || []).filter(r => r.status === status)
    : (data || []);

  // Helper to mutate - now just one cache key to invalidate
  const mutateAll = async () => {
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

    // After approval, revalidate the single cache key to get fresh data
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

    // After rejection, revalidate the single cache key to get fresh data
    await mutateAll();
    
    return data;
  };

  return {
    requests: filteredRequests, // Return filtered requests
    isLoading,
    error,
    mutate,
    approveRequest,
    rejectRequest,
  };
}


