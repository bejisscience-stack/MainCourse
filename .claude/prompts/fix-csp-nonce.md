Fix CSP unsafe-inline and SVG sanitization. Only touch next.config.js and middleware.ts and app/layout.tsx if needed for nonce injection. Do NOT touch any other files.

FIX 1 — HIGH — Implement nonce-based CSP (CSP-01):
- In middleware.ts: generate a random nonce per request using crypto.randomUUID() or crypto.getRandomValues()
- Set the nonce on the request headers so Next.js can access it: requestHeaders.set('x-nonce', nonce)
- In next.config.js: update the CSP header to use the nonce
  - Change script-src from 'self' 'unsafe-inline' to 'self' 'nonce-{NONCE_PLACEHOLDER}'
  - Keep style-src 'self' 'unsafe-inline' (Tailwind needs it, this is acceptable)
- IMPORTANT: Next.js 14 CSP with nonce requires the CSP to be set in middleware, not in next.config.js headers
  - Move the CSP header generation to middleware.ts where you have access to the nonce
  - Remove the CSP line from next.config.js headers array
  - In middleware: response.headers.set('Content-Security-Policy', `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: *.supabase.co; connect-src 'self' *.supabase.co *.keepz.me wss://*.supabase.co; font-src 'self'; frame-src 'self' *.keepz.me; media-src 'self' *.supabase.co`)
- If app/layout.tsx has any inline scripts (like theme initialization), add nonce attribute to them
- Check if PostHog or other analytics scripts need the nonce — if so, pass it via a header or server component
- If nonce-based CSP is too complex to implement correctly in this task, as a fallback: at minimum remove unsafe-inline and add specific hashes for known inline scripts using 'sha256-...' format. Document which scripts need hashes.

FIX 2 — HIGH — SVG sanitization plan (CSP-02):
- In next.config.js: add a more detailed comment above dangerouslyAllowSVG explaining the risk
- Check if any storage buckets accept SVG uploads from users
- If yes: add a note that SVG sanitization (DOMPurify or svg-sanitize) should be added to the upload flow
- If no user-uploaded SVGs exist: document that SVGs are admin-only and this is an accepted risk
- Do NOT install a sanitization library in this task — just document the plan

IMPORTANT: Test thoroughly. If CSP breaks the site (scripts blocked, blank page), revert to unsafe-inline and document what failed. A working site with unsafe-inline is better than a broken site with strict CSP.

Run npm run build AND manually verify the dev server loads correctly (npm run dev, check browser console for CSP violations).
Commit with message "security: implement nonce-based CSP, document SVG policy (CSP-01, CSP-02)"
Output <promise>DONE</promise> when build passes and no CSP errors in browser console.
