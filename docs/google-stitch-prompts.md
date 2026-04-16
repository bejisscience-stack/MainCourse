# Google Stitch Prompts — Swavleba Full Redesign

All prompts use Material Design 3 with neutral seed color (no locked brand color). Dark theme primary. Run each prompt separately in Google Stitch in the order below.

**Order follows the user journey:**

1. Home (first impression) → 2. Auth (sign up/in) → 3. Courses Catalog (browse) → 4. Payment (enroll) → 5. My Courses (dashboard) → 6. Chat (learn) → 7. DMs + Friends (social) → 8. Settings (account) → 9. Lecturer Dashboard → 10. Admin Dashboard → 11. Legal Pages

---

## PROMPT 1: Home / Landing Page

```
Design the home/landing page for an education platform called "Swavleba" using Material Design 3 (Material You). This is a Georgian-language course platform where students enroll in courses (Editing, Content Creation, Website Creation), participate in paid projects, and communicate via real-time chat. The design should use neutral MD3 tones — no locked brand color, keep it adaptable so any primary color works on top.

PAGE STRUCTURE (top to bottom):
1. Fixed Navigation Bar
2. Hero Section
3. Courses Carousel Section
4. Active Projects Carousel Section
5. Footer

---

SECTION 1 — NAVIGATION BAR (fixed top, full width):

- Sticky/fixed at top with backdrop blur and subtle border-bottom
- Height: 64px mobile, 80px desktop
- Max-width container (1280px) centered

LEFT SIDE:
- Platform logo image "Swavleba" (links to home)
- Logo hover: subtle scale-up animation

CENTER (desktop only, hidden on mobile):
- Navigation links vary by user role:
  - Not logged in: "Courses", "Projects"
  - Student: "Courses", "Projects", "My Courses"
  - Lecturer: "Dashboard"
  - Admin: "Admin Dashboard", "All Courses", "Projects"
- Active link has distinct color, others are muted
- Hover: text color brightens

RIGHT SIDE (desktop):
- Language selector dropdown (English/Georgian with flag icons)
- Notification bell icon (only when logged in) — with unread count badge
- If logged in: Avatar button (image or initial circle) + chevron dropdown
  - Dropdown menu (MD3 Menu):
    - User info header: avatar + username + email + role badge (Lecturer/Admin if applicable)
    - Role-specific links:
      - Lecturer: Dashboard, Chat, Settings
      - Admin: Admin Dashboard, All Courses, Settings
      - Student: My Courses, Settings
    - Divider
    - Sign Out button (red text, with loading state)
- If not logged in: "Log In" text link + "Sign Up" filled button (pill/rounded-full shape)

MOBILE:
- Logo left, hamburger icon right
- Hamburger opens full dropdown below navbar:
  - Navigation links (role-specific, same as desktop)
  - Language selector + Notification bell centered
  - If logged in: Profile section (avatar + name + email + role badge) + role links + Settings + Sign Out
  - If not logged in: Log In + Sign Up buttons stacked

---

SECTION 2 — HERO SECTION:

- Full-width, generous vertical padding (96px top on mobile, 192px on desktop, 48-128px bottom)
- Subtle radial gradient halo effect behind content (very subtle, decorative)
- Content centered, max-width 640-720px

ELEMENTS:
- Main heading (display-large typography, 48-80px responsive):
  - Line 1: Bold primary text (e.g., "Start Your Journey")
  - Line 2 (optional): Lighter secondary text (e.g., "To Financial Freedom")
- Subtitle paragraph below heading:
  - Body-large typography, muted color, max-width 640px, relaxed line-height
- CTA button (centered below subtitle):
  - Context-aware label:
    - Not logged in: "Enroll Now" → links to /signup
    - Student: "My Courses" → links to /my-courses
    - Lecturer: "Dashboard" → links to /lecturer/dashboard
    - Admin: "Admin Panel" → links to /admin
  - Style: MD3 FilledButton, pill shape (rounded-full), large padding
  - Arrow icon "→" that shifts right on hover
  - Hover: slight lift (-translate-y) + shadow increase
- Scroll-reveal animation: content fades in and slides up on scroll (staggered: heading first, subtitle second, button third)

---

SECTION 3 — COURSES CAROUSEL:

HEADER:
- Section title "Our Courses" (headline-large, centered, clickable — links to /courses page)
- Subtitle: "[N] courses available" (body-medium, muted)
- Scroll-reveal fade-in animation

DESKTOP CAROUSEL (md+):
- Horizontal carousel showing 2-3 course cards at a time (2 on tablet, 3 on desktop)
- Left/Right arrow buttons (MD3 IconButton, circular, with border) on each side
- Auto-rotation every 4 seconds, pauses on hover
- Smooth slide transition with transform
- Dot indicators or progress bar below carousel

MOBILE LAYOUT:
- Vertical stack of course cards (not carousel)
- Shows first 3 courses by default
- "Show All" / "Show Less" toggle button at bottom

COURSE CARD (MD3 Card — elevated or filled variant):
- Thumbnail area at top:
  - Course thumbnail image or gradient placeholder
  - If course has intro video: play button overlay, clicking expands to video player
  - "Bestseller" badge (top-left, small chip) if applicable
- Card body:
  - Course title (title-medium, bold)
  - Author/Creator name (body-small, muted)
  - Star rating + review count (body-small, star icon + number)
  - Course type badge/chip: "Editing" / "Content Creation" / "Website Creation"
- Card footer:
  - Price display: current price in GEL currency, with optional strikethrough original price if discounted
  - Enrollment status handling:
    - Not enrolled: "Enroll" button (MD3 FilledButton) → opens EnrollmentModal
    - Pending request: "Pending" badge (amber)
    - Enrolled: "Go to Course" button or "Enrolled" chip (green)
    - Expired: "Expired" badge (red) + days info + "Re-enroll" option
  - If not logged in, Enroll redirects to signup
- Card hover: subtle elevation increase + scale animation
- Click on card: opens course detail or enrollment modal

ENROLLMENT MODAL (triggered from course card):
- MD3 Dialog, full-screen on mobile
- Course details summary
- Payment integration (Keepz payment gateway)
- Referral code field
- Success/error states

LOADING STATE:
- Spinner centered below section title

ERROR STATE:
- Error card (red container) with message + "Retry" button

---

SECTION 4 — ACTIVE PROJECTS CAROUSEL:

HEADER:
- Section title "Active Projects" (headline-large, centered)
- Scroll-reveal animation

DESKTOP:
- Horizontal carousel, 1 card visible at a time (larger cards)
- Left/Right arrow buttons
- Auto-rotation every 4 seconds, pauses on hover
- Dot indicators

MOBILE:
- Vertical stack, first 3 shown
- "Show All" / "Show Less" toggle

PROJECT CARD (MD3 Card, larger than course cards):
- Project name (title-large, bold)
- Description text (body-medium, 2-3 line clamp)
- Video thumbnail with play button (if video link exists, YouTube embed support)
- Metadata row:
  - Budget display in GEL currency + remaining budget progress bar
  - View range (e.g., "1K - 5K views")
  - Platform badges: Instagram (pink chip with camera icon), TikTok (slate chip with music icon)
- Date range: "Mar 15 - Apr 15, 2026" format
- Countdown timer: live countdown to end date (days, hours, minutes, seconds)
  - Color-coded: green if >3 days, amber if 1-3 days, red if <1 day
  - "Ended" label if past end date, "Starts in..." if before start date
- "View Details" button → opens Project Details Modal
- Card hover: subtle elevation increase

PROJECT DETAILS MODAL:
- Full project description
- Embedded video player
- Criteria list with RPM rates
- Submission count / participant info
- Close button

LOADING STATE:
- "Loading projects..." text centered

ERROR STATE:
- Error card with "Retry" button

EMPTY STATE:
- Section hidden if no active projects

---

SECTION 5 — FOOTER:

- Dark background (surface-container or surface-dim in MD3 dark)
- Border-top separator
- Max-width container, padding

THREE COLUMNS (grid, 1 column on mobile):

Column 1 — Brand:
- Swavleba logo image
- Short description paragraph (body-small, muted)

Column 2 — Legal:
- "Legal" heading (title-small)
- Links list: Terms and Conditions, Privacy Policy, Personal Info Security, Refund Policy
- Links are muted, hover brightens

Column 3 — Company:
- "Company" heading (title-small)
- Links list: About Us, Courses
- Same hover style

BOTTOM BAR:
- Horizontal divider
- Copyright: "© 2026 Swavleba. All rights reserved." (centered, body-small, muted)

---

GLOBAL BEHAVIORS:

SCROLL REVEAL ANIMATION:
- Content sections fade in + slide up when scrolling into view
- Staggered delays within each section (heading → subtitle → content)
- Smooth, subtle — 600ms duration

ROLE-BASED REDIRECTS:
- Lecturers who visit home page are redirected to /lecturer/dashboard
- The CTA button in hero changes based on auth state and role

DARK THEME:
- Primary design should be dark theme
- Proper MD3 dark surface hierarchy
- Light theme support as secondary

---

MATERIAL DESIGN 3 SPECIFICS:
- Use MD3 neutral seed color — surfaces in gray/slate tones, no locked brand color
- MD3 shape scale for all rounded corners
- MD3 type scale (display, headline, title, body, label) for all text
- MD3 tonal elevation for cards and containers
- MD3 state layers for all interactive elements (hover 8%, focus 12%, pressed 12%)
- MD3 components: TopAppBar, Card (elevated + filled), FilledButton, TextButton, IconButton, Menu, Dialog, Chip, Badge, NavigationBar (mobile)
- MD3 motion: standard easing curves for all transitions and animations

---

RESPONSIVE BREAKPOINTS:
- Mobile (<768px): single column, stacked layouts, hamburger nav, vertical card lists
- Tablet (768-1024px): 2 cards per carousel slide, full nav visible
- Desktop (>1024px): 3 cards per carousel slide, full nav, max-width 1280px container

---

ACCESSIBILITY:
- Focus-visible outlines on all interactive elements
- ARIA labels on icon buttons and nav toggles
- Skip-to-content link (hidden until focused)
- Sufficient color contrast per MD3 guidelines
- Keyboard navigation: Tab through nav items, Enter to activate, Escape to close menus/modals

---

BILINGUAL LABELS (English shown, Georgian exists in app):
- Navigation: "Courses", "Projects", "My Courses", "Dashboard", "Admin Dashboard", "Log In", "Sign Up", "Settings", "Sign Out"
- Hero: "Start Your Journey", "To Financial Freedom", "Enroll Now", "My Courses"
- Courses: "Our Courses", "courses available", "Enroll", "Pending", "Enrolled", "Expired", "Retry"
- Projects: "Active Projects", "View Details", "Loading projects..."
- Footer: "Legal", "Terms and Conditions", "Privacy Policy", "Personal Info Security", "Refund Policy", "Company", "About Us", "All rights reserved"
```

