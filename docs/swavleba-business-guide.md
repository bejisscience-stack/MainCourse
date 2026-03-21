# Swavleba (Wavleba) — Business Guide

> This document describes Swavleba as a business — how the platform works, user flows, monetization, and policies. It contains no technical implementation details. Use it as context for understanding the platform from a product and operations perspective.

---

## 1. Platform Overview

**Brand Name:** Wavleba (ვავლება in Georgian)
**Website:** swavleba.ge
**Tagline:** "Learn To Earn Online" / "Create And Earn Financial Freedom Online"
**Launch Date:** March 21, 2026
**Languages:** English and Georgian (bilingual throughout)
**Currency:** Georgian Lari (₾ / GEL)

**Description:** Swavleba is a unified platform for learning, content creation, and monetization. It connects professional lecturers with students who want to learn digital skills and earn income from their creativity.

**Mission:** Create an ecosystem where everyone can earn income through their skills and creativity — a unified space for learning, content creation, and monetization.

**What Swavleba Offers Users:**

- Quality courses from professional lecturers
- Monetization opportunities from created video clips
- Transparent pricing and conditions
- Secure payments and reliable financial transactions

**What Swavleba Offers Lecturers:**

- New audience reach and student base expansion
- Additional income from video view RPM (Rate Per Match)
- Efficient course management tools
- Marketing support, promotions, campaigns, direct student communication
- Trust through transparent conditions and safe settlements

**How It Works:**

1. **Learn** — Choose and study courses from professionals
2. **Create** — Clip best moments into useful videos
3. **Publish** — Upload clips to social media platforms
4. **Earn** — Receive income from every view

---

## 2. Company Information

- **Legal Name:** Wavleba
- **Address:** Georgia, Tbilisi, Leo and Nodar Gabuniya II Lane, No. 3, Apartment 27
- **Email:** bejisscience@gmail.com
- **Phone:** +995 555 54 99 88
- **Currency:** Georgian Lari (₾ / GEL)
- **Timezone:** UTC+4 (Georgia Standard Time)
- **Jurisdiction:** Georgian law, Tbilisi courts
- **Payment Role:** "Limited payment collection agent" — the payment provider processes transactions, and Wavleba collects on behalf of partner lecturers

---

## 3. User Roles & Permissions

### 3.1 Student

- Browse and enroll in courses and bundles
- Watch video lectures and track progress
- Participate in course chat channels
- Submit videos to lecturer-created projects
- Earn RPM (Rate Per Match) from project submissions
- Share referral codes and earn commissions
- Withdraw earnings to Georgian bank account
- Manage profile, balance, and transactions

### 3.2 Lecturer

- Create and manage individual courses
- Create and manage course bundles (2+ courses)
- Set course pricing and referral commission percentages
- Upload video lectures and course materials
- Create video projects with budgets and criteria
- Fund project budgets via payment
- Manage chat channels within courses (text, voice, lectures)
- Mute students in chat
- View submissions and provide reviews
- Earn revenue from course sales
- Requires admin approval before going live

### 3.3 Admin

- Approve or reject lecturer registrations
- Approve or reject enrollment requests (course and bundle)
- Approve or reject project subscription requests
- Process withdrawal requests (approve/reject with notes)
- Send targeted notifications (in-app and email)
- Manage view bot (schedule scrapes, trigger manual runs)
- Approve student payouts for project submissions
- View platform analytics (revenue, enrollments, referrals, projects)
- Access all course chats
- Make manual balance adjustments

---

## 4. Registration & Onboarding

### 4.1 Signup Flow

1. User provides: **Email**, **Password** (minimum 6 characters), **Username** (3-30 characters, alphanumeric + underscores)
2. Selects role: **Student** or **Lecturer**
3. Optionally enters a **referral code** (can also come from URL parameter `?ref=CODE`)
4. Agrees to **Terms & Conditions** and **Privacy Policy**
5. Receives email verification link
6. Clicks verification link to activate account

**Alternative:** "Continue with Google" OAuth signup (skips email/password step)

### 4.2 Post-Signup Redirects

