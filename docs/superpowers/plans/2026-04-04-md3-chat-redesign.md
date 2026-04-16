# MD3 Chat Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 15 Swavleba chat components from navy/emerald hardcoded theme to Material Design 3 neutral tonal surfaces.

**Architecture:** Pure Tailwind CSS extension — add MD3 CSS variables (space-separated RGB channels) to `globals.css`, extend `tailwind.config.ts` with `md3` color namespace and shape tokens. Replace class names component-by-component. No new dependencies.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS 3.4, CSS custom properties

**Spec:** `docs/superpowers/specs/2026-04-04-md3-chat-redesign-design.md`

---

## File Map

### New/Modified Configuration Files

- Modify: `app/globals.css` — add MD3 CSS variables (light + dark), typography utilities, update chat-\* utilities
- Modify: `tailwind.config.ts` — add `md3` color namespace, shape scale border-radius tokens

### Chat Components (all modify, no create)

- Modify: `components/chat/ServerSidebar.tsx` — MD3 NavigationRail styling
- Modify: `components/chat/ChannelSidebar.tsx` — MD3 NavigationDrawer styling
- Modify: `components/chat/ChatArea.tsx` — MD3 TopAppBar, message area, typing indicator
- Modify: `components/chat/Message.tsx` — MD3 message styling, reactions, hover actions
- Modify: `components/chat/MessageInput.tsx` — MD3 TextField, FAB send button
- Modify: `components/chat/MemberSidebar.tsx` — MD3 list patterns
- Modify: `components/chat/LayoutContainer.tsx` — panel wiring, member sidebar toggle, mobile drawer
- Modify: `components/chat/ChatNavigation.tsx` — MD3 TopAppBar navigation
- Modify: `components/chat/ChatErrorBoundary.tsx` — MD3 error surfaces
- Modify: `components/chat/LecturesChannel.tsx` — MD3 video list styling
- Modify: `components/chat/ProjectCard.tsx` — MD3 Card pattern
- Modify: `components/chat/VideoUploadDialog.tsx` — MD3 Dialog pattern
- Modify: `components/chat/VideoSubmissionDialog.tsx` — MD3 Dialog pattern
- Modify: `components/chat/SubmissionReviewDialog.tsx` — MD3 Dialog pattern
- Modify: `components/chat/ChannelManagement.tsx` — MD3 Dialog pattern

### Localization

- Modify: `locales/en.json` — add new chat namespace keys
- Modify: `locales/ge.json` — add corresponding Georgian translations

---

## Task 1: Add MD3 Design Tokens to globals.css

**Files:**

- Modify: `app/globals.css`

**Context:** The spec defines MD3 color tokens as space-separated RGB channels (e.g., `28 27 31`) so Tailwind's `/[opacity]` syntax works. Both light and dark theme values are needed. Current file uses `:root.dark` for dark mode.

- [ ] **Step 1: Add MD3 CSS variables for light theme**

In `app/globals.css`, inside the existing `:root, :root.light` block, after the existing variables (line ~20), add all MD3 tokens from spec Section 1.1 Light Theme table. Example format:

```css
/* MD3 Design Tokens */
--md3-surface: 255 251 254;
--md3-surface-container-lowest: 255 255 255;
--md3-surface-container-low: 247 242 250;
--md3-surface-container: 243 237 247;
--md3-surface-container-high: 236 230 240;
--md3-surface-container-highest: 230 224 233;
--md3-on-surface: 28 27 31;
--md3-on-surface-variant: 73 69 79;
--md3-outline: 121 116 126;
--md3-outline-variant: 202 196 208;
--md3-primary: 103 80 164;
--md3-on-primary: 255 255 255;
--md3-primary-container: 234 221 255;
--md3-on-primary-container: 33 0 93;
--md3-secondary-container: 232 222 248;
--md3-on-secondary-container: 29 25 43;
--md3-error: 179 38 30;
--md3-error-container: 249 222 220;
--md3-on-error-container: 65 14 11;
--md3-inverse-surface: 49 48 51;
--md3-inverse-on-surface: 244 239 244;
--md3-scrim: rgba(0, 0, 0, 0.32);
/* MD3 Shape */
--md3-shape-xs: 4px;
--md3-shape-sm: 8px;
--md3-shape-md: 12px;
--md3-shape-lg: 16px;
--md3-shape-xl: 28px;
```