---

## PROMPT 2: Authentication Pages

```
Design a set of authentication pages for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary, light theme secondary. These pages handle login, signup, password recovery, and profile completion.

SHARED LAYOUT FOR ALL AUTH PAGES:
- Full viewport height, centered content
- Gradient background (subtle, top-to-bottom)
- Single centered card (max-width 448px) with MD3 elevated surface
- MD3 shape: extra-large rounded corners (28dp) on card
- Platform logo image centered at top of card (links to home page)

---

PAGE 1 — LOGIN (/login):

- Heading: "Sign In" (headline-medium)
- Form fields (MD3 OutlinedTextField):
  - Email (text input, email keyboard on mobile)
  - Password (password input with show/hide toggle icon)
- "Forgot Password?" text link (right-aligned below password field, body-small)
- "Sign In" button: MD3 FilledButton, full-width, large padding
  - Loading state: circular progress indicator replacing text
  - Disabled when fields empty
- Divider row: horizontal line with "or" text centered
- "Continue with Google" button: MD3 OutlinedButton, full-width, Google "G" icon on left
  - Loading state: spinner
- Bottom text: "Don't have an account?" + "Sign Up" link (body-medium)
- Error state: MD3 error container (red surface) above form with error message text
- Auto-redirect: if already logged in, redirect based on role (student → /my-courses, lecturer → /lecturer/dashboard, admin → /admin)
- 30-second timeout: shows timeout error message with retry suggestion

---

PAGE 2 — SIGNUP (/signup):

- Heading: "Create Account" (headline-medium)
- Form fields (MD3 OutlinedTextField):
  - Username
  - Email
  - Password
  - Role selector: MD3 SegmentedButton with two options — "Student" | "Lecturer"
  - Referral Code field (optional):
    - Pre-filled from URL parameter if present
    - Validation indicator: green checkmark if valid, amber warning if invalid
    - Helper text: "Optional — enter a referral code for a discount"
- "Create Account" button: MD3 FilledButton, full-width
  - Loading state
- Divider + "Continue with Google" button (same as login)
- Bottom: "Already have an account?" + "Sign In" link
- Referral validation states:
  - Valid: green chip "Referral applied" with checkmark
  - Invalid: amber warning text "Referral code not found — you can still sign up"
- Success state (replaces form):
  - Checkmark icon (large, animated)
  - "Check your email" heading
  - "We sent a verification link to your@email.com" body text
  - "Back to Login" button
- Error state: same red container as login

---

PAGE 3 — FORGOT PASSWORD (/forgot-password):

- Heading: "Forgot Password" (headline-medium)
- Description: "Enter your email and we'll send you a reset link" (body-medium, muted)
- Email input field (MD3 OutlinedTextField)
- "Send Reset Link" button: MD3 FilledButton, full-width
  - Loading state
- Success state (replaces form):
  - Email icon (large)
  - "Check Your Email" heading
  - "If an account exists with that email, we sent a password reset link." body text
  - "Back to Login" text button
- "Back to Login" link at bottom (always visible)

---

PAGE 4 — RESET PASSWORD (/reset-password):

- Heading: "Reset Password" (headline-medium)
- Form fields:
  - New Password (password input with show/hide)
  - Confirm Password (password input with show/hide)
  - Password strength indicator bar below new password field
- "Reset Password" button: MD3 FilledButton, full-width
  - Loading state
- Error states:
  - Token expired/invalid: error container + "Request a new reset link" button
  - Passwords don't match: inline error on confirm field
- Success: redirect to login with success toast "Password updated successfully"

---

PAGE 5 — COMPLETE PROFILE (/complete-profile):

- Heading: "Complete Your Profile" (headline-medium)
- Subtitle: "Just a few more details to get started" (body-medium, muted)
- Form fields:
  - Username (MD3 OutlinedTextField)
  - Role selector: MD3 SegmentedButton — "Student" | "Lecturer"
- "Complete Profile" button: MD3 FilledButton, full-width
  - Loading state
- Error state: inline error text
- Only shown for OAuth users (Google sign-in) who haven't set username/role yet

---

RESPONSIVE:
- Mobile: card takes full width with 16px padding, no horizontal margins
- Tablet/Desktop: card centered, max-width 448px, generous vertical padding

ACCESSIBILITY:
- All inputs have visible labels (not just placeholders)
- Error messages associated with fields via aria-describedby
- Focus management: auto-focus first field on page load
- Form submission via Enter key
```