- **Student** (with referral) → Home page
- **Student** (without referral) → My Courses page
- **Lecturer** → Lecturer pending approval page

### 4.3 Google OAuth Complete Profile

- First-time Google OAuth users must complete their profile
- Sets: **Username** + **Role** (Student or Lecturer)
- Only shown once; subsequent logins skip this step

### 4.4 Lecturer Pending Approval

- After lecturer signup, account is in "pending" status
- Admin must approve before lecturer can create courses
- Lecturer sees a "pending approval" page until approved

### 4.5 Referral Code During Signup

- Optional field during registration
- Can be pre-filled from URL parameter (`?ref=CODE`)
- Validated in real-time (shows valid/invalid feedback)
- Stored on profile; commission credited when user enrolls in first course
- If no referral code used at enrollment time, the signup referral code serves as fallback

---

## 5. Course System

### 5.1 Individual Courses

Each course has:

- **Title** and **Description**
- **Course Type:** Editing, Content Creation, or Website Creation
- **Price** (in GEL) and optional **Original Price** (for showing discounts)
- **Thumbnail Image** and optional **Intro Video**
- **Author/Creator** name
- **Rating** and **Review Count**
- **Bestseller Badge** (admin/lecturer toggle)
- **Referral Commission Percentage** (0-100%, set by lecturer)

### 5.2 Course Types

1. **Editing** — Video editing skills
2. **Content Creation** — Content creation skills
3. **Website Creation** — Web development skills

### 5.3 Video Lectures

- Lecturers upload video files with optional thumbnails
- Videos have a display order within the course
- Students can mark lectures as completed
- Progress tracking (percentage watched, resume from last position)
- Lectures appear in a dedicated "Lectures" channel within course chat

### 5.4 Course Bundles

- A bundle contains **2 or more courses** at a discounted price
- Shows "Save X%" badge when bundle price is less than sum of individual course prices
- Lists all included courses
- Separate enrollment flow from individual courses
- Created and managed by lecturers
- Can be activated/deactivated

### 5.5 Browsing & Discovery

- **Search** by course name or lecturer name
- **Filter** by course type (All, Editing, Content Creation, Website Creation)
- Course cards display: thumbnail, title, type, rating, price, bestseller badge
- Lecturers' own courses excluded from their browse view

---

## 6. Enrollment System

### 6.1 Course Enrollment Flow (5 Steps)

1. **Overview** — Course details and pricing
2. **Payment** — Select payment method and pay via Keepz
3. **Referral** — Optionally enter referral code (or pre-filled from signup)
4. **Upload** — Upload payment screenshot (legacy manual flow only)
5. **Review & Submit** — Confirm enrollment request

### 6.2 Payment Methods

**Keepz Payment (Instant):**

- Pay via Keepz checkout → auto-approval on successful payment
- No admin review needed
- Supports saved cards for repeat payments

**Legacy Manual Flow:**

- Upload payment screenshot as proof
- Admin manually reviews and approves/rejects

### 6.3 Bundle Enrollment

- Same flow as course enrollment but for the entire bundle
- Enrolls user in all courses within the bundle at once
- No referral code support for bundle enrollment

### 6.4 Enrollment Lifecycle

- **Pending** → Awaiting payment or admin approval
- **Approved** → Access granted (lifetime by default)
- **Rejected** → Admin denied with reason

### 6.5 Course Access

- **Lifetime access** — enrollments do not expire by default
- **Re-enrollment** — if an enrollment has an expiry date and expires, user can re-enroll
- **Re-enrollments skip referral processing** to prevent commission gaming
- **First course enrollment** grants **1-month free project access** across all courses

### 6.6 Admin Approval (Manual Enrollments)

- Admin views pending requests
- Reviews payment screenshot proof
- Approves → user receives "enrollment approved" notification + access granted
- Rejects → user receives "enrollment rejected" notification with reason

---

## 7. Payment System (Keepz)

### 7.1 Payment Gateway

Swavleba uses **Keepz**, a Georgian payment gateway, for all transactions.

### 7.2 Accepted Payment Methods

