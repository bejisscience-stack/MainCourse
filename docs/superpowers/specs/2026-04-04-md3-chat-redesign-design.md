# MD3 Chat Redesign — Design Specification

## Overview

Redesign the Swavleba chat interface from its current navy/emerald hardcoded theme to Material Design 3 (Material You). The chat system is a 4-panel Discord-like layout serving students, lecturers, and admins.

**Palette:** M3 baseline palette (purple-tinted primary). The surface/neutral tokens are gray-neutral; the primary family uses M3's default purple tones. This is intentional — it provides a distinct accent that can be swapped to any seed color later by regenerating the primary tokens via the M3 theme builder.

**Approach:** Pure Tailwind extension — add MD3 semantic tokens to `tailwind.config.ts` and CSS variables to `globals.css`. No new dependencies. Existing navy/charcoal/emerald tokens preserved for non-chat pages.

**Source of truth:** `docs/google-stitch-full-redesign.md` (PART 4, lines 433-684) and `docs/google-stitch-prompts.md` (PROMPT 6, lines 701-886).

---

## Scope

### In Scope

- All 15 components in `components/chat/` (excluding duplicate `MemberSidebar 2.tsx`)
- MD3 design tokens (CSS variables + Tailwind config)
- Dark theme (primary) + light theme support
- Mobile responsive improvements (100dvh, proper drawer)
- Accessibility (ARIA labels, focus-visible, keyboard nav)

### Out of Scope (this phase)

- DM system and Friends system (PART 4.4-4.5 of spec — separate phase)
- Hook logic changes
- Database schema or edge function changes
- Non-chat pages

### Preserved

- All hook interfaces (useChatMessages, useActiveServer, useActiveChannel, etc.)
- EnrollmentModal integration in ServerSidebar
- `dynamic()` import for LecturesChannel
- `createPortal` usage in dialogs
- Optimistic message updates (pending/failed states)
- Auth guards and routing in page components

---

## 1. MD3 Design Tokens

### 1.1 Color Tokens (CSS Variables in globals.css)

CSS variables use space-separated RGB channels to support Tailwind's opacity modifier syntax (e.g., `bg-md3-on-surface/[0.08]`). Exception: `--md3-scrim` uses rgba directly since it has a fixed opacity.

**Dark theme** (`:root.dark`):

| Token                             | RGB Channels  | Hex Equivalent     | Usage                         |
| --------------------------------- | ------------- | ------------------ | ----------------------------- |
| `--md3-surface`                   | `28 27 31`    | `#1C1B1F`          | Page background               |
| `--md3-surface-container-lowest`  | `15 14 18`    | `#0F0E12`          | Server sidebar bg             |
| `--md3-surface-container-low`     | `28 27 31`    | `#1C1B1F`          | Channel/member sidebar bg     |
| `--md3-surface-container`         | `33 31 38`    | `#211F26`          | Chat area bg, cards           |
| `--md3-surface-container-high`    | `43 41 48`    | `#2B2930`          | Message input, elevated cards |
| `--md3-surface-container-highest` | `54 52 59`    | `#36343B`          | Hover tooltips, popovers      |
| `--md3-on-surface`                | `230 225 229` | `#E6E1E5`          | Primary text                  |
| `--md3-on-surface-variant`        | `202 196 208` | `#CAC4D0`          | Secondary text, icons         |
| `--md3-outline`                   | `147 143 153` | `#938F99`          | Borders, dividers             |
| `--md3-outline-variant`           | `73 69 79`    | `#49454F`          | Subtle borders                |
| `--md3-primary`                   | `208 188 255` | `#D0BCFF`          | Accent color                  |
| `--md3-on-primary`                | `56 30 114`   | `#381E72`          | Text on primary               |
| `--md3-primary-container`         | `79 55 139`   | `#4F378B`          | Active states, highlights     |
| `--md3-on-primary-container`      | `234 221 255` | `#EADDFF`          | Text on primary container     |
| `--md3-secondary-container`       | `74 68 88`    | `#4A4458`          | Secondary highlights          |
| `--md3-on-secondary-container`    | `232 222 248` | `#E8DEF8`          | Text on secondary container   |
| `--md3-error`                     | `242 184 181` | `#F2B8B5`          | Error text                    |
| `--md3-error-container`           | `140 29 24`   | `#8C1D18`          | Error backgrounds             |
| `--md3-on-error-container`        | `249 222 220` | `#F9DEDC`          | Text on error container       |
| `--md3-inverse-surface`           | `230 225 229` | `#E6E1E5`          | Snackbar bg                   |
| `--md3-inverse-on-surface`        | `49 48 51`    | `#313033`          | Snackbar text                 |
| `--md3-scrim`                     | —             | `rgba(0,0,0,0.32)` | Modal backdrop (fixed)        |