---

## PROMPT 3: Courses Catalog Page

```
Design a courses catalog page for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. This page shows all available courses with filtering, search, and enrollment actions.

PAGE LAYOUT:
- Navigation bar at top (fixed, designed separately)
- Full-width content area with max-width 1280px container
- Padding: 96px top (below fixed nav), 64px bottom

---

HEADER SECTION:
- Page title: "Courses" (display-small, centered)
- Subtitle: "Find the perfect course for your journey" (body-large, muted, centered)

FILTER BAR (below header, centered):
- MD3 SegmentedButton or FilterChip row with options:
  - "All" (default, selected)
  - "Editing"
  - "Content Creation"
  - "Website Creation"
- Search input (MD3 SearchBar or OutlinedTextField with search icon):
  - Placeholder: "Search courses..."
  - Filters results as user types
  - Clear button (X icon) when text entered

---

COURSE GRID:
- Responsive grid: 1 column mobile, 2 tablet, 3-4 desktop
- Gap: 24px

COURSE CARD (MD3 Card — elevated variant):
- Thumbnail area (top, 16:9 ratio):
  - Course image or gradient placeholder
  - Play button overlay if course has intro video → click expands inline video player
  - "Bestseller" chip badge (top-left corner, small, MD3 FilledTonalButton style) if applicable
- Body (padding 16px):
  - Course title (title-medium, bold, 2-line clamp)
  - Author name (body-small, muted)
  - Rating row: filled star icons + numeric rating + review count in parentheses (body-small)
  - Course type chip: MD3 AssistChip — "Editing" / "Content Creation" / "Website Creation"
- Footer (padding 16px, border-top):
  - Price display:
    - Current price: "₾XX" (title-medium, bold)
    - Original price (if discounted): "₾XX" strikethrough (body-small, muted)
    - Discount badge: "-XX%" chip (red/error container)
  - Enrollment action button (right-aligned):
    - Not enrolled: "Enroll" MD3 FilledButton
    - Pending: "Pending" MD3 TonalButton (amber)
    - Enrolled: "Enrolled" MD3 TonalButton (green) with checkmark icon
    - Expired: "Expired" chip (red) + "Re-enroll" text button
- Card hover: slight elevation increase + subtle scale (1.02)
- Card click: opens enrollment modal

---

BUNDLE SECTION (below course grid, only if bundles exist):
- Section heading: "Course Bundles" (headline-medium) + "Save more with bundles" subtitle
- Bundle cards (horizontal scroll on mobile, grid on desktop):
  - MD3 Card (filled variant, distinct from course cards)
  - Bundle title (title-large)
  - Description (body-medium, 2-line clamp)
  - Included courses: small horizontal list of course thumbnails + titles
  - Pricing:
    - Bundle price: "₾XX" (headline-small, bold)
    - Individual total: "₾XX" strikethrough
    - Savings badge: "Save ₾XX" chip (green/success container)
  - "Enroll in Bundle" MD3 FilledButton

---

STATES:
- Loading: skeleton grid (8 card placeholders with animated pulse)
- Error: MD3 error container card (centered) with message + "Retry" button
- Empty (no courses match filter): illustration + "No courses found" + "Try a different filter" text
- No courses at all: illustration + "Coming soon" message

RESPONSIVE:
- Mobile (<768px): 1 column, filter chips horizontally scrollable, search full-width
- Tablet (768-1024px): 2 columns
- Desktop (>1024px): 3-4 columns, max-width 1280px

ACCESSIBILITY:
- Filter chips: keyboard navigable, aria-pressed state
- Course cards: focusable, Enter to activate
- Search: aria-label, live results announcement
```

---

## PROMPT 4: Payment Flows & Modals

```
Design the payment flow screens and modals for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. Payment is processed via Keepz.me gateway in GEL (₾) currency.

---

MODAL 1 — ENROLLMENT MODAL (course enrollment):

Container: MD3 Dialog, full-screen on mobile, max-width 560px on desktop
Close button: X icon (top-right corner)

STEP 1 — "Course Info":
- Course thumbnail (16:9, rounded corners)
- Course title (headline-small)
- Course description (body-medium, 3-line clamp)
- Intro video player (if available, inline)
- Price display:
  - Current price: "₾XX" (display-small, bold)
  - Original price: "₾XX" (body-large, strikethrough, muted) — if discounted
  - Discount chip: "-XX%" (MD3 Chip, error/red)
- "Continue to Payment" MD3 FilledButton
- "Cancel" MD3 TextButton

STEP 2 — "Payment":
- Referral code section:
  - MD3 OutlinedTextField: "Enter referral code" (optional)
  - "Apply" button next to field
  - Applied state: green chip showing code + discount amount + "Remove" action
  - Invalid: error text below field
- Updated price display (if referral applied): shows original, discount, final price
- Payment method section:
  - "Saved Cards" heading:
    - Radio list of saved cards: card icon (Visa/MC) + "•••• 1234" + radio button
    - Selected card highlighted
    - Each card has small "Delete" icon button
  - Divider
  - "Pay with New Card" radio option (MD3 Radio + label)
  - If new card selected: "You'll be redirected to payment page" helper text
  - "Save card for future payments" MD3 Checkbox (default checked)
- "Pay ₾XX" MD3 FilledButton (large, prominent)
  - Loading state: "Processing..." with circular progress
- "Back" MD3 TextButton

PROCESSING STATE:
- Full modal replaced with centered content:
  - Large circular progress indicator
  - "Processing your payment..." text
  - "Please don't close this window" helper text

SUCCESS STATE:
- Full modal replaced with:
  - Large animated checkmark icon (green, scale-in animation)
  - "Payment Successful!" heading (headline-medium)
  - Amount paid: "₾XX"
  - "You now have access to [Course Name]" body text
  - "Go to Chat" MD3 FilledButton (primary action)
  - "Go to My Courses" MD3 OutlinedButton

ERROR STATE:
- Full modal replaced with:
  - Error icon (red X, large)
  - "Payment Failed" heading
  - Error message body text
  - "Try Again" MD3 FilledButton
  - "Go Back" MD3 TextButton

---

MODAL 2 — BUNDLE ENROLLMENT MODAL:
- Same flow as enrollment modal but:
  - Step 1 shows bundle info: title, description, list of included courses (thumbnail + title per course), bundle price vs individual total, savings amount
  - Payment step identical

---

MODAL 3 — PROJECT PAYMENT MODAL (for project budget):
- Simplified version:
  - Project name + budget amount display
  - Payment method selection (saved cards / new card)
  - "Pay ₾XX" button
  - Processing/success/error states

---

PAGE — PAYMENT SUCCESS (/payment/success):
- Full page (not modal)
- Centered content, max-width 480px
- Status checking animation (polling):
  - Circular progress + "Verifying your payment..." text
- Success state:
  - Large animated checkmark (green circle with check)
  - "Payment Successful!" heading (display-small)
  - Amount: "₾XX" (headline-medium)
  - Payment type context:
    - Course enrollment: "You're now enrolled in [Course]"
    - Project budget: "Project budget funded successfully"
  - Action buttons:
    - "Go to My Courses" / "Go to Chat" MD3 FilledButton
    - "Back to Home" MD3 TextButton
- Failed state (payment didn't go through):
  - Red X icon
  - "Payment Verification Failed" heading
  - "Go to Courses" MD3 FilledButton
- Timeout state (taking too long):
  - Warning icon (amber)
  - "This is taking longer than expected" heading
  - "Your payment may still be processing" body
  - "Check Again" MD3 FilledButton + "Go to My Courses" MD3 TextButton

PAGE — PAYMENT FAILED (/payment/failed):
- Full page, centered content
- Large error icon (red circle with X)
- "Payment Failed" heading (display-small)
- "Your payment could not be processed" body text
- "Try Again" MD3 FilledButton (links back to course)
- "Browse Courses" MD3 TextButton

---

RESPONSIVE:
- Mobile: modals become full-screen, buttons stack vertically, payment pages full-width
- Desktop: modals centered (max-width 560px), payment pages centered (max-width 480px)

ACCESSIBILITY:
- Focus trapped within modals
- Escape key closes modals
- Progress states announced to screen readers
- Payment buttons have aria-busy during processing
```

