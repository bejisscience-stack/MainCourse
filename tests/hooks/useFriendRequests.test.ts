/**
 * Tests for useFriendRequests hook.
 *
 * Covers: fetching sent/received requests, sending, accepting,
 * rejecting, cancelling, error handling, and edge cases.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { mockSupabase, resetMocks, mockQueryChain } from '../__mocks__/supabase';

// Mock the supabase module before importing the hook
jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

// Mock SWR to give us control over data fetching
const mockMutate = jest.fn().mockResolvedValue(undefined);
let swrCallback: (() => Promise<any>) | null = null;
let swrKey: any = null;

jest.mock('swr', () => ({
  __esModule: true,
  default: (key: any, fetcher: any, _opts: any) => {
    swrKey = key;
    swrCallback = fetcher;
    // If key is null, SWR won't call fetcher
    return {
      data: key ? undefined : { sent: [], received: [] },
      error: undefined,
      isLoading: !!key,
      mutate: mockMutate,
    };
  },
}));

import { useFriendRequests } from '@/hooks/useFriendRequests';

// --- Test data ---

const mockSentRow = {
  id: 'req-1',
  sender_id: 'user-1',
  receiver_id: 'user-2',
  status: 'pending',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  sender: { username: 'alice', avatar_url: 'https://img/alice.png' },
  receiver: { username: 'bob', avatar_url: 'https://img/bob.png' },
};

const mockReceivedRow = {
  id: 'req-2',
  sender_id: 'user-3',
  receiver_id: 'user-1',
  status: 'pending',
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
  sender: { username: 'carol', avatar_url: 'https://img/carol.png' },
  receiver: { username: 'alice', avatar_url: 'https://img/alice.png' },
};

// --- Tests ---

describe('useFriendRequests', () => {
  beforeEach(() => {
    resetMocks();
    mockMutate.mockClear();
    swrCallback = null;
    swrKey = null;
  });

  // ==================== Initialization ====================

  describe('initialization', () => {
    it('should not fetch when userId is null', () => {
      const { result } = renderHook(() => useFriendRequests(null));

      expect(swrKey).toBeNull();
      expect(result.current.sent).toEqual([]);
      expect(result.current.received).toEqual([]);
    });

    it('should create correct SWR key with userId', () => {
      renderHook(() => useFriendRequests('user-1'));

      expect(swrKey).toEqual(['friend-requests', 'user-1']);
    });
  });

  // ==================== Fetching (via SWR fetcher) ====================

  describe('fetchFriendRequests (SWR fetcher)', () => {
    it('should fetch and transform sent and received requests', async () => {
      const sentChain = mockQueryChain([mockSentRow], null);
      const receivedChain = mockQueryChain([mockReceivedRow], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        // First call is for sent (sender_id), second for received (receiver_id)
        return callCount <= 1 ? sentChain : receivedChain;
      });

      renderHook(() => useFriendRequests('user-1'));

      expect(swrCallback).toBeDefined();
      const data = await swrCallback!();

      expect(data.sent).toHaveLength(1);
      expect(data.sent[0]).toEqual({
        id: 'req-1',
        senderId: 'user-1',
        receiverId: 'user-2',
        status: 'pending',
        senderUsername: 'alice',
        senderAvatarUrl: 'https://img/alice.png',
        receiverUsername: 'bob',
        receiverAvatarUrl: 'https://img/bob.png',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      });

      expect(data.received).toHaveLength(1);
      expect(data.received[0].id).toBe('req-2');
    });

    it('should handle empty sent and received lists', async () => {
      const emptyChain = mockQueryChain([], null);
      mockSupabase.from.mockReturnValue(emptyChain);

      renderHook(() => useFriendRequests('user-1'));
      const data = await swrCallback!();

      expect(data.sent).toEqual([]);
      expect(data.received).toEqual([]);
    });

    it('should throw on sent query error', async () => {
      const errorChain = mockQueryChain(null, { message: 'DB error', code: '500' });
      mockSupabase.from.mockReturnValue(errorChain);

      renderHook(() => useFriendRequests('user-1'));
      await expect(swrCallback!()).rejects.toEqual({ message: 'DB error', code: '500' });
    });

    it('should handle rows with null sender/receiver profile', async () => {
      const rowWithNullProfile = {
        ...mockSentRow,
        sender: null,
        receiver: null,
      };
      const chain = mockQueryChain([rowWithNullProfile], null);
      mockSupabase.from.mockReturnValue(chain);

      renderHook(() => useFriendRequests('user-1'));
      const data = await swrCallback!();

      expect(data.sent[0].senderUsername).toBeUndefined();
      expect(data.sent[0].senderAvatarUrl).toBeUndefined();
      expect(data.sent[0].receiverUsername).toBeUndefined();
      expect(data.sent[0].receiverAvatarUrl).toBeUndefined();
    });
  });

  // ==================== sendFriendRequest ====================

  describe('sendFriendRequest', () => {
    it('should insert a friend request and revalidate', async () => {
      const insertChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(insertChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      await act(async () => {
        await result.current.sendFriendRequest('user-2');
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('friend_requests');
      expect(insertChain.insert).toHaveBeenCalledWith({
        sender_id: 'user-1',
        receiver_id: 'user-2',
      });
      expect(mockMutate).toHaveBeenCalled();
    });

    it('should throw when not authenticated', async () => {
      const { result } = renderHook(() => useFriendRequests(null));

      await expect(
        act(async () => {
          await result.current.sendFriendRequest('user-2');
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw on insert error', async () => {
      const errorChain = mockQueryChain(null, null);
      errorChain.insert.mockReturnValue({
        ...errorChain,
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: null, error: { message: 'Duplicate' } }).then(resolve, reject),
      });
      mockSupabase.from.mockReturnValue(errorChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      await expect(
        act(async () => {
          await result.current.sendFriendRequest('user-2');
        })
      ).rejects.toEqual({ message: 'Duplicate' });
    });

    it('should reset isSubmitting after success', async () => {
      const insertChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(insertChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      await act(async () => {
        await result.current.sendFriendRequest('user-2');
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should reset isSubmitting after failure', async () => {
      const errorChain = mockQueryChain(null, null);
      errorChain.insert.mockReturnValue({
        ...errorChain,
        then: (resolve: any) =>
          Promise.resolve({ data: null, error: { message: 'fail' } }).then(resolve),
      });
      mockSupabase.from.mockReturnValue(errorChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      try {
        await act(async () => {
          await result.current.sendFriendRequest('user-2');
        });
      } catch {
        // expected
      }

      expect(result.current.isSubmitting).toBe(false);
    });
  });

  // ==================== acceptFriendRequest ====================

  describe('acceptFriendRequest', () => {
    it('should update status to accepted and revalidate', async () => {
      const updateChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(updateChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      await act(async () => {
        await result.current.acceptFriendRequest('req-2');
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('friend_requests');
      expect(updateChain.update).toHaveBeenCalledWith({ status: 'accepted' });
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'req-2');
      expect(updateChain.eq).toHaveBeenCalledWith('receiver_id', 'user-1');
      expect(mockMutate).toHaveBeenCalled();
    });

    it('should throw when not authenticated', async () => {
      const { result } = renderHook(() => useFriendRequests(null));

      await expect(
        act(async () => {
          await result.current.acceptFriendRequest('req-2');
        })
      ).rejects.toThrow('Not authenticated');
    });
  });

  // ==================== rejectFriendRequest ====================

  describe('rejectFriendRequest', () => {
    it('should update status to rejected and revalidate', async () => {
      const updateChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(updateChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      await act(async () => {
        await result.current.rejectFriendRequest('req-2');
      });

      expect(updateChain.update).toHaveBeenCalledWith({ status: 'rejected' });
      expect(updateChain.eq).toHaveBeenCalledWith('id', 'req-2');
      expect(updateChain.eq).toHaveBeenCalledWith('receiver_id', 'user-1');
      expect(mockMutate).toHaveBeenCalled();
    });
  });

  // ==================== cancelFriendRequest ====================

  describe('cancelFriendRequest', () => {
    it('should delete pending request and revalidate', async () => {
      const deleteChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(deleteChain);

      const { result } = renderHook(() => useFriendRequests('user-1'));

      await act(async () => {
        await result.current.cancelFriendRequest('req-1');
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('friend_requests');
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('id', 'req-1');
      expect(deleteChain.eq).toHaveBeenCalledWith('sender_id', 'user-1');
      expect(deleteChain.eq).toHaveBeenCalledWith('status', 'pending');
      expect(mockMutate).toHaveBeenCalled();
    });

    it('should throw when not authenticated', async () => {
      const { result } = renderHook(() => useFriendRequests(null));

      await expect(
        act(async () => {
          await result.current.cancelFriendRequest('req-1');
        })
      ).rejects.toThrow('Not authenticated');
    });
  });
});