**Light theme** (`:root`, `:root.light`):

| Token                             | RGB Channels  | Hex Equivalent     | Usage                       |
| --------------------------------- | ------------- | ------------------ | --------------------------- |
| `--md3-surface`                   | `255 251 254` | `#FFFBFE`          | Page background             |
| `--md3-surface-container-lowest`  | `255 255 255` | `#FFFFFF`          | Server sidebar bg           |
| `--md3-surface-container-low`     | `247 242 250` | `#F7F2FA`          | Channel/member sidebar bg   |
| `--md3-surface-container`         | `243 237 247` | `#F3EDF7`          | Chat area bg                |
| `--md3-surface-container-high`    | `236 230 240` | `#ECE6F0`          | Elevated cards              |
| `--md3-surface-container-highest` | `230 224 233` | `#E6E0E9`          | Tooltips                    |
| `--md3-on-surface`                | `28 27 31`    | `#1C1B1F`          | Primary text                |
| `--md3-on-surface-variant`        | `73 69 79`    | `#49454F`          | Secondary text              |
| `--md3-outline`                   | `121 116 126` | `#79747E`          | Borders                     |
| `--md3-outline-variant`           | `202 196 208` | `#CAC4D0`          | Subtle borders              |
| `--md3-primary`                   | `103 80 164`  | `#6750A4`          | Accent                      |
| `--md3-on-primary`                | `255 255 255` | `#FFFFFF`          | Text on primary             |
| `--md3-primary-container`         | `234 221 255` | `#EADDFF`          | Active states               |
| `--md3-on-primary-container`      | `33 0 93`     | `#21005D`          | Text on primary container   |
| `--md3-secondary-container`       | `232 222 248` | `#E8DEF8`          | Secondary highlights        |
| `--md3-on-secondary-container`    | `29 25 43`    | `#1D192B`          | Text on secondary container |
| `--md3-error`                     | `179 38 30`   | `#B3261E`          | Error                       |
| `--md3-error-container`           | `249 222 220` | `#F9DEDC`          | Error backgrounds           |
| `--md3-on-error-container`        | `65 14 11`    | `#410E0B`          | Text on error container     |
| `--md3-inverse-surface`           | `49 48 51`    | `#313033`          | Snackbar bg                 |
| `--md3-inverse-on-surface`        | `244 239 244` | `#F4EFF4`          | Snackbar text               |
| `--md3-scrim`                     | —             | `rgba(0,0,0,0.32)` | Modal backdrop (fixed)      |

### 1.2 Shape Tokens

| Token            | Value  | Usage               |
| ---------------- | ------ | ------------------- |
| `--md3-shape-xs` | `4px`  | Small chips, badges |
| `--md3-shape-sm` | `8px`  | Buttons, list items |
| `--md3-shape-md` | `12px` | Cards, inputs       |
| `--md3-shape-lg` | `16px` | Dialogs, containers |
| `--md3-shape-xl` | `28px` | FABs, large dialogs |

### 1.3 Elevation (Tonal — no drop shadows)

MD3 uses tonal surface elevation. Higher elevation = lighter surface in dark mode. The `surface-container-*` tokens already encode this. No box-shadow needed for elevation in chat components.

### 1.4 State Layers