---

## PROMPT 5: My Courses Page

```
Design a "My Courses" dashboard page for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. This page shows a student's enrolled courses with enrollment status, expiry info, and quick actions.

PAGE LAYOUT:
- Navigation bar at top (fixed)
- Subtle animated background (decorative, behind content)
- Content area: max-width 1280px, centered, padding-top 96px

---

HEADER:
- Greeting: "Welcome back, [Username]" (headline-medium)
- Subtitle: "Your enrolled courses" (body-large, muted)

---

ENROLLED COURSES GRID:
- Responsive: 1 column mobile, 2 tablet, 3 desktop
- Gap: 24px

ENROLLED COURSE CARD (MD3 Card — elevated):
- Same structure as course catalog card but with enrollment info overlay:
  - Thumbnail + title + author + rating + type chip
- Enrollment status section (replaces price/enroll button):
  - Active enrollment:
    - Green status dot + "Active" label
    - "XX days remaining" text (body-small)
    - Progress bar showing time remaining (green gradient)
    - "Go to Chat" MD3 FilledButton (primary action)
    - "Go to Course" MD3 OutlinedButton
  - Expiring soon (< 7 days):
    - Amber status dot + "Expiring Soon" label
    - "X days remaining" (amber text)
    - Progress bar (amber)
    - Same action buttons
  - Expired:
    - Full card overlay (semi-transparent dark surface):
      - Lock icon (large, centered)
      - "Enrollment Expired" heading
      - "Expired on [date]" body text
      - "Re-enroll" MD3 FilledButton
    - Card appears slightly desaturated/dimmed beneath overlay

---

FEATURED COURSE MODAL (auto-shows for students with 0 enrollments):
- MD3 Dialog (large)
- "Get Started!" heading
- Featured course card inside dialog (thumbnail, title, description, price)
- "Enroll Now" MD3 FilledButton
- "Browse All Courses" MD3 TextButton
- "Dismiss" icon button (top-right corner)
- Only shows once per session (dismissable)

---

STATES:
- Loading: skeleton grid (3 card placeholders)
- No enrollments:
  - Large illustration (empty state — books/graduation cap)
  - "No courses yet" heading (headline-small)
  - "Enroll in your first course to start learning" body text
  - "Browse Courses" MD3 FilledButton (links to /courses)
- Error: error container + "Retry" button

RESPONSIVE:
- Mobile: 1 column, full-width cards
- Tablet: 2 columns
- Desktop: 3 columns
```

---

## PROMPT 6: Chat System

