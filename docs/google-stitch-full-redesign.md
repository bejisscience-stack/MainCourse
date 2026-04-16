# Swavleba Full Website Redesign — Google Stitch Master Prompt

## Platform Overview

**Swavleba** (swavleba.ge) is a Georgian-language education platform where students enroll in courses, watch video lectures, participate in paid social media projects, earn money, and communicate via real-time Discord-like chat. Bilingual (English + Georgian). Three user roles: Student, Lecturer, Admin. Payment via Keepz.me gateway (GEL currency). Dark theme primary.

**Design system:** Material Design 3 (Material You) with neutral seed color — no locked brand color. All surfaces in gray/slate tones so any accent color can be applied later. Both dark (primary) and light theme support.

---

## Roles & Permissions Summary

| Role                       | Access                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Public** (not logged in) | Home, Courses catalog, Projects list, About Us, Legal pages, Login, Signup                                                                     |
| **Student**                | Everything public + My Courses, Chat, Settings (profile, balance, withdrawals, saved cards, referral), Enrollment/Payment, Project submissions |
| **Lecturer**               | Lecturer Dashboard (course CRUD, bundles, analytics), Lecturer Chat (channel management, video uploads, project creation), Settings            |
| **Admin**                  | Admin Dashboard (overview, analytics, view bot, withdrawals, lecturer approvals, course management, notifications, email manager, settings)    |

---

## PART 1: Global Components (shared across all pages)

### 1.1 Navigation Bar

**Route:** All pages | **File:** `components/Navigation.tsx`

DESKTOP LAYOUT:

- Fixed top, full-width, backdrop-blur background, subtle bottom border
- Height: 64px mobile, 80px desktop
- Left: Platform logo image (links to /)
- Center: Role-based navigation links:
  - Public: "Courses", "Projects"
  - Student: "Courses", "Projects", "My Courses"
  - Lecturer: "Dashboard"
  - Admin: "Admin Dashboard", "All Courses", "Projects"
- Right side controls:
  - Language selector dropdown (English flag / Georgian flag)
  - Notification bell icon with unread count badge (logged-in only)
  - Logged in: Avatar button (image or initial-letter circle) + chevron → opens profile dropdown
  - Not logged in: "Log In" text button + "Sign Up" filled pill button

PROFILE DROPDOWN MENU (logged-in):

- Header: Avatar + Username + Email + Role badge (Lecturer/Admin chip)
- Role-specific links:
  - Student: My Courses, Settings
  - Lecturer: Dashboard, Chat, Settings
  - Admin: Admin Dashboard, All Courses, Settings
- Divider
- Sign Out button (red text, loading state, error display)

MOBILE LAYOUT:

- Logo left, hamburger icon right
- Expanded menu: role links, language selector + notification bell, profile section (avatar + name + email + role badge), role-specific navigation, Sign Out
- Not logged in: Log In + Sign Up buttons stacked

### 1.2 Footer

**Route:** Home, Courses, Projects, About Us, Legal pages | **File:** `components/Footer.tsx`

- Dark background, border-top
- 3-column grid (1 col on mobile):
  - Brand: Logo image + description paragraph
  - Legal: "Terms and Conditions", "Privacy Policy", "Personal Info Security", "Refund Policy"
  - Company: "About Us", "Courses"
- Bottom bar: "© 2026 Swavleba. All rights reserved."

### 1.3 Notification System

**Files:** `components/NotificationBell.tsx`, `components/NotificationDropdown.tsx`

- Bell icon in navbar with red unread count badge
- Click opens dropdown (positioned below bell):
  - List of notifications, each showing:
    - Color-coded left border by type (enrollment, payment, withdrawal, system)
    - Title (localized EN/GE)
    - Message body (localized)
    - Time ago ("2 minutes ago", "3 hours ago")
    - Read/unread state (unread has colored background)
    - Click marks as read
  - "Mark all as read" button at top
  - Empty state: "No notifications"
  - Loading state: skeleton placeholders
- Real-time: new notifications arrive via Supabase Realtime
- Browser notifications (if permission granted)

### 1.4 Language Selector

**File:** `components/LanguageSelector.tsx`

- Dropdown with flag icons (English/Georgian)
- Current language shown as flag + text
- Click toggles between languages

### 1.5 Background Animations

**Files:** `components/BackgroundShapes.tsx`, `components/GlobalBackgroundManager.tsx`, `components/backgrounds/*.tsx`