| State   | Opacity | Implementation                           |
| ------- | ------- | ---------------------------------------- |
| Hover   | 8%      | `hover:bg-md3-on-surface/[0.08]`         |
| Focus   | 12%     | `focus-visible:bg-md3-on-surface/[0.12]` |
| Pressed | 12%     | `active:bg-md3-on-surface/[0.12]`        |
| Dragged | 16%     | `bg-md3-on-surface/[0.16]`               |

Note: These work because CSS variables are defined as space-separated RGB channels. The Tailwind config references them via `rgb(var(--md3-on-surface) / <alpha-value>)`.

### 1.5 Tailwind Config Extension

Add `md3` color namespace to `tailwind.config.ts`. Abbreviations use readable names to avoid ambiguity:

```ts
md3: {
  surface: 'rgb(var(--md3-surface) / <alpha-value>)',
  'surface-lowest': 'rgb(var(--md3-surface-container-lowest) / <alpha-value>)',
  'surface-low': 'rgb(var(--md3-surface-container-low) / <alpha-value>)',
  'surface-cont': 'rgb(var(--md3-surface-container) / <alpha-value>)',
  'surface-high': 'rgb(var(--md3-surface-container-high) / <alpha-value>)',
  'surface-highest': 'rgb(var(--md3-surface-container-highest) / <alpha-value>)',
  'on-surface': 'rgb(var(--md3-on-surface) / <alpha-value>)',
  'on-surface-var': 'rgb(var(--md3-on-surface-variant) / <alpha-value>)',
  outline: 'rgb(var(--md3-outline) / <alpha-value>)',
  'outline-var': 'rgb(var(--md3-outline-variant) / <alpha-value>)',
  primary: 'rgb(var(--md3-primary) / <alpha-value>)',
  'on-primary': 'rgb(var(--md3-on-primary) / <alpha-value>)',
  'primary-cont': 'rgb(var(--md3-primary-container) / <alpha-value>)',
  'on-primary-cont': 'rgb(var(--md3-on-primary-container) / <alpha-value>)',
  'secondary-cont': 'rgb(var(--md3-secondary-container) / <alpha-value>)',
  'on-secondary-cont': 'rgb(var(--md3-on-secondary-container) / <alpha-value>)',
  error: 'rgb(var(--md3-error) / <alpha-value>)',
  'error-cont': 'rgb(var(--md3-error-container) / <alpha-value>)',
  'on-error-cont': 'rgb(var(--md3-on-error-container) / <alpha-value>)',
  'inverse-surface': 'rgb(var(--md3-inverse-surface) / <alpha-value>)',
  'inverse-on-surface': 'rgb(var(--md3-inverse-on-surface) / <alpha-value>)',
  scrim: 'var(--md3-scrim)', // fixed opacity, no alpha-value
}
```

Add shape scale to `borderRadius`:

```ts
'md3-xs': 'var(--md3-shape-xs)',
'md3-sm': 'var(--md3-shape-sm)',
'md3-md': 'var(--md3-shape-md)',
'md3-lg': 'var(--md3-shape-lg)',
'md3-xl': 'var(--md3-shape-xl)',
```

### 1.6 Typography Scale

Map MD3 type roles to Tailwind utility classes. Define as `@apply` utilities in globals.css:

| MD3 Role         | Tailwind Classes                                        |
| ---------------- | ------------------------------------------------------- |
| `display-large`  | `text-[57px] leading-[64px] font-normal tracking-tight` |
| `headline-small` | `text-2xl leading-8 font-normal`                        |
| `title-large`    | `text-[22px] leading-7 font-medium`                     |
| `title-medium`   | `text-base leading-6 font-medium tracking-wide`         |
| `title-small`    | `text-sm leading-5 font-medium tracking-wide`           |
| `body-large`     | `text-base leading-6 font-normal`                       |
| `body-medium`    | `text-sm leading-5 font-normal`                         |
| `body-small`     | `text-xs leading-4 font-normal`                         |
| `label-large`    | `text-sm leading-5 font-medium tracking-wide`           |
| `label-medium`   | `text-xs leading-4 font-medium tracking-wider`          |
| `label-small`    | `text-[11px] leading-4 font-medium tracking-widest`     |

Implementation: add `@layer components` utilities in globals.css so these can be used as classes (e.g., `class="md3-title-large"`).