```
Design a full-featured course chat interface for an education platform called "Swavleba" using Material Design 3 (Material You) design language. The platform serves Georgian students and lecturers. The chat is the core collaboration space — similar to Discord but for education.

OVERALL LAYOUT (3-panel + optional 4th):
The page is full-height (100dvh) with a top navigation bar and a 3-column layout below it:

1. LEFT: Server Sidebar (narrow, 64px wide) — vertical list of course icons
2. MIDDLE-LEFT: Channel Sidebar (240px wide) — channel list for selected course
3. CENTER: Chat Area (flexible width) — messages, input, typing indicators
4. RIGHT (toggleable): Member Sidebar (240px wide) — online/offline member list

---

TOP NAVIGATION BAR:
- Platform logo "Swavleba" on the left (links to home)
- Navigation links: Home, Courses, Chat (active state), and role-specific links
- Language switcher (English / Georgian dropdown with flags)
- User avatar + dropdown menu (Profile, Settings, Logout)
- Use MD3 TopAppBar with surface color and on-surface text

---

PANEL 1 — SERVER SIDEBAR (leftmost, narrow icon strip):
- "DM" button at top (direct messages) — circular, emerald/primary color, with active ring state
- Horizontal divider line below DM button
- Vertical list of course icons — each is a 48x48 rounded square showing first letter of course name
  - Active state: highlighted with primary container color + left indicator bar (4px rounded pill)
  - Hover state: tooltip showing full course name appears to the right
  - Locked courses (not enrolled): show lock icon instead of letter, muted colors
  - Unread badge: red circular badge on top-right corner showing count (max "9+")
- "+" button at bottom (only visible to lecturers) — for creating new courses
- Scrollable if many courses
- Use MD3 NavigationRail pattern with custom icons
- Clicking a locked course opens an enrollment/payment modal

---

PANEL 2 — CHANNEL SIDEBAR:
- Header: Course name + collapse button + unread count badge
- Collapsible channel categories (e.g., "COURSE CHANNELS", "ASSIGNMENTS")
  - Category headers are uppercase, small text, with collapse/expand chevron
- Channel list within each category:
  - Text channels: show "#" icon + channel name
  - Lectures channels: show video camera icon + channel name
  - Projects channels: show folder icon + channel name
  - Voice channels: show speaker icon + channel name
  - Active channel: MD3 filled container with primary color
  - Unread channels: bold text + unread dot indicator
  - Hover: subtle surface variant background
- Lecturer-only: "Manage Channels" button (gear icon) — opens channel CRUD modal
- User profile footer at bottom of sidebar:
  - Avatar (image or initial letter in colored circle)
  - Username (truncated if long)
  - Online status indicator (green dot + "Online" text)
  - Microphone button + Settings button (icon buttons)
- Use MD3 NavigationDrawer pattern with sections

---

PANEL 3 — CHAT AREA (main content):

CHANNEL HEADER (top bar):
- Mobile: hamburger menu button (opens sidebars as overlay)
- "#" icon + Channel name (bold)
- Connection status indicator (amber dot + "Connecting..." when disconnected)
- Channel description text (hidden on mobile)
- Use MD3 SmallTopAppBar

MESSAGE LIST (scrollable area):
- Messages grouped by sender — consecutive messages from same user collapse (no avatar repeat)
- Each message shows:
  - User avatar (40px circle, image or initial letter)
  - Username (colored by role — lecturer gets distinct color)
  - Timestamp ("Today at 3:05 PM", "Yesterday at 1:00 AM", or "Mar 15 at 2:30 PM")
  - Message text content (supports multi-line)
  - Reply preview (if replying to another message): shows "Replying to @username: truncated content..." in a subtle card above the message
  - Edited indicator ("(edited)" text next to timestamp)
  - Media attachments:
    - Images: rounded card with loading skeleton, click to open lightbox modal (full-screen overlay with close button)
    - Videos: inline player with controls in a rounded card
    - GIFs: auto-play with loading state
    - Error state: broken image icon with fallback text
  - Reactions bar: row of emoji pills below message (emoji + count), clickable to toggle own reaction
  - Hover actions (appear on message hover): Reply button, Reaction picker button (opens emoji grid with common reactions), Delete button (own messages or lecturer)
  - Project cards (special message type in Projects channel):
    - Embedded card showing project name, description, video thumbnail, budget, view targets, platform icons (Instagram/TikTok), date range, countdown timer
    - "Submit" button for students to submit their work
    - Review/approve actions for lecturers
  - Pending state: message appears immediately with slight opacity, shows sending indicator
  - Failed state: red tint + error message + "Retry" button
- Loading skeleton: 5 animated placeholder rows (circle + lines)
- Empty state: chat bubble icon + "No messages yet" + "Be the first to start the conversation"
- "Load older messages" button at top when more history exists
- "Scroll to bottom" FAB (floating action button) appears when scrolled up — MD3 FAB style

TYPING INDICATOR (between messages and input):
- Three bouncing dots (animated) + "Username is typing..." / "Username and Username are typing..." / "Username and 2 others are typing..."
- Subtle surface container background

MESSAGE INPUT (bottom bar):
- Auto-expanding textarea (grows with content)
- Placeholder: "Message #channel-name"
- Reply preview bar (when replying): shows "@username: content..." with X cancel button, appears above textarea
- Attachment button (paperclip icon): opens file picker for images and videos (max 10MB)
- Drag & drop zone: full input area accepts file drops, shows highlighted drop state with dashed border
- Upload progress: shows file preview thumbnails with progress bar while uploading
- Attached file previews: small thumbnails with X remove button
- Send button (arrow icon, MD3 FilledButton or FAB)
- Disabled states:
  - Muted users: "You are muted in this channel"
  - Restricted channels (Lectures): "Only lecturers can send messages here"
  - Not enrolled / expired: input disabled
- For Projects channel (lecturer only): show a large "+" FAB button instead of text input — opens Project Creation dialog
- For Projects channel (student): show "Only lecturers can create projects" text

SPECIAL VIEWS:

Lectures Channel View (replaces message list when channel type is "lectures"):
- Video player area at top (large, with custom controls)
- Video list below — ordered, with:
  - Thumbnail, title, duration, progress bar
  - Lock icon for unwatched previous videos (sequential unlock)
  - Completion checkmark for finished videos
  - Upload/Edit/Delete buttons for lecturers

Project Creation Dialog (modal for lecturers):
- Form fields: Project name, description, video link or file upload, budget (GEL currency), min/max views, platforms (Instagram/TikTok checkboxes), start date, end date, criteria list with RPM rates
- MD3 Dialog with form fields

Video Submission Dialog (modal for students):
- Per-platform URL inputs (Instagram link, TikTok link)
- URL validation per platform
- Optional message field
- Submit button with loading state

---

PANEL 4 — MEMBER SIDEBAR (right, toggleable):
- Header: "Members" label + member count + collapse button
- Online members section:
  - Each member: avatar (32px) + username + role label (colored by role) + status dot (green=online, amber=away, red=busy)
- Offline members section:
  - Same layout but dimmed/muted opacity

---

STATES TO DESIGN:
1. Default state — course selected, channel selected, messages loaded
2. Loading state — skeleton placeholders while data loads
3. Empty state (no courses) — illustration + "No enrolled courses yet" + "Browse Courses" CTA button
4. Empty state (no messages) — chat icon + "No messages yet" + subtitle
5. Error state — error card with red container + "Try Again" button
6. Not logged in state — "Please log in to access chat" message
7. Mobile responsive state — sidebars as slide-over drawers with backdrop overlay, hamburger menu trigger
8. Muted channel state — disabled input with muted message

---

MATERIAL DESIGN 3 SPECIFICS:
- Color scheme: Use MD3 dynamic color with a neutral seed color so the design feels clean and adaptable — do not lock into any specific brand color
- Dark theme (primary use case) with proper MD3 dark surface hierarchy (surface, surface-container, surface-container-high)
- Light theme support
- Rounded corners: use MD3 shape scale (extra-small 4dp, small 8dp, medium 12dp, large 16dp, extra-large 28dp)
- Typography: MD3 type scale (display, headline, title, body, label)
- Elevation: use MD3 tonal elevation instead of drop shadows
- Motion: MD3 standard easing curves for transitions
- State layers: proper MD3 state layers for hover (8% opacity), focus (12%), pressed (12%)
- Components: use MD3 FAB, Cards, Chips (for reactions), NavigationRail, NavigationDrawer, TopAppBar, TextField, IconButton, Badge patterns

---

RESPONSIVE BEHAVIOR:
- Desktop (>768px): All panels visible, member sidebar toggleable
- Mobile (<768px): Only chat area visible by default. Hamburger button opens server + channel sidebars as a slide-over drawer from left with backdrop overlay. Input always visible at bottom using 100dvh height.

---

ACCESSIBILITY:
- All interactive elements need focus-visible outlines
- Tooltips on icon-only buttons
- ARIA labels on all buttons
- Keyboard navigation support
- Sufficient color contrast ratios per MD3 guidelines
```

---

## PROMPT 7: DMs + Friends System