- [ ] **Step 2: Add MD3 CSS variables for dark theme**

In the `:root.dark` block, after existing variables (line ~36), add all MD3 tokens from spec Section 1.1 Dark Theme table. Same format but dark values (e.g., `--md3-surface: 28 27 31;`).

- [ ] **Step 3: Add MD3 typography utilities**

After the existing `@tailwind utilities;` line, add a `@layer components` block with MD3 type scale classes from spec Section 1.6:

```css
@layer components {
  .md3-display-large {
    @apply text-[57px] leading-[64px] font-normal tracking-tight;
  }
  .md3-headline-small {
    @apply text-2xl leading-8 font-normal;
  }
  .md3-title-large {
    @apply text-[22px] leading-7 font-medium;
  }
  .md3-title-medium {
    @apply text-base leading-6 font-medium tracking-wide;
  }
  .md3-title-small {
    @apply text-sm leading-5 font-medium tracking-wide;
  }
  .md3-body-large {
    @apply text-base leading-6 font-normal;
  }
  .md3-body-medium {
    @apply text-sm leading-5 font-normal;
  }
  .md3-body-small {
    @apply text-xs leading-4 font-normal;
  }
  .md3-label-large {
    @apply text-sm leading-5 font-medium tracking-wide;
  }
  .md3-label-medium {
    @apply text-xs leading-4 font-medium tracking-wider;
  }
  .md3-label-small {
    @apply text-[11px] leading-4 font-medium tracking-widest;
  }
}
```

- [ ] **Step 4: Verify no syntax errors**

Run: `npm run build`
Expected: Build succeeds with no CSS parsing errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat: add MD3 design tokens and typography utilities to globals.css"
```

---

## Task 2: Extend Tailwind Config with MD3 Tokens

**Files:**

- Modify: `tailwind.config.ts`

**Context:** Add `md3` color namespace using `rgb(var(...) / <alpha-value>)` pattern for opacity modifier support. Add MD3 shape scale to `borderRadius`. Keep all existing tokens.

- [ ] **Step 1: Add md3 color namespace**

In `tailwind.config.ts`, inside `theme.extend.colors`, add the full `md3` object from spec Section 1.5. All color values use format: `'rgb(var(--md3-surface) / <alpha-value>)'` except `scrim` which uses `'var(--md3-scrim)'`.

- [ ] **Step 2: Add md3 shape scale to borderRadius**

In `theme.extend.borderRadius`, add:

```ts
'md3-xs': 'var(--md3-shape-xs)',
'md3-sm': 'var(--md3-shape-sm)',
'md3-md': 'var(--md3-shape-md)',
'md3-lg': 'var(--md3-shape-lg)',
'md3-xl': 'var(--md3-shape-xl)',
```

- [ ] **Step 3: Verify tokens resolve correctly**

Run: `npm run build`
Expected: Build succeeds. No unknown utility class warnings.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: extend Tailwind config with MD3 color namespace and shape scale"
```

---

## Task 3: Redesign ServerSidebar.tsx (Panel 1)

**Files:**

- Modify: `components/chat/ServerSidebar.tsx`

**Context:** This is the leftmost 64px-wide vertical icon strip. Replace all navy/emerald hardcoded classes with MD3 tokens. Spec Section 2 has the full current→target mapping table with line numbers. Preserve all props, hooks, and EnrollmentModal integration.

- [ ] **Step 1: Replace outer container classes**

Line 123: Replace `bg-navy-950/85 border-r border-navy-800/60` with `bg-md3-surface-lowest border-r border-md3-outline-var`. Add `role="navigation" aria-label="Course servers"`.

- [ ] **Step 2: Replace DM button classes**