---

## 2. Panel 1 — ServerSidebar.tsx (MD3 NavigationRail)

**File:** `components/chat/ServerSidebar.tsx` (251 lines)

### Visual Changes

| Element            | Current (verified from code)                                                                                        | Target                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Background         | `bg-navy-950/85` (line 123)                                                                                         | `bg-md3-surface-lowest`                                                                      |
| Border             | `border-navy-800/60` (line 123)                                                                                     | `border-md3-outline-var`                                                                     |
| DM button bg       | `bg-emerald-500/90` (line 128)                                                                                      | `bg-md3-primary-cont`                                                                        |
| DM button text     | `text-white` (line 128)                                                                                             | `text-md3-on-primary-cont`                                                                   |
| DM active ring     | `ring-emerald-400/50` (line 131)                                                                                    | `ring-md3-primary`                                                                           |
| DM active shadow   | `shadow-glow` (line 131)                                                                                            | Remove (MD3 uses tonal elevation)                                                            |
| Course icon bg     | `bg-navy-900/70` (line 158)                                                                                         | `bg-md3-surface-high`                                                                        |
| Course icon active | `bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft-lg` (line 155-156)                            | `bg-md3-primary-cont text-md3-on-primary-cont`                                               |
| Course icon hover  | `hover:bg-navy-800/80 hover:border-navy-700/70 hover:text-white` (line 159)                                         | `hover:bg-md3-on-surface/[0.08]`                                                             |
| Active indicator   | `bg-emerald-400` (line 222)                                                                                         | `bg-md3-primary` pill (4px wide, 40px tall)                                                  |
| Lock icon          | `text-gray-500` SVG (line 173-184)                                                                                  | `text-md3-on-surface-var opacity-[0.38]`                                                     |
| Locked icon bg     | `bg-navy-900/40 text-gray-500 border-navy-800/50` (line 158)                                                        | `bg-md3-surface-cont text-md3-on-surface-var/[0.38]`                                         |
| Unread badge       | `bg-red-500 text-white` (line 192)                                                                                  | `bg-md3-error text-white`                                                                    |
| Tooltip bg         | `bg-navy-900/95 border-navy-700/60` (line 201)                                                                      | `bg-md3-surface-highest text-md3-on-surface`                                                 |
| Separator          | `bg-navy-800/70` (line 139)                                                                                         | `bg-md3-outline-var`                                                                         |
| Add course btn     | `bg-navy-900/70 border-navy-800/60 hover:border-emerald-500/50 hover:bg-emerald-500/15 text-emerald-300` (line 231) | `bg-md3-surface-high border-md3-outline-var hover:bg-md3-on-surface/[0.08] text-md3-primary` |

### Structural Changes

- Add `role="navigation"` and `aria-label="Course servers"` to outer div
- Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md3-primary` to all buttons
- Add `aria-hidden="true"` to decorative SVG icons

---

## 3. Panel 2 — ChannelSidebar.tsx (MD3 NavigationDrawer)

**File:** `components/chat/ChannelSidebar.tsx`

### Visual Changes

| Element               | Current (verified from code)                                                                    | Target                                                        |
| --------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Background            | `bg-navy-950/70` (line 132)                                                                     | `bg-md3-surface-low`                                          |
| Border                | `border-navy-800/60` (line 132)                                                                 | `border-md3-outline-var`                                      |
| Header bg             | `bg-navy-950/60` (line 134)                                                                     | `bg-md3-surface-low`                                          |
| Course header text    | `text-gray-100` (line 135)                                                                      | `text-md3-on-surface`                                         |
| Collapse/gear buttons | `text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60` (line 147)                          | `text-md3-on-surface-var hover:bg-md3-on-surface/[0.08]`      |
| Category label        | `text-gray-500` (line 208)                                                                      | `text-md3-on-surface-var` (with `label-small uppercase`)      |
| Channel `#` icon      | `text-gray-500` (line 35)                                                                       | `text-md3-on-surface-var`                                     |
| Active channel        | `bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft` (line 271)               | `bg-md3-primary-cont text-md3-on-primary-cont rounded-md3-xl` |
| Active indicator dot  | `bg-emerald-400` (line 291)                                                                     | `bg-md3-primary`                                              |
| Unread channel text   | `text-gray-100 font-medium` (line 273)                                                          | `font-bold text-md3-on-surface` + `bg-md3-primary` dot        |
| Default channel text  | `text-gray-400` (line 274)                                                                      | `text-md3-on-surface-var`                                     |
| Channel hover         | `hover:bg-navy-800/50` (line 273)                                                               | `hover:bg-md3-on-surface/[0.08]`                              |
| Unread count badge    | `bg-red-500 text-white` (line 284)                                                              | `bg-md3-primary text-md3-on-primary`                          |
| Channel mgmt modal bg | `bg-navy-950/80 backdrop-blur-sm` overlay + `bg-navy-950/90 border-navy-800/60` (line 310, 314) | `bg-md3-scrim` overlay + `bg-md3-surface-high rounded-md3-xl` |

