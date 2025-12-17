import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeProfileUsername } from '@/lib/username';

export interface FriendRequestUser {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
}

export interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  user: FriendRequestUser | null;
}

export function useFriendRequests() {
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('No session found for friend requests');
        setError('Not authenticated');
        setIsLoading(false);
        return;
      }

      const response = await fetch('/api/friends/requests', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `HTTP ${response.status}: Failed to fetch friend requests`;
        console.error('Friend requests API error:', errorMessage);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Friend requests API response:', { 
        sent: data.sent?.length || 0, 
        received: data.received?.length || 0,
      });
      
      // Log detailed user data from API
      if (data.sent && data.sent.length > 0) {
        console.log('=== SENT REQUESTS FROM API ===');
        data.sent.forEach((r: any, index: number) => {
          console.log(`Sent request ${index + 1}:`, JSON.parse(JSON.stringify({
            id: r.id,
            receiver_id: r.receiver_id,
            hasUser: !!r.user,
            userObject: r.user,
            username: r.user?.username,
            usernameType: typeof r.user?.username,
            usernameValue: r.user?.username,
            email: r.user?.email,
            emailType: typeof r.user?.email,
          })));
          console.log('Full sent request object:', JSON.parse(JSON.stringify(r)));
        });
      }
      
      if (data.received && data.received.length > 0) {
        console.log('=== RECEIVED REQUESTS FROM API ===');
        data.received.forEach((r: any, index: number) => {
          console.log(`Received request ${index + 1}:`, JSON.parse(JSON.stringify({
            id: r.id,
            sender_id: r.sender_id,
            hasUser: !!r.user,
            userObject: r.user,
            username: r.user?.username,
            usernameType: typeof r.user?.username,
            usernameValue: r.user?.username,
            email: r.user?.email,
            emailType: typeof r.user?.email,
          })));
          console.log('Full received request object:', JSON.parse(JSON.stringify(r)));
        });
      }
      
      // Process sent requests - API already normalizes username, just ensure user object exists
      const sentWithUsernames = (data.sent || []).map((req: any) => {
        // User object should come from API with already normalized username
        const user = req.user || {
          id: req.receiver_id,
          username: 'User',
          email: '',
          avatarUrl: null,
        };

        // Ensure username is never empty
        if (!user.username || user.username.trim() === '') {
          user.username = normalizeProfileUsername({ username: user.username, email: user.email });
        }

        if (!req.user) {
          console.warn('Sent request missing user object, using fallback:', req.id);
        }

        return {
          ...req,
          user,
        };
      });
      
      // Process received requests - API already normalizes username, just ensure user object exists
      const receivedWithUsernames = (data.received || []).map((req: any) => {
        // User object should come from API with already normalized username
        const user = req.user || {
          id: req.sender_id,
          username: 'User',
          email: '',
          avatarUrl: null,
        };

        // Ensure username is never empty
        if (!user.username || user.username.trim() === '') {
          user.username = normalizeProfileUsername({ username: user.username, email: user.email });
        }

        if (!req.user) {
          console.warn('Received request missing user object, using fallback:', req.id);
        }

        return {
          ...req,
          user,
        };
      });
      
      console.log('Processed friend requests:', {
        sent: sentWithUsernames.map((r: any) => ({ id: r.id, username: r.user?.username, email: r.user?.email })),
        received: receivedWithUsernames.map((r: any) => ({ id: r.id, username: r.user?.username, email: r.user?.email }))
      });
      
      console.log('Setting friend requests:', {
        sent: sentWithUsernames.map(r => ({ id: r.id, username: r.user?.username })),
        received: receivedWithUsernames.map(r => ({ id: r.id, username: r.user?.username }))
      });
      
      setSentRequests(sentWithUsernames);
      setReceivedRequests(receivedWithUsernames);
    } catch (err: any) {
      console.error('Error fetching friend requests:', err);
      setError(err.message || 'Failed to fetch friend requests');
      // Set empty arrays on error so UI still renders
      setSentRequests([]);
      setReceivedRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendRequest = useCallback(async (receiverId: string) => {
    try {
      if (!receiverId || typeof receiverId !== 'string') {
        throw new Error('Invalid receiver ID');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated. Please log in again.');
      }

      const response = await fetch('/api/friends/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ receiverId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to send friend request (${response.status})`;
        console.error('Friend request API error:', errorMessage, errorData);
        throw new Error(errorMessage);
      }

      // Refresh requests
      await fetchRequests();
    } catch (err: any) {
      console.error('Error sending friend request:', err);
      throw err;
    }
  }, [fetchRequests]);

  const acceptRequest = useCallback(async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/friends/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to accept friend request');
      }

      // Refresh requests
      await fetchRequests();
    } catch (err: any) {
      console.error('Error accepting friend request:', err);
      throw err;
    }
  }, [fetchRequests]);

  const rejectRequest = useCallback(async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/friends/reject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to reject friend request');
      }

      // Refresh requests
      await fetchRequests();
    } catch (err: any) {
      console.error('Error rejecting friend request:', err);
      throw err;
    }
  }, [fetchRequests]);

  const cancelRequest = useCallback(async (requestId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/friends/request?requestId=${requestId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to cancel friend request');
      }

      // Refresh requests
      await fetchRequests();
    } catch (err: any) {
      console.error('Error canceling friend request:', err);
      throw err;
    }
  }, [fetchRequests]);

  useEffect(() => {
    fetchRequests();

    // Set up polling as fallback (every 10 seconds) - this will work even if real-time fails
    pollingIntervalRef.current = setInterval(() => {
      fetchRequests();
    }, 10000);

    // Subscribe to real-time changes in friend requests
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isCleaningUp = false;
    let retryCount = 0;
    const MAX_RETRIES = 2; // Only retry twice to avoid infinite loops

    const setupSubscription = async () => {
      // Don't set up if we're cleaning up
      if (isCleaningUp) return;
      
      // Don't retry if we've exceeded max retries
      if (retryCount >= MAX_RETRIES) {
        console.warn('[RT] Max retries reached for friend requests subscription. Relying on polling.');
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error getting session for friend requests subscription:', sessionError);
        return;
      }
      
      if (!session) {
        console.warn('No session available for friend requests subscription');
        return;
      }

      const userId = session.user.id;
      console.log('Setting up friend requests subscription for user:', userId);

      // Create a single channel with both filters
      channel = supabase
        .channel(`friend-requests-${userId}-${Date.now()}`, {
          config: {
            broadcast: { self: false },
            presence: { key: '' },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `sender_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[RT] Friend request INSERT (sent):', payload);
            setTimeout(() => fetchRequests(), 100);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[RT] Friend request INSERT (received):', payload);
            setTimeout(() => fetchRequests(), 100);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_requests',
            filter: `sender_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[RT] Friend request UPDATE (sent):', payload);
            setTimeout(() => fetchRequests(), 100);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[RT] Friend request UPDATE (received):', payload);
            setTimeout(() => fetchRequests(), 100);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'friend_requests',
            filter: `sender_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[RT] Friend request DELETE (sent):', payload);
            setTimeout(() => fetchRequests(), 100);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'friend_requests',
            filter: `receiver_id=eq.${userId}`,
          },
          (payload) => {
            console.log('[RT] Friend request DELETE (received):', payload);
            setTimeout(() => fetchRequests(), 100);
          }
        )
        .subscribe((status, err) => {
          // Don't process status changes if we're cleaning up
          if (isCleaningUp) return;

          if (status === 'SUBSCRIBED') {
            console.log('[RT] Successfully subscribed to friend requests changes');
            retryCount = 0; // Reset retry count on success
          } else if (status === 'CLOSED' && !isCleaningUp) {
            // Only log, don't retry automatically - polling will handle updates
            console.warn('[RT] Friend requests subscription closed. Polling will continue to fetch updates.');
            // Note: Real-time requires migration 047 to be run. Until then, polling works fine.
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[RT] Friend requests subscription error:', status, err);
            // Only retry once, then rely on polling
            if (retryCount < MAX_RETRIES && !isCleaningUp) {
              retryCount++;
              console.log(`[RT] Retrying subscription (attempt ${retryCount}/${MAX_RETRIES})...`);
              setTimeout(() => {
                if (!isCleaningUp && channel) {
                  try {
                    channel.unsubscribe();
                  } catch (e) {
                    // Ignore unsubscribe errors
                  }
                  setupSubscription();
                }
              }, 5000);
            } else {
              console.warn('[RT] Max retries reached. Relying on polling for friend requests.');
            }
          }
        });
    };

    setupSubscription();

    return () => {
      isCleaningUp = true;
      
      // Clear polling interval
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Clean up real-time subscription
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch (e) {
          // Ignore cleanup errors
        }
        channel = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - fetchRequests is stable via useCallback

  return {
    sentRequests,
    receivedRequests,
    isLoading,
    error,
    refetch: fetchRequests,
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
  };
}

