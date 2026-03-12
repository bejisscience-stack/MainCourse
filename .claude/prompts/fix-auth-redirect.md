Fix 2 auth issues in app/auth/callback/route.ts ONLY. Do not touch any other file.

FIX 1 — CRITICAL — Open redirect (AUTH-03):
- At line 13 where next parameter is read from URL, apply validateRedirectUrl
- Import validateRedirectUrl from lib/validate-redirect (it already exists and is used in app/signup/page.tsx)
- Pattern: const next = validateRedirectUrl(requestUrl.searchParams.get('next')) || '/my-courses';
- This ensures absolute URLs like https://evil.com are rejected
- Apply to all places where next is used in redirects (lines 103 and 156)

FIX 2 — MEDIUM — Auth error message leaking (AUTH-04):
- At lines 56 and 159-161 where error.message is put into redirect URL query params
- Replace raw error.message with generic error codes
- Pattern: const friendlyError = error.message?.includes('expired') ? 'link_expired' : error.message?.includes('not found') ? 'not_found' : 'auth_error';
- Then: return NextResponse.redirect(new URL('/login?error=' + friendlyError, baseUrl))
- Apply to both locations (line 56 OTP flow and lines 159-161 PKCE flow)

Run npm run build after changes. Commit with message "security: fix open redirect and error leaking in auth callback (AUTH-03, AUTH-04)"
Output <promise>DONE</promise> when build passes.
