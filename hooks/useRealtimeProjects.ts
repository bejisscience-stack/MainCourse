import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseRealtimeProjectsOptions {
  enabled?: boolean;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

/**
 * Real-time subscription hook for projects table
 * Listens for INSERT, UPDATE, and DELETE events on the projects table
 * and triggers callbacks to refresh data
 */
export function useRealtimeProjects({
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UseRealtimeProjectsOptions = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });

  // Keep callbacks fresh
  useEffect(() => {
    callbacksRef.current = { onInsert, onUpdate, onDelete };
  }, [onInsert, onUpdate, onDelete]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    // Subscribe to projects table changes
    const channel = supabase
      .channel('projects-realtime', {
        config: {
          broadcast: { self: false },
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          console.log('[RT Projects] New project inserted:', payload.new?.id);
          callbacksRef.current.onInsert?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          console.log('[RT Projects] Project updated:', payload.new?.id);
          callbacksRef.current.onUpdate?.(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'projects',
        },
        (payload) => {
          console.log('[RT Projects] Project deleted:', payload.old?.id);
          callbacksRef.current.onDelete?.(payload);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          console.log('[RT Projects] Connected to projects realtime channel');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          console.warn('[RT Projects] Disconnected from projects channel:', status);
        }
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected };
}

/**
 * Real-time subscription hook for project_criteria table
 * Useful when criteria changes need to trigger project refresh
 */
export function useRealtimeProjectCriteria({
  enabled = true,
  onChange,
}: {
  enabled?: boolean;
  onChange?: () => void;
} = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel('project-criteria-realtime', {
        config: {
          broadcast: { self: false },
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_criteria',
        },
        () => {
          console.log('[RT Project Criteria] Change detected');
          callbackRef.current?.();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled]);

  return { isConnected };
}

/**
 * Real-time subscription hook for submission_reviews table
 * Used to track budget changes when submissions are accepted/rejected
 */
export function useRealtimeSubmissionReviews({
  projectId,
  enabled = true,
  onChange,
}: {
  projectId?: string;
  enabled?: boolean;
  onChange?: () => void;
}) {
  const [isConnected, setIsConnected] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const callbackRef = useRef(onChange);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || !projectId) {
      setIsConnected(false);
      return;
    }

    const channel = supabase
      .channel(`submission-reviews:${projectId}`, {
        config: {
          broadcast: { self: false },
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'submission_reviews',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          console.log('[RT Submission Reviews] Change detected for project:', projectId);
          callbackRef.current?.();
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
      setIsConnected(false);
    };
  }, [enabled, projectId]);

  return { isConnected };
}
