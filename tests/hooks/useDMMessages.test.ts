/**
 * Tests for useDMMessages hook.
 *
 * Covers: initial fetch, optimistic updates (pending, replace, fail, remove),
 * real-time message handling, pagination (loadMore), error handling,
 * conversation switching, and edge cases.
 */
import { renderHook, act } from '@testing-library/react';
import { mockSupabase, resetMocks } from '../__mocks__/supabase';
import type { Message } from '@/types/message';

// Mock the supabase module
jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock api-client
jest.mock('@/lib/api-client', () => ({
  edgeFunctionUrl: jest.fn((name: string) => `https://test.supabase.co/functions/v1/${name}`),
}));

// Mock useRealtimeDMMessages
const mockRealtimeCallbacks: {
  onNewMessage?: (msg: Message) => void;
  onMessageUpdate?: (msg: Message) => void;
  onMessageDelete?: (id: string) => void;
} = {};

jest.mock('@/hooks/useRealtimeDMMessages', () => ({
  useRealtimeDMMessages: (opts: any) => {
    mockRealtimeCallbacks.onNewMessage = opts.onNewMessage;
    mockRealtimeCallbacks.onMessageUpdate = opts.onMessageUpdate;
    mockRealtimeCallbacks.onMessageDelete = opts.onMessageDelete;
    return { isConnected: true };
  },
}));

// Mock profile caching
jest.mock('@/hooks/useRealtimeMessages', () => ({
  prefetchProfiles: jest.fn().mockResolvedValue(undefined),
  getCachedUsername: jest.fn((id: string) => id === 'user-1' ? 'alice' : 'User'),
}));

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Env vars
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

import { useDMMessages } from '@/hooks/useDMMessages';

// --- Test data ---

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    content: 'Hello world',
    timestamp: Date.now(),
    user: { id: 'user-1', username: 'alice', avatarUrl: '' },
    ...overrides,
  };
}

function mockFetchSuccess(messages: Message[], status = 200) {
  mockFetch.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: () => Promise.resolve({ messages }),
  });
}

function mockFetchError(status: number, error: string) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: error,
    json: () => Promise.resolve({ error }),
  });
}

// --- Tests ---

