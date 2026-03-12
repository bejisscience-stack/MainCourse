Fix 2 security items in next.config.js ONLY. Do not touch any other file.

1. CSP enforcement (HDR-01 HIGH):
- Change "Content-Security-Policy-Report-Only" to "Content-Security-Policy"
- Remove 'unsafe-eval' from script-src (Next.js production does not need it)
- Keep 'unsafe-inline' but add comment: // TODO: migrate to nonce-based scripts
- Make sure connect-src includes all domains the app actually calls (supabase, keepz, etc)

2. SVG safety comment (INF-04):
- Add a comment above the dangerouslyAllowSVG: true line explaining it is partially mitigated by the contentSecurityPolicy on images, and that user-uploaded SVGs should be sanitized

Run npm run build after changes. Commit with message "security: enforce CSP, document SVG policy (HDR-01, INF-04)"

Output <promise>DONE</promise> when build passes.