- **Bank Cards:** Visa, Mastercard
- **Online Banking:** TBC, BOG (Bank of Georgia), Credo, Liberty
- **Mobile Payments:** Apple Pay, Google Pay
- **Cryptocurrency:** Bitcoin, Ethereum, USDT

### 7.3 Payment Types

| Type                 | Who Pays | Amount                | Purpose                                    |
| -------------------- | -------- | --------------------- | ------------------------------------------ |
| Course Enrollment    | Student  | Course price          | Enroll in individual course                |
| Bundle Enrollment    | Student  | Bundle price          | Enroll in all bundled courses              |
| Project Subscription | Student  | ~₾10/month            | Access to project channels and submissions |
| Project Budget       | Lecturer | Project budget amount | Fund a project for student payouts         |

### 7.4 Payment Flow

1. User initiates payment → system creates order with Keepz
2. User redirected to Keepz checkout page (or charged via saved card)
3. User completes payment on Keepz
4. Keepz sends callback → system auto-approves enrollment/subscription
5. User redirected to success page with confirmation

### 7.5 Saved Cards

- Users can opt to save their card during payment ("Save card for future use")
- Saved cards enable one-click payments without redirect
- Card info stored: masked number, brand, expiration date
- Users can delete saved cards

### 7.6 Payment Safety

- Orders expire after **5 minutes** if not completed
- **Self-healing:** If Keepz callback is lost but payment succeeded, the system recovers automatically when user checks status
- Duplicate prevention: safe to retry within the idempotency window
- Amount validation prevents fraud

### 7.7 Post-Payment Redirects

- **Course enrollment** → Course chat page
- **Bundle enrollment** → My Courses page
- **Project subscription** → Courses page
- **Project budget** → Course chat (projects channel)
- **Failed payment** → Failure page with "Try Again" option

### 7.8 Pricing

- All prices in **Georgian Lari (₾ / GEL)**
- Prices displayed include all fees/commissions
- No hidden charges

---

## 8. Project System (Video Content)

### 8.1 Overview

Lecturers create projects that incentivize students to create and promote social media content. Each project has a fixed budget; students earn money based on achieving view/engagement targets.

### 8.2 Project Creation (Lecturer)

A project includes:

- **Name** and **Description** — project brief
- **Budget** (in GEL) — total payout pool
- **Platforms:** TikTok, Instagram (expandable to YouTube, Facebook)
- **View Range:** minimum views (≥5,000) and maximum views
- **Start Date** and **End Date** — active period
- **Reference Video** (optional) — example of expected content
- **Criteria** — specific requirements with RPM per criterion

### 8.3 Project Criteria & RPM

- Lecturers define multiple criteria per project (e.g., "Like & Comment", "Share to Story")
- Each criterion has an **RPM** (Rate Per Match) — payment amount in GEL
- Criteria can be platform-specific or apply to all platforms
- **Potential RPM** = sum of all criteria RPMs (shown in UI)
- Students earn per matched criterion based on their submission performance

### 8.4 Student Submission Flow

1. Student views active project details and criteria
2. Submits video URL(s) with platform-specific links (TikTok, Instagram)
3. Can include a message/notes with submission
4. View scraper automatically tracks engagement metrics
5. Admin reviews submission with verified view counts
6. Admin approves payout → student balance credited

### 8.5 Payout Calculation

```
Payout = (verified_view_count / 1,000) × RPM
```

Example: 8,500 views × ₾0.50 RPM = ₾4.25 payout

### 8.6 Project Budget Flow

1. Lecturer creates project → status: "draft"
2. Lecturer pays project budget via Keepz → status: "active"
3. As admin approves payouts, "spent" amount increases
4. Remaining budget = total budget - spent
5. Project completes when end date passes

### 8.7 Project Status Lifecycle

- **Draft** → Created but not yet funded
- **Pending Payment** → Awaiting lecturer's Keepz payment
- **Active** → Funded and accepting submissions
- **Completed** → End date passed

---

## 9. Project Subscriptions

### 9.1 Purpose

Project subscriptions grant access to project channels and the ability to view and submit to projects, separate from course enrollment.