- Subtle animated backgrounds behind content
- Multiple themes: AI Network, Analytics, Crypto Rain, Global Commerce, Money Flow, Social Media, Stock Market
- User-selectable via BackgroundSelector
- Canvas-based, non-interactive, decorative only

### 1.6 Scroll Reveal Animation

**File:** `components/ScrollReveal.tsx`

- Content sections fade in + slide up when scrolling into view
- Configurable delay and duration
- Used on Home page hero, courses, projects sections

### 1.7 Toast Notifications

- Sonner toast library
- Position: top-right
- Types: success (green), error (red), info
- Close button on each toast
- Used for: withdrawal updates, enrollment success, errors

---

## PART 2: Authentication Pages

### 2.1 Login Page

**Route:** `/login` | **Access:** Public

- Centered card on gradient background
- Logo at top (links to home)
- Heading: "Sign In"
- Form fields:
  - Email input (text field with label)
  - Password input (password field with label)
- "Forgot Password?" link below password field
- "Sign In" submit button (filled, full-width, loading state)
- Divider: "or"
- "Continue with Google" button (Google icon + text, outlined style, loading state)
- Bottom: "Don't have an account? Sign Up" link
- Error display: red alert box with error message
- Auto-redirect: already logged-in users redirected based on role
- Timeout handling: 30-second timeout with error message

### 2.2 Signup Page

**Route:** `/signup` | **Access:** Public

- Same centered card layout as Login
- Logo at top
- Heading: "Create Account"
- Form fields:
  - Username input
  - Email input
  - Password input
  - Role selector: "Student" / "Lecturer" toggle/radio (two options)
  - Referral code field (pre-filled from URL ?ref=CODE, validated against API)
- Referral validation:
  - Valid: green checkmark, code applied
  - Invalid: warning message, signup still allowed
- "Create Account" submit button (filled, full-width, loading state)
- Divider: "or"
- "Continue with Google" button
- Bottom: "Already have an account? Sign In" link
- Success state: "Check your email to verify your account" message
- Error display
- Auto-redirect for logged-in users

### 2.3 Forgot Password Page

**Route:** `/forgot-password` | **Access:** Public

- Centered card
- Logo + "Forgot Password" heading
- Description text
- Email input field
- "Send Reset Link" button (loading state)
- Success state: "Check your email" confirmation message (always shown regardless of email existence — prevents enumeration)
- "Back to Login" link

### 2.4 Reset Password Page

**Route:** `/reset-password` | **Access:** Via email link

- Centered card
- Logo + "Reset Password" heading
- Form fields:
  - New password input
  - Confirm password input
- "Reset Password" button (loading state)
- Error states: invalid/expired token, password mismatch
- Success: redirect to login
- Token verification from URL params (token_hash + type=recovery)

### 2.5 Complete Profile Page

**Route:** `/complete-profile` | **Access:** Authenticated (incomplete profile)

- Centered card
- Heading: "Complete Your Profile"
- Form fields:
  - Username input
  - Role selector: Student / Lecturer
- "Complete Profile" button
- Redirects when profile already complete
- Used for OAuth users who need to set username/role

---

## PART 3: Student Pages

### 3.1 Home / Landing Page

**Route:** `/` | **Access:** Public (lecturers redirected to dashboard)

SECTIONS (top to bottom):

1. Navigation Bar
2. Hero Section:
   - Large heading (responsive 48-80px): main title + optional subtitle line
   - Subtitle paragraph (muted color)
   - CTA button (context-aware):
     - Not logged in: "Enroll Now" → /signup
     - Student: "My Courses" → /my-courses
     - Lecturer: "Dashboard" → /lecturer/dashboard
     - Admin: "Admin Panel" → /admin
   - Arrow icon animates on hover
   - Scroll reveal animations (staggered)
   - Subtle radial gradient halo behind content
3. Courses Carousel:
   - "Our Courses" heading (clickable → /courses) + count badge
   - Desktop: horizontal carousel (2-3 cards), auto-rotation 4s, prev/next arrows
   - Mobile: vertical stack, "Show All"/"Show Less" toggle
   - Course cards (see 3.2 below)
   - Loading/error/empty states
4. Active Projects Carousel:
   - "Active Projects" heading + count
   - Desktop: single-card carousel with arrows, auto-rotation
   - Mobile: vertical stack with toggle
   - Project cards (see 3.5 below)
   - Click opens Project Details Modal
   - Loading/error states, hidden if no projects
