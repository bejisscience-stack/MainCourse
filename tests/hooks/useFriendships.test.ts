/**
 * Tests for useFriendships hook.
 *
 * Covers: fetching friendships (both user1/user2 sides), removing friends,
 * error handling, and edge cases.
 */
import { renderHook, act } from '@testing-library/react';
import { mockSupabase, resetMocks, mockQueryChain } from '../__mocks__/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
}));

const mockMutate = jest.fn().mockResolvedValue(undefined);
let swrCallback: (() => Promise<any>) | null = null;
let swrKey: any = null;

jest.mock('swr', () => ({
  __esModule: true,
  default: (key: any, fetcher: any, _opts: any) => {
    swrKey = key;
    swrCallback = fetcher;
    return {
      data: key ? undefined : [],
      error: undefined,
      isLoading: !!key,
      mutate: mockMutate,
    };
  },
}));

import { useFriendships } from '@/hooks/useFriendships';

// --- Test data ---

const asUser1Row = {
  id: 'fs-1',
  user1_id: 'user-1',
  user2_id: 'user-2',
  created_at: '2026-01-01T00:00:00Z',
  friend: { id: 'user-2', username: 'bob', avatar_url: 'https://img/bob.png' },
};

const asUser2Row = {
  id: 'fs-2',
  user1_id: 'user-3',
  user2_id: 'user-1',
  created_at: '2026-01-02T00:00:00Z',
  friend: { id: 'user-3', username: 'carol', avatar_url: 'https://img/carol.png' },
};

// --- Tests ---

describe('useFriendships', () => {
  beforeEach(() => {
    resetMocks();
    mockMutate.mockClear();
    swrCallback = null;
    swrKey = null;
  });

  // ==================== Initialization ====================

  describe('initialization', () => {
    it('should not fetch when userId is null', () => {
      const { result } = renderHook(() => useFriendships(null));

      expect(swrKey).toBeNull();
      expect(result.current.friendships).toEqual([]);
    });

    it('should create correct SWR key with userId', () => {
      renderHook(() => useFriendships('user-1'));

      expect(swrKey).toEqual(['friendships', 'user-1']);
    });
  });

  // ==================== Fetching ====================

  describe('fetchFriendships (SWR fetcher)', () => {
    it('should fetch and combine friendships from both user1 and user2 queries', async () => {
      const user1Chain = mockQueryChain([asUser1Row], null);
      const user2Chain = mockQueryChain([asUser2Row], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? user1Chain : user2Chain;
      });

      renderHook(() => useFriendships('user-1'));
      const data = await swrCallback!();

      expect(data).toHaveLength(2);

      // First friendship: user is user1, friend is user2
      expect(data[0]).toEqual({
        id: 'fs-1',
        friendId: 'user-2',
        friendUsername: 'bob',
        friendAvatarUrl: 'https://img/bob.png',
        createdAt: '2026-01-01T00:00:00Z',
      });

      // Second friendship: user is user2, friend is user1 side
      expect(data[1]).toEqual({
        id: 'fs-2',
        friendId: 'user-3',
        friendUsername: 'carol',
        friendAvatarUrl: 'https://img/carol.png',
        createdAt: '2026-01-02T00:00:00Z',
      });
    });

    it('should handle empty friendships', async () => {
      const emptyChain = mockQueryChain([], null);
      mockSupabase.from.mockReturnValue(emptyChain);

      renderHook(() => useFriendships('user-1'));
      const data = await swrCallback!();

      expect(data).toEqual([]);
    });

    it('should throw on query error (user1 side)', async () => {
      const errorChain = mockQueryChain(null, { message: 'DB error' });
      mockSupabase.from.mockReturnValue(errorChain);

      renderHook(() => useFriendships('user-1'));
      await expect(swrCallback!()).rejects.toEqual({ message: 'DB error' });
    });

    it('should throw on query error (user2 side)', async () => {
      const okChain = mockQueryChain([], null);
      const errorChain = mockQueryChain(null, { message: 'Permission denied' });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? okChain : errorChain;
      });

      renderHook(() => useFriendships('user-1'));
      await expect(swrCallback!()).rejects.toEqual({ message: 'Permission denied' });
    });

    it('should default missing friend profile to "User"', async () => {
      const rowNoProfile = {
        ...asUser1Row,
        friend: null,
      };
      const chain = mockQueryChain([rowNoProfile], null);
      const emptyChain = mockQueryChain([], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? chain : emptyChain;
      });

      renderHook(() => useFriendships('user-1'));
      const data = await swrCallback!();

      expect(data[0].friendUsername).toBe('User');
      expect(data[0].friendAvatarUrl).toBe('');
    });

    it('should handle null data arrays gracefully', async () => {
      const nullDataChain = mockQueryChain(null, null);
      // Override then to return { data: null, error: null }
      nullDataChain.then = undefined as any;
      const chain = {
        ...nullDataChain,
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
      mockSupabase.from.mockReturnValue(chain);

      renderHook(() => useFriendships('user-1'));
      const data = await swrCallback!();

      expect(data).toEqual([]);
    });
  });

  // ==================== removeFriend ====================

  describe('removeFriend', () => {
    it('should delete friendship row and revalidate', async () => {
      const deleteChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(deleteChain);

      const { result } = renderHook(() => useFriendships('user-1'));

      await act(async () => {
        await result.current.removeFriend('fs-1');
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('friendships');
      expect(deleteChain.delete).toHaveBeenCalled();
      expect(deleteChain.eq).toHaveBeenCalledWith('id', 'fs-1');
      expect(mockMutate).toHaveBeenCalled();
    });

    it('should throw when not authenticated', async () => {
      const { result } = renderHook(() => useFriendships(null));

      await expect(
        act(async () => {
          await result.current.removeFriend('fs-1');
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw on delete error', async () => {
      const errorChain = mockQueryChain(null, null);
      errorChain.delete.mockReturnValue({
        ...errorChain,
        eq: jest.fn().mockReturnValue({
          then: (resolve: any) =>
            Promise.resolve({ data: null, error: { message: 'Not found' } }).then(resolve),
        }),
      });
      mockSupabase.from.mockReturnValue(errorChain);

      const { result } = renderHook(() => useFriendships('user-1'));

      await expect(
        act(async () => {
          await result.current.removeFriend('fs-999');
        })
      ).rejects.toEqual({ message: 'Not found' });
    });

    it('should reset isSubmitting after success', async () => {
      const deleteChain = mockQueryChain(null, null);
      mockSupabase.from.mockReturnValue(deleteChain);

      const { result } = renderHook(() => useFriendships('user-1'));

      await act(async () => {
        await result.current.removeFriend('fs-1');
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('should reset isSubmitting after failure', async () => {
      const errorChain = mockQueryChain(null, null);
      errorChain.delete.mockReturnValue({
        ...errorChain,
        eq: jest.fn().mockReturnValue({
          then: (resolve: any) =>
            Promise.resolve({ data: null, error: { message: 'fail' } }).then(resolve),
        }),
      });
      mockSupabase.from.mockReturnValue(errorChain);

      const { result } = renderHook(() => useFriendships('user-1'));

      try {
        await act(async () => {
          await result.current.removeFriend('fs-1');
        });
      } catch {
        // expected
      }

      expect(result.current.isSubmitting).toBe(false);
    });
  });
});