### 9.2 Pricing

- **₾10/month** (default subscription price)
- One-time monthly payment via Keepz

### 9.3 Access Tiers (Three Ways to Access Projects)

| Access Type       | Duration | How to Get                                                      |
| ----------------- | -------- | --------------------------------------------------------------- |
| Course Enrollment | Lifetime | Enroll in any course — access that course's projects forever    |
| Free Grant        | 1 month  | Automatic on first-ever course enrollment — access ALL projects |
| Paid Subscription | 1 month  | Purchase project subscription via Keepz                         |

### 9.4 Subscription Flow

1. Student accesses project → shown subscription modal if no access
2. Pays ₾10 via Keepz (saved card or new payment)
3. Admin reviews and approves subscription
4. Access granted for 1 month from approval date
5. After expiry, must purchase again (no auto-renewal)

---

## 10. Referral System

### 10.1 Overview

Every registered user receives a unique referral code. Sharing this code earns commissions when referred users enroll in courses.

### 10.2 Referral Code

- **Format:** 8-character uppercase alphanumeric (e.g., "A1B2C3D4")
- Auto-generated on registration
- Unique per user
- Displayed in user settings for sharing

### 10.3 Sharing Options

- **Copy referral code** directly
- **General referral link** — directs to platform with code pre-filled
- **Course-specific referral links** — up to 10 course-specific links shown
- Copy-to-clipboard functionality for all link types

### 10.4 How Referrals Work

**Path 1: Signup Referral**

1. New user signs up with referral code (via URL or manual entry)
2. Code stored on their profile
3. When they enroll in their first course → referrer earns commission

**Path 2: Enrollment Referral**

1. Existing user enrolls in a course
2. Enters referral code during enrollment payment step
3. On enrollment approval → referrer earns commission

**Priority:** If user provides a code at enrollment, it takes precedence over the signup referral code.

### 10.5 Commission Calculation

- **Commission %** is set by the lecturer per course (0-100%)
- **Commission amount** = (commission % / 100) × course price

**Example:**

- Course price: ₾100
- Commission: 20%
- Referrer (student) receives: ₾20
- Lecturer receives: ₾80

If no referral or commission is 0%:

- Lecturer receives: full course price

### 10.6 Commission Rules

- **No self-referral** — users cannot use their own code
- **One referral per enrollment** — no duplicate commissions
- **First enrollment only** — re-enrollments (expired courses) skip referral processing
- **Credited on approval** — commission added to referrer's balance when enrollment is approved
- **Course-level setting** — each course can have different commission rates

---

## 11. Balance & Withdrawal System

### 11.1 Balance Overview

Every user has a balance that tracks all earnings. The balance page shows:

- **Current Balance** — available funds (GEL)
- **Total Earned** — lifetime credits (all sources)
- **Total Withdrawn** — lifetime withdrawals
- **Pending Withdrawal** — amount in pending withdrawal requests

### 11.2 How Users Earn

| Source              | Who Earns           | When                                                |
| ------------------- | ------------------- | --------------------------------------------------- |
| Referral Commission | Referrer (any user) | When referred user's enrollment is approved         |
| Course Purchase     | Lecturer            | When a student enrolls in their course              |
| Submission Payout   | Student             | When admin approves project submission review       |
| Admin Adjustment    | Any user            | Manual credit/debit by admin (refunds, corrections) |

### 11.3 Transaction Audit Trail

Every balance change is recorded with:

- Transaction type (credit or debit)
- Source (referral_commission, course_purchase, submission_payout, withdrawal, admin_adjustment)
- Amount
- Balance before and after
- Human-readable description
- Timestamp

### 11.4 Withdrawal Flow

1. User navigates to Balance section in Settings
2. Enters withdrawal amount and Georgian IBAN
3. System validates:
   - Amount ≥ **₾20** (minimum withdrawal)
   - Valid **Georgian IBAN format** (GE + 2 digits + 2 letters + 16 digits = 22 characters)
   - Sufficient balance
   - No existing pending withdrawal (only one at a time)