Line 128-132: Replace `bg-emerald-500/90` with `bg-md3-primary-cont`, `text-white` with `text-md3-on-primary-cont`, `ring-emerald-400/50` with `ring-md3-primary`, remove `shadow-glow`. Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md3-primary`.

- [ ] **Step 3: Replace separator**

Line 139: Replace `bg-navy-800/70` with `bg-md3-outline-var`.

- [ ] **Step 4: Replace course icon classes**

Lines 154-160: Replace active state `bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft-lg` with `bg-md3-primary-cont text-md3-on-primary-cont border-transparent`. Replace locked state `bg-navy-900/40 text-gray-500 border-navy-800/50` with `bg-md3-surface-cont text-md3-on-surface-var/[0.38] border-md3-outline-var`. Replace default `bg-navy-900/70 text-gray-200 border-navy-800/60 hover:bg-navy-800/80 hover:border-navy-700/70 hover:text-white` with `bg-md3-surface-high text-md3-on-surface border-md3-outline-var hover:bg-md3-on-surface/[0.08]`. Add focus-visible outlines.

- [ ] **Step 5: Replace unread badge, tooltip, active indicator**

Line 192 badge: `bg-red-500 text-white` → `bg-md3-error text-white` (keep `text-white`). Lines 200-206 tooltips: `bg-navy-900/95 border-navy-700/60 text-gray-200` → `bg-md3-surface-highest border-md3-outline-var text-md3-on-surface`. Line 222 indicator: `bg-emerald-400` → `bg-md3-primary`.

- [ ] **Step 6: Replace add course button**

Line 231: `bg-navy-900/70 border-navy-800/60 hover:border-emerald-500/50 hover:bg-emerald-500/15 text-emerald-300` → `bg-md3-surface-high border-md3-outline-var hover:bg-md3-on-surface/[0.08] text-md3-primary`.

- [ ] **Step 7: Add aria-hidden to decorative SVGs**

Add `aria-hidden="true"` to the lock icon SVG (lines 173-184) and any other decorative SVGs.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: No TypeScript errors, no missing classes.

- [ ] **Step 9: Commit**

```bash
git add components/chat/ServerSidebar.tsx
git commit -m "feat: redesign ServerSidebar with MD3 NavigationRail tokens"
```

---

## Task 4: Redesign ChannelSidebar.tsx (Panel 2)

**Files:**

- Modify: `components/chat/ChannelSidebar.tsx`

**Context:** Channel list for selected course. Spec Section 3 has the full mapping table. Note: user profile footer is in LayoutContainer, NOT here.

- [ ] **Step 1: Replace container and header classes**

Line 120 (no server fallback): `bg-navy-900` → `bg-md3-surface-low`. Line 132 main container: `bg-navy-950/70 border-r border-navy-800/60` → `bg-md3-surface-low border-r border-md3-outline-var`. Line 134 header: `bg-navy-950/60` → `bg-md3-surface-low`, remove `shadow-soft`. Line 135: `text-gray-100` → `text-md3-on-surface`.

- [ ] **Step 2: Replace button and control classes**

Lines 147, 168 collapse/gear buttons: `text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60` → `text-md3-on-surface-var hover:bg-md3-on-surface/[0.08]`. Line 237 add channel button: same pattern.

- [ ] **Step 3: Replace category and channel classes**

Line 208 category label: `text-gray-500` → `text-md3-on-surface-var`. Line 35 `#` icon: `text-gray-500` → `text-md3-on-surface-var`. Line 271 active channel: `bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft` → `bg-md3-primary-cont text-md3-on-primary-cont border-transparent rounded-md3-xl`. Lines 273-274 text colors: `text-gray-100 font-medium` → `text-md3-on-surface font-bold`, `text-gray-400` → `text-md3-on-surface-var`. Hover: `hover:bg-navy-800/50` → `hover:bg-md3-on-surface/[0.08]`.

- [ ] **Step 4: Replace indicator, badge, and modal classes**