5. Footer

### 3.2 Course Card Component

**File:** `components/CourseCard.tsx`

- Thumbnail area:
  - Course image or gradient placeholder
  - Play button overlay if intro video exists → expands to video player
  - "Bestseller" badge chip (if applicable)
- Body:
  - Course title (bold)
  - Author/Creator name (muted)
  - Star rating + review count
  - Course type chip: "Editing" / "Content Creation" / "Website Creation"
- Footer:
  - Price in GEL (₾) with optional strikethrough original price
  - Enrollment action:
    - Not enrolled: "Enroll" button → opens EnrollmentModal
    - Pending request: "Pending" amber badge
    - Enrolled: "Go to Course" / "Enrolled" green chip
    - Expired: "Expired" red badge + days remaining + re-enroll option
- Hover: elevation increase + subtle scale
- Enrollment modal integration (see 3.3)

### 3.3 Enrollment Modal

**File:** `components/EnrollmentModal.tsx`

- Full-screen portal overlay
- Multi-step enrollment wizard:
  - Step 1: Course info (title, description, video preview, price)
  - Step 2: Payment method selection:
    - Saved cards list (card mask •••• 1234, delete option)
    - "Pay with new card" option
    - Keepz payment gateway redirect
  - Referral code input (auto-filled from URL, validated)
  - Price display with discount if referral applied
- States:
  - Loading (fetching course/cards)
  - Processing payment (spinner)
  - Success (confetti/checkmark)
  - Error (retry option)
- Re-enrollment mode (for expired enrollments)
- Bundle enrollment mode
- PostHog analytics tracking

### 3.4 Courses Catalog Page

**Route:** `/courses` | **Access:** Public

- Navigation bar
- Page heading: "Courses" + subtitle
- Filter tabs: "All", "Editing", "Content Creation", "Website Creation"
- Search input field
- Course grid (responsive: 1-2-3-4 columns)
  - Each card: CourseEnrollmentCard (CourseCard + enrollment status)
- Bundle section (if bundles exist):
  - Bundle cards: title, description, included courses list, bundle price vs individual prices, discount badge
  - "Enroll in Bundle" button → BundleEnrollmentModal
- URL params: ?course=ID (auto-open enrollment), ?ref=CODE (referral), ?pendingEnroll=course:ID
- Loading skeleton grid
- Error state with retry
- Empty state
- Meta Pixel ViewContent tracking

### 3.5 Projects Page

**Route:** `/projects` | **Access:** Public

- Navigation bar
- Page heading: "Active Projects" + subtitle
- Projects count badge chip
- Project grid (1-2-3-4 columns responsive)
- Each project card:
  - Project name (bold)
  - Description (2-3 line clamp)
  - Video thumbnail with play button
  - Budget: total in GEL + remaining budget progress bar
  - View range: "1K - 5K views"
  - Platform badges: Instagram (pink), TikTok (slate)
  - Date range: "Mar 15 - Apr 15, 2026"
  - Countdown timer (live): green >3d, amber 1-3d, red <1d, "Ended" if past
  - "View Details" button
- Click opens Project Details Modal:
  - Full description
  - Embedded video (YouTube support)
  - Criteria list with RPM rates per platform
  - Submission stats
  - Close button
- Loading skeleton grid
- Error state with retry
- Empty state: "No active projects right now"
- Meta Pixel tracking

### 3.6 My Courses Page

**Route:** `/my-courses` | **Access:** Student (logged in)

- Navigation bar + background shapes
- Page heading with user's name
- Enrolled courses grid:
  - Each card: CourseEnrollmentCard with enrollment info
  - Shows days remaining, expiry status
  - "Go to Chat" action for active enrollments
  - Expired overlay with re-enroll prompt
- Featured course modal: auto-shows for students with 0 enrollments (dismissable)
- Payment recovery: auto-recovers stuck payments on load
- Loading/error/empty states
- Redirects: lecturers → dashboard, admins → admin, unauthenticated → login

### 3.7 Settings Page

**Route:** `/settings` | **Access:** Logged in (all roles)

SECTIONS (stacked cards):

1. **Profile Section:**
   - Avatar (clickable to upload, 2MB max)
   - Upload button + Remove avatar button
   - Username field + Update button
   - Loading/success/error states for each action

2. **Password Section:**
   - Current password field
   - New password field
   - Confirm password field
   - "Update Password" button
   - Success/error states