4. Withdrawal request created → balance immediately debited
5. Admin reviews request in Withdrawals dashboard
6. **Approved** → funds transferred externally to user's bank (1-3 business days)
7. **Rejected** → balance refunded to user, reason provided

### 11.5 Withdrawal Rules

- **Minimum:** ₾20
- **Maximum pending:** 1 request per user at a time
- **IBAN required:** Only Georgian IBANs accepted
- **Admin approval required:** No automatic payouts
- **Monthly payout schedule:** 5th of each month (per terms)

---

## 12. Real-Time Chat

### 12.1 Structure

Each course has its own chat space with multiple channels:

- **Text Channels** — General discussion, media sharing
- **Voice Channels** — Audio discussions
- **Lectures Channel** — Auto-created, dedicated to course content delivery
- **Project Channel** — Accessible via project subscription or enrollment

### 12.2 Features

- **Text messaging** with markdown support
- **Media sharing** — images (JPG, PNG, WebP), videos (MP4, WebM), GIFs
- **Reply-to messages** — quote and respond to specific messages with preview
- **Emoji reactions** — react to messages (tracked per user)
- **Typing indicators** — real-time "User is typing..." status
- **Unread tracking** — per-channel unread message count
- **Channel muting** — users can mute individual channels

### 12.3 Access Controls

- Only **enrolled students** and the **course lecturer** can access course chat
- **Project channels** require either course enrollment, free project access grant, or paid project subscription
- Lecturers can **mute students** in their course channels
- Lecture channels may restrict who can post

### 12.4 Navigation

- Server sidebar shows all courses user has access to
- Channel sidebar shows channels within selected course
- Member sidebar shows online users in current channel
- Quick links: My Profile, My Courses, Home

---

## 13. Notification System

### 13.1 Notification Types (8)

| Type                       | Trigger                           |
| -------------------------- | --------------------------------- |
| Enrollment Approved        | Admin approves course enrollment  |
| Enrollment Rejected        | Admin rejects course enrollment   |
| Bundle Enrollment Approved | Admin approves bundle enrollment  |
| Bundle Enrollment Rejected | Admin rejects bundle enrollment   |
| Withdrawal Approved        | Admin approves withdrawal request |
| Withdrawal Rejected        | Admin rejects withdrawal request  |
| Admin Message              | Manually sent by admin            |
| System                     | Automated platform notification   |

### 13.2 Delivery Channels

- **In-app** — appears in notification panel with unread badge counter
- **Email** — sent to user's registered email
- **Both** — simultaneous in-app and email delivery

### 13.3 Bilingual Notifications

All notifications support both English and Georgian:

- Separate title and message fields for each language
- Displayed in user's current language preference
- Admin can send in: English only, Georgian only, or both

### 13.4 User Actions

- View notification history
- Mark individual notifications as read
- Mark all notifications as read
- Unread count badge in navigation

---

## 14. Admin Dashboard

### 14.1 Overview Tab

- Total Courses count
- Quick actions (view all courses)
- System status at a glance

### 14.2 View Bot Tab

Manages automated social media view scraping for project submissions.

**Sub-sections:**

- **Dashboard:** Scrape run history, scheduling controls, stats (TikTok/Instagram link counts)
- **Submissions:** Individual video submissions pending payout, filter by project/platform, trigger single checks, approve payouts
- **By Project:** Aggregate metrics per project, trigger project-wide scrapes

**Scheduling Options:**

- Daily at 3:00 AM UTC (default)
- Daily at 9:00 AM UTC
- Every 6 hours / Every 12 hours
- Weekly
- Custom cron expression

### 14.3 Withdrawals Tab

- View all withdrawal requests with status filter (Pending / Completed / Rejected)
- Request details: amount, requester email/username, role, bank account (IBAN), current balance
- **Approve** with optional admin notes (shown to user)
- **Reject** with mandatory reason (shown to user)
- Real-time updates

### 14.4 All Courses Tab

- Grid view of all platform courses
- Course title, author, price
- Direct "Open Chat" button to enter any course's chat

### 14.5 Send Notifications Tab