Line 291 indicator: `bg-emerald-400` → `bg-md3-primary`. Line 284 badge: `bg-red-500 text-white` → `bg-md3-primary text-md3-on-primary`. Lines 310, 314 modal: `bg-navy-950/80 backdrop-blur-sm` → `bg-md3-scrim`, `bg-navy-950/90 border-navy-800/60` → `bg-md3-surface-high border-md3-outline-var rounded-md3-xl`.

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add components/chat/ChannelSidebar.tsx
git commit -m "feat: redesign ChannelSidebar with MD3 NavigationDrawer tokens"
```

---

## Task 5: Redesign ChatArea.tsx (Panel 3 — Container)

**Files:**

- Modify: `components/chat/ChatArea.tsx`

**Context:** Main chat area with header, message list, typing indicator. Spec Section 4.1. This component imports Message and MessageInput — those are separate tasks. Focus on the ChatArea wrapper: header bar, message container bg, empty state, scroll-to-bottom FAB, typing indicator.

- [ ] **Step 1: Read the full current file**

Read `components/chat/ChatArea.tsx` to identify all navy/emerald/gray class references and their exact locations.

- [ ] **Step 2: Replace channel header classes**

Replace the header bar's navy background, text-white, and border classes with `bg-md3-surface-cont`, `text-md3-on-surface`, `border-b border-md3-outline-var`. Add member toggle button.

- [ ] **Step 3: Replace message area background and states**

Replace message container background with `bg-md3-surface`. Empty state: `text-md3-on-surface-var`. Load older: `text-md3-primary`. Scroll-to-bottom FAB: `bg-md3-primary-cont text-md3-on-primary-cont rounded-md3-lg`.

- [ ] **Step 4: Replace typing indicator classes**

Background: `bg-md3-surface-cont`. Dots: `bg-md3-primary`. Text: `text-md3-on-surface-var`.

- [ ] **Step 5: Add accessibility attributes**

Add `role="log" aria-live="polite"` to message list container.

- [ ] **Step 6: Verify build**

Run: `npm run build`

- [ ] **Step 7: Commit**

```bash
git add components/chat/ChatArea.tsx
git commit -m "feat: redesign ChatArea with MD3 surface tokens and TopAppBar header"
```

---

## Task 6: Redesign Message.tsx

**Files:**

- Modify: `components/chat/Message.tsx`

**Context:** Individual message rendering. Spec Section 4.2. Complex component with reactions, replies, hover actions, media, project cards, pending/failed states. Read the full file first — it's large.

- [ ] **Step 1: Read the full current file**

Read `components/chat/Message.tsx` to understand all class locations. Note: it imports ProjectCard.

- [ ] **Step 2: Replace username, timestamp, message text classes**

Student username: `text-md3-on-surface font-semibold`. Lecturer: `text-md3-primary font-semibold`. Timestamp: `text-md3-on-surface-var`. Message text: `text-md3-on-surface`. "(edited)": `text-md3-on-surface-var`.

- [ ] **Step 3: Replace reply preview and reaction classes**

Reply preview card: `bg-md3-surface-high border-l-2 border-md3-outline-var rounded-md3-sm`. Reaction chips: `bg-md3-surface-high text-md3-on-surface-var rounded-full`. Own reaction: `bg-md3-primary-cont text-md3-on-primary-cont`.

- [ ] **Step 4: Replace hover actions bar and media classes**

Hover actions: `bg-md3-surface-highest rounded-md3-sm`. Media images: `rounded-md3-md`. Pending: `opacity-50`. Failed: `bg-md3-error-cont/10 border-l-2 border-md3-error`.

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add components/chat/Message.tsx
git commit -m "feat: redesign Message with MD3 card, chip, and state tokens"
```

---

## Task 7: Redesign MessageInput.tsx

**Files:**

- Modify: `components/chat/MessageInput.tsx`

**Context:** Spec Section 4.3. Auto-expanding textarea with attachments, reply preview, send button.

- [ ] **Step 1: Read the full current file**

Read `components/chat/MessageInput.tsx` to identify all style locations.

- [ ] **Step 2: Replace all style classes**