```
Update the existing Swavleba chat interface design with the following additions. This builds on the previously generated chat design — do not redesign existing panels, only add and modify what is specified below.

---

NEW FEATURE: DIRECT MESSAGES (DM) SYSTEM

When the user clicks the "DM" button in the Server Sidebar (Panel 1), the Channel Sidebar (Panel 2) transforms into a DM sidebar with the following layout:

DM SIDEBAR (replaces Channel Sidebar when DM mode is active):

HEADER:
- "Direct Messages" title
- New DM button (compose/pencil icon) — opens a user search modal to start a new conversation
- Friend requests button (person+ icon) with notification badge showing pending request count

SEARCH BAR:
- MD3 SearchBar at top to filter conversations
- Placeholder: "Search conversations..."

CONVERSATION LIST:
- List of recent DM conversations, sorted by most recent message
- Each conversation row shows:
  - User avatar (40px circle with online status dot overlay — green/amber/red/gray)
  - Username (bold if unread messages)
  - Last message preview (truncated, gray text — "You: message..." or "message...")
  - Timestamp of last message ("2m", "1h", "Yesterday", "Mar 15")
  - Unread message count badge (red circle with number)
- Active conversation: MD3 filled container highlight
- Hover: surface variant background
- Swipe-to-delete or long-press context menu: Mute, Block, Delete conversation

---

NEW FEATURE: FRIENDS SYSTEM

FRIEND REQUESTS PAGE (full panel, replaces Chat Area when opened from DM sidebar):

TAB BAR at top with 4 tabs (MD3 Tabs):
1. "Online" — shows online friends only
2. "All Friends" — shows complete friends list
3. "Pending" — shows incoming and outgoing friend requests
4. "Blocked" — shows blocked users

ONLINE TAB:
- Search/filter bar at top
- Grid or list of online friends:
  - Avatar with green status dot
  - Username
  - Current status text (if set, e.g., "Studying editing...")
  - Action buttons: Message (opens DM), Voice Call (future), More menu (Remove Friend, Block)
- Empty state: illustration + "No friends online right now"

ALL FRIENDS TAB:
- Same layout as Online but includes offline friends (dimmed)
- Total friend count in tab badge
- Alphabetical sorting with letter dividers

PENDING TAB:
- Two sections:
  - "Incoming" — requests from others
    - Avatar + Username + "wants to be your friend" text
    - Accept button (MD3 FilledButton, green/primary) + Decline button (MD3 OutlinedButton)
  - "Outgoing" — requests you sent
    - Avatar + Username + "Friend request sent" text
    - Cancel button (MD3 OutlinedButton)
- Empty state: "No pending friend requests"

BLOCKED TAB:
- List of blocked users
  - Avatar + Username + "Blocked" label
  - Unblock button
- Empty state: "You haven't blocked anyone"

---

ADD FRIEND MODAL (opened from a button on the Friends page or DM sidebar):
- MD3 Dialog
- Text field: "Enter username or email"
- Search results appear below as user types (debounced)
  - Each result: Avatar + Username + mutual friends count
  - "Send Request" button per result
  - Already friends: show "Already Friends" chip instead
  - Request already sent: show "Request Sent" chip instead
- Success toast: "Friend request sent to @username"

---

DM CHAT VIEW (replaces Chat Area when a DM conversation is selected):
- Same message list, input, typing indicator, and media features as channel chat
- Header changes:
  - Shows recipient's avatar + username + online status instead of "#channel-name"
  - Action buttons in header: Voice Call (future, disabled/grayed), Video Call (future, disabled/grayed), User Profile button (opens profile sidebar), More menu (Mute, Block, Close DM)
- Profile sidebar (toggleable from header): shows user's full profile
  - Large avatar
  - Username + role
  - "Member since" date
  - Mutual courses list
  - Mutual friends list
  - Action buttons: Remove Friend, Block, Message

---

USER PROFILE POPOVER (appears when clicking any username or avatar anywhere in the app):
- MD3 Card popover/popup
- User avatar (large)
- Username + role badge (Student/Lecturer)
- Online status
- Mutual courses (list of shared enrolled courses)
- Mutual friends count
- Action buttons:
  - "Send Message" (opens DM)
  - "Add Friend" / "Friends" / "Request Sent" (contextual)
  - "Block" (in more menu)

---

NOTIFICATION INTEGRATION:
- Friend request received: show badge on DM button in Server Sidebar + badge on Friend Requests button in DM sidebar
- New DM message: show badge on DM button in Server Sidebar + unread indicator on conversation in DM list
- Friend request accepted: toast notification "Username accepted your friend request"

---

STATES TO ADD:
1. DM sidebar — with conversations listed
2. DM sidebar — empty state ("No conversations yet — add friends to start chatting")
3. DM chat — active conversation with messages
4. DM chat — empty conversation ("Say hello! This is the beginning of your conversation with @username")
5. Friends page — all 4 tabs (Online, All, Pending, Blocked)
6. Friends page — empty states for each tab
7. Add Friend modal — search, results, sent state
8. User profile popover — friend/non-friend/request-sent variants

---

MOBILE RESPONSIVE ADDITIONS:
- DM sidebar appears as the same slide-over drawer pattern used for channels
- Friends page is full-screen on mobile with back button
- User profile popover becomes a bottom sheet on mobile
- Add Friend modal becomes full-screen on mobile
```

---

## PROMPT 8: Settings Page

```
Design a user settings page for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. This page has multiple sections for profile, security, referrals, earnings/withdrawals, saved cards, and account deletion.

PAGE LAYOUT:
- Navigation bar at top (fixed)
- Subtle animated background
- Content: max-width 720px, centered, padding-top 96px, padding-bottom 64px
- Sections are stacked MD3 Cards with 24px gap between them

---

SECTION 1 — PROFILE:
- Card heading: "Profile" (title-large) with edit icon
- Avatar area:
  - Large avatar circle (96px): shows user image or initial letter with colored background
  - Hover overlay on avatar: camera icon + "Change" text
  - Click opens file picker (images only, max 2MB)
  - Upload progress: circular progress indicator overlaying avatar
  - "Remove Avatar" text button below (only if avatar set)
- Username field: MD3 OutlinedTextField (pre-filled with current username)
- Email display: read-only text (body-medium, muted) — not editable
- Role badge: MD3 chip showing "Student" / "Lecturer" / "Admin"
- "Update Profile" MD3 FilledButton
- Success: green snackbar "Profile updated"
- Error: inline error text below field

SECTION 2 — PASSWORD:
- Card heading: "Password" (title-large) with lock icon
- Fields (MD3 OutlinedTextField):
  - Current Password (with show/hide toggle)
  - New Password (with show/hide toggle + strength indicator bar)
  - Confirm New Password (with show/hide toggle)
- "Update Password" MD3 FilledButton
- Success/error feedback inline

SECTION 3 — REFERRAL PROGRAM:
- Card heading: "Referral Program" (title-large) with gift icon
- Referral code display:
  - Large monospace text showing code (e.g., "ABC123")
  - "Copy Code" MD3 TonalButton with copy icon
  - Copied state: button text changes to "Copied!" with checkmark, reverts after 2s
- Referral link:
  - Full URL displayed in a surface container (truncated on mobile)
  - "Copy Link" MD3 TonalButton
  - Copied feedback same as above
- Per-course referral links section (expandable):
  - List of enrolled courses, each with its own referral link
  - Course name + "Copy" button per row
- Helper text: "Share your referral code to earn commission on enrollments" (body-small, muted)

SECTION 4 — BALANCE & EARNINGS:
- Card heading: "Earnings" (title-large) with wallet icon
- Balance display: large prominent number "₾XX.XX" (display-small, bold)
- Stats row (3 mini stat cards side by side):
  - "Total Earned": ₾XX.XX (green text)
  - "Total Withdrawn": ₾XX.XX (muted text)
  - "Pending": ₾XX.XX (amber text, only if pending withdrawal exists)
- Bank Account (IBAN) section:
  - MD3 OutlinedTextField with current IBAN pre-filled
  - "Update IBAN" MD3 OutlinedButton
  - Success/error feedback
- Withdrawal form (expandable/toggle):
  - "Request Withdrawal" MD3 FilledButton to expand
  - Expanded:
    - Amount input (MD3 OutlinedTextField, numeric, with ₾ prefix)
    - Helper text: "Minimum withdrawal: ₾XX"
    - "Submit Withdrawal Request" MD3 FilledButton
    - Cancel text button
  - Pending withdrawal indicator: amber chip "Withdrawal of ₾XX pending approval"
- Transaction History (expandable toggle):
  - "View Transaction History" MD3 TextButton with chevron
  - Expanded: MD3 data table:
    - Columns: Date, Type, Amount, Status, Description
    - Type column: chips (earning, withdrawal, refund)
    - Status column: colored chips (completed=green, pending=amber, failed=red)
    - Scrollable on mobile
- Withdrawal Requests list:
  - Each request: amount, status badge (pending/approved/rejected), date
  - Rejected: shows rejection reason in body-small text
  - Real-time updates (status changes animate in)

SECTION 5 — SAVED CARDS:
- Card heading: "Saved Payment Cards" (title-large) with credit card icon
- Card list:
  - Each row: card icon (Visa/Mastercard) + masked number "•••• 1234" + "Delete" MD3 IconButton (trash icon)
  - Delete confirmation: inline "Are you sure?" + Confirm/Cancel buttons
- Empty state: "No saved cards" (body-medium, muted) + "Cards are saved when you make a payment" helper text

SECTION 6 — DELETE ACCOUNT:
- Card with error/danger surface tint (subtle red)
- Heading: "Delete Account" (title-large, error color) with warning icon
- Warning text: "This action is permanent and cannot be undone. All your data, enrollments, and earnings will be lost." (body-medium)
- "Delete My Account" MD3 FilledButton (error/red color)
- Confirmation dialog (MD3 Dialog):
  - Warning icon (large, red)
  - "Are you sure?" heading
  - "Type DELETE to confirm" instruction
  - Text input field
  - "Delete Account" button (red, only enabled when "DELETE" is typed)
  - "Cancel" text button

---

RESPONSIVE:
- Mobile: full-width cards with 16px padding, stacked vertically
- Desktop: max-width 720px centered, same stacked layout

ACCESSIBILITY:
- All sections accessible via keyboard Tab
- ARIA labels on icon buttons
- Error states announced to screen readers
- Form fields have visible persistent labels
```