- **Audience Targeting:**
  - All users
  - By role (Students / Lecturers / Admins)
  - By course (all enrolled users in a specific course)
  - Specific users (searchable by email/username)
- **Channel Selection:** In-app only / Email only / Both
- **Language Selection:** English / Georgian / Both (with separate title/message fields)
- **Email Source Options** (when email enabled):
  - Registered profiles (matching target audience)
  - Coming Soon waitlist emails
  - Both profiles + waitlist
  - Specific email addresses (manual entry)

### 14.6 Analytics Tab

**Stat Cards (6):**

1. Waiting List count (pre-launch signups)
2. Total Revenue (₾ from courses + bundles)
3. Total Enrollments (courses + bundles combined)
4. Active Referrals
5. Total Projects
6. Total Project Budget (₾)

**Charts:**

1. Revenue by Course (bar chart, sorted descending)
2. Referral Activations by Course (bar chart)
3. Projects by Course (bar chart)
4. Platform Distribution — TikTok vs Instagram vs other (donut/pie chart)

**Tables:**

1. Course Revenue — course title, type, price, enrollment count, total revenue
2. Top Referrers (top 10) — username, referral code, activation count, commission earned
3. Projects by Course — course title, project count, total budget, average budget, submission count

---

## 15. View Scraping System

### 15.1 Purpose

Automated system that verifies engagement metrics (views, likes, comments, shares, saves) on student-submitted social media videos.

### 15.2 Supported Platforms

- **TikTok** — tracks: play count, likes (digg count), comments, shares, saves (collect count)
- **Instagram** — tracks: video view count, likes, comments

### 15.3 Automated Schedule

- Runs daily at **3:00 AM UTC** by default
- Admin can change schedule via dashboard presets or custom cron
- Only scrapes submissions from **active projects** (within start/end date range)

### 15.4 Manual Triggers

- Admin can trigger scrape for a **single submission**
- Admin can trigger scrape for **all submissions in a project**
- Admin can trigger a **full scrape run** across all active projects

### 15.5 Scrape Results

- Latest metrics cached per submission (views, likes, comments, shares, saves)
- Timestamp of last scrape recorded
- Batch run tracking (success/failure counts per run)

### 15.6 Payout Process

1. View counts verified by scraper
2. Admin reviews submission in View Bot → Submissions tab
3. Admin calculates payout: `(view_count / 1,000) × RPM`
4. Admin approves → payout credited to student's balance
5. Project's "spent" amount updated
6. Student notified of payout

---

## 16. Legal & Policies

### 16.1 Terms and Conditions (13 Sections)

1. **Introduction** — Platform operates as an intermediary service connecting lecturers and students
2. **Agreement** — By registering or using the platform, users accept all terms
3. **User Obligations** — Provide accurate information, use legally, no fraud or abuse
4. **Account & Security** — Valid email/phone required, users own password security
5. **Confidentiality** — Data handled per Georgian law + GDPR principles
6. **Payments & Prices** — Authorization model (funds checked, then deducted), transparent pricing, monthly payout on 5th of each month
7. **Prohibited Acts** — Fake transactions, data abuse, harmful content, bots, reverse engineering, hate speech
8. **Intellectual Property** — Wavleba owns brand/code/logo; partners (lecturers) retain content ownership; platform can display content for service purposes
9. **Liability Limitation** — Service provided as-is; lecturer responsible for course quality; company not liable for indirect harm except in cases of gross negligence
10. **Account Termination** — Company can suspend/terminate for violation/fraud/risk; user can delete account anytime; data kept per legal requirements
11. **Terms Changes** — Company can update terms; users notified; continued use = acceptance
12. **Governing Law** — Georgian law applies; Tbilisi courts have jurisdiction; mediation required before court proceedings
13. **Contact Information** — Company email, phone, and address

### 16.2 Privacy Policy (12 Sections)