describe('useDMMessages', () => {
  beforeEach(() => {
    resetMocks();
    mockFetch.mockReset();
    jest.useFakeTimers({ legacyFakeTimers: false });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ==================== Initialization ====================

  describe('initialization', () => {
    it('should not fetch when conversationId is null', () => {
      const { result } = renderHook(() =>
        useDMMessages({ conversationId: null })
      );

      expect(result.current.messages).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should not fetch when enabled is false', () => {
      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1', enabled: false })
      );

      expect(result.current.messages).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should fetch messages on mount with valid conversationId', async () => {
      const msgs = [makeMessage({ id: 'msg-1' }), makeMessage({ id: 'msg-2' })];
      mockFetchSuccess(msgs);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      // Wait for async effect
      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('dm-messages'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );
    });

    it('should set hasMore=false when fewer than 50 messages returned', async () => {
      const msgs = [makeMessage({ id: 'msg-1' })];
      mockFetchSuccess(msgs);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.hasMore).toBe(false);
    });

    it('should set hasMore=true when exactly 50 messages returned', async () => {
      const msgs = Array.from({ length: 50 }, (_, i) => makeMessage({ id: `msg-${i}` }));
      mockFetchSuccess(msgs);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.hasMore).toBe(true);
    });
  });

  // ==================== Error Handling ====================

  describe('error handling', () => {
    it('should set error on fetch failure', async () => {
      mockFetchError(500, 'Internal Server Error');

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle 401 and attempt session refresh', async () => {
      // First fetch returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      });

      // After refresh, retry succeeds
      const msgs = [makeMessage({ id: 'msg-1' })];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ messages: msgs }),
      });

      renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(mockSupabase.auth.refreshSession).toHaveBeenCalled();
    });
  });

  // ==================== Conversation Switching ====================

  describe('conversation switching', () => {
    it('should clear messages when conversationId changes', async () => {
      const msgs1 = [makeMessage({ id: 'msg-1', content: 'Convo 1' })];
      mockFetchSuccess(msgs1);

      const { result, rerender } = renderHook(
        ({ conversationId }) => useDMMessages({ conversationId }),
        { initialProps: { conversationId: 'conv-1' as string | null } }
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Switch conversation
      const msgs2 = [makeMessage({ id: 'msg-2', content: 'Convo 2' })];
      mockFetchSuccess(msgs2);

      rerender({ conversationId: 'conv-2' });

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Messages should be from new conversation only
      const msgIds = result.current.messages.map(m => m.id);
      expect(msgIds).not.toContain('msg-1');
    });

    it('should clear messages when conversationId becomes null', async () => {
      const msgs = [makeMessage({ id: 'msg-1' })];
      mockFetchSuccess(msgs);

      const { result, rerender } = renderHook(
        ({ conversationId }) => useDMMessages({ conversationId }),
        { initialProps: { conversationId: 'conv-1' as string | null } }
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      rerender({ conversationId: null });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  // ==================== Optimistic Updates ====================

  describe('optimistic updates', () => {
    it('addPendingMessage should add a pending message to the list', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      let tempId: string;
      act(() => {
        tempId = result.current.addPendingMessage('Hello!', undefined, 'user-1');
      });

      expect(result.current.messages).toHaveLength(1);
      const pending = result.current.messages[0] as any;
      expect(pending.content).toBe('Hello!');
      expect(pending.pending).toBe(true);
      expect(pending.tempId).toBeDefined();
    });

    it('replacePendingMessage should replace pending with real message', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      let tempId: string;
      act(() => {
        tempId = result.current.addPendingMessage('Hello!', undefined, 'user-1');
      });

      const realMessage = makeMessage({ id: 'msg-real', content: 'Hello!' });

      act(() => {
        result.current.replacePendingMessage(tempId!, realMessage);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('msg-real');
      expect((result.current.messages[0] as any).pending).toBeUndefined();
    });

    it('markMessageFailed should mark pending message as failed', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      let tempId: string;
      act(() => {
        tempId = result.current.addPendingMessage('Hello!', undefined, 'user-1');
      });

      act(() => {
        result.current.markMessageFailed(tempId!, 'Network error');
      });

      const failed = result.current.messages[0] as any;
      expect(failed.failed).toBe(true);
      expect(failed.error).toBe('Network error');
      expect(failed.pending).toBeUndefined();
    });

    it('removePendingMessage should remove the pending message', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      let tempId: string;
      act(() => {
        tempId = result.current.addPendingMessage('Hello!', undefined, 'user-1');
      });

      expect(result.current.messages).toHaveLength(1);

      act(() => {
        result.current.removePendingMessage(tempId!);
      });

      expect(result.current.messages).toHaveLength(0);
    });

    it('replacePendingMessage should handle duplicate real message', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const realMessage = makeMessage({ id: 'msg-real', content: 'Hello!' });

      // First add via realtime (simulating the real message arriving first)
      act(() => {
        mockRealtimeCallbacks.onNewMessage?.(realMessage);
      });

      // Then add pending
      let tempId: string;
      act(() => {
        tempId = result.current.addPendingMessage('Hello!', undefined, 'user-1');
      });

      // Replace pending with same real message (already exists)
      act(() => {
        result.current.replacePendingMessage(tempId!, realMessage);
      });

      // Should have deduplicated - real message should be there, pending removed
      const ids = result.current.messages.map(m => m.id);
      const realCount = ids.filter(id => id === 'msg-real').length;
      expect(realCount).toBe(1);
    });
  });

  // ==================== Real-time Handlers ====================

  describe('real-time message handlers', () => {
    it('handleNewMessage should add new message', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const newMsg = makeMessage({ id: 'rt-msg-1', content: 'Real-time!' });

      act(() => {
        mockRealtimeCallbacks.onNewMessage?.(newMsg);
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('rt-msg-1');
    });

    it('handleNewMessage should not duplicate existing message', async () => {
      const existing = makeMessage({ id: 'msg-1', content: 'Hi' });
      mockFetchSuccess([existing]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Same message arrives via realtime
      act(() => {
        mockRealtimeCallbacks.onNewMessage?.(existing);
      });

      expect(result.current.messages).toHaveLength(1);
    });

    it('handleNewMessage should replace matching pending message', async () => {
      mockFetchSuccess([]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      // Add pending
      let tempId: string;
      act(() => {
        tempId = result.current.addPendingMessage('Hello!', undefined, 'user-1');
      });

      // Real message arrives via realtime with matching content
      const realMsg = makeMessage({
        id: 'real-1',
        content: 'Hello!',
        user: { id: 'user-1', username: 'alice', avatarUrl: '' },
        timestamp: Date.now(),
      });

      act(() => {
        mockRealtimeCallbacks.onNewMessage?.(realMsg);
      });

      // Pending should be replaced with real message
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].id).toBe('real-1');
    });

    it('handleMessageUpdate should update existing message', async () => {
      const msg = makeMessage({ id: 'msg-1', content: 'Original' });
      mockFetchSuccess([msg]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      const updatedMsg = { ...msg, content: 'Edited', edited: true };

      act(() => {
        mockRealtimeCallbacks.onMessageUpdate?.(updatedMsg);
      });

      expect(result.current.messages[0].content).toBe('Edited');
      expect((result.current.messages[0] as any).edited).toBe(true);
    });

    it('handleMessageDelete should remove message', async () => {
      const msg = makeMessage({ id: 'msg-1' });
      mockFetchSuccess([msg]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      expect(result.current.messages).toHaveLength(1);

      act(() => {
        mockRealtimeCallbacks.onMessageDelete?.('msg-1');
      });

      expect(result.current.messages).toHaveLength(0);
    });
  });

  // ==================== updateMessage ====================

  describe('updateMessage', () => {
    it('should update a specific message by id', async () => {
      const msg = makeMessage({ id: 'msg-1', content: 'Original' });
      mockFetchSuccess([msg]);

      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      await act(async () => {
        await jest.runAllTimersAsync();
      });

      act(() => {
        result.current.updateMessage('msg-1', { content: 'Updated' });
      });

      expect(result.current.messages[0].content).toBe('Updated');
    });
  });

  // ==================== isConnected ====================

  describe('real-time connection', () => {
    it('should expose isConnected from realtime hook', () => {
      const { result } = renderHook(() =>
        useDMMessages({ conversationId: 'conv-1' })
      );

      expect(result.current.isConnected).toBe(true);
    });
  });
});