3. **Referral Section:**
   - Referral code display (read-only)
   - Copy code button (with copied feedback)
   - Referral link display
   - Copy link button (with copied feedback)
   - Per-course referral links (one per enrolled course)

4. **Balance & Earnings Section:**
   - Balance display: ₾XX.XX
   - Total earned / Total withdrawn stats
   - Bank account (IBAN) field + Update button
   - Withdrawal form:
   - Amount input
   - Minimum withdrawal threshold display
   - Pending withdrawal indicator
   - "Request Withdrawal" button
   - Transaction history toggle:
   - Table: date, type, amount, status, description
   - Withdrawal requests list:
   - Each: amount, status badge (pending/approved/rejected), date, reason (if rejected)
   - Real-time updates via Supabase Realtime

5. **Saved Cards Section:**
   - List of saved payment cards:
   - Card mask (•••• 1234)
   - Card type icon
   - Delete button (with confirmation)
   - Empty state: "No saved cards"

6. **Delete Account Section:**
   - "Delete Account" danger button
   - Confirmation modal: type "DELETE" to confirm
   - Warning text about irreversibility

### 3.8 Payment Success Page

**Route:** `/payment/success?paymentId=XXX` | **Access:** Logged in

- Status polling (checks payment status repeatedly)
- States:
  - Loading: spinner + "Verifying payment..."
  - Success: checkmark animation + "Payment successful!" + amount + action buttons:
    - Course enrollment: "Go to My Courses" or "Go to Chat"
    - Project budget: "Back to Chat"
  - Failed: error message + "Go to Courses" button
  - Timeout: timeout message + retry button
- Self-healing: triggers payment recovery if stuck

### 3.9 Payment Failed Page

**Route:** `/payment/failed?paymentId=XXX` | **Access:** Logged in

- Error icon
- "Payment Failed" heading
- "Try Again" button (links to course page)
- "Go to Courses" fallback link

---

## PART 4: Chat System

### 4.1 Student Chat Page

**Route:** `/chat` | **Access:** Student

### 4.2 Lecturer Chat Page

**Route:** `/lecturer/chat` | **Access:** Lecturer

### 4.3 Course-specific Chat

**Route:** `/courses/[courseId]/chat` | **Access:** Enrolled students

ALL CHAT VIEWS share this layout:

**4-PANEL LAYOUT:**

PANEL 1 — Server Sidebar (64px, leftmost):

- "DM" button (circular, active ring state)
- Divider
- Course icons list (48x48 rounded squares, first letter of course name)
  - Active: highlighted + left indicator pill
  - Locked (not enrolled): lock icon, muted, click opens EnrollmentModal
  - Unread badge (red, "9+" max)
  - Hover tooltip with course name
- "+" button (lecturer only) → create course
- Scrollable

PANEL 2 — Channel Sidebar (240px):

- Course name header + collapse button + unread badge
- Collapsible categories (persist in localStorage):
  - Category header: uppercase label + chevron
  - Channel list:
    - Text: "#" + name
    - Lectures: video icon + name
    - Projects: folder icon + name
    - Voice: speaker icon + name
  - Active: filled container
  - Unread: bold + dot
- Lecturer: "Manage Channels" gear button → ChannelManagement modal
- User profile footer: avatar + username + online status (green dot) + mic button + settings button

PANEL 3 — Chat Area (flexible):

- Channel header: hamburger (mobile) + "#" + channel name + connection status + description
- Message list:
  - Grouped by sender (consecutive = collapsed, no repeat avatar)
  - Message: avatar (40px) + username (role-colored) + timestamp + content
  - Reply preview: "Replying to @user: content..."
  - Edited indicator: "(edited)"
  - Media: images (lightbox on click), videos (inline player), GIFs
  - Reactions: emoji pills (emoji + count), toggle own
  - Hover actions: Reply, Reaction picker (6 common emojis), Delete
  - Project cards (Projects channel): name, description, video, budget, platforms, countdown, submit/review buttons
  - Pending: slight opacity + sending indicator
  - Failed: red tint + error + "Retry"
  - Muted: silently removed