Container: `bg-md3-surface-high border border-md3-outline rounded-md3-md`. Textarea: `bg-transparent text-md3-on-surface placeholder:text-md3-on-surface-var`. Reply preview: `bg-md3-surface-highest`. Attachment button: `text-md3-on-surface-var hover:bg-md3-on-surface/[0.08]`. Send button: `bg-md3-primary text-md3-on-primary rounded-full`. Drop zone: `border-2 border-dashed border-md3-primary`. Disabled states: `text-md3-on-surface-var opacity-[0.38]`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/chat/MessageInput.tsx
git commit -m "feat: redesign MessageInput with MD3 TextField and FAB tokens"
```

---

## Task 8: Redesign MemberSidebar.tsx (Panel 4)

**Files:**

- Modify: `components/chat/MemberSidebar.tsx`

**Context:** Spec Section 5. Online/offline member list. Status dots use semantic fixed colors (not themed).

- [ ] **Step 1: Read the full current file**

Read `components/chat/MemberSidebar.tsx`.

- [ ] **Step 2: Replace all style classes**

Background: `bg-md3-surface-low`. Header: `text-md3-on-surface`. Section labels: `text-md3-on-surface-var`. Member rows: `text-md3-on-surface`. Lecturer role chip: `bg-md3-primary-cont text-md3-on-primary-cont`. Student role: `text-md3-on-surface-var`. Offline: `opacity-[0.38]`. Close button: `text-md3-on-surface-var`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/chat/MemberSidebar.tsx
git commit -m "feat: redesign MemberSidebar with MD3 list pattern tokens"
```

---

## Task 9: Redesign LayoutContainer.tsx

**Files:**

- Modify: `components/chat/LayoutContainer.tsx`

**Context:** Spec Section 6. Orchestrates the 4-panel layout. Has the user profile footer (lines 282-342). Needs new MemberSidebar toggle state. Mobile drawer uses scrim backdrop.

- [ ] **Step 1: Replace outer container and mobile backdrop**

Line 202: `bg-navy-950/40 backdrop-blur-sm text-white` → `bg-md3-surface text-md3-on-surface`. Line 205-206: `bg-black/60 backdrop-blur-sm` → `bg-md3-scrim` (remove blur — MD3 scrim is flat).

- [ ] **Step 2: Replace channel sidebar wrapper classes**

Line 232: `bg-navy-950/95 md:bg-navy-950/70 border-r border-navy-800/60` → `bg-md3-surface-low border-r border-md3-outline-var`. Lines 239-262 collapsed header: `bg-navy-950/60 text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60` → `bg-md3-surface-low text-md3-on-surface-var hover:bg-md3-on-surface/[0.08]`.

- [ ] **Step 3: Replace user profile footer classes (lines 282-342)**

Background: `bg-navy-950/80 border-t border-navy-800/60` → `bg-md3-surface-cont border-t border-md3-outline-var`. Avatar: `bg-emerald-500/90 text-white` → `bg-md3-primary-cont text-md3-on-primary-cont`. Username: `text-gray-100` → `text-md3-on-surface`. Online status: `text-emerald-300 bg-emerald-400` → `text-md3-on-surface-var bg-[#4CAF50]`. Action buttons: `text-gray-400 border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 hover:text-emerald-200` → `text-md3-on-surface-var border-md3-outline-var bg-md3-surface-high hover:bg-md3-on-surface/[0.08]`.

- [ ] **Step 4: Add MemberSidebar toggle state and rendering**

Add `const [memberSidebarOpen, setMemberSidebarOpen] = useState(false)` to LayoutContainer. Import MemberSidebar. Add Panel 4 to the right side of the layout with slide animation: `transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]`. Pass toggle callback to ChatArea.

- [ ] **Step 5: Verify build**

Run: `npm run build`

- [ ] **Step 6: Commit**

```bash
git add components/chat/LayoutContainer.tsx
git commit -m "feat: redesign LayoutContainer with MD3 tokens and member sidebar toggle"
```

---

## Task 10: Redesign ChatNavigation.tsx

**Files:**

- Modify: `components/chat/ChatNavigation.tsx`

**Context:** Spec Section 7.5. Top navigation bar (335 lines). Language selector, nav links, user dropdown, sign out.

