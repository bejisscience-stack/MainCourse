# Next.js 15 Upgrade Plan

**Status:** Research / Planning
**Created:** 2026-03-17
**Reason:** Next.js 14.2.35 has known high-severity DoS vulnerabilities (Image Optimizer, HTTP deserialization)

---

## Dependencies Requiring Update

| Package            | Current  | Required for Next.js 15 |
| ------------------ | -------- | ----------------------- |
| `next`             | ^14.2.35 | ^15.x                   |
| `react`            | ^18.3.1  | ^19.0.0                 |
| `react-dom`        | ^18.3.1  | ^19.0.0                 |
| `@types/react`     | ^18.3.1  | ^19.x                   |
| `@types/react-dom` | ^18.3.0  | ^19.x                   |
| `@supabase/ssr`    | ^0.8.0   | verify React 19 compat  |
| `framer-motion`    | ^12.34.3 | verify React 19 compat  |
| `posthog-js`       | ^1.353.1 | verify React 19 compat  |
| `recharts`         | ^3.7.0   | verify React 19 compat  |

---

## Breaking Changes Assessment

### 1. `swcMinify: true` in `next.config.js`

Removed in Next.js 15 (SWC minification is always on). **Must delete the line.**

### 2. `cookies()` / `headers()` now async

Already `await`ed in our codebase (4 call sites). **No change needed.**

### 3. React 19 upgrade (biggest risk)

- `ref` as prop — no more `forwardRef` required
- New `use()` hook
- New `useActionState` replaces `useFormState`
- Our 40+ components need audit for `forwardRef` usage

### 4. `next.config.js` → `next.config.ts`

CommonJS `module.exports` still works but TypeScript config is now preferred. **Optional migration.**

### 5. `next/router` usage

All client navigation uses `next/navigation`. **Clean — no change needed.**

### 6. Image configuration

Already using `remotePatterns` (no deprecated `images.domains`). **Clean.**

### 7. Middleware

Uses `NextRequest`/`NextResponse`, no deprecated patterns. **Clean.**

### 8. `export const dynamic`

~30 API routes use this. **Still valid in Next.js 15.**

---

## Risk Assessment

| Risk Level | Area                       | Notes                                        |
| ---------- | -------------------------- | -------------------------------------------- |
| Low        | Config cleanup             | Remove `swcMinify` line                      |
| Low        | Routing / middleware       | Already on App Router, no deprecated APIs    |
| Medium     | React 18 → 19              | Component audit for `forwardRef`, lib compat |
| Medium     | Third-party library compat | `@supabase/ssr`, `framer-motion`, `recharts` |

---

## Recommended Approach

1. **Stage 1 — Audit:** Grep codebase for `forwardRef`, `useFormState`, and any React 18-only patterns
2. **Stage 2 — Upgrade:** Bump `next`, `react`, `react-dom` and type packages together
3. **Stage 3 — Config:** Remove `swcMinify`, optionally migrate to `next.config.ts`
4. **Stage 4 — Test:** Full build + manual testing in staging before production deploy

Upgrade Next.js + React together in a single PR. Test thoroughly in staging before merging to main.