- Loading skeleton (5 rows)
- Empty state: chat icon + "No messages yet"
- "Load older messages" button
- Scroll-to-bottom FAB
- Typing indicator: bouncing dots + "User is typing..." / "User and User are typing..." / "User and N others..."
- Message input:
  - Auto-expanding textarea
  - Reply preview bar (with cancel)
  - Attachment button → file picker (JPEG, PNG, WebP, GIF, MP4, WebM, max 10MB)
  - Drag & drop with highlighted zone
  - Upload progress thumbnails
  - Send button
  - Disabled states: muted, restricted channel, not enrolled
- Projects channel (lecturer): "+" FAB → VideoUploadDialog
- Projects channel (student): "Only lecturers can create projects" text

SPECIAL: Lectures Channel:

- Video player (large, custom controls)
- Video list: thumbnail, title, duration, progress bar, completion checkmark
- Sequential unlock (must complete previous)
- Lock icon for locked videos
- Lecturer: upload/edit/delete controls
- Expired enrollment: locked with re-enroll prompt

SPECIAL: Channel Management Modal (lecturer):

- Channel list with search
- Create: name, type (text/voice/lectures), description, category
- Edit: same fields
- Delete: confirmation

SPECIAL: VideoUploadDialog (Project Creation — lecturer):

- Project name, description
- Video: link input OR file upload
- Budget (GEL), min/max views
- Platforms: Instagram/TikTok checkboxes
- Start date, end date (date pickers)
- Criteria list: text + RPM per criteria, per platform
- Payment integration (Keepz) if budget > 0

SPECIAL: VideoSubmissionDialog (student):

- Per-platform URL inputs (Instagram, TikTok)
- URL validation per platform
- Optional message
- Submit button with loading state

SPECIAL: SubmissionReviewDialog (lecturer):

- View student submission
- Approve/reject actions

PANEL 4 — Member Sidebar (240px, toggleable):

- "Members" header + count + collapse button
- Online section: avatar + username + role (colored) + status dot (green/amber/red)
- Offline section: same but dimmed

MOBILE:

- Only chat area visible
- Hamburger opens sidebars as slide-over drawer with backdrop
- Input always visible at bottom (100dvh)

---

### 4.4 Direct Messages (DM) System (NEW — planned feature)

When user clicks "DM" button in Server Sidebar (Panel 1), Panel 2 transforms into the DM sidebar:

DM SIDEBAR (replaces Channel Sidebar):

HEADER:

- "Direct Messages" title
- New DM button (compose/pencil icon) → opens user search modal
- Friend requests button (person+ icon) with pending request count badge

SEARCH BAR:

- MD3 SearchBar to filter conversations
- Placeholder: "Search conversations..."

CONVERSATION LIST:

- Recent DM conversations sorted by last message time
- Each row:
  - Avatar (40px circle) with online status dot overlay (green/amber/red/gray)
  - Username (bold if unread)
  - Last message preview (truncated — "You: message..." or "message...")
  - Timestamp ("2m", "1h", "Yesterday", "Mar 15")
  - Unread count badge (red circle)
- Active conversation: MD3 filled container highlight
- Hover: surface variant background
- Context menu (long-press / right-click): Mute, Block, Delete conversation
- Empty state: "No conversations yet — add friends to start chatting"

DM CHAT VIEW (replaces Panel 3 when DM conversation selected):

- Same message list, input, typing indicator, and media features as channel chat
- Header changes:
  - Recipient avatar + username + online status (instead of "#channel-name")
  - Action buttons: Voice Call (future, grayed), Video Call (future, grayed), User Profile button (opens profile sidebar), More menu (Mute, Block, Close DM)
- Empty conversation: "Say hello! This is the beginning of your conversation with @username"
- Profile sidebar (toggleable from header):
  - Large avatar
  - Username + role badge
  - "Member since" date
  - Mutual courses list
  - Mutual friends list
  - Action buttons: Remove Friend, Block, Message

### 4.5 Friends System (NEW — planned feature)

FRIEND REQUESTS PAGE (replaces Panel 3 when opened from DM sidebar friend requests button):

TAB BAR (MD3 Tabs, 4 tabs):

TAB 1 — "Online":

- Search/filter bar
- List/grid of online friends:
  - Avatar with green status dot
  - Username
  - Status text (if set, e.g., "Studying editing...")
  - Actions: Message (opens DM), Voice Call (future), More menu (Remove Friend, Block)
- Empty: "No friends online right now"

TAB 2 — "All Friends":

- Same layout as Online but includes offline friends (dimmed)
- Total friend count in tab badge
- Alphabetical sorting with letter dividers

TAB 3 — "Pending":