- [ ] **Step 1: Read the full current file**

Read `components/chat/ChatNavigation.tsx`.

- [ ] **Step 2: Replace all style classes**

Outer: `bg-md3-surface-cont border-md3-outline-var`. Language selector: `hover:bg-md3-on-surface/[0.08]`, dropdown: `bg-md3-surface-highest`. Nav links: `text-md3-on-surface-var hover:text-md3-on-surface`, active: `text-md3-primary bg-md3-primary-cont/20`. Avatar: `bg-md3-primary-cont`. User dropdown: `bg-md3-surface-highest`. Sign out: `text-md3-error hover:bg-md3-error/[0.08]`. Focus rings: `ring-md3-primary`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/chat/ChatNavigation.tsx
git commit -m "feat: redesign ChatNavigation with MD3 TopAppBar tokens"
```

---

## Task 11: Redesign ChatErrorBoundary.tsx

**Files:**

- Modify: `components/chat/ChatErrorBoundary.tsx`

**Context:** Spec Section 7.6. Error fallback UI (97 lines). Small, focused change.

- [ ] **Step 1: Replace all style classes**

Line 42: `bg-navy-950/20` → `bg-md3-surface`. Line 44: `bg-red-900/50 border-red-700 text-red-200` → `bg-md3-error-cont text-md3-on-error-cont border-md3-error`. Line 60: `text-red-300/70` → `text-md3-on-error-cont/70`. Line 68: `bg-emerald-500 hover:bg-emerald-600 text-white` → `bg-md3-primary text-md3-on-primary hover:bg-md3-primary/90`. Line 82: `bg-navy-700 hover:bg-navy-600 text-white` → `bg-md3-surface-high text-md3-on-surface hover:bg-md3-on-surface/[0.08]`.

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add components/chat/ChatErrorBoundary.tsx
git commit -m "feat: redesign ChatErrorBoundary with MD3 error surface tokens"
```

---

## Task 12: Redesign LecturesChannel.tsx

**Files:**

- Modify: `components/chat/LecturesChannel.tsx`

**Context:** Spec Section 7.1. Video player and video list. Loaded via `dynamic()` import — don't change the import mechanism.

- [ ] **Step 1: Read the full current file**

Read `components/chat/LecturesChannel.tsx` to find all style classes.

- [ ] **Step 2: Replace all style classes**

Video player container: `bg-md3-surface-cont rounded-md3-lg overflow-hidden`. Video list items: `bg-md3-surface-high rounded-md3-sm` on hover. Active video: `bg-md3-primary-cont/10 border-l-2 border-md3-primary`. Lock icon: `text-md3-on-surface-var opacity-[0.38]`. Completion checkmark: `text-md3-primary`. Progress bar: `bg-md3-primary` on `bg-md3-outline-var` rail.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/chat/LecturesChannel.tsx
git commit -m "feat: redesign LecturesChannel with MD3 card and surface tokens"
```

---

## Task 13: Redesign ProjectCard.tsx

**Files:**

- Modify: `components/chat/ProjectCard.tsx`

**Context:** Spec Section 7.2. Project card embedded in messages.

- [ ] **Step 1: Read and replace all style classes**

Card: `bg-md3-surface-high rounded-md3-md border border-md3-outline-var`. Title: `text-md3-on-surface`. Budget chip: `bg-md3-secondary-cont text-md3-on-secondary-cont rounded-full`. Platforms: `text-md3-on-surface-var`. Submit: `bg-md3-primary text-md3-on-primary rounded-md3-xl`. Countdown: `text-md3-error`.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build && git add components/chat/ProjectCard.tsx && git commit -m "feat: redesign ProjectCard with MD3 Card tokens"
```

---

## Task 14: Redesign Dialog Components

**Files:**

- Modify: `components/chat/VideoUploadDialog.tsx`
- Modify: `components/chat/VideoSubmissionDialog.tsx`
- Modify: `components/chat/SubmissionReviewDialog.tsx`
- Modify: `components/chat/ChannelManagement.tsx`

