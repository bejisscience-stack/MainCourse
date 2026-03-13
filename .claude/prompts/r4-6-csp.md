Document CSP style-src as accepted risk. Only touch middleware.ts.

FIX — HIGH (accepted risk) — style-src unsafe-inline (CSP-01):
- At line 86 in the CSP header where style-src 'self' 'unsafe-inline' is set
- Add a detailed comment above the CSP construction explaining why unsafe-inline is needed for styles:
  // SECURITY NOTE (CSP-01): style-src 'unsafe-inline' is required for Tailwind CSS which generates
  // inline styles at runtime. Removing it breaks all Tailwind styling. This is an accepted risk because:
  // 1. CSS injection is lower impact than script injection (no code execution)
  // 2. script-src uses nonce-based allowlisting which prevents XSS script execution
  // 3. Migrating to nonce-based styles requires Tailwind config changes and is tracked as a future improvement
  // To migrate: configure Tailwind to use CSS-in-JS with nonce support, or extract all styles to external stylesheets
- Do NOT change any CSP values — only add documentation
- Do NOT touch any other part of middleware.ts

Run npm run build. Commit with message "security: document CSP style-src accepted risk (CSP-01)"
Output <promise>DONE</promise> when build passes.