- Two sections:
  - "Incoming" — requests from others:
    - Avatar + Username + "wants to be your friend"
    - Accept button (MD3 FilledButton) + Decline button (MD3 OutlinedButton)
  - "Outgoing" — requests you sent:
    - Avatar + Username + "Friend request sent"
    - Cancel button (MD3 OutlinedButton)
- Empty: "No pending friend requests"

TAB 4 — "Blocked":

- Blocked users list:
  - Avatar + Username + "Blocked" label
  - Unblock button
- Empty: "You haven't blocked anyone"

ADD FRIEND MODAL (from Friends page or DM sidebar):

- MD3 Dialog
- Text field: "Enter username or email"
- Debounced search results below:
  - Avatar + Username + mutual friends count
  - "Send Request" button per result
  - Already friends: "Already Friends" chip
  - Request sent: "Request Sent" chip
- Success toast: "Friend request sent to @username"

USER PROFILE POPOVER (click any username/avatar anywhere in app):

- MD3 Card popover
- Large avatar
- Username + role badge (Student/Lecturer)
- Online status
- Mutual courses list
- Mutual friends count
- Actions:
  - "Send Message" (opens DM)
  - "Add Friend" / "Friends" / "Request Sent" (contextual state)
  - "Block" (in more menu)
- Mobile: becomes bottom sheet instead of popover

NOTIFICATION INTEGRATION FOR DM/FRIENDS:

- Friend request received: badge on DM button in Server Sidebar + badge on Friend Requests button in DM sidebar
- New DM message: badge on DM button in Server Sidebar + unread indicator on conversation
- Friend request accepted: toast "Username accepted your friend request"

MOBILE FOR DM/FRIENDS:

- DM sidebar: same slide-over drawer as channel sidebar
- Friends page: full-screen with back button
- User profile popover: bottom sheet
- Add Friend modal: full-screen on mobile

---

## PART 5: Lecturer Pages

### 5.1 Lecturer Dashboard

**Route:** `/lecturer/dashboard` | **Access:** Lecturer (approved)

- Navigation bar + background shapes
- Dashboard heading with lecturer name

COURSE MANAGEMENT:

- "Create Course" button → opens multi-step modal:
  - Step 1: Basic info (title, description, course type dropdown)
  - Step 2: Pricing (price, original price, referral commission %)
  - Step 3: Media (thumbnail upload with progress, intro video upload with progress)
  - Step 4: Review & publish (summary, bestseller toggle, author/creator fields)
  - Progress indicator (step 1/4, 2/4, etc.)
- Course list/grid:
  - Each course card: thumbnail, title, type, price, student count
  - Edit button → same modal with pre-filled data
  - Delete button (with confirmation)
  - "Manage Channels" link → chat
- Loading/error states

BUNDLE MANAGEMENT:

- "Create Bundle" button → modal:
  - Bundle title, description
  - Price, original price
  - Course selector (checkboxes from lecturer's courses)
- Bundle list:
  - Title, included courses, price
  - Edit/Delete actions

ANALYTICS PREVIEW:

- Enrollment count per course
- Revenue summary

### 5.2 Lecturer Pending Page

**Route:** `/lecturer/pending` | **Access:** Lecturer (not approved)

- Navigation bar + background shapes
- "Pending Approval" heading
- Message explaining lecturer account is awaiting admin approval
- "Sign Out" button
- Auto-redirects to dashboard if already approved

### 5.3 Lecturer Root Redirect

**Route:** `/lecturer` | **Access:** Lecturer

- Auto-redirects:
  - Approved → /lecturer/dashboard
  - Not approved → /lecturer/pending
  - Not lecturer → /

---

## PART 6: Admin Dashboard

### 6.1 Admin Dashboard Page

**Route:** `/admin` | **Access:** Admin (verified via RPC)

TAB-BASED LAYOUT with these tabs:

- Overview, View Bot, Withdrawals, Lecturers, Courses, Notifications, Email Manager, Analytics, Settings

TAB: Overview (`AdminOverview`):

- Stat cards (4-column grid):
  - Total Users (icon + count)
  - Total Courses (icon + count)
  - Total Revenue (icon + ₾amount)
  - Active Enrollments (icon + count)
- Recent activity feed
- User analytics table

TAB: View Bot (`AdminViewBot`):

- View bot dashboard for monitoring social media views
- Per-project view tracking
- Submission management
- Components: ViewBotDashboard, ViewBotByProject, ViewBotSubmissions

TAB: Withdrawals (`AdminWithdrawals`):

- Pending withdrawal requests table:
  - Username, amount (₾), bank account (IBAN), date, status
  - "Approve" button (green) → processes withdrawal
  - "Reject" button (red) → opens rejection reason input
- Approved/Rejected history
- Real-time updates

TAB: Lecturers (`AdminLecturerApprovals`):

- Pending lecturer approval requests:
  - Username, email, registration date
  - "Approve" button → activates lecturer account
  - "Reject" button
- Approved lecturers list

TAB: Courses:

- All courses table:
  - Title, type, price, lecturer, enrollment count, status
  - Edit/Delete actions
- Course creation (same modal as lecturer)

TAB: Notifications (`AdminNotificationSender`):

- Send notification form:
  - Target: All users, Students, Lecturers, Specific user
  - Title (EN + GE fields)
  - Message (EN + GE fields)
  - Type: info, success, warning, error, system
  - "Send" button
- Notification history

TAB: Email Manager (`AdminEmailManager`):

- Compose email:
  - Recipients: All users, specific role, specific user
  - Subject line
  - Rich text editor (RichTextEditor component)
  - "Send" button
- Email history/logs

TAB: Analytics (`AdminAnalytics`):

- Revenue charts (line/bar)
- Enrollment trends
- User growth
- Course performance comparison
- Date range selector
- Export options

TAB: Settings (`AdminSettings`):

- Platform settings:
  - Minimum withdrawal amount
  - Featured course selector
  - Referral commission defaults
  - Maintenance mode toggle
- System configuration

---

## PART 7: Static/Legal Pages

### 7.1 About Us

**Route:** `/about-us` | **Access:** Public

- Navigation + Footer
- Content card: heading, subtitle, sections:
  - Mission statement
  - "For Users" benefits list (5 items)
  - "For Lecturers" benefits list (5 items)
  - "How It Works" numbered steps
  - Vision statement
  - Contact info

### 7.2 Terms and Conditions

**Route:** `/terms-and-conditions` | **Access:** Public

- Navigation + Footer
- Content card: heading, effective date, last updated
- Multiple article sections with legal text

### 7.3 Privacy Policy

**Route:** `/privacy-policy` | **Access:** Public

- Same layout as Terms

### 7.4 Personal Info Security

**Route:** `/personal-info-security` | **Access:** Public

- Same layout as Terms

### 7.5 Refund Policy

**Route:** `/refund-policy` | **Access:** Public

- Same layout as Terms

---

## PART 8: Bundle Pages

### 8.1 Bundle Enrollment Page

**Route:** `/bundles/[bundleId]` | **Access:** Public

- Navigation + background shapes
- Bundle details card:
  - Bundle title, description
  - Included courses list with thumbnails
  - Price comparison: bundle price vs individual total
  - Savings amount/percentage badge
- "Enroll in Bundle" button → opens EnrollmentModal (bundle mode)
- Already enrolled: "Already Enrolled" state
- Loading/error states

---

## PART 9: Payment Components

### 9.1 EnrollmentModal (detailed in 3.3)

### 9.2 BundleEnrollmentModal

**File:** `components/BundleEnrollmentModal.tsx`

- Similar to EnrollmentModal but for bundles
- Shows bundle courses list
- Bundle-specific pricing

### 9.3 PaymentDialog

**File:** `components/PaymentDialog.tsx`

- Generic payment confirmation dialog
- Amount display
- Payment method selection

### 9.4 PaymentMethodSelector

**File:** `components/PaymentMethodSelector.tsx`

- Saved cards list with radio selection
- "Pay with new card" option
- Card mask display + delete button
- Keepz gateway integration

### 9.5 ProjectSubscriptionModal

**File:** `components/ProjectSubscriptionModal.tsx`

- Project-specific payment for budget allocation
- Keepz payment flow

---

## PART 10: Utility Components

### 10.1 ExpiredEnrollmentOverlay

**File:** `components/ExpiredEnrollmentOverlay.tsx`

- Overlay shown on expired course content
- "Your enrollment has expired" message
- "Re-enroll" button → EnrollmentModal (re-enrollment mode)
- Displays expiry date and days since

### 10.2 ProfileCompletionGuard

**File:** `components/ProfileCompletionGuard.tsx`

- Global guard: checks if logged-in user has completed profile
- Redirects to /complete-profile if not
- Handles OAuth users who skip username setup

### 10.3 VideoPlayer

**File:** `components/VideoPlayer.tsx`

- Custom video player for course lectures
- Progress tracking (sends completion % to server)
- Controls: play/pause, seek, volume, fullscreen
- Signed URL support for protected videos

### 10.4 RichTextEditor

**File:** `components/RichTextEditor.tsx`

- Rich text editing for admin email composer
- Bold, italic, links, lists, headings
- HTML output

### 10.5 FloatingButton

**File:** `components/FloatingButton.tsx`

- Generic floating action button
- Fixed position (bottom-right typically)
- Icon + optional label
- Animation on appear

### 10.6 ErrorBoundary

**File:** `components/ErrorBoundary.tsx`

- React error boundary wrapper
- Fallback UI: error message + "Try Again" button
- Used around dynamic imports and critical sections

---

## PART 11: Data Model Summary

| Entity                 | Key Fields                                                                                                                                                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **User/Profile**       | id, email, username, role (student/lecturer/admin), avatar_url, is_approved, balance, bank_account_number, referral_code, profile_completed, first_login_completed                            |
| **Course**             | id, title, description, course_type, price, original_price, author, creator, intro_video_url, thumbnail_url, rating, review_count, is_bestseller, lecturer_id, referral_commission_percentage |
| **Enrollment**         | user_id, course_id, created_at, expires_at                                                                                                                                                    |
| **Channel**            | id, course_id, name, type (text/voice/lectures), description, category_name, display_order                                                                                                    |
| **Message**            | id, channel_id, user_id, content, reply_to, attachments[], reactions[], edited, timestamp                                                                                                     |
| **Video**              | id, channel_id, course_id, title, url, duration, display_order, progress per user                                                                                                             |
| **Project**            | id, channel_id, course_id, user_id, name, description, video_link, budget, min_views, max_views, platforms[], start_date, end_date, status                                                    |
| **Project Criteria**   | project_id, criteria_text, rpm, platform, display_order                                                                                                                                       |
| **Project Submission** | id, project_id, user_id, platform_links{}, message, status                                                                                                                                    |
| **Notification**       | id, user_id, title{en,ge}, message{en,ge}, type, read, created_at                                                                                                                             |
| **Withdrawal Request** | id, user_id, amount, status (pending/approved/rejected), bank_account_number, reason                                                                                                          |
| **Saved Card**         | id, user_id, card_mask, card_type                                                                                                                                                             |
| **Course Bundle**      | id, title, description, price, original_price, is_active, course_bundle_items[]                                                                                                               |
| **Payment**            | id, user_id, amount, status, payment_type (enrollment/project_budget), reference_id                                                                                                           |

---

## PART 12: Design Specifications

### Material Design 3:

- **Color:** Neutral seed — gray/slate surfaces, no locked brand color
- **Dark theme** (primary): proper MD3 dark surface hierarchy (surface, surface-container, surface-container-high, surface-container-highest)
- **Light theme** support as secondary
- **Shape:** MD3 shape scale (extra-small 4dp, small 8dp, medium 12dp, large 16dp, extra-large 28dp)
- **Typography:** MD3 type scale (display, headline, title, body, label)
- **Elevation:** MD3 tonal elevation (not drop shadows)
- **Motion:** MD3 standard easing, 200-600ms durations
- **State layers:** hover 8%, focus 12%, pressed 12%
- **Components:** TopAppBar, Card, FilledButton, OutlinedButton, TextButton, IconButton, FAB, Chip, Badge, NavigationRail, NavigationDrawer, Menu, Dialog, TextField, Tabs, SegmentedButton, ProgressIndicator, Snackbar, Switch, Checkbox, Radio, DatePicker

### Responsive Breakpoints:

- Mobile: <768px (1 column, hamburger nav, bottom sheets, full-screen modals)
- Tablet: 768-1024px (2 columns, full nav)
- Desktop: >1024px (3-4 columns, max-width 1280px container)

### Accessibility:

- Focus-visible outlines on all interactive elements
- ARIA labels on icon buttons
- Keyboard navigation (Tab, Enter, Escape)
- Skip-to-content link
- Color contrast per MD3 guidelines
- Screen reader support for dynamic content

### Bilingual (all UI text has EN + GE versions):

- Navigation, auth forms, course cards, chat UI, settings, admin dashboard, legal pages, error messages, empty states, button labels, notifications