---

## PROMPT 9: Lecturer Dashboard

```
Design a lecturer dashboard page for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. Lecturers manage their courses, create bundles, and view analytics from this page.

PAGE LAYOUT:
- Navigation bar at top (fixed)
- Subtle animated background
- Content: max-width 1280px, centered, padding-top 96px

---

HEADER:
- "Dashboard" heading (display-small)
- Lecturer name subtitle (body-large, muted)
- "Create Course" MD3 FAB (extended variant with + icon) — positioned top-right on desktop, bottom-right floating on mobile

---

COURSE MANAGEMENT SECTION:

COURSE GRID:
- Responsive: 1 column mobile, 2 tablet, 3 desktop
- Gap: 24px

LECTURER COURSE CARD (MD3 Card — elevated):
- Thumbnail (16:9, course image or placeholder)
- Body:
  - Course title (title-medium, bold)
  - Course type chip
  - Price: "₾XX" (body-large, bold)
  - Stats row: "XX students enrolled" (body-small, muted)
- Action buttons row (bottom of card):
  - "Edit" MD3 OutlinedButton (pencil icon)
  - "Manage Chat" MD3 TextButton (chat icon) — links to /lecturer/chat
  - "Delete" MD3 IconButton (trash, error color) — opens confirmation dialog
- Delete confirmation: MD3 Dialog with "Are you sure?" + course name + Delete/Cancel buttons

COURSE CREATION/EDIT MODAL (MD3 Dialog, full-screen on mobile):
- Multi-step wizard with progress indicator at top (step dots or linear progress bar):

  Step 1 — "Basic Info":
  - Course title (MD3 OutlinedTextField)
  - Description (MD3 OutlinedTextField, multiline/textarea, 4 rows)
  - Course type: MD3 dropdown/exposed menu — "Editing" / "Content Creation" / "Website Creation"
  - "Next" MD3 FilledButton

  Step 2 — "Pricing":
  - Price (MD3 OutlinedTextField, numeric, ₾ prefix)
  - Original price (optional, for showing discount) (MD3 OutlinedTextField)
  - Referral commission % (MD3 OutlinedTextField, numeric, % suffix)
  - "Back" MD3 TextButton + "Next" MD3 FilledButton

  Step 3 — "Media":
  - Thumbnail upload:
    - Drop zone (dashed border, upload icon, "Drop image or click to browse")
    - Preview thumbnail after upload
    - Progress bar during upload
    - "Remove" icon button on preview
  - Intro video upload:
    - Same drop zone pattern
    - Video preview player after upload
    - Progress bar
    - OR text field for external video URL
  - "Back" + "Next" buttons

  Step 4 — "Review & Publish":
    - Summary card showing all entered details:
      - Title, description, type, price, media previews
    - Bestseller toggle: MD3 Switch + "Mark as Bestseller" label
    - Author field (MD3 OutlinedTextField, pre-filled with lecturer name)
    - Creator field (MD3 OutlinedTextField)
    - "Back" + "Publish Course" MD3 FilledButton
    - Loading state on publish

---

BUNDLE MANAGEMENT SECTION:
- Section heading: "Course Bundles" (headline-medium) + "Create Bundle" MD3 OutlinedButton
- Bundle list (below courses):
  - Each bundle card (MD3 Card — filled variant):
    - Bundle title (title-medium)
    - Included courses: horizontal chips/avatars
    - Bundle price + original combined price (strikethrough)
    - "Edit" + "Delete" action buttons
- Bundle creation/edit modal (MD3 Dialog):
  - Bundle title (MD3 OutlinedTextField)
  - Description (multiline)
  - Price (numeric, ₾)
  - Original price (numeric, ₾)
  - Course selector: list of lecturer's courses with MD3 Checkbox per course
    - Selected courses shown as chips below
  - "Save Bundle" MD3 FilledButton

---

ANALYTICS PREVIEW (bottom section):
- Section heading: "Quick Stats" (headline-medium)
- Stats row (MD3 Cards, horizontal scroll on mobile):
  - Total Students (icon + number)
  - Total Revenue (icon + ₾amount)
  - Active Enrollments (icon + number)
  - Average Rating (icon + star rating)

---

STATES:
- Loading: skeleton grid
- No courses: empty state illustration + "Create your first course" + FAB highlighted
- Error: error container + retry

RESPONSIVE:
- Mobile: 1 column, FAB floating bottom-right, modal full-screen
- Tablet: 2 columns
- Desktop: 3 columns, modal centered (max-width 640px)
```

---

## PROMPT 10: Admin Dashboard

