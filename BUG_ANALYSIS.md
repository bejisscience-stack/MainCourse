# Codebase Bug Analysis Report

## Identified Issues and Hypotheses

### Category 1: Memory Leaks & Resource Cleanup

**Hypothesis A1**: Real-time subscriptions in `useRealtimeMessages` may not be properly cleaned up when components unmount or channel changes, causing memory leaks.

**Hypothesis A2**: File preview URLs created with `URL.createObjectURL()` in `MessageInput.tsx` may not be revoked properly, causing memory leaks.

**Hypothesis A3**: Event listeners (storage, auth state) may not be cleaned up properly, causing memory leaks.

### Category 2: Race Conditions & Concurrent Requests

**Hypothesis B1**: Multiple concurrent enrollment requests for the same course could create duplicate requests due to lack of proper locking/checking.

**Hypothesis B2**: Session refresh in `useChatMessages` could cause race conditions when multiple components try to refresh simultaneously.

**Hypothesis B3**: Message sending in `MessageInput` allows concurrent sends which could cause message ordering issues or duplicate messages.

### Category 3: Error Handling & Silent Failures

**Hypothesis C1**: Silent error catching in `lib/supabase.ts` (`.catch(() => {})`) may hide critical authentication errors.

**Hypothesis C2**: Database query errors in API routes may not be properly logged or handled, making debugging difficult.

**Hypothesis C3**: Profile fetch failures in message API routes may cause messages to display with "User" instead of actual usernames.

### Category 4: State Management Issues

**Hypothesis D1**: Stale closures in `useChatMessages` callbacks could cause messages to not update properly when channel changes.

**Hypothesis D2**: Ref updates (`isSubmittingRef`, `navigationStartedRef`) in login page may not prevent double submissions in all edge cases.

**Hypothesis D3**: SWR cache in `useUser` may not properly invalidate when role changes, causing stale role data.

### Category 5: Type Safety & Data Validation

**Hypothesis E1**: Use of `any` types in several places could hide type errors and cause runtime issues.

**Hypothesis E2**: Missing validation for channel access before allowing message sends could allow unauthorized access.

**Hypothesis E3**: Profile username normalization may fail for edge cases (null, empty strings) causing display issues.

### Category 6: Real-time Subscription Issues

**Hypothesis F1**: Real-time message subscriptions may create duplicate subscriptions when channel changes rapidly.

**Hypothesis F2**: Profile cache in `useRealtimeMessages` may return stale data if profile updates occur.

**Hypothesis F3**: Typing indicators may not be properly cleaned up, causing stale typing states.

## Testing Strategy

We will instrument the code with debug logs to test each hypothesis during runtime. Logs will track:
- Subscription lifecycle (create/cleanup)
- Memory allocation (URL.createObjectURL/revokeObjectURL)
- Concurrent request patterns
- Error occurrences and handling
- State updates and ref changes
- Cache invalidation events