Note: The user profile footer is rendered in LayoutContainer.tsx (lines 282-342), not in ChannelSidebar. See Section 6 for its redesign.

---

## 4. Panel 3 — ChatArea, Message, MessageInput

### 4.1 ChatArea.tsx

**Channel Header (MD3 SmallTopAppBar):**

| Element          | Current       | Target                                                                          |
| ---------------- | ------------- | ------------------------------------------------------------------------------- |
| Background       | navy variants | `bg-md3-surface-cont`                                                           |
| Channel name     | `text-white`  | `text-md3-on-surface` (with `title-large` scale)                                |
| Description      | gray variant  | `text-md3-on-surface-var` (with `body-medium` scale)                            |
| Connection dot   | amber         | `bg-amber-500` (keep — semantic status, not themed) + `text-md3-on-surface-var` |
| Hamburger button | custom        | `text-md3-on-surface` with state layer                                          |
| Member toggle    | (new)         | IconButton with `text-md3-on-surface-var`, toggles Panel 4                      |
| Border           | custom        | `border-b border-md3-outline-var`                                               |

**Message Area:**

- Background: `bg-md3-surface`
- Empty state icon: `text-md3-on-surface-var`
- "Load older messages" button: `text-md3-primary` text button
- Scroll-to-bottom FAB: `bg-md3-primary-cont text-md3-on-primary-cont rounded-md3-lg`

**Typing Indicator:**

- Background: `bg-md3-surface-cont` inline bar
- Dots: `bg-md3-primary` animated
- Text: `text-md3-on-surface-var` (with `body-small` scale)

### 4.2 Message.tsx

| Element             | Current         | Target                                                                 |
| ------------------- | --------------- | ---------------------------------------------------------------------- |
| Username (student)  | custom          | `text-md3-on-surface font-semibold` (`body-medium`)                    |
| Username (lecturer) | custom color    | `text-md3-primary font-semibold` (`body-medium`)                       |
| Timestamp           | custom gray     | `text-md3-on-surface-var` (`body-small`)                               |
| Message text        | `text-gray-100` | `text-md3-on-surface` (`body-medium`)                                  |
| "(edited)"          | custom          | `text-md3-on-surface-var` (`body-small`)                               |
| Reply preview       | custom card     | `bg-md3-surface-high border-l-2 border-md3-outline-var rounded-md3-sm` |
| Reactions           | custom pills    | `bg-md3-surface-high text-md3-on-surface-var rounded-full` chips       |
| Own reaction        | custom          | `bg-md3-primary-cont text-md3-on-primary-cont`                         |
| Hover actions bar   | custom          | `bg-md3-surface-highest rounded-md3-sm` floating pill                  |
| Avatar              | 40px circle     | Keep 40px, `rounded-full`                                              |
| Media images        | custom rounded  | `rounded-md3-md`                                                       |
| Pending opacity     | slight          | `opacity-50`                                                           |
| Failed state        | red tint        | `bg-md3-error-cont/10 border-l-2 border-md3-error`                     |

### 4.3 MessageInput.tsx

