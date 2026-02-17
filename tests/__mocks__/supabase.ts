/**
 * Mock Supabase client for testing hooks.
 *
 * Usage in tests:
 *   import { mockSupabase, resetMocks, mockQueryChain } from '../__mocks__/supabase';
 *
 * The actual `@/lib/supabase` module is mocked by jest.mock in each test file.
 */

// --- Query chain builder ---

export interface MockQueryChain {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  maybeSingle: jest.Mock;
  single: jest.Mock;
  _resolve: { data: any; error: any };
}

/** Create a chainable mock that resolves to { data, error }. */
export function mockQueryChain(data: any = null, error: any = null): MockQueryChain {
  const result = { data, error };
  const chain: any = {};
  const self = () => chain;

  chain._resolve = result;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.delete = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.maybeSingle = jest.fn().mockResolvedValue(result);
  chain.single = jest.fn().mockResolvedValue(result);

  // Make the chain itself awaitable (when no terminal method is called)
  chain.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);

  return chain as MockQueryChain;
}

// --- Supabase client mock ---

export const mockFrom = jest.fn();
export const mockChannel = jest.fn();

export const mockAuth = {
  getSession: jest.fn().mockResolvedValue({
    data: { session: { access_token: 'test-token', user: { id: 'user-1' } } },
  }),
  refreshSession: jest.fn().mockResolvedValue({
    data: { session: { access_token: 'refreshed-token', user: { id: 'user-1' } } },
  }),
  onAuthStateChange: jest.fn().mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  }),
};

export const mockSupabase = {
  from: mockFrom,
  channel: mockChannel,
  auth: mockAuth,
};

export function resetMocks() {
  mockFrom.mockReset();
  mockChannel.mockReset();
  mockAuth.getSession.mockResolvedValue({
    data: { session: { access_token: 'test-token', user: { id: 'user-1' } } },
  });
  mockAuth.refreshSession.mockResolvedValue({
    data: { session: { access_token: 'refreshed-token', user: { id: 'user-1' } } },
  });
}