1. **General** — Controls personal data collection per Georgian law + GDPR
2. **Data Processor** — Wavleba entity details
3. **Data Collected** — Registration data, payment data (via secure provider), technical data (IP, device, cookies), content (reviews, photos), location (GPS with consent, approximate by IP)
4. **Processing Purposes** — Service provision, secure payment, user communication, platform improvement, technical security, marketing (consent-only)
5. **Data Sharing** — Payment providers, service providers, law enforcement (only when legally required)
6. **Data Retention** — After account deletion, data kept only as legally required, then deleted or anonymized
7. **Security** — Encryption (in transit and at rest), access controls, regular monitoring
8. **User Rights** — Access, correction, deletion (right to be forgotten), portability, processing restriction/objection, marketing opt-out
9. **Cookies & Analytics** — Google Analytics used; users can manage via browser settings
10. **International Transfer** — Appropriate safeguards if data leaves Georgia
11. **Policy Changes** — Users notified; new version effective immediately
12. **Contact** — Email for data requests: bejisscience@gmail.com

### 16.3 Personal Information Security Policy (7 Sections)

1. **General** — Commitment to protecting personal data
2. **Protected Data** — Registration, payment (via provider), technical, location, reviews/content
3. **Protection Principles** — Legal compliance, data minimization, transparency, security, accountability
4. **Security Measures** — Encryption (transit and at rest), monitoring, access controls, backups, standards updates
5. **User Rights** — Access, correction, deletion, restriction, processing objection, marketing opt-out
6. **Breach Response** — Notification within 24 hours, remediation, regulatory disclosure if needed
7. **Contact** — Company contact details

### 16.4 Refund Policy (4 Sections)

1. **General** — Defines refund conditions
2. **Eligibility** — Full refund if service not rendered due to: technical fault, force majeure, or company/partner's fault
3. **Process** — Email refund request to bejisscience@gmail.com with: name, email, payment proof; processed within **10 business days**
4. **Contact** — Company email and phone

---

## 17. Platform Pages

### Public Pages (No Login Required)

| Page                   | Path                      | Description                                                       |
| ---------------------- | ------------------------- | ----------------------------------------------------------------- |
| Home                   | `/`                       | Hero section, video showcase, courses carousel, projects carousel |
| Coming Soon            | `/coming-soon`            | Pre-launch countdown timer + email waitlist subscription          |
| About Us               | `/about-us`               | Platform mission, how it works, what we offer                     |
| Terms & Conditions     | `/terms-and-conditions`   | Full legal terms                                                  |
| Privacy Policy         | `/privacy-policy`         | Data handling policies                                            |
| Personal Info Security | `/personal-info-security` | Data protection policy                                            |
| Refund Policy          | `/refund-policy`          | Refund eligibility and process                                    |

### Authentication Pages

| Page             | Path                | Description                                     |
| ---------------- | ------------------- | ----------------------------------------------- |
| Sign Up          | `/signup`           | Email/password + role selection + referral code |
| Log In           | `/login`            | Email/password or Google OAuth                  |
| Forgot Password  | `/forgot-password`  | Email recovery link                             |
| Reset Password   | `/reset-password`   | Set new password via OTP link                   |
| Complete Profile | `/complete-profile` | Google OAuth users set username + role          |

### Student Pages (Login Required)

| Page            | Path                       | Description                                                          |
| --------------- | -------------------------- | -------------------------------------------------------------------- |
| My Courses      | `/my-courses`              | Enrolled courses + discover new courses                              |
| Courses         | `/courses`                 | Browse all courses, bundles, search & filter                         |
| Course Chat     | `/courses/[courseId]/chat` | Course channels: text, voice, lectures, projects                     |
| Projects        | `/projects`                | Browse and submit to active projects                                 |
| Settings        | `/settings`                | Profile, referral codes, password, balance, transactions, withdrawal |
| Payment Success | `/payment/success`         | Payment confirmation with status polling                             |
| Payment Failed  | `/payment/failed`          | Payment failure with retry option                                    |

### Lecturer Pages

| Page               | Path                  | Description                                   |
| ------------------ | --------------------- | --------------------------------------------- |
| Lecturer Dashboard | `/lecturer/dashboard` | Create/edit courses, bundles, manage content  |
| Lecturer Chat      | `/lecturer/chat`      | View all course channels across their courses |
| Lecturer Pending   | `/lecturer`           | Waiting for admin approval (new lecturers)    |