| Element         | Current       | Target                                                        |
| --------------- | ------------- | ------------------------------------------------------------- |
| Container bg    | custom        | `bg-md3-surface-high`                                         |
| Border          | custom        | `border border-md3-outline rounded-md3-md`                    |
| Textarea        | custom        | `bg-transparent text-md3-on-surface`                          |
| Placeholder     | custom        | `text-md3-on-surface-var`                                     |
| Reply preview   | custom        | `bg-md3-surface-highest` bar above input                      |
| Attachment icon | custom        | `text-md3-on-surface-var` with state layer                    |
| Send button     | custom        | `bg-md3-primary text-md3-on-primary rounded-full` (small FAB) |
| Disabled text   | custom        | `text-md3-on-surface-var` with reduced opacity                |
| Drop zone       | custom dashed | `border-2 border-dashed border-md3-primary`                   |

---

## 5. Panel 4 — MemberSidebar.tsx

| Element               | Current      | Target                                                                       |
| --------------------- | ------------ | ---------------------------------------------------------------------------- |
| Background            | custom       | `bg-md3-surface-low`                                                         |
| Header                | custom       | `text-md3-on-surface` (`title-medium`) + member count                        |
| Online section label  | custom       | `text-md3-on-surface-var` (`label-small`)                                    |
| Member row            | custom       | Avatar + `text-md3-on-surface` (`body-medium`)                               |
| Role label (lecturer) | custom       | `bg-md3-primary-cont text-md3-on-primary-cont` chip                          |
| Role label (student)  | custom       | `text-md3-on-surface-var` (`body-small`)                                     |
| Status dots           | custom       | Green (#4CAF50), Amber (#FF9800), Red (#F44336) — semantic/fixed, not themed |
| Offline section       | custom muted | Same layout, `opacity-[0.38]`                                                |
| Close button          | custom       | `text-md3-on-surface-var` IconButton                                         |

---

## 6. LayoutContainer.tsx

### Visual Changes

| Element                    | Current (verified from code)                                           | Target                                                   |
| -------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Outer bg                   | `bg-navy-950/40 backdrop-blur-sm text-white` (line 202)                | `bg-md3-surface text-md3-on-surface`                     |
| Mobile backdrop            | `bg-black/60 backdrop-blur-sm` (line 205)                              | `bg-md3-scrim` (32% black, no blur — MD3 scrim is flat)  |
| Channel sidebar wrapper bg | `bg-navy-950/95 md:bg-navy-950/70` (line 232)                          | `bg-md3-surface-low`                                     |
| Channel sidebar border     | `border-navy-800/60` (line 232)                                        | `border-md3-outline-var`                                 |
| Collapsed header bg        | `bg-navy-950/60` (line 239)                                            | `bg-md3-surface-low`                                     |
| Collapsed header text      | `text-gray-400` (line 241)                                             | `text-md3-on-surface-var`                                |
| Collapse button            | `text-gray-400 hover:text-emerald-300 hover:bg-navy-800/60` (line 244) | `text-md3-on-surface-var hover:bg-md3-on-surface/[0.08]` |

### User Profile Footer (lines 282-342 in LayoutContainer)

| Element              | Current (verified from code)                                                                                                         | Target                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Background           | `bg-navy-950/80` (line 283)                                                                                                          | `bg-md3-surface-cont`                                                                               |
| Border               | `border-navy-800/60` (line 283)                                                                                                      | `border-md3-outline-var`                                                                            |
| Avatar fallback bg   | `bg-emerald-500/90` (line 291)                                                                                                       | `bg-md3-primary-cont`                                                                               |
| Avatar fallback text | `text-white` (line 291)                                                                                                              | `text-md3-on-primary-cont`                                                                          |
| Username             | `text-gray-100` (line 296)                                                                                                           | `text-md3-on-surface`                                                                               |
| Online status text   | `text-emerald-300` (line 299)                                                                                                        | `text-md3-on-surface-var`                                                                           |
| Online dot           | `bg-emerald-400` (line 300)                                                                                                          | `bg-[#4CAF50]` (semantic status, fixed)                                                             |
| Action buttons       | `text-gray-400 border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 hover:text-emerald-200` (line 305) | `text-md3-on-surface-var bg-md3-surface-high border-md3-outline-var hover:bg-md3-on-surface/[0.08]` |

### Structural Changes

- Add Panel 4 (MemberSidebar) toggle state: `const [memberSidebarOpen, setMemberSidebarOpen] = useState(false)`
- Pass `onMemberToggle` callback to ChatArea header
- Panel 4 slides in from right on toggle (240px, `duration-300 ease-[cubic-bezier(0.2,0,0,1)]`)
- Remove `backdrop-blur-sm` from mobile scrim

---

## 7. Special Views

### 7.1 LecturesChannel.tsx

- Video player container: `bg-md3-surface-cont rounded-md3-lg overflow-hidden`
- Video list items: `bg-md3-surface-high rounded-md3-sm` on hover
- Active video: `bg-md3-primary-cont/10 border-l-2 border-md3-primary`
- Lock icon: `text-md3-on-surface-var opacity-[0.38]`
- Completion checkmark: `text-md3-primary`
- Progress bar: `bg-md3-primary` track on `bg-md3-outline-var` rail

### 7.2 ProjectCard.tsx

- Card: `bg-md3-surface-high rounded-md3-md border border-md3-outline-var`
- Title: `text-md3-on-surface` (`title-medium`)
- Budget chip: `bg-md3-secondary-cont text-md3-on-secondary-cont rounded-full`
- Platform icons: `text-md3-on-surface-var`
- Submit button: `bg-md3-primary text-md3-on-primary rounded-md3-xl` (MD3 FilledButton)
- Countdown: `text-md3-error` (`body-small`)

### 7.3 VideoUploadDialog.tsx / VideoSubmissionDialog.tsx / SubmissionReviewDialog.tsx

- Dialog container: `bg-md3-surface-high rounded-md3-xl` with scrim backdrop
- Title: `text-md3-on-surface` (`headline-small`)
- Form inputs: MD3 outlined text field — `border border-md3-outline rounded-md3-xs` with label
- Primary action: `bg-md3-primary text-md3-on-primary rounded-md3-xl` (FilledButton)
- Secondary action: `border border-md3-outline text-md3-primary rounded-md3-xl` (OutlinedButton)

### 7.4 ChannelManagement.tsx

- Same dialog pattern as 7.3
- Channel list items: `bg-md3-surface-cont rounded-md3-sm` with hover state layer
- Type selector: MD3 SegmentedButton pattern
- Delete button: `text-md3-error`

### 7.5 ChatNavigation.tsx (335 lines)

Top navigation bar for chat interface. Uses `signOut`, language selector, user dropdown, role-based navigation links.

| Element                 | Current (verified from code)                               | Target                                              |
| ----------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| Outer bg                | `bg-navy-950/80 border-navy-800/60`                        | `bg-md3-surface-cont border-md3-outline-var`        |
| Language selector hover | `hover:bg-navy-800/60` (line 43)                           | `hover:bg-md3-on-surface/[0.08]`                    |
| Language dropdown bg    | navy variant                                               | `bg-md3-surface-highest border-md3-outline-var`     |
| Nav links               | `text-gray-300 hover:text-white`                           | `text-md3-on-surface-var hover:text-md3-on-surface` |
| Active nav link         | `text-emerald-300 bg-emerald-500/15 border-emerald-400/30` | `text-md3-primary bg-md3-primary-cont/20`           |
| Avatar fallback bg      | `bg-emerald-500`                                           | `bg-md3-primary-cont`                               |
| User dropdown bg        | navy variant                                               | `bg-md3-surface-highest border-md3-outline-var`     |
| Sign out button         | `text-red-300 hover:bg-red-900/30`                         | `text-md3-error hover:bg-md3-error/[0.08]`          |
| Focus rings             | `ring-emerald-400/50`                                      | `ring-md3-primary`                                  |

### 7.6 ChatErrorBoundary.tsx (97 lines)

Error boundary fallback UI.

| Element              | Current (verified from code)                               | Target                                                                   |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| Outer bg             | `bg-navy-950/20` (line 42)                                 | `bg-md3-surface`                                                         |
| Error card bg        | `bg-red-900/50 border-red-700 text-red-200` (line 44)      | `bg-md3-error-cont text-md3-on-error-cont border-md3-error`              |
| Error detail text    | `text-red-300/70` (line 60)                                | `text-md3-on-error-cont/70`                                              |
| "Try Again" button   | `bg-emerald-500 hover:bg-emerald-600 text-white` (line 68) | `bg-md3-primary text-md3-on-primary hover:bg-md3-primary/90`             |
| "Reload Page" button | `bg-navy-700 hover:bg-navy-600 text-white` (line 82)       | `bg-md3-surface-high text-md3-on-surface hover:bg-md3-on-surface/[0.08]` |

---

## 8. Accessibility

All chat components must include:

- `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md3-primary` on interactive elements
- `aria-label` on icon-only buttons
- `role="navigation"` on sidebars
- `role="log"` on message list with `aria-live="polite"`
- `aria-hidden="true"` on decorative icons
- Keyboard navigation: Tab order follows visual layout

---

## 9. Localization

New keys needed (distinct from existing root-level keys):

**en.json** (under `"chat"` namespace):

```json
"chat": {
  ...existing keys preserved...,
  "members": "Members",
  "memberCount": "{{count}} members",
  "offlineMembers": "Offline",
  "onlineMembers": "Online",
  "noMessages": "No messages yet",
  "beFirstToChat": "Be the first to start the conversation",
  "loadOlderMessages": "Load older messages",
  "scrollToBottom": "Scroll to bottom",
  "messagePlaceholder": "Message #{{channel}}",
  "youAreMuted": "You are muted in this channel",
  "typing": "{{user}} is typing...",
  "typingMultiple": "{{user}} and {{count}} others are typing...",
  "retry": "Retry",
  "sendFailed": "Failed to send"
}
```

**ge.json:** Corresponding Georgian translations.

---

## 10. Migration Strategy

### 10.1 Existing chat-\* Utility Classes

The current `globals.css` defines 8 chat utility classes (lines 231-285). Migration plan:

| Utility Class            | Action                                         | Reason                                          |
| ------------------------ | ---------------------------------------------- | ----------------------------------------------- |
| `.chat-surface`          | Update to use `--md3-surface-container`        | Maps to MD3 surface hierarchy                   |
| `.chat-surface-elevated` | Update to use `--md3-surface-container-high`   | Maps to MD3 elevated surface                    |
| `.chat-surface-muted`    | Update to use `--md3-surface` with 55% opacity | Preserve muted behavior                         |
| `.chat-border`           | Update to use `--md3-outline-variant`          | Maps to MD3 outline                             |
| `.chat-divider`          | Update to use `--md3-outline-variant`          | Maps to MD3 outline                             |
| `.chat-text-muted`       | Update to use `--md3-on-surface-variant`       | Maps to MD3 secondary text                      |
| `.chat-ring`             | Update to use `--md3-primary`                  | Maps to MD3 accent                              |
| `.chat-scrollbar`        | Keep as-is                                     | Scrollbar styling is platform-specific, not MD3 |

After all component migrations, verify no component still uses the old RGB-based `var(--surface)` / `var(--accent-color)` values. If none do, the old `chat-*` utilities can be removed in a cleanup pass.

### 10.2 Implementation Order

1. Add MD3 tokens to globals.css and tailwind.config.ts (non-breaking — new tokens, old ones stay)
2. Add MD3 typography utilities to globals.css
3. Redesign chat components one panel at a time:
   - ServerSidebar → ChannelSidebar → ChatArea/Message/MessageInput → MemberSidebar → LayoutContainer → ChatNavigation → ChatErrorBoundary → LecturesChannel → ProjectCard → Dialogs
4. Each component: replace class names, preserve all props/callbacks/hooks
5. Verify per component: dark mode, light mode, mobile, all interactive states
6. Run `npm run build` after each panel to catch TypeScript errors
7. Update `chat-*` utility classes to use MD3 variables
8. Update locales with new chat keys

No breaking changes to non-chat pages. The navy/charcoal/emerald tokens remain available.