```
Design an admin dashboard for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. This is a comprehensive admin panel with multiple tab sections for managing the entire platform.

PAGE LAYOUT:
- Navigation bar at top (fixed)
- Subtle animated background
- Content: max-width 1440px, centered, padding-top 96px
- Tab-based navigation for different admin sections

---

TAB BAR:
- MD3 Tabs (scrollable on mobile, full-width on desktop)
- 9 tabs: Overview, View Bot, Withdrawals, Lecturers, Courses, Notifications, Email, Analytics, Settings
- Active tab: indicator line below + bold text
- Badge dots on tabs with pending items (Withdrawals, Lecturers)

---

TAB 1 — OVERVIEW:

Stat Cards Row (4 cards, 2x2 on mobile, 4x1 on desktop):
- Each MD3 Card (filled variant):
  - Icon in colored circle (top-left)
  - Stat label (body-medium, muted)
  - Stat value (display-small, bold)
  - Cards: "Total Users", "Total Courses", "Total Revenue (₾)", "Active Enrollments"

Recent Activity Feed:
- MD3 Card containing list:
  - Each item: avatar + action text ("User X enrolled in Course Y") + timestamp
  - Color-coded left border by type
  - "View All" text button at bottom

User Table (below activity):
- MD3 data table:
  - Columns: Username, Email, Role, Joined, Status
  - Role column: colored chips (Student=default, Lecturer=primary, Admin=tertiary)
  - Searchable, sortable columns
  - Pagination controls at bottom

---

TAB 2 — VIEW BOT:

View Bot Dashboard:
- Overview stats: total projects tracked, total views counted, active trackers
- Per-project cards:
  - Project name, platform, target views, current views
  - Progress bar (current/target)
  - View trend mini-chart (sparkline)
- Submissions management:
  - Table: student, platform, URL, submitted views, verified views, status
  - Action buttons: Verify, Reject, Pay

---

TAB 3 — WITHDRAWALS:

Pending Withdrawals Table:
- MD3 data table:
  - Columns: Username, Amount (₾), Bank Account (IBAN), Requested Date, Status
  - Each row actions:
    - "Approve" MD3 FilledTonalButton (green/success) → processes immediately
    - "Reject" MD3 OutlinedButton (red) → expands to show rejection reason text field + "Confirm Reject" button
- Approved/Rejected history (expandable section below):
  - Same table with status column showing colored chips (Approved=green, Rejected=red)
  - Rejection reason shown as expandable row detail
- Real-time: new requests appear with highlight animation
- Empty state: "No pending withdrawal requests"

---

TAB 4 — LECTURERS:

Pending Approvals:
- Heading: "Pending Lecturer Approvals" with count badge
- Card list:
  - Each card: avatar + username + email + registration date
  - "Approve" MD3 FilledButton (green) + "Reject" MD3 OutlinedButton (red)
  - Approve → lecturer account activated, notification sent
- Approved lecturers list (below, collapsible):
  - Table: username, email, courses count, total students, approval date
- Empty state: "No pending lecturer approvals"

---

TAB 5 — COURSES:

All Courses Table:
- MD3 data table:
  - Columns: Title, Type, Price (₾), Lecturer, Enrollments, Status
  - Type: colored chips
  - Status: Active/Draft chips
  - Row actions: Edit (opens course modal), Delete (confirmation dialog)
- Search bar above table
- Filters: by type, by lecturer
- "Create Course" button (same modal as lecturer dashboard)

---

TAB 6 — NOTIFICATIONS:

Send Notification Form (MD3 Card):
- Target selector: MD3 dropdown — "All Users" / "All Students" / "All Lecturers" / "Specific User"
  - If "Specific User": user search field with autocomplete dropdown
- Notification type: MD3 SegmentedButton — info / success / warning / error / system
- Title fields:
  - English title (MD3 OutlinedTextField)
  - Georgian title (MD3 OutlinedTextField)
- Message fields:
  - English message (MD3 OutlinedTextField, multiline)
  - Georgian message (MD3 OutlinedTextField, multiline)
- Preview card: shows how notification will look with selected type color
- "Send Notification" MD3 FilledButton
- Success toast: "Notification sent to X users"

Notification History (below form):
- Table: title, type badge, target, sent date, recipient count
- Expandable row: full message text

---

TAB 7 — EMAIL MANAGER:

Compose Email (MD3 Card):
- Recipients: MD3 dropdown — "All Users" / "All Students" / "All Lecturers" / "Specific User"
  - Specific user: search field
- Subject line (MD3 OutlinedTextField)
- Rich text editor:
  - Toolbar: Bold, Italic, Underline, Link, Bullet list, Numbered list, Heading
  - Editor area (MD3 surface, min-height 300px)
  - Supports basic HTML formatting
- "Send Email" MD3 FilledButton
  - Confirmation dialog: "Send to X recipients?" + Send/Cancel
- Email logs table below: subject, recipients, sent date, status

---

TAB 8 — ANALYTICS:

Date Range Selector:
- MD3 DateRangePicker or two date fields (From / To) + "Apply" button
- Quick presets: "Last 7 Days", "Last 30 Days", "Last 90 Days", "All Time" (MD3 FilterChips)

Charts Section:
- Revenue Chart: line chart showing daily/weekly revenue (₾)
  - Toggle: Daily / Weekly / Monthly
- Enrollment Chart: bar chart showing new enrollments over time
- User Growth Chart: area chart showing cumulative users
- Course Performance: horizontal bar chart comparing courses by enrollment count

Stats Summary Row:
- Period totals: Revenue, New Users, New Enrollments, Avg Order Value
- Comparison to previous period: "+XX%" green or "-XX%" red

Export:
- "Export CSV" MD3 OutlinedButton
- "Export PDF" MD3 OutlinedButton

---

TAB 9 — SETTINGS:

Platform Settings (MD3 Card):
- Minimum withdrawal amount: numeric field (₾) + Save button
- Featured course: dropdown selector (from all courses) + Save button
- Default referral commission %: numeric field + Save button
- Maintenance mode: MD3 Switch + warning text "Enabling this will show maintenance page to all users"
- Each setting has individual Save button and success/error feedback

---

RESPONSIVE:
- Mobile: tabs become scrollable horizontal strip, tables become card lists, charts stack vertically
- Tablet: 2-column where applicable
- Desktop: full-width tables, side-by-side charts
```

---

## PROMPT 11: Legal & Static Pages

```
Design a set of legal and static content pages for the education platform "Swavleba" using Material Design 3 with neutral seed color. Dark theme primary. These pages share the same layout template.

SHARED LAYOUT:
- Navigation bar at top (fixed)
- Footer at bottom
- Content area: max-width 896px, centered, padding-top 96px, padding-bottom 64px
- Single MD3 Card (elevated) containing all page content
- Card padding: 32px mobile, 48px desktop

---

PAGE 1 — ABOUT US (/about-us):

- Heading: "About Swavleba" (display-small)
- Subtitle paragraph (body-large, muted)
- Content sections (each with headline-small heading + body-medium text):
  - "Our Mission" — paragraph
  - "For Students" — bulleted list (5 items) with checkmark icons
  - "For Lecturers" — bulleted list (5 items) with checkmark icons
  - "How It Works" — numbered ordered list (steps)
  - "Our Vision" — paragraph
  - "Contact Us" — email/info
- All text properly spaced with MD3 typography scale
- Lists use MD3 ListItem pattern with leading icons

---

PAGE 2 — TERMS AND CONDITIONS (/terms-and-conditions):

- Heading: "Terms and Conditions" (display-small)
- Metadata: "Effective Date: [date]" + "Last Updated: [date]" (body-small, muted)
- Content: multiple article sections:
  - Each section: numbered heading (headline-small, e.g., "Article 1 — Introduction") + body paragraphs
  - Sub-sections with smaller headings (title-medium)
  - Proper paragraph spacing (16px between paragraphs)
- Table of contents (optional, top of page): linked section titles for quick navigation

---

PAGE 3 — PRIVACY POLICY (/privacy-policy):
- Same layout as Terms and Conditions
- Different heading and article content

PAGE 4 — PERSONAL INFO SECURITY (/personal-info-security):
- Same layout as Terms and Conditions

PAGE 5 — REFUND POLICY (/refund-policy):
- Same layout as Terms and Conditions

---

DESIGN NOTES:
- All pages use the same card-in-page template
- Long-form text should be highly readable: max line-width 65-75 characters, comfortable line-height (1.6-1.75)
- Links within text: primary color, underlined on hover
- MD3 Dividers between major sections
- Smooth scroll behavior for table of contents links

RESPONSIVE:
- Mobile: card full-width, 24px padding, text sizes scale down slightly
- Desktop: card max-width 896px, centered with generous margins
```