### Admin Pages

| Page            | Path     | Description                                                                         |
| --------------- | -------- | ----------------------------------------------------------------------------------- |
| Admin Dashboard | `/admin` | 6-tab dashboard: Overview, View Bot, Withdrawals, Courses, Notifications, Analytics |

---

## 18. Settings Page Sections

### Profile

- Username (3-30 characters, alphanumeric + underscores)
- Profile image upload/remove

### Password

- Current password verification required
- New password (minimum 6 characters)
- Confirmation must match
- Must differ from current password

### Referral

- View personal referral code
- Copy general referral link
- Copy course-specific referral links (up to 10 courses shown)

### Balance & Earnings

- Current balance display
- Total earned / Total withdrawn
- Pending withdrawal amount
- Bank account IBAN field (Georgian format)
- Request withdrawal (minimum ₾20)

### Transaction History

- Referral commission entries
- Course purchase entries (lecturer)
- Submission payout entries
- Withdrawal entries
- Admin adjustment entries
- Status tracking per transaction (Pending, Completed, Rejected, Approved)

---

## 19. Lecturer Dashboard Features

### Course Creation (4-Step Wizard)

1. **Basic Info:** Title, description, course type, price
2. **Media:** Intro video upload, thumbnail upload
3. **Pricing:** Original price (for discount display), bestseller flag
4. **Revenue:** Referral commission percentage (0-100%)

### Course Management

- List all created courses
- Edit course details
- Delete courses

### Bundle Management

- Create bundles (select 2+ courses)
- Set bundle price and description
- Activate/deactivate bundles
- Edit bundle contents

### Channel Management

- Create/edit/delete text and voice channels
- Categories for organization
- Lectures channel auto-created (protected from deletion)
- Project channel management

---

## 20. Future Vision

Currently the platform focuses on courses and video clip monetization. Planned expansions include:

- **Podcasts**
- **Live Streams**
- **Masterclasses**
- **Workshops**

**Goal:** A platform where everyone can learn, create, and earn — regardless of their starting point.

---

## Appendix A: Key Business Flows

### A.1 Course Enrollment with Referral

```
Student A (referrer) shares referral code: "A1B2C3D4"
  ↓
Student B signs up with code "A1B2C3D4"
  ↓
Student B creates enrollment request for Course X
  (Course price = ₾100, Referral commission = 20%)
  ↓
Student B pays ₾100 via Keepz → auto-approved
  ↓
System processes referral:
  • Student A (referrer): +₾20 (referral commission)
  • Lecturer: +₾80 (course purchase revenue)
  • Student B: enrolled in Course X
```

### A.2 Project Submission Payout

```
Lecturer creates project:
  • Budget: ₾500
  • Criteria: "View > 5K" at ₾0.50 RPM
  • Pays ₾500 via Keepz → project becomes active
  ↓
Student submits TikTok video link
  ↓
View scraper runs at 3:00 AM UTC → TikTok views = 8,500
  ↓
Admin reviews submission:
  • Verified views: 8,500
  • RPM: ₾0.50
  • Payout: (8,500 / 1,000) × ₾0.50 = ₾4.25
  ↓
Admin approves payout:
  • Student balance: +₾4.25
  • Project spent: +₾4.25
  • Remaining budget: ₾495.75
```

### A.3 Withdrawal

```
Student has ₾150 balance
  ↓
Requests withdrawal: ₾100 to IBAN GE29TBCB...
  (Balance immediately becomes ₾50)
  ↓
Admin reviews in Withdrawals tab
  ↓
Admin approves with note: "Processed via TBC"
  ↓
Bank transfer initiated (1-3 business days)
  ↓
Student notified: "Withdrawal approved"
```

### A.4 Project Subscription Access

```
New student enrolls in Course X (first course ever)
  ↓
System grants 1-month free project access (all courses)
  ↓
After 1 month, free access expires
  ↓
Student pays ₾10 project subscription via Keepz
  ↓
Admin approves → 1 month subscription activated
  ↓
Student can view and submit to all active projects
```