**Context:** Spec Sections 7.3-7.4. All 4 dialogs share the same MD3 Dialog pattern. Each uses `createPortal` — preserve that.

- [ ] **Step 1: Read all 4 dialog files**

Read each file to identify current dialog container, form input, button, and overlay classes.

- [ ] **Step 2: Apply shared MD3 Dialog pattern to all 4**

Dialog container: `bg-md3-surface-high rounded-md3-xl`. Scrim backdrop: `bg-md3-scrim` (remove `backdrop-blur`). Title: `text-md3-on-surface md3-headline-small`. Form inputs: `border border-md3-outline rounded-md3-xs bg-transparent text-md3-on-surface placeholder:text-md3-on-surface-var`. Primary button: `bg-md3-primary text-md3-on-primary rounded-md3-xl`. Secondary button: `border border-md3-outline text-md3-primary rounded-md3-xl`. Delete/destructive: `text-md3-error`.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add components/chat/VideoUploadDialog.tsx components/chat/VideoSubmissionDialog.tsx components/chat/SubmissionReviewDialog.tsx components/chat/ChannelManagement.tsx
git commit -m "feat: redesign all chat dialogs with MD3 Dialog pattern"
```

---

## Task 15: Update chat-\* Utility Classes in globals.css

**Files:**

- Modify: `app/globals.css`

**Context:** Spec Section 10.1. Update 7 existing utilities to use MD3 variables. Keep `.chat-scrollbar` as-is.

- [ ] **Step 1: Update utilities**

```css
.chat-surface {
  background-color: rgb(var(--md3-surface-container) / 0.78);
  backdrop-filter: blur(10px);
}
.chat-surface-elevated {
  background-color: rgb(var(--md3-surface-container-high) / 0.85);
  backdrop-filter: blur(12px);
}
.chat-surface-muted {
  background-color: rgb(var(--md3-surface) / 0.55);
}
.chat-border {
  border-color: rgb(var(--md3-outline-variant) / 0.65);
}
.chat-divider {
  background-color: rgb(var(--md3-outline-variant) / 0.6);
}
.chat-text-muted {
  color: rgb(var(--md3-on-surface-variant) / 0.9);
}
.chat-ring {
  box-shadow: 0 0 0 2px rgb(var(--md3-primary) / 0.25);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: update chat-* utility classes to use MD3 design tokens"
```

---

## Task 16: Update Localization Keys

**Files:**

- Modify: `locales/en.json`
- Modify: `locales/ge.json`

**Context:** Spec Section 9. Add new keys to the existing `"chat"` namespace. Preserve all existing keys.

- [ ] **Step 1: Add English keys**

In `locales/en.json`, inside the `"chat"` object (after existing keys at line ~257), add the 14 new keys from spec Section 9.

- [ ] **Step 2: Add Georgian keys**

In `locales/ge.json`, inside the `"chat"` object, add the same 14 keys with Georgian translations. Use existing translation patterns from the file for consistency.

- [ ] **Step 3: Verify build**

Run: `npm run build`

- [ ] **Step 4: Commit**

```bash
git add locales/en.json locales/ge.json
git commit -m "feat: add MD3 chat UI localization keys for EN and GE"
```

---

## Task 17: Final Verification

**Files:** All modified files from Tasks 1-16.

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Lint check**

Run: `npm run lint`
Expected: No new lint errors introduced.

- [ ] **Step 3: Verify no remaining navy/emerald references in chat components**

Search for any remaining hardcoded theme references in `components/chat/`:

```bash
grep -rn "navy-\|emerald-\|shadow-glow\|shadow-soft" components/chat/ --include="*.tsx"
```

Expected: No matches (all navy/emerald/glow/shadow-soft references replaced with MD3 tokens).

- [ ] **Step 4: Verify dark theme variables are complete**

Check that all `--md3-*` variables exist in both `:root` and `:root.dark` blocks.

- [ ] **Step 5: Commit final state if any fixes needed**

```bash
git add components/chat/ app/globals.css tailwind.config.ts locales/en.json locales/ge.json && git commit -m "fix: clean up remaining navy/emerald references in chat components"
```
