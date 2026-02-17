/**
 * Tests for useDMConversations hook.
 *
 * Covers: fetching conversations, getOrCreateConversation (existing + new),
 * error handling, sorting, and edge cases.
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

import { useDMConversations } from '@/hooks/useDMConversations';

// --- Test data ---

const asUser1Row = {
  id: 'conv-1',
  user1_id: 'user-1',
  user2_id: 'user-2',
  last_message: 'Hello!',
  last_message_at: '2026-01-02T12:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  friend: { id: 'user-2', username: 'bob', avatar_url: 'https://img/bob.png' },
};

const asUser2Row = {
  id: 'conv-2',
  user1_id: 'user-3',
  user2_id: 'user-1',
  last_message: 'Hey there!',
  last_message_at: '2026-01-03T12:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  friend: { id: 'user-3', username: 'carol', avatar_url: 'https://img/carol.png' },
};

const noMessageRow = {
  id: 'conv-3',
  user1_id: 'user-1',
  user2_id: 'user-4',
  last_message: null,
  last_message_at: null,
  created_at: '2026-01-04T00:00:00Z',
  friend: { id: 'user-4', username: 'dave', avatar_url: '' },
};

// --- Tests ---

describe('useDMConversations', () => {
  beforeEach(() => {
    resetMocks();
    mockMutate.mockClear();
    swrCallback = null;
    swrKey = null;
  });

  // ==================== Initialization ====================

  describe('initialization', () => {
    it('should not fetch when userId is null', () => {
      const { result } = renderHook(() => useDMConversations(null));

      expect(swrKey).toBeNull();
      expect(result.current.conversations).toEqual([]);
    });

    it('should create correct SWR key with userId', () => {
      renderHook(() => useDMConversations('user-1'));

      expect(swrKey).toEqual(['dm-conversations', 'user-1']);
    });
  });

  // ==================== Fetching ====================

  describe('fetchDMConversations (SWR fetcher)', () => {
    it('should fetch and combine conversations from both sides', async () => {
      const user1Chain = mockQueryChain([asUser1Row], null);
      const user2Chain = mockQueryChain([asUser2Row], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? user1Chain : user2Chain;
      });

      renderHook(() => useDMConversations('user-1'));
      const data = await swrCallback!();

      expect(data).toHaveLength(2);
      // conv-2 has a later last_message_at, so it should be first after sorting
      expect(data[0].id).toBe('conv-2');
      expect(data[0].friendUsername).toBe('carol');
      expect(data[1].id).toBe('conv-1');
      expect(data[1].friendUsername).toBe('bob');
    });

    it('should sort conversations by last_message_at DESC', async () => {
      const user1Chain = mockQueryChain([asUser1Row, noMessageRow], null);
      const user2Chain = mockQueryChain([asUser2Row], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? user1Chain : user2Chain;
      });

      renderHook(() => useDMConversations('user-1'));
      const data = await swrCallback!();

      expect(data).toHaveLength(3);
      // conv-2 (Jan 3) > conv-1 (Jan 2) > conv-3 (null → 0)
      expect(data[0].id).toBe('conv-2');
      expect(data[1].id).toBe('conv-1');
      expect(data[2].id).toBe('conv-3');
    });

    it('should handle conversations with no last message', async () => {
      const chain = mockQueryChain([noMessageRow], null);
      const emptyChain = mockQueryChain([], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? chain : emptyChain;
      });

      renderHook(() => useDMConversations('user-1'));
      const data = await swrCallback!();

      expect(data[0].lastMessage).toBeUndefined();
      expect(data[0].lastMessageAt).toBeNull();
    });

    it('should handle empty conversations', async () => {
      const emptyChain = mockQueryChain([], null);
      mockSupabase.from.mockReturnValue(emptyChain);

      renderHook(() => useDMConversations('user-1'));
      const data = await swrCallback!();

      expect(data).toEqual([]);
    });

    it('should throw on query error', async () => {
      const errorChain = mockQueryChain(null, { message: 'DB error' });
      mockSupabase.from.mockReturnValue(errorChain);

      renderHook(() => useDMConversations('user-1'));
      await expect(swrCallback!()).rejects.toEqual({ message: 'DB error' });
    });

    it('should default missing friend profile to "User"', async () => {
      const rowNoProfile = { ...asUser1Row, friend: null };
      const chain = mockQueryChain([rowNoProfile], null);
      const emptyChain = mockQueryChain([], null);

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        return callCount <= 1 ? chain : emptyChain;
      });

      renderHook(() => useDMConversations('user-1'));
      const data = await swrCallback!();

      expect(data[0].friendUsername).toBe('User');
      expect(data[0].friendAvatarUrl).toBe('');
    });
  });

  // ==================== getOrCreateConversation ====================

  describe('getOrCreateConversation', () => {
    it('should return existing conversation when found', async () => {
      const existingData = {
        id: 'conv-1',
        user1_id: 'user-1',
        user2_id: 'user-2',
        last_message: 'Hello!',
        last_message_at: '2026-01-02T12:00:00Z',
        created_at: '2026-01-01T00:00:00Z',
      };

      // First call: from('dm_conversations') for maybeSingle check
      const findChain = mockQueryChain(existingData, null);
      // Second call: from('profiles') for friend profile
      const profileChain = mockQueryChain({ username: 'bob', avatar_url: 'https://img/bob.png' }, null);

      let callCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'profiles') return profileChain;
        return findChain;
      });

      const { result } = renderHook(() => useDMConversations('user-1'));

      let conversation: any;
      await act(async () => {
        conversation = await result.current.getOrCreateConversation('user-2');
      });

      expect(conversation).toEqual({
        id: 'conv-1',
        friendId: 'user-2',
        friendUsername: 'bob',
        friendAvatarUrl: 'https://img/bob.png',
        lastMessage: 'Hello!',
        lastMessageAt: '2026-01-02T12:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      });
      expect(mockMutate).toHaveBeenCalled();
    });

    it('should create new conversation when none exists', async () => {
      const newConvoData = {
        id: 'conv-new',
        user1_id: 'user-1',
        user2_id: 'user-5',
        last_message: null,
        last_message_at: null,
        created_at: '2026-01-05T00:00:00Z',
      };

      // maybeSingle returns null (no existing convo)
      const findChain = mockQueryChain(null, null);
      // insert returns new convo
      const insertChain = mockQueryChain(newConvoData, null);
      // profile lookup
      const profileChain = mockQueryChain({ username: 'eve', avatar_url: '' }, null);

      let fromCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'profiles') return profileChain;
        // First dm_conversations call = maybeSingle (find), second = insert
        if (fromCallCount === 1) return findChain;
        return insertChain;
      });

      const { result } = renderHook(() => useDMConversations('user-1'));

      let conversation: any;
      await act(async () => {
        conversation = await result.current.getOrCreateConversation('user-5');
      });

      expect(conversation.id).toBe('conv-new');
      expect(conversation.friendId).toBe('user-5');
      expect(conversation.friendUsername).toBe('eve');
      expect(conversation.lastMessage).toBeUndefined();
    });

    it('should ensure user1_id < user2_id ordering', async () => {
      // user-1 > user-0, so user1_id should be user-0, user2_id should be user-1
      const findChain = mockQueryChain(null, null);
      const insertChain = mockQueryChain(
        { id: 'conv-x', user1_id: 'user-0', user2_id: 'user-1', last_message: null, last_message_at: null, created_at: '2026-01-01T00:00:00Z' },
        null
      );
      const profileChain = mockQueryChain({ username: 'zero', avatar_url: '' }, null);

      let fromCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        fromCallCount++;
        if (table === 'profiles') return profileChain;
        if (fromCallCount === 1) return findChain;
        return insertChain;
      });

      const { result } = renderHook(() => useDMConversations('user-1'));

      await act(async () => {
        await result.current.getOrCreateConversation('user-0');
      });

      // Verify the eq calls used the correct ordering
      expect(findChain.eq).toHaveBeenCalledWith('user1_id', 'user-0');
      expect(findChain.eq).toHaveBeenCalledWith('user2_id', 'user-1');
    });

    it('should throw when not authenticated', async () => {
      const { result } = renderHook(() => useDMConversations(null));

      await expect(
        act(async () => {
          await result.current.getOrCreateConversation('user-2');
        })
      ).rejects.toThrow('Not authenticated');
    });

    it('should throw on fetch error', async () => {
      const errorChain = mockQueryChain(null, { message: 'RLS denied' });
      mockSupabase.from.mockReturnValue(errorChain);

      const { result } = renderHook(() => useDMConversations('user-1'));

      await expect(
        act(async () => {
          await result.current.getOrCreateConversation('user-2');
        })
      ).rejects.toEqual({ message: 'RLS denied' });
    });

    it('should throw on insert error', async () => {
      const findChain = mockQueryChain(null, null); // no existing
      const insertChain = mockQueryChain(null, { message: 'Insert failed' });

      let fromCallCount = 0;
      mockSupabase.from.mockImplementation(() => {
        fromCallCount++;
        return fromCallCount === 1 ? findChain : insertChain;
      });

      const { result } = renderHook(() => useDMConversations('user-1'));

      await expect(
        act(async () => {
          await result.current.getOrCreateConversation('user-2');
        })
      ).rejects.toEqual({ message: 'Insert failed' });
    });

    it('should reset isCreating after success', async () => {
      const findChain = mockQueryChain(
        { id: 'conv-1', user1_id: 'user-1', user2_id: 'user-2', last_message: null, last_message_at: null, created_at: '2026-01-01T00:00:00Z' },
        null
      );
      const profileChain = mockQueryChain({ username: 'bob', avatar_url: '' }, null);

      mockSupabase.from.mockImplementation((table: string) => {
        return table === 'profiles' ? profileChain : findChain;
      });

      const { result } = renderHook(() => useDMConversations('user-1'));

      await act(async () => {
        await result.current.getOrCreateConversation('user-2');
      });

      expect(result.current.isCreating).toBe(false);
    });

    it('should reset isCreating after failure', async () => {
      const errorChain = mockQueryChain(null, { message: 'fail' });
      mockSupabase.from.mockReturnValue(errorChain);

      const { result } = renderHook(() => useDMConversations('user-1'));

      try {
        await act(async () => {
          await result.current.getOrCreateConversation('user-2');
        });
      } catch {
        // expected
      }

      expect(result.current.isCreating).toBe(false);
    });
  });
});
