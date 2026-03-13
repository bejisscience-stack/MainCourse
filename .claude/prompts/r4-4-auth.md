Fix 2 issues in lib/auth.ts ONLY. Do not touch any other file.

FIX 1 — MEDIUM — User enumeration via signup (AUTH-01):
- At lines 53-55 where signup error is thrown
- Replace: throw new Error(error.message || 'Failed to create account. Please try again.')
- With: throw new Error('Check your email to continue.')
- This generic message is returned whether the email is new or already registered
- Add a console.error before the throw to log the real error server-side:
  console.error('[Auth] Signup error:', error.message);

FIX 2 — LOW — getCurrentUser uses getSession first (AUTH-02):
- At lines 181-191 where getCurrentUser is defined
- Add a comment documenting this is intentional for client-side performance:
  // Note: getSession() reads from cookies (fast, no network). getUser() verifies with server.
  // This order is acceptable for client-side UI state. Server-side auth uses verifyTokenAndGetUser() instead.
- Do NOT change the logic — it is correct for its use case

Run npm run build. Commit with message "security: fix user enumeration, document auth pattern (AUTH-01, AUTH-02)"
Output <promise>DONE</promise> when build passes.
