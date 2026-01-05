# MainCourse Platform - Comprehensive Testing Guide

## Table of Contents
1. [Platform Overview](#platform-overview)
2. [Technical Stack](#technical-stack)
3. [User Roles & Permissions](#user-roles--permissions)
4. [Testing Prerequisites](#testing-prerequisites)
5. [Testing Instructions by Role](#testing-instructions-by-role)
   - [Admin Role Testing](#admin-role-testing)
   - [Lecturer Role Testing](#lecturer-role-testing)
   - [Student Role Testing](#student-role-testing)
6. [Feature-Specific Testing](#feature-specific-testing)
7. [Cross-Role Integration Testing](#cross-role-integration-testing)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [Performance & Security Testing](#performance--security-testing)

---

## Platform Overview

**MainCourse** is a Next.js-based Learning Management System (LMS) focused on online courses in:
- Video Editing
- Content Creation
- Website Creation

### Core Business Model
- **Students** pay to enroll in courses and can earn money through referrals
- **Lecturers** create courses, manage content, and set referral commission rates
- **Admins** approve enrollments and withdrawals, monitor platform activity
- **Currency**: Georgian Lari (₾)
- **Target Market**: Georgian audience (supports English and Georgian languages)

### Key Features
1. **Course Enrollment System** with admin approval workflow
2. **Referral Marketing System** with customizable commission rates (0-100%)
3. **Real-time Chat System** with text channels, lecture channels, and project channels
4. **Project Management** with student submissions and lecturer reviews
5. **Balance & Withdrawal System** with minimum withdrawal amount (₾20)
6. **Course Bundles** for purchasing multiple courses together
7. **Video Progress Tracking** for lecture completion
8. **Multilingual Support** (English/Georgian)
9. **Dark Mode** with animated backgrounds

---

## Technical Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context + SWR for data fetching
- **Real-time**: Supabase Realtime subscriptions

### Backend
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth (email/password)
- **Storage**: Supabase Storage (images, videos, documents)
- **Security**: Row Level Security (RLS) policies on all tables
- **Functions**: PostgreSQL stored procedures for critical operations

### Database Schema (Key Tables)
- `profiles` - User accounts with roles, balances, referral codes
- `courses` - Course catalog with pricing and metadata
- `enrollments` - Active student-course relationships
- `enrollment_requests` - Pending enrollment applications (requires admin approval)
- `channels` - Chat channels within courses
- `messages` - Chat messages with real-time sync
- `videos` - Lecture content in lecture channels
- `video_progress` - Student watch progress tracking
- `projects` - Project assignments created by lecturers
- `project_submissions` - Student project submissions
- `submission_reviews` - Lecturer feedback on submissions
- `referrals` - Tracks referral relationships and commissions
- `balance_transactions` - Complete audit trail of all balance changes
- `withdrawal_requests` - Student/lecturer withdrawal applications
- `course_bundles` - Bundled course offerings
- `muted_users` - User chat mute preferences

---

## User Roles & Permissions

### 1. STUDENT (Default Role)
**Permissions:**
- Browse public course catalog
- Submit enrollment requests with payment screenshots
- Use referral codes when enrolling
- Access enrolled course chats and content
- View lecture videos and track progress
- Submit projects in courses
- Invite others via personal referral code
- Earn referral commissions
- Request balance withdrawals (minimum ₾20)
- Manage profile and settings

**Restrictions:**
- Cannot create courses or channels
- Cannot approve enrollment/withdrawal requests
- Cannot access other students' personal data
- Cannot access courses they're not enrolled in

### 2. LECTURER
**Permissions:**
- All student permissions, plus:
- Create and manage courses
- Create and manage course channels
- Upload lecture videos
- Create project assignments
- Review and grade student submissions
- Set referral commission rates (0-100%) for their courses
- View enrolled students in their courses
- Access lecturer dashboard

**Restrictions:**
- Cannot approve enrollment/withdrawal requests (admin-only)
- Cannot modify other lecturers' courses
- Cannot access admin dashboard

### 3. ADMIN
**Permissions:**
- All lecturer permissions, plus:
- Approve/reject enrollment requests
- Approve/reject withdrawal requests
- View all courses across platform
- Access admin dashboard with analytics
- View all enrollment and withdrawal requests
- Monitor platform statistics

**Restrictions:**
- Admin role is hardcoded in database (cannot be self-assigned)
- Admins should not abuse permissions for personal gain

---

## Testing Prerequisites

### Required Accounts
You will need to create and test with the following accounts:

1. **Three Student Accounts**
   - Student A (for referral testing)
   - Student B (referred by Student A)
   - Student C (for enrollment testing without referral)

2. **Two Lecturer Accounts**
   - Lecturer 1 (creates Course A and Course B)
   - Lecturer 2 (creates Course C)

3. **One Admin Account**
   - Admin User (has admin role in database)

### Test Data Preparation
Before testing, ensure you have:
- Sample payment screenshots (PNG/JPG format) for enrollment requests
- Sample video files for lecture uploads
- Sample video URLs for project submissions
- Valid Georgian IBAN format for withdrawal testing: `GE[2 digits][2 letters][16 digits]`
- Example: `GE29NB0000000123456789`

### Browser Setup
- Use Chrome browser with Claude Code extension
- Clear cookies/localStorage between role switches to avoid session conflicts
- Open browser DevTools → Console to monitor real-time updates
- Enable network tab to check API responses

### Environment Setup
1. Access the platform at the base URL (localhost or deployed URL)
2. Ensure Supabase is running and accessible
3. Verify database has proper RLS policies enabled
4. Confirm all storage buckets are created and accessible

---

## Testing Instructions by Role

# ADMIN ROLE TESTING

## Setup
1. Log in with admin credentials
2. Verify you can access `/admin` route
3. Verify navigation shows "Admin Dashboard" link

---

## Section 1: Admin Dashboard Overview

### Test 1.1: Dashboard Access
- [ ] Navigate to `/admin`
- [ ] Verify page loads without errors
- [ ] Confirm you see dashboard tabs:
  - Overview
  - Enrollment Requests
  - Withdrawal Requests
  - All Courses

### Test 1.2: Overview Tab Statistics
- [ ] Click "Overview" tab
- [ ] Verify statistics display:
  - Total Courses
  - Total Students
  - Pending Enrollment Requests
  - Pending Withdrawal Requests
- [ ] Verify numbers are accurate (cross-check with database if possible)
- [ ] Check for any console errors

---

## Section 2: Enrollment Request Management

### Test 2.1: View Pending Enrollment Requests
- [ ] Switch to "Enrollment Requests" tab
- [ ] Verify list shows all pending enrollment requests
- [ ] Confirm each request displays:
  - Student name
  - Course name
  - Request date
  - Payment screenshots (multiple if uploaded)
  - Referral code used (if any)
- [ ] Click on payment screenshot thumbnails
- [ ] Verify full-size images open in modal/new tab
- [ ] Check image quality and visibility

### Test 2.2: Approve Enrollment Request WITHOUT Referral Code
- [ ] Create a test enrollment request as Student C (no referral code)
- [ ] As admin, find this request in the list
- [ ] Click "Approve" button
- [ ] Verify confirmation dialog appears
- [ ] Confirm approval
- [ ] Verify:
  - Request disappears from pending list
  - Student C now has access to course chat
  - Enrollment record created in database
  - No referral commission was processed
  - Student C can see course in their "My Courses" page

### Test 2.3: Approve Enrollment Request WITH Referral Code
- [ ] Create enrollment request as Student B using Student A's referral code
- [ ] Note Student A's balance before approval
- [ ] Note the course's referral commission percentage (e.g., 20%)
- [ ] Calculate expected commission: `course_price × (commission_percentage / 100)`
- [ ] As admin, approve this enrollment
- [ ] Verify:
  - Student B enrolled successfully
  - Student A's balance increased by exact commission amount
  - Balance transaction record created with:
    - transaction_type: `credit`
    - source: `referral_commission`
    - reference to enrollment
  - Referral record created linking Student A → Student B
  - Student B sees course in "My Courses"

### Test 2.4: Reject Enrollment Request
- [ ] Create test enrollment request as Student C
- [ ] As admin, click "Reject" button
- [ ] Enter rejection reason (admin notes)
- [ ] Confirm rejection
- [ ] Verify:
  - Request disappears from pending list
  - No enrollment created
  - Student cannot access course
  - Student can submit a new enrollment request for same course
  - Rejection reason is stored (check database)

### Test 2.5: Approve Enrollment for Course with 0% Commission
- [ ] Have Lecturer create a course with 0% referral commission
- [ ] Student B enrolls using Student A's referral code
- [ ] Admin approves enrollment
- [ ] Verify:
  - Enrollment succeeds
  - Student A's balance does NOT increase
  - Referral record still created (for tracking)
  - No balance transaction for commission

### Test 2.6: Approve Enrollment for Course with 100% Commission
- [ ] Have Lecturer create course priced at ₾100 with 100% commission
- [ ] Student B enrolls with Student A's code
- [ ] Admin approves
- [ ] Verify Student A receives full ₾100 as commission

### Test 2.7: Multiple Payment Screenshots
- [ ] Student uploads 3 payment screenshots
- [ ] Admin views enrollment request
- [ ] Verify all 3 screenshots are visible
- [ ] Click through each screenshot to verify quality
- [ ] Approve request and confirm it processes correctly

### Test 2.8: Filter Enrollment Requests
- [ ] If filtering exists, test filtering by:
  - Course
  - Student
  - Date range
  - Referral code presence
- [ ] Verify filtered results are accurate

---

## Section 3: Withdrawal Request Management

### Test 3.1: View Pending Withdrawal Requests
- [ ] Navigate to "Withdrawal Requests" tab
- [ ] Verify list shows pending withdrawals
- [ ] Confirm each request shows:
  - User name
  - User type (Student/Lecturer)
  - Amount requested
  - Bank account number (IBAN)
  - Current balance
  - Request date

### Test 3.2: Approve Valid Withdrawal Request
- [ ] Have Student A request withdrawal of ₾30 (above minimum)
- [ ] Note Student A's balance before approval (e.g., ₾50)
- [ ] As admin, approve withdrawal
- [ ] Verify:
  - Request status changes to "approved" or "completed"
  - Student A's balance decreases by ₾30
  - Balance transaction created with:
    - transaction_type: `debit`
    - source: `withdrawal`
  - Withdrawal request marked with admin's ID and timestamp
  - Student sees updated balance in settings

### Test 3.3: Reject Withdrawal Request
- [ ] Have Student B request withdrawal
- [ ] As admin, click "Reject"
- [ ] Enter rejection reason (e.g., "Invalid bank account")
- [ ] Confirm rejection
- [ ] Verify:
  - Request status changes to "rejected"
  - Student B's balance unchanged
  - No debit transaction created
  - Student can see rejection reason
  - Student can submit new withdrawal request

### Test 3.4: Attempt to Approve Withdrawal with Insufficient Balance
- [ ] Student C has ₾15 balance
- [ ] Student C requests ₾50 withdrawal
- [ ] Admin attempts to approve
- [ ] Verify:
  - System prevents approval (shows error)
  - OR approval succeeds but balance goes negative (this would be a bug)
  - Proper error handling exists

### Test 3.5: Minimum Withdrawal Amount Validation
- [ ] Student requests ₾19.99 (below ₾20 minimum)
- [ ] Verify system prevents request submission
- [ ] If request somehow gets through, admin should see warning
- [ ] Reject if invalid amount bypassed frontend validation

### Test 3.6: IBAN Format Validation
- [ ] Student enters invalid IBAN (e.g., missing characters)
- [ ] Verify frontend validation prevents submission
- [ ] If invalid IBAN reaches admin, verify it's flagged
- [ ] Test valid Georgian IBAN format: `GE29NB0000000123456789`

### Test 3.7: Lecturer Withdrawal Request
- [ ] Lecturer creates course and earns commission
- [ ] Lecturer requests withdrawal
- [ ] Admin approves
- [ ] Verify same process as student withdrawal works correctly

---

## Section 4: Course Management (Admin View)

### Test 4.1: View All Courses
- [ ] Navigate to "All Courses" tab
- [ ] Verify all courses from all lecturers are visible
- [ ] Confirm each course shows:
  - Title
  - Description
  - Course type (Editing/Content Creation/Website Creation)
  - Price and original price
  - Lecturer name
  - Enrollment count
  - Referral commission percentage
  - Creation date

### Test 4.2: Course Details Inspection
- [ ] Click on a course to view details
- [ ] Verify you can see:
  - All course metadata
  - Enrolled students list
  - Course channels
  - Lecture videos
  - Projects created
- [ ] Verify you can access course chat as admin

### Test 4.3: Course Statistics
- [ ] Check if admin can view:
  - Total enrollments per course
  - Revenue per course (enrollments × price)
  - Referral conversions per course
  - Average video completion rate

---

## Section 5: Bundle Management

### Test 5.1: View Bundle Enrollment Requests
- [ ] Create test bundle with 2-3 courses
- [ ] Have student request bundle enrollment
- [ ] Admin views bundle enrollment requests
- [ ] Verify request shows:
  - All courses in bundle
  - Bundle price
  - Payment screenshots
  - Student information

### Test 5.2: Approve Bundle Enrollment
- [ ] Approve bundle enrollment request
- [ ] Verify:
  - Individual enrollments created for EACH course in bundle
  - Student has access to all courses
  - All courses appear in student's "My Courses"
  - If referral code used, commission calculated on bundle price

### Test 5.3: Reject Bundle Enrollment
- [ ] Reject bundle enrollment request
- [ ] Verify:
  - No enrollments created for any course
  - Student cannot access any course in bundle
  - Can submit new bundle enrollment request

---

## Section 6: Admin Real-time Updates

### Test 6.1: Real-time Enrollment Request Notifications
- [ ] Open admin dashboard in one browser tab
- [ ] Open student account in another tab
- [ ] Student submits enrollment request
- [ ] Verify admin dashboard updates in real-time (without page refresh)
- [ ] Check if notification/badge appears for new request

### Test 6.2: Real-time Withdrawal Request Notifications
- [ ] Admin dashboard open
- [ ] Student submits withdrawal request in another tab
- [ ] Verify real-time update appears
- [ ] Check notification system

---

## Section 7: Admin Edge Cases

### Test 7.1: Approve Same Enrollment Twice
- [ ] Approve an enrollment request
- [ ] Attempt to approve it again (if UI allows)
- [ ] Verify system prevents duplicate enrollment
- [ ] Check for proper error handling

### Test 7.2: Delete/Modify Approved Enrollment
- [ ] Find an approved enrollment in database
- [ ] Attempt to delete or modify it via admin UI (if possible)
- [ ] Verify proper safeguards exist
- [ ] Confirm student access is not broken

### Test 7.3: Approve Enrollment for Deleted Course
- [ ] Create course, get enrollment request
- [ ] Delete course (if possible)
- [ ] Attempt to approve enrollment
- [ ] Verify proper error handling

### Test 7.4: Concurrent Admin Actions
- [ ] Open admin dashboard in two browsers (two admin accounts if possible)
- [ ] Both admins attempt to approve same enrollment simultaneously
- [ ] Verify:
  - Only one approval succeeds
  - No duplicate enrollments created
  - No double commission paid
  - Proper conflict handling

### Test 7.5: Invalid Referral Code in Enrollment Request
- [ ] Student submits enrollment with non-existent referral code
- [ ] Admin views request
- [ ] Verify referral code is flagged as invalid
- [ ] Approve enrollment
- [ ] Verify no commission is paid (no valid referrer)

### Test 7.6: Self-referral Attempt
- [ ] Student A uses their own referral code to enroll
- [ ] Admin reviews request
- [ ] Verify system flags self-referral
- [ ] If approved, verify no commission to self

### Test 7.7: Withdrawal Greater Than Balance
- [ ] Student has ₾50 balance
- [ ] Student requests ₾100 withdrawal
- [ ] Verify system prevents request OR flags it for admin
- [ ] Admin should not be able to approve

---

## Section 8: Admin Security Testing

### Test 8.1: Access Control Verification
- [ ] Log out of admin account
- [ ] Log in as regular student
- [ ] Attempt to access `/admin` directly via URL
- [ ] Verify access is denied (redirect to home or error page)
- [ ] Check for console errors revealing admin routes

### Test 8.2: API Endpoint Protection
- [ ] As student, attempt to call admin API endpoints directly:
  - `/api/admin/enrollment-requests/[id]/approve`
  - `/api/admin/withdrawal-requests/[id]/approve`
- [ ] Verify all requests return 401/403 errors
- [ ] Confirm no data is modified

### Test 8.3: RLS Policy Verification
- [ ] As admin, verify you can only modify data through proper API routes
- [ ] Attempt to directly modify database via Supabase client
- [ ] Confirm RLS policies enforce admin role checks

---

## Section 9: Admin User Experience

### Test 9.1: Mobile Responsiveness
- [ ] Resize browser to mobile width (375px)
- [ ] Navigate admin dashboard
- [ ] Verify:
  - Tables are scrollable/responsive
  - Buttons are touchable
  - Images load properly
  - No layout breaking

### Test 9.2: Admin Dashboard Performance
- [ ] Create 50+ pending enrollment requests
- [ ] Load admin dashboard
- [ ] Measure load time
- [ ] Verify pagination exists if needed
- [ ] Check for loading states

### Test 9.3: Search and Filter Functionality
- [ ] Test search functionality for:
  - Enrollment requests by student name
  - Withdrawal requests by amount
  - Courses by title
- [ ] Verify search results are accurate and instant

---

## Section 10: Admin Data Export (if exists)

### Test 10.1: Export Enrollment Requests
- [ ] Check if admin can export enrollment data
- [ ] Test export formats (CSV, Excel, PDF)
- [ ] Verify exported data matches dashboard data

### Test 10.2: Export Financial Reports
- [ ] Check if admin can export:
  - Balance transactions report
  - Withdrawal history
  - Referral commissions paid
- [ ] Verify accuracy of financial data

---

# LECTURER ROLE TESTING

## Setup
1. Create lecturer account or log in with existing lecturer credentials
2. Verify you can access `/lecturer/dashboard`
3. Note: Lecturers have all student permissions plus lecturer-specific features

---

## Section 1: Course Creation

### Test 1.1: Create New Course - Basic Info
- [ ] Navigate to `/lecturer/dashboard`
- [ ] Click "Create New Course" button
- [ ] Fill in course details:
  - Title: "Test Video Editing Course"
  - Description: "Learn professional video editing techniques"
  - Course type: Select "Editing"
  - Price: ₾150
  - Original price: ₾200 (for discount display)
- [ ] Verify form validation for required fields
- [ ] Submit course creation form
- [ ] Verify:
  - Course created successfully
  - Course appears in lecturer dashboard
  - Course visible on public `/courses` page
  - Course has auto-generated ID

### Test 1.2: Upload Course Thumbnail
- [ ] Select the course you just created
- [ ] Click "Upload Thumbnail" or similar option
- [ ] Upload image file (test PNG, JPG formats)
- [ ] Verify:
  - Image uploads to Supabase storage bucket `course-thumbnails`
  - Thumbnail displays correctly on course card
  - Image dimensions are appropriate
  - Thumbnail shows on public course listing

### Test 1.3: Set Referral Commission Percentage
- [ ] Edit course settings
- [ ] Set referral commission to 25%
- [ ] Save changes
- [ ] Verify:
  - Commission percentage saved correctly
  - Value displays in course details
  - When student enrolls with referral, 25% of ₾150 (₾37.50) will be paid

### Test 1.4: Create Course with Different Types
- [ ] Create course with type "Content Creation"
- [ ] Create course with type "Website Creation"
- [ ] Verify:
  - All three types filter correctly on `/courses` page
  - Type badges display correctly
  - Type-specific features work (if any)

### Test 1.5: Course Metadata
- [ ] Add intro video URL (YouTube or uploaded)
- [ ] Add author/creator information
- [ ] Save metadata
- [ ] Verify metadata displays on course page

### Test 1.6: Edit Existing Course
- [ ] Click "Edit" on existing course
- [ ] Change title, description, price
- [ ] Save changes
- [ ] Verify:
  - Changes reflected immediately
  - Existing enrollments not affected
  - New price applies to new enrollments only

### Test 1.7: Delete Course (if possible)
- [ ] Create test course
- [ ] Attempt to delete it
- [ ] If deletion allowed, verify:
  - Course removed from listings
  - Existing enrollments handled properly
  - Student access revoked or grandfathered
- [ ] If deletion blocked with enrollments, verify proper error message

---

## Section 2: Channel Management

### Test 2.1: View Default Channels
- [ ] Create new course
- [ ] Verify default channels are auto-created:
  - General (text channel)
  - Announcements (text channel)
  - Lectures (lectures channel)
  - Projects (text channel)
- [ ] Verify each channel is accessible

### Test 2.2: Create Custom Text Channel
- [ ] Navigate to course channel management
- [ ] Click "Create Channel"
- [ ] Set:
  - Name: "Resources"
  - Type: Text
  - Description: "Share useful resources here"
  - Category: "Information" (if categories exist)
- [ ] Create channel
- [ ] Verify:
  - Channel appears in course sidebar
  - Enrolled students can see it
  - Channel is empty (no messages)

### Test 2.3: Create Lecture Channel
- [ ] Create channel named "Advanced Techniques"
- [ ] Set type to "Lectures"
- [ ] Save channel
- [ ] Verify:
  - Channel has lecture video interface
  - Can upload videos to this channel
  - Students see video player instead of text chat

### Test 2.4: Reorder Channels
- [ ] If drag-and-drop reordering exists, test it
- [ ] Change display order of channels
- [ ] Verify:
  - Order persists after page reload
  - Students see same order
  - Order saved in `display_order` field

### Test 2.5: Edit Channel
- [ ] Edit existing channel name and description
- [ ] Save changes
- [ ] Verify changes reflected in sidebar and channel view

### Test 2.6: Delete Channel
- [ ] Create test channel
- [ ] Delete it
- [ ] Verify:
  - Channel removed from sidebar
  - Messages deleted or archived
  - Students no longer see channel
- [ ] Attempt to delete default channel
- [ ] Verify system prevents deletion of essential channels

---

## Section 3: Lecture Video Management

### Test 3.1: Upload Lecture Video
- [ ] Navigate to "Lectures" channel
- [ ] Click "Add Video" or "Upload Lecture"
- [ ] Fill in video details:
  - Title: "Introduction to Video Editing"
  - Description: "Learn the basics"
  - Video URL or upload file
  - Duration: 15:30 (15 minutes 30 seconds)
- [ ] Upload video thumbnail
- [ ] Set display order: 1
- [ ] Publish video
- [ ] Verify:
  - Video appears in lectures channel
  - Thumbnail displays correctly
  - Duration shows correctly
  - Students can access and play video

### Test 3.2: Video Upload Formats
- [ ] Test uploading videos in different formats:
  - MP4 (should work)
  - MOV (should work)
  - AVI (may work depending on browser support)
  - WebM (should work)
- [ ] Verify:
  - Supported formats upload successfully
  - Unsupported formats show error message
  - Video plays in browser

### Test 3.3: Video from URL
- [ ] Instead of uploading, provide video URL:
  - YouTube URL: `https://www.youtube.com/watch?v=...`
  - Vimeo URL: `https://vimeo.com/...`
  - Direct video file URL
- [ ] Verify:
  - Video embeds correctly
  - Play controls work
  - Thumbnail extracts automatically (if supported)

### Test 3.4: Unpublish Video
- [ ] Create video but don't publish (if option exists)
- [ ] Verify:
  - Lecturer can see it in draft mode
  - Students cannot see unpublished video
- [ ] Publish video
- [ ] Verify students can now see it

### Test 3.5: Edit Video Details
- [ ] Edit existing lecture video
- [ ] Change title, description, thumbnail
- [ ] Save changes
- [ ] Verify:
  - Changes reflected immediately
  - Student progress not reset
  - Video continues from saved progress

### Test 3.6: Delete Video
- [ ] Delete lecture video
- [ ] Verify:
  - Video removed from channel
  - Student progress deleted
  - Thumbnail removed from storage

### Test 3.7: Video Progress Tracking (Lecturer View)
- [ ] Check if lecturer can view:
  - Which students watched which videos
  - Completion percentages per video
  - Average watch time
- [ ] Verify analytics accuracy

### Test 3.8: Reorder Lecture Videos
- [ ] Create 5 videos with different display orders
- [ ] Change display order
- [ ] Verify:
  - Videos reorder in UI
  - Order persists
  - Students see same order

---

## Section 4: Project Creation & Management

### Test 4.1: Create Basic Project
- [ ] Navigate to "Projects" channel
- [ ] Click "Create Project" (may be via message or dedicated button)
- [ ] Fill in project details:
  - Name: "Product Advertisement Video"
  - Description: "Create a 30-second ad for a product"
  - Budget: ₾50
  - Start date: Today
  - End date: 7 days from now
- [ ] Submit project
- [ ] Verify:
  - Project posts as message in projects channel
  - Project details visible to all enrolled students
  - Project appears in projects list

### Test 4.2: Set View Requirements
- [ ] Create project with view requirements:
  - Minimum views: 1000
  - Maximum views: 5000
- [ ] Specify platforms:
  - ✓ TikTok
  - ✓ Instagram
  - ✓ YouTube
- [ ] Save project
- [ ] Verify:
  - Students see view requirements
  - Platform checkboxes work
  - Students can submit for each platform

### Test 4.3: Create Evaluation Criteria
- [ ] Add custom evaluation criteria (JSON format):
  ```json
  [
    {"criterion": "Video Quality", "max_score": 25},
    {"criterion": "Creativity", "max_score": 25},
    {"criterion": "Engagement", "max_score": 25},
    {"criterion": "Technical Execution", "max_score": 25}
  ]
  ```
- [ ] Save criteria
- [ ] Verify:
  - Criteria display in project details
  - Total max score = 100
  - Students see what they'll be graded on

### Test 4.4: Project with Video Link Requirement
- [ ] Create project requiring:
  - Video link (URL to uploaded video)
  - Platform links (TikTok, Instagram, YouTube)
- [ ] Verify:
  - Students can submit links in submission form
  - Links are validated (proper URL format)

### Test 4.5: Edit Project After Creation
- [ ] Edit existing project
- [ ] Change deadline, budget, description
- [ ] Save changes
- [ ] Verify:
  - Changes reflected in project message
  - Students see updated information
  - Existing submissions not affected

### Test 4.6: Delete Project
- [ ] Delete a project
- [ ] Verify:
  - Project message removed or marked deleted
  - Student submissions preserved or deleted (based on design)
  - Students notified if needed

---

## Section 5: Reviewing Student Project Submissions

### Test 5.1: View Submitted Projects
- [ ] After students submit projects, navigate to submissions
- [ ] Verify you can see:
  - Student name
  - Submission date
  - Video URL or uploaded file
  - Platform links (TikTok/Instagram/YouTube)
  - Message from student

### Test 5.2: Create Review for Submission
- [ ] Click "Review" on a submission
- [ ] Enter scores for each criterion:
  - Video Quality: 20/25
  - Creativity: 22/25
  - Engagement: 18/25
  - Technical Execution: 23/25
  - Total: 83/100
- [ ] Write feedback: "Great work! Improve audio quality next time."
- [ ] Select platform reviewed: TikTok
- [ ] Mark as approved: Yes
- [ ] Submit review
- [ ] Verify:
  - Review saved to database
  - Student sees review in chat
  - Score calculated correctly
  - Approval status visible

### Test 5.3: Review Multiple Platforms
- [ ] Student submits same project to TikTok, Instagram, YouTube
- [ ] Create separate review for each platform
- [ ] Verify:
  - Three separate review records created
  - Each platform review independent
  - Student sees all three reviews
  - Scores can differ per platform

### Test 5.4: Reject Submission
- [ ] Review a submission
- [ ] Mark as NOT approved
- [ ] Provide feedback: "Needs more creativity, please resubmit"
- [ ] Save review
- [ ] Verify:
  - Student sees rejection
  - Student can resubmit
  - Original submission preserved

### Test 5.5: Edit Review
- [ ] After submitting review, edit it
- [ ] Change score and feedback
- [ ] Save changes
- [ ] Verify:
  - Updated review visible to student
  - Timestamp updated (edited_at)
  - Revision history preserved (if exists)

### Test 5.6: Bulk Review (if feature exists)
- [ ] Select multiple submissions
- [ ] Approve/reject in bulk
- [ ] Verify all selected submissions processed

---

## Section 6: Course Chat & Communication (Lecturer View)

### Test 6.1: Send Message in Text Channel
- [ ] Navigate to "General" channel
- [ ] Type message: "Welcome to the course!"
- [ ] Send message
- [ ] Verify:
  - Message appears in chat
  - Timestamp correct
  - Lecturer name/avatar displays
  - Students receive message in real-time

### Test 6.2: Send Message with Attachments
- [ ] Upload image attachment
- [ ] Upload document (PDF)
- [ ] Send message with attachments
- [ ] Verify:
  - Files upload to `chat-media` bucket
  - Attachments display as thumbnails/links
  - Students can download/view attachments
  - File size limits enforced

### Test 6.3: Reply to Student Message
- [ ] Student posts question in channel
- [ ] Click "Reply" on student message
- [ ] Type response
- [ ] Send reply
- [ ] Verify:
  - Reply threads correctly (shows parent message)
  - Student receives notification
  - Thread displays in chat

### Test 6.4: Edit Lecturer Message
- [ ] Send message
- [ ] Click "Edit" (within edit time limit if exists)
- [ ] Modify message text
- [ ] Save edit
- [ ] Verify:
  - Message updated in chat
  - "Edited" indicator appears
  - Edit timestamp stored
  - Students see edited message

### Test 6.5: Delete Lecturer Message
- [ ] Send test message
- [ ] Delete message
- [ ] Verify:
  - Message removed from chat
  - OR message shows as "Message deleted"
  - Students can no longer see content
  - Replies to deleted message handled properly

### Test 6.6: Pin Important Messages (if feature exists)
- [ ] Pin an announcement message
- [ ] Verify:
  - Pinned message stays at top of channel
  - Students can always see pinned messages
  - Multiple pins handled correctly

### Test 6.7: Typing Indicators
- [ ] Start typing message but don't send
- [ ] Verify:
  - Students see "Lecturer is typing..." indicator
  - Indicator disappears after 5 seconds of inactivity
  - Real-time sync works

### Test 6.8: Real-time Message Reception
- [ ] Open student account in another browser
- [ ] Student sends message
- [ ] Verify lecturer receives message instantly without refresh
- [ ] Check Supabase Realtime subscription works

---

## Section 7: Student Management (Lecturer View)

### Test 7.1: View Enrolled Students
- [ ] Navigate to course members sidebar
- [ ] Verify you can see:
  - All enrolled students (approved enrollments only)
  - Student names
  - Student avatars (if uploaded)
  - Enrollment date
- [ ] Verify pending enrollments NOT visible (admin-only)

### Test 7.2: View Student Profiles
- [ ] Click on student name
- [ ] Verify you can view:
  - Student username
  - Student profile info
  - Course progress (videos watched)
  - Project submissions from this student
- [ ] Verify you cannot see:
  - Student balance
  - Student referral earnings
  - Student personal data (bank account, etc.)

### Test 7.3: Student Progress Tracking
- [ ] View student's video progress
- [ ] Verify:
  - Percentage completion per video
  - Total course completion percentage
  - Last watched date
  - Which videos completed vs in-progress

### Test 7.4: Student Submission History
- [ ] View all submissions by a student
- [ ] Verify:
  - Chronological list of submissions
  - Scores and feedback for each
  - Submission dates
  - Platform links

---

## Section 8: Course Analytics (Lecturer Dashboard)

### Test 8.1: Course Statistics Overview
- [ ] Navigate to lecturer dashboard
- [ ] For each course, verify you can see:
  - Total enrollments
  - Pending enrollment requests (if visible to lecturer)
  - Total revenue (enrollments × price)
  - Average video completion rate
  - Student engagement metrics

### Test 8.2: Revenue Tracking
- [ ] Check if lecturer can see:
  - Total earnings from course sales
  - Referral commissions paid out (cost)
  - Net revenue
  - Monthly revenue trends

### Test 8.3: Engagement Metrics
- [ ] View:
  - Most watched videos
  - Least watched videos
  - Average watch time per video
  - Message activity in channels
  - Project submission rate

### Test 8.4: Student Retention
- [ ] Check if dashboard shows:
  - Active students (logged in recently)
  - Inactive students
  - Course completion rate

---

## Section 9: Referral Commission Settings

### Test 9.1: Update Commission Percentage
- [ ] Edit course settings
- [ ] Change referral commission from 25% to 50%
- [ ] Save changes
- [ ] Verify:
  - New enrollments use 50% rate
  - Old referrals honored at original rate (if designed that way)
  - Commission rate displays correctly on course page

### Test 9.2: Set Commission to 0%
- [ ] Set referral commission to 0%
- [ ] Student enrolls with referral code
- [ ] Admin approves
- [ ] Verify:
  - No commission paid to referrer
  - Enrollment succeeds normally
  - Referral tracking still works

### Test 9.3: Set Commission to 100%
- [ ] Set commission to 100%
- [ ] Student enrolls with referral
- [ ] Admin approves
- [ ] Verify:
  - Full course price paid to referrer
  - Lecturer still receives payment (from platform)
  - System handles 100% commission

### Test 9.4: Invalid Commission Values
- [ ] Attempt to set commission to -10%
- [ ] Attempt to set commission to 150%
- [ ] Verify:
  - Frontend validation prevents invalid values
  - Backend rejects invalid values
  - Proper error messages shown

---

## Section 10: Bundle Creation (Lecturer)

### Test 10.1: Create Course Bundle
- [ ] Navigate to bundle creation
- [ ] Fill bundle details:
  - Title: "Complete Content Creator Bundle"
  - Description: "All courses for content creation"
  - Select courses: Course A, Course B
  - Bundle price: ₾250 (cheaper than ₾150 + ₾150 = ₾300)
  - Original price: ₾300
- [ ] Save bundle
- [ ] Verify:
  - Bundle appears on bundles page
  - Bundle shows discount percentage
  - All selected courses listed

### Test 10.2: Edit Bundle
- [ ] Edit existing bundle
- [ ] Add or remove courses
- [ ] Change price
- [ ] Save changes
- [ ] Verify:
  - Changes reflected on bundle page
  - Existing bundle enrollments not affected

### Test 10.3: Deactivate Bundle
- [ ] Set bundle to inactive
- [ ] Verify:
  - Bundle no longer visible to students
  - Direct link shows "Bundle unavailable"
  - Existing enrollments still valid

---

## Section 11: Lecturer Balance & Withdrawals

### Test 11.1: View Balance
- [ ] Navigate to `/settings` or lecturer dashboard
- [ ] Verify you can see:
  - Current balance
  - Balance history (transactions)
  - Pending withdrawals
  - Completed withdrawals

### Test 11.2: Request Withdrawal
- [ ] Ensure balance ≥ ₾20
- [ ] Navigate to withdrawal section
- [ ] Enter:
  - Amount: ₾50
  - Bank account (IBAN): `GE29NB0000000123456789`
- [ ] Submit withdrawal request
- [ ] Verify:
  - Request created with status "pending"
  - Balance not yet deducted
  - Request visible in admin dashboard
  - Lecturer sees pending status

### Test 11.3: View Balance Transactions
- [ ] Navigate to balance history
- [ ] Verify you can see:
  - All credits (course sales, referrals if lecturer also refers)
  - All debits (withdrawals)
  - Transaction dates
  - Transaction sources
  - Running balance

---

## Section 12: Lecturer as Student (Dual Role)

### Test 12.1: Enroll in Another Lecturer's Course
- [ ] As Lecturer 1, enroll in Lecturer 2's course
- [ ] Verify:
  - Enrollment process same as regular student
  - Can access course content
  - Can submit projects
  - Lecturer 1 still has lecturer dashboard access

### Test 12.2: Use Referral Code as Lecturer
- [ ] Lecturer 1 gets referral code
- [ ] Lecturer 2 uses code to enroll in course
- [ ] Admin approves
- [ ] Verify:
  - Lecturer 1 earns referral commission
  - Commission added to balance
  - Lecturer 1 can withdraw earnings

### Test 12.3: Lecturer Balance from Multiple Sources
- [ ] Lecturer earns money from:
  - Course sales (platform payout)
  - Referral commissions
- [ ] Verify:
  - All sources tracked separately in transactions
  - Total balance accurate
  - Can withdraw combined balance

---

## Section 13: Lecturer Edge Cases

### Test 13.1: Create Course with Same Name
- [ ] Create course named "Video Editing 101"
- [ ] Create another course with identical name
- [ ] Verify:
  - System allows (courses have unique IDs)
  - OR system warns about duplicate name
  - Both courses distinguishable

### Test 13.2: Upload Very Large Video
- [ ] Attempt to upload video > 500MB
- [ ] Verify:
  - Upload shows progress bar
  - OR system rejects file (size limit)
  - Proper error message if too large
  - Timeout handling for long uploads

### Test 13.3: Create Project with Past End Date
- [ ] Create project with end date in the past
- [ ] Verify:
  - Frontend validation prevents submission
  - OR backend rejects with error
  - Proper date validation

### Test 13.4: Review Submission After Deadline
- [ ] Project deadline passes
- [ ] Student submits late
- [ ] Lecturer reviews late submission
- [ ] Verify:
  - Late submissions flagged
  - Lecturer can still review
  - OR late submissions blocked

### Test 13.5: Delete Course with Enrollments
- [ ] Course has 10 enrolled students
- [ ] Attempt to delete course
- [ ] Verify:
  - System prevents deletion (shows error)
  - OR allows deletion but student access handled
  - Proper warning message

### Test 13.6: Concurrent Video Uploads
- [ ] Upload 3 videos simultaneously
- [ ] Verify:
  - All uploads succeed
  - No file overwrites
  - Unique filenames generated
  - All videos playable

---

## Section 14: Lecturer Security Testing

### Test 14.1: Access Another Lecturer's Course
- [ ] Log in as Lecturer 1
- [ ] Attempt to edit Lecturer 2's course via direct URL
- [ ] Verify:
  - Access denied (403 error)
  - Cannot modify other's content
  - RLS policies prevent unauthorized access

### Test 14.2: Impersonate Admin
- [ ] As lecturer, attempt to access `/admin` route
- [ ] Attempt to call admin API endpoints
- [ ] Verify:
  - All admin routes blocked
  - API returns 401/403 errors
  - No data leakage

### Test 14.3: XSS Prevention in Messages
- [ ] Send message with script tag: `<script>alert('XSS')</script>`
- [ ] Verify:
  - Script does not execute
  - Content escaped/sanitized
  - Displayed as plain text

---

# STUDENT ROLE TESTING

## Setup
1. Create multiple student accounts (Student A, B, C)
2. Ensure test courses exist (created by lecturers)
3. Prepare payment screenshots for enrollment

---

## Section 1: Account Creation & Authentication

### Test 1.1: Sign Up Without Referral Code
- [ ] Navigate to `/signup`
- [ ] Fill in:
  - Email: `student-test@example.com`
  - Username: `student_test` (3-30 chars, alphanumeric + underscore)
  - Full name: "Test Student"
  - Password: minimum 6 characters
- [ ] Leave referral code field empty
- [ ] Submit signup form
- [ ] Verify:
  - Account created successfully
  - Profile created in database
  - Default role is "student"
  - Auto-generated unique referral code assigned
  - `signup_referral_code` is NULL
  - `referred_for_course_id` is NULL
  - Redirected to homepage or dashboard

### Test 1.2: Sign Up WITH General Referral Code
- [ ] Get Student A's referral code (8-character code)
- [ ] Sign up as Student B
- [ ] Enter Student A's code in referral field
- [ ] Complete signup
- [ ] Verify:
  - Account created
  - `signup_referral_code` = Student A's code
  - `referred_for_course_id` is NULL (no specific course)
  - No commission paid yet (only on enrollment)

### Test 1.3: Sign Up WITH Course-Specific Referral Link
- [ ] Get course-specific referral link: `/signup?ref=XXXXXXXX&course=course-id-123`
- [ ] Visit this link
- [ ] Complete signup
- [ ] Verify:
  - `signup_referral_code` = referral code
  - `referred_for_course_id` = course-id-123
  - `first_login_completed` = FALSE
- [ ] After login, verify:
  - Popup appears recommending the specific course
  - Popup shows course details
  - Can enroll directly from popup

### Test 1.4: First Login Course Popup
- [ ] Log in for the first time as student from Test 1.3
- [ ] Verify:
  - Popup modal appears
  - Shows recommended course info
  - "Enroll Now" button present
  - Can dismiss popup
  - After dismissal, `first_login_completed` = TRUE
  - Popup never shows again

### Test 1.5: Username Validation
- [ ] Attempt signup with username < 3 characters: `ab`
- [ ] Verify error: "Username must be 3-30 characters"
- [ ] Attempt signup with username > 30 characters
- [ ] Verify error shown
- [ ] Attempt signup with special characters: `user@name!`
- [ ] Verify error: "Only alphanumeric and underscore allowed"
- [ ] Attempt signup with duplicate username
- [ ] Verify error: "Username already taken"

### Test 1.6: Password Validation
- [ ] Attempt signup with password < 6 characters: `12345`
- [ ] Verify error: "Password must be at least 6 characters"
- [ ] Use valid password ≥ 6 characters
- [ ] Verify signup succeeds

### Test 1.7: Email Validation
- [ ] Attempt signup with invalid email: `notanemail`
- [ ] Verify error: "Invalid email format"
- [ ] Attempt signup with duplicate email
- [ ] Verify error: "Email already registered"

### Test 1.8: Login
- [ ] Navigate to `/login`
- [ ] Enter email and password
- [ ] Click "Login"
- [ ] Verify:
  - Redirect to homepage or dashboard
  - Session created (check cookies)
  - User info loaded
  - Navigation shows user avatar/name

### Test 1.9: Logout
- [ ] Click logout button
- [ ] Verify:
  - Session cleared
  - Redirected to homepage
  - Cannot access protected routes
  - Navigation shows login/signup buttons

### Test 1.10: Password Reset
- [ ] Click "Forgot Password" on login page
- [ ] Enter email
- [ ] Submit reset request
- [ ] Verify:
  - Reset email sent (check inbox or Supabase logs)
  - Reset link works
  - Can set new password
  - Can login with new password

---

## Section 2: Browse & Explore Courses

### Test 2.1: View All Courses
- [ ] Navigate to `/courses`
- [ ] Verify you can see:
  - All published courses
  - Course thumbnails
  - Course titles
  - Course descriptions (truncated)
  - Prices and original prices (with discount %)
  - Course types (badges)
  - Lecturer names
  - Ratings (if available)
  - "Bestseller" badges (if applicable)

### Test 2.2: Filter Courses by Type
- [ ] Click "All" filter
- [ ] Verify all courses shown
- [ ] Click "Editing" filter
- [ ] Verify only Editing courses shown
- [ ] Click "Content Creation" filter
- [ ] Verify only Content Creation courses shown
- [ ] Click "Website Creation" filter
- [ ] Verify only Website Creation courses shown

### Test 2.3: Search Courses
- [ ] If search exists, type "Video"
- [ ] Verify:
  - Results filter in real-time
  - Courses with "Video" in title/description shown
  - Other courses hidden

### Test 2.4: View Course Details
- [ ] Click on a course card
- [ ] Verify course detail page shows:
  - Full description
  - Intro video (if available)
  - Course curriculum/outline
  - Lecturer info
  - Price
  - Enrollment button
  - Reviews/ratings

### Test 2.5: View Course Without Login
- [ ] Log out
- [ ] Browse `/courses` page
- [ ] Verify:
  - Courses visible to public
  - Click "Enroll" redirects to login page
  - After login, redirected back to course enrollment

---

## Section 3: Course Enrollment Process

### Test 3.1: Start Enrollment Wizard
- [ ] Log in as Student C
- [ ] Navigate to course page
- [ ] Click "Enroll Now"
- [ ] Verify:
  - Enrollment wizard/modal opens
  - Shows course overview (Step 1)
  - Shows course price
  - Shows what's included

### Test 3.2: Enrollment Step 2 - Referral Code (Optional)
- [ ] Proceed to Step 2
- [ ] Leave referral code field empty
- [ ] Proceed to Step 3
- [ ] Verify:
  - Can skip referral code
  - No error shown
- [ ] Go back to Step 2
- [ ] Enter Student A's referral code
- [ ] Verify:
  - Code validated in real-time (green checkmark or similar)
  - Shows "Valid code" message
- [ ] Enter invalid code: `INVALID123`
- [ ] Verify:
  - Shows "Invalid code" error
  - Cannot proceed until valid or empty

### Test 3.3: Enrollment Step 3 - Payment Screenshots
- [ ] Proceed to Step 3 (payment upload)
- [ ] Upload 1 payment screenshot (PNG/JPG)
- [ ] Verify:
  - Image preview shown
  - File size validated (e.g., max 5MB)
  - Can remove and re-upload
- [ ] Upload 3 payment screenshots
- [ ] Verify:
  - All 3 previewed
  - Can remove individual images
  - Max limit enforced (if exists)

### Test 3.4: Enrollment Step 4 - Review and Submit
- [ ] Proceed to Step 4 (review)
- [ ] Verify summary shows:
  - Course name
  - Price
  - Referral code used (if any)
  - Payment screenshots (thumbnails)
- [ ] Click "Submit Enrollment Request"
- [ ] Verify:
  - Request submitted successfully
  - `enrollment_requests` record created with status "pending"
  - Payment screenshots uploaded to `payment-screenshots` bucket
  - Referral code stored in request
  - Success message shown
  - Redirected to "My Courses" or course page

### Test 3.5: Pending Enrollment Status
- [ ] After submitting request, navigate to course page
- [ ] Verify:
  - "Enrollment Pending" status shown
  - Cannot access course content yet
  - Shows "Your request is being reviewed by admin"
  - Option to cancel request (if exists)

### Test 3.6: Enrollment Approved by Admin
- [ ] Admin approves enrollment request
- [ ] Verify:
  - Enrollment record created
  - Student can now access course
  - Course appears in "My Courses"
  - Can access course chat channels
  - If referral used, referrer's balance increased

### Test 3.7: Enrollment Rejected by Admin
- [ ] Submit enrollment request
- [ ] Admin rejects with reason: "Invalid payment screenshot"
- [ ] Verify:
  - Student sees rejection notification
  - Shows admin's rejection reason
  - Can submit new enrollment request
  - Old request marked as rejected

### Test 3.8: Enroll in Same Course Twice
- [ ] After enrolled in course, attempt to enroll again
- [ ] Verify:
  - System prevents duplicate enrollment
  - Shows "Already enrolled" message
  - OR hides enrollment button

### Test 3.9: Enroll in Multiple Courses
- [ ] Enroll in Course A (with referral)
- [ ] Enroll in Course B (without referral)
- [ ] Enroll in Course C (with different referral)
- [ ] Verify:
  - All three enrollment requests created separately
  - Each tracked independently
  - Can have different referral codes
  - All appear in "My Courses" after approval

---

## Section 4: My Courses & Course Access

### Test 4.1: View My Courses
- [ ] Navigate to `/my-courses`
- [ ] Verify you see:
  - All enrolled courses (approved enrollments only)
  - Course thumbnails
  - Course titles
  - Progress percentage (if tracked)
  - "Continue Learning" buttons

### Test 4.2: Access Course Chat
- [ ] Click on enrolled course
- [ ] OR navigate to `/courses/[courseId]/chat`
- [ ] Verify:
  - Course chat interface loads
  - Left sidebar shows list of courses
  - Middle sidebar shows course channels
  - Right sidebar shows course members
  - Main area shows chat messages

### Test 4.3: Channel Sidebar
- [ ] Verify channel sidebar shows:
  - All channels for the course
  - Channel categories (if organized)
  - Channel types (text, lectures, voice icons)
  - Unread message indicators (counts or dots)
- [ ] Click on different channels
- [ ] Verify:
  - Channel switches without page reload
  - Messages load for selected channel
  - Active channel highlighted

### Test 4.4: Server Sidebar (Courses List)
- [ ] Verify server sidebar shows:
  - All enrolled courses
  - Course icons/thumbnails
  - Unread indicators per course
- [ ] Click on different courses
- [ ] Verify:
  - Switches to that course's channels
  - Loads correct channel list
  - Active course highlighted

### Test 4.5: Members Sidebar
- [ ] Verify members sidebar shows:
  - Lecturer (with special badge/role)
  - All enrolled students
  - Online status indicators (if implemented)
  - Avatars and usernames

---

## Section 5: Chat Functionality (Student View)

### Test 5.1: Send Text Message
- [ ] Select a text channel (e.g., "General")
- [ ] Type message: "Hello everyone!"
- [ ] Press Enter or click Send
- [ ] Verify:
  - Message appears in chat
  - Your username and avatar shown
  - Timestamp displayed
  - Other students receive message in real-time

### Test 5.2: Send Message with Emoji
- [ ] Type message with emoji: "Great course! 🎉🎓"
- [ ] Send message
- [ ] Verify:
  - Emoji renders correctly
  - No encoding issues

### Test 5.3: Send Long Message
- [ ] Type message with 500+ characters
- [ ] Send message
- [ ] Verify:
  - Full message sent (or character limit enforced)
  - Message wraps properly in UI
  - Scrolling works

### Test 5.4: Send Message with Attachment
- [ ] Click attachment/upload button
- [ ] Upload image (PNG/JPG)
- [ ] Send message with image
- [ ] Verify:
  - Image uploads to `chat-media` bucket
  - Thumbnail/preview shown in chat
  - Click on image opens full-size view
  - Download option available
- [ ] Upload PDF document
- [ ] Verify document link works

### Test 5.5: Reply to Message
- [ ] Hover over lecturer or student message
- [ ] Click "Reply" button
- [ ] Type reply
- [ ] Send
- [ ] Verify:
  - Reply threads correctly
  - Shows parent message quote
  - Click on parent message scrolls to original
  - Thread indicator visible

### Test 5.6: Edit Own Message
- [ ] Send a message
- [ ] Click "Edit" option (if within edit time window)
- [ ] Modify message text
- [ ] Save edit
- [ ] Verify:
  - Message updated in chat
  - "Edited" label appears
  - Edit timestamp stored
  - Cannot edit other users' messages

### Test 5.7: Delete Own Message
- [ ] Send test message
- [ ] Click "Delete"
- [ ] Confirm deletion
- [ ] Verify:
  - Message removed OR shows "Message deleted"
  - Cannot delete other users' messages
  - Replies to deleted message handled

### Test 5.8: Real-time Message Reception
- [ ] Open course chat in two browsers (two student accounts)
- [ ] Student A sends message
- [ ] Verify Student B receives instantly without refresh
- [ ] Check Supabase Realtime subscription active
- [ ] Verify no lag or delays

### Test 5.9: Typing Indicators
- [ ] Student A starts typing (don't send)
- [ ] Verify Student B sees "Student A is typing..."
- [ ] Student A stops typing
- [ ] Verify indicator disappears after ~3-5 seconds
- [ ] Multiple students typing simultaneously
- [ ] Verify shows "Student A, Student B are typing..."

### Test 5.10: Unread Message Tracking
- [ ] Student B sends 5 messages in "General" channel
- [ ] Student A is in different channel
- [ ] Verify:
  - "General" channel shows unread badge (count: 5)
  - Server sidebar shows course unread indicator
- [ ] Student A clicks on "General" channel
- [ ] Verify:
  - Unread count resets to 0
  - Badge disappears

### Test 5.11: Scroll to Load Old Messages
- [ ] Navigate to channel with 100+ messages
- [ ] Scroll to top
- [ ] Verify:
  - Older messages load (pagination/infinite scroll)
  - Smooth scrolling experience
  - No duplicate messages

---

## Section 6: Lectures & Video Watching

### Test 6.1: Access Lectures Channel
- [ ] Click on "Lectures" channel
- [ ] Verify:
  - Shows video player interface (not chat)
  - Lists all lecture videos
  - Videos ordered by display_order
  - Thumbnails visible

### Test 6.2: Play Lecture Video
- [ ] Click on first lecture video
- [ ] Verify:
  - Video player loads
  - Video plays
  - Controls work (play, pause, volume, fullscreen)
  - Duration displays correctly

### Test 6.3: Video Progress Tracking
- [ ] Watch video for 5 minutes
- [ ] Navigate away from video
- [ ] Return to same video
- [ ] Verify:
  - Video resumes from where you left off (5 minutes)
  - Progress saved in `video_progress` table
  - Progress bar shows watched portion

### Test 6.4: Complete Video
- [ ] Watch video to the end (or skip to end)
- [ ] Verify:
  - Video marked as "completed"
  - Checkmark or badge appears on video
  - Course progress percentage updates
  - `video_progress.completed` = TRUE

### Test 6.5: Watch Multiple Videos
- [ ] Watch 3 out of 10 videos completely
- [ ] Verify:
  - Course completion shows 30%
  - Each video's status tracked independently
  - Can see which videos are unwatched vs watched

### Test 6.6: Video Quality Settings
- [ ] If video player has quality settings, change quality
- [ ] Verify:
  - Video switches to selected quality
  - Playback continues smoothly

### Test 6.7: Fullscreen Mode
- [ ] Click fullscreen button
- [ ] Verify:
  - Video goes fullscreen
  - Controls still accessible
  - Exit fullscreen works

### Test 6.8: Different Video Formats
- [ ] Play MP4 video
- [ ] Play WebM video (if exists)
- [ ] Play embedded YouTube video
- [ ] Verify all formats play correctly

---

## Section 7: Projects & Submissions

### Test 7.1: View Project Assignment
- [ ] Navigate to "Projects" channel
- [ ] Find project posted by lecturer
- [ ] Verify you can see:
  - Project name and description
  - Budget amount
  - View requirements (min/max)
  - Supported platforms (TikTok, Instagram, YouTube)
  - Evaluation criteria
  - Start and end dates
  - "Submit Project" button

### Test 7.2: Submit Project - Video Upload
- [ ] Click "Submit Project"
- [ ] Upload video file (MP4)
- [ ] Fill in:
  - Message/description
  - Platform links (optional)
- [ ] Submit
- [ ] Verify:
  - Video uploads successfully
  - Submission recorded in `project_submissions`
  - Submission appears as reply to project message
  - Lecturer can see submission

### Test 7.3: Submit Project - Video URL
- [ ] Instead of upload, provide video URL
- [ ] Enter:
  - Video URL: YouTube/Vimeo link
  - Platform-specific links:
    - TikTok: `https://tiktok.com/@user/video/123`
    - Instagram: `https://instagram.com/p/ABC123`
    - YouTube: `https://youtube.com/watch?v=xyz`
- [ ] Submit
- [ ] Verify:
  - Links validated
  - Submission recorded with all platform links
  - Lecturer can access each platform link

### Test 7.4: View Submission Review
- [ ] After lecturer reviews your submission
- [ ] Navigate to submission
- [ ] Verify you can see:
  - Score for each criterion
  - Total score
  - Lecturer feedback
  - Approval status (approved/rejected)
  - Platform reviewed (if multiple platforms)

### Test 7.5: Resubmit After Rejection
- [ ] Receive rejected submission
- [ ] Read rejection feedback
- [ ] Click "Resubmit" (if option exists)
- [ ] Upload improved version
- [ ] Submit again
- [ ] Verify:
  - New submission created
  - Old submission preserved
  - Lecturer can review new submission

### Test 7.6: Submit to Multiple Platforms
- [ ] Submit project to TikTok
- [ ] Submit same project to Instagram
- [ ] Submit same project to YouTube
- [ ] Verify:
  - Three separate submission records
  - Each can be reviewed independently
  - Scores may differ per platform

### Test 7.7: Late Submission
- [ ] Wait until project deadline passes
- [ ] Attempt to submit project
- [ ] Verify:
  - System allows late submission with warning
  - OR blocks submission after deadline
  - Late flag visible to lecturer

### Test 7.8: Project Without Submission
- [ ] View project assignment
- [ ] Don't submit anything
- [ ] Verify:
  - Project marked as "Not Submitted"
  - Can still submit before deadline
  - Lecturer sees who hasn't submitted

---

## Section 8: Referral System (Student View)

### Test 8.1: View Your Referral Code
- [ ] Navigate to `/settings` or profile
- [ ] Locate referral section
- [ ] Verify:
  - Your unique 8-character code displayed
  - Can copy code to clipboard
  - Referral link generated (e.g., `/signup?ref=XXXXXXXX`)

### Test 8.2: Share General Referral Link
- [ ] Copy your referral link
- [ ] Open incognito/private browser
- [ ] Visit referral link
- [ ] Verify:
  - Signup page loads
  - Referral code pre-filled
  - New user can complete signup

### Test 8.3: Share Course-Specific Referral Link
- [ ] Generate link for specific course
- [ ] Format: `/signup?ref=YOUR_CODE&course=course-id-123`
- [ ] Share link with new user
- [ ] New user signs up via this link
- [ ] Verify:
  - New user sees course recommendation popup on first login
  - Can enroll directly from popup

### Test 8.4: Track Referrals
- [ ] After Student B signs up with your code and enrolls
- [ ] Navigate to referral dashboard
- [ ] Verify you can see:
  - Number of referrals (people who used your code)
  - Courses they enrolled in
  - Commissions earned per referral
  - Total earnings from referrals

### Test 8.5: Earn Commission from Referral
- [ ] Student B enrolls in ₾100 course (20% commission) using your code
- [ ] Admin approves enrollment
- [ ] Check your balance
- [ ] Verify:
  - Balance increased by ₾20
  - Transaction record shows:
    - source: `referral_commission`
    - reference to Student B's enrollment
  - Can see in balance history

### Test 8.6: Refer Multiple Students
- [ ] Refer Student B, C, D
- [ ] Each enrolls in different courses
- [ ] Admin approves all
- [ ] Verify:
  - Each commission calculated correctly based on course's commission %
  - All commissions added to balance
  - All referrals tracked in dashboard

### Test 8.7: Student Uses Someone Else's Code
- [ ] Enroll in course using Student A's referral code
- [ ] Admin approves
- [ ] Verify:
  - You don't earn commission
  - Student A earns commission
  - Your balance unchanged

### Test 8.8: Invalid Referral Code Handling
- [ ] Attempt to enroll with non-existent code: `FAKE1234`
- [ ] Verify:
  - Error: "Invalid referral code"
  - Cannot proceed with invalid code
  - Can skip referral code and proceed

---

## Section 9: Balance & Withdrawals (Student View)

### Test 9.1: View Current Balance
- [ ] Navigate to `/settings` → Balance section
- [ ] Verify you can see:
  - Current balance (in ₾)
  - Available for withdrawal
  - Pending withdrawals (if any)

### Test 9.2: View Balance History
- [ ] Check balance transaction history
- [ ] Verify you can see:
  - All credits (referral commissions)
  - All debits (withdrawals)
  - Transaction dates
  - Transaction sources
  - Running balance
  - Chronological order

### Test 9.3: Request Withdrawal - Valid Amount
- [ ] Ensure balance ≥ ₾20 (minimum)
- [ ] Navigate to withdrawal section
- [ ] Fill in:
  - Amount: ₾50
  - Bank account (Georgian IBAN): `GE29NB0000000123456789`
- [ ] Submit request
- [ ] Verify:
  - Request created with status "pending"
  - Balance not yet deducted (only deducted on approval)
  - Request visible in withdrawal history
  - Shows "Pending review by admin"

### Test 9.4: Request Withdrawal - Below Minimum
- [ ] Attempt to request ₾19 (below ₾20 minimum)
- [ ] Verify:
  - Frontend validation prevents submission
  - Error message: "Minimum withdrawal amount is ₾20"
  - Cannot submit request

### Test 9.5: Request Withdrawal - Exceeds Balance
- [ ] Balance is ₾30
- [ ] Attempt to request ₾50
- [ ] Verify:
  - Error: "Insufficient balance"
  - Cannot submit request

### Test 9.6: IBAN Validation
- [ ] Enter invalid IBAN (wrong format)
- [ ] Examples:
  - Too short: `GE29NB00000`
  - Wrong prefix: `US29NB0000000123456789`
  - Missing letters: `GE290000000123456789`
- [ ] Verify:
  - Frontend validation shows error
  - Must match Georgian IBAN: `GE[2 digits][2 letters][16 digits]`

### Test 9.7: Valid IBAN Formats
- [ ] Test valid Georgian IBANs:
  - `GE29NB0000000123456789`
  - `GE12AB9876543210987654`
- [ ] Verify:
  - Validation passes
  - Can submit withdrawal request

### Test 9.8: Withdrawal Approved by Admin
- [ ] Admin approves your withdrawal request
- [ ] Verify:
  - Balance decreases by withdrawal amount
  - Transaction recorded as debit
  - Request status changes to "approved" or "completed"
  - Receive notification (if implemented)

### Test 9.9: Withdrawal Rejected by Admin
- [ ] Admin rejects withdrawal with reason: "Invalid bank account"
- [ ] Verify:
  - Request status = "rejected"
  - Balance unchanged (no deduction)
  - Can see rejection reason
  - Can submit new request

### Test 9.10: Multiple Pending Withdrawals
- [ ] Submit withdrawal request for ₾20
- [ ] Before approval, submit another for ₾30
- [ ] Verify:
  - Both requests created
  - Total pending: ₾50
  - Balance not yet deducted
  - Admin sees both requests

### Test 9.11: Cancel Withdrawal Request
- [ ] Submit withdrawal request
- [ ] Before admin reviews, cancel it (if feature exists)
- [ ] Verify:
  - Request status = "cancelled"
  - Balance unchanged
  - Cannot be processed by admin

---

## Section 10: Profile & Settings

### Test 10.1: View Profile
- [ ] Navigate to `/settings`
- [ ] Verify you can see:
  - Username
  - Email
  - Full name
  - Role (Student)
  - Avatar (if uploaded)
  - Referral code
  - Account creation date

### Test 10.2: Upload Avatar
- [ ] Click "Upload Avatar"
- [ ] Select image (PNG/JPG)
- [ ] Upload
- [ ] Verify:
  - Image uploads to `avatars` bucket
  - Avatar displays in profile
  - Avatar shows in chat messages
  - Avatar shows in member sidebar

### Test 10.3: Update Profile Information
- [ ] Edit full name
- [ ] Save changes
- [ ] Verify:
  - Name updated in database
  - Shows updated name throughout app
  - Cannot change email (if locked)
  - Cannot change username (if locked)

### Test 10.4: Change Password
- [ ] Navigate to password change section
- [ ] Enter:
  - Current password
  - New password (min 6 chars)
  - Confirm new password
- [ ] Submit
- [ ] Verify:
  - Password updated
  - Success message shown
  - Can log in with new password
  - Old password no longer works

### Test 10.5: Password Change Validation
- [ ] Enter wrong current password
- [ ] Verify error: "Current password incorrect"
- [ ] Enter mismatched new passwords
- [ ] Verify error: "Passwords do not match"
- [ ] Enter new password < 6 chars
- [ ] Verify error: "Password must be at least 6 characters"

### Test 10.6: Language Settings
- [ ] Change language from English to Georgian
- [ ] Verify:
  - UI switches to Georgian
  - Translations load correctly
  - Language preference saved
  - Persists after page reload
- [ ] Switch back to English
- [ ] Verify same behavior

### Test 10.7: Theme Settings
- [ ] If theme selector exists (light/dark)
- [ ] Toggle theme
- [ ] Verify:
  - Theme changes immediately
  - Preference saved
  - Persists across sessions

### Test 10.8: Background Animation Settings
- [ ] Navigate to background selector
- [ ] Change background animation
- [ ] Options:
  - AI Network Background
  - Analytics Background
  - Crypto Rain Background
  - Global Commerce Background
  - Money Flow Background
  - Social Media Background
  - Stock Market Background
- [ ] Verify:
  - Background changes immediately
  - Preference saved in localStorage
  - Persists after refresh

---

## Section 11: Course Muting

### Test 11.1: Mute Course
- [ ] Navigate to course chat
- [ ] Click "Mute" or similar option
- [ ] Verify:
  - Course muted (stored in `muted_users` table)
  - No more notifications from this course
  - Unread indicators disabled for muted course
  - Can still access course content

### Test 11.2: Unmute Course
- [ ] Mute a course
- [ ] Click "Unmute"
- [ ] Verify:
  - Course unmuted
  - Notifications resume
  - Unread indicators enabled

### Test 11.3: Muted Course Notifications
- [ ] Mute Course A
- [ ] Lecturer posts message in Course A
- [ ] Verify:
  - No notification received
  - No browser notification
  - No unread badge (or muted badge instead)

---

## Section 12: Bundle Enrollment

### Test 12.1: View Bundle
- [ ] Navigate to bundle page `/bundles/[bundleId]`
- [ ] Verify bundle shows:
  - Bundle title and description
  - All courses included
  - Bundle price vs individual prices
  - Discount percentage
  - "Enroll in Bundle" button

### Test 12.2: Enroll in Bundle
- [ ] Click "Enroll in Bundle"
- [ ] Go through enrollment wizard:
  - Step 1: Bundle overview
  - Step 2: Referral code (optional)
  - Step 3: Payment screenshots
  - Step 4: Review and submit
- [ ] Submit bundle enrollment request
- [ ] Verify:
  - `bundle_enrollment_requests` record created
  - Payment screenshots uploaded
  - Referral code stored (if used)

### Test 12.3: Bundle Enrollment Approved
- [ ] Admin approves bundle enrollment
- [ ] Verify:
  - Individual enrollments created for EACH course in bundle
  - All courses appear in "My Courses"
  - Can access all course chats
  - If referral used, commission calculated on bundle price

### Test 12.4: Partial Enrollment in Bundle
- [ ] Already enrolled in Course A (individually)
- [ ] Bundle contains Course A + Course B
- [ ] Attempt to enroll in bundle
- [ ] Verify:
  - System handles duplicate enrollment
  - Either:
    - Prevents bundle enrollment (error message)
    - OR enrolls only in Course B (skips duplicate)
    - OR allows bundle but no duplicate charge

---

## Section 13: Student Edge Cases

### Test 13.1: Access Course Before Approval
- [ ] Submit enrollment request
- [ ] Before admin approval, try to access course chat via URL:
  - `/courses/[courseId]/chat`
- [ ] Verify:
  - Access denied (redirect or error)
  - Cannot see course channels
  - Cannot see course content

### Test 13.2: Enrollment Request Expiry
- [ ] Submit enrollment request
- [ ] Wait 30 days (or configured expiry time)
- [ ] Check if request auto-expires
- [ ] Verify:
  - Request status changes to "expired"
  - Can submit new request

### Test 13.3: Concurrent Enrollment Requests
- [ ] Submit enrollment request for Course A
- [ ] While pending, attempt to submit another request for same course
- [ ] Verify:
  - System prevents duplicate pending requests
  - Error: "You already have a pending request for this course"

### Test 13.4: Enroll After Rejection
- [ ] Admin rejects enrollment
- [ ] Submit new enrollment request for same course
- [ ] Verify:
  - New request allowed
  - Old rejection doesn't block new request
  - Can upload different payment screenshots

### Test 13.5: Balance After Multiple Referrals
- [ ] Earn commissions from 10 different referrals
- [ ] Verify:
  - All 10 commissions added correctly
  - Balance transaction history accurate
  - Total balance correct

### Test 13.6: Withdraw Entire Balance
- [ ] Balance = ₾50
- [ ] Request withdrawal of ₾50 (entire balance)
- [ ] Admin approves
- [ ] Verify:
  - Balance = ₾0
  - Cannot request another withdrawal (below minimum)

### Test 13.7: Rapid Message Sending
- [ ] Send 20 messages rapidly in chat
- [ ] Verify:
  - All messages sent successfully
  - No rate limiting (or proper rate limit message)
  - No duplicate messages
  - Messages in correct order

### Test 13.8: Upload Very Large Image to Chat
- [ ] Attempt to upload 20MB image
- [ ] Verify:
  - System enforces file size limit
  - Error message if too large
  - Suggest compression or resize

### Test 13.9: Video Progress Edge Cases
- [ ] Watch video to 90% completion
- [ ] Close browser/tab
- [ ] Reopen and resume
- [ ] Verify progress saved at 90%
- [ ] Skip to end
- [ ] Verify marked as completed despite not watching full video

### Test 13.10: Course with No Content
- [ ] Enroll in course with no lecture videos
- [ ] Verify:
  - Can access chat
  - Shows "No lectures yet" message
  - Doesn't break UI

---

## Section 14: Student Security Testing

### Test 14.1: Access Another Student's Data
- [ ] Log in as Student A
- [ ] Attempt to access Student B's:
  - Profile via direct URL
  - Balance via API endpoint
  - Withdrawal requests
- [ ] Verify:
  - All access denied (403 errors)
  - RLS policies enforce user isolation

### Test 14.2: Access Lecturer/Admin Routes
- [ ] As student, attempt to access:
  - `/lecturer/dashboard`
  - `/admin`
- [ ] Verify:
  - Access denied
  - Redirected to home or error page

### Test 14.3: Call Admin API Endpoints
- [ ] As student, attempt to call:
  - `/api/admin/enrollment-requests/[id]/approve`
  - `/api/admin/withdrawals/[id]/approve`
- [ ] Verify:
  - All return 401/403 errors
  - No data modified

### Test 14.4: XSS Prevention
- [ ] Send chat message: `<script>alert('XSS')</script>`
- [ ] Verify script tag escaped and doesn't execute
- [ ] Try in profile name: `<img src=x onerror=alert('XSS')>`
- [ ] Verify HTML tags sanitized

### Test 14.5: SQL Injection Prevention
- [ ] Enter in search/input fields: `' OR '1'='1`
- [ ] Verify:
  - No SQL errors
  - Input treated as literal string
  - No data leaked

---

# FEATURE-SPECIFIC TESTING

## Feature 1: Real-time Chat System

### Test 1.1: Supabase Realtime Subscription
- [ ] Open chat in browser
- [ ] Open DevTools → Console
- [ ] Verify Supabase Realtime subscription active
- [ ] Check for subscription logs
- [ ] Send message from another user
- [ ] Verify real-time update logged

### Test 1.2: Connection Loss Handling
- [ ] Disconnect internet
- [ ] Verify:
  - "Connection lost" indicator appears
  - Messages queue locally (if implemented)
- [ ] Reconnect internet
- [ ] Verify:
  - Auto-reconnection
  - Queued messages sent
  - Chat syncs

### Test 1.3: Multiple Device Sync
- [ ] Log in as Student A on Desktop
- [ ] Log in as same Student A on Mobile
- [ ] Send message from Desktop
- [ ] Verify:
  - Message appears on Mobile instantly
  - Read status syncs
  - Typing indicators sync

### Test 1.4: Message Ordering
- [ ] Three students send messages simultaneously
- [ ] Verify:
  - Messages ordered by timestamp
  - No race conditions
  - Consistent order across all clients

### Test 1.5: Large Channel Performance
- [ ] Join channel with 1000+ messages
- [ ] Verify:
  - Initial load performant (<3 seconds)
  - Scroll smooth
  - Real-time updates still work

---

## Feature 2: Video Progress Tracking

### Test 2.1: Progress Granularity
- [ ] Watch video and pause at 2:35 (2 minutes 35 seconds)
- [ ] Navigate away
- [ ] Return to video
- [ ] Verify:
  - Resumes exactly at 2:35
  - Progress saved in seconds (155 seconds)

### Test 2.2: Multiple Videos Progress
- [ ] Watch Video 1 to 50%
- [ ] Watch Video 2 to 75%
- [ ] Watch Video 3 to 100%
- [ ] Verify:
  - Each video's progress tracked separately
  - All progress persists
  - Course completion percentage accurate

### Test 2.3: Completion Threshold
- [ ] Watch video to 95% (if 90%+ marks complete)
- [ ] Verify:
  - Video marked as completed
  - OR requires 100% to complete (depends on design)

### Test 2.4: Rewatching Completed Video
- [ ] Complete video (100%)
- [ ] Rewatch from beginning
- [ ] Verify:
  - Can rewatch
  - Still marked as completed
  - Progress resets to current watch point

---

## Feature 3: Referral Commission Calculation

### Test 3.1: Commission Precision
- [ ] Course price: ₾99.99
- [ ] Commission: 15%
- [ ] Calculate: ₾99.99 × 0.15 = ₾14.9985
- [ ] Admin approves enrollment
- [ ] Verify:
  - Commission rounded correctly (₾15.00 or ₾14.99)
  - No floating-point errors

### Test 3.2: Zero Commission Course
- [ ] Course with 0% commission
- [ ] Student enrolls with referral
- [ ] Admin approves
- [ ] Verify:
  - Referrer balance unchanged (₾0 commission)
  - Referral record still created (for tracking)

### Test 3.3: High Commission Course
- [ ] Course: ₾200, Commission: 80%
- [ ] Expected commission: ₾160
- [ ] Student enrolls with referral
- [ ] Admin approves
- [ ] Verify:
  - Referrer receives exactly ₾160
  - Transaction recorded correctly

### Test 3.4: Referral Chain (if supported)
- [ ] Student A refers Student B
- [ ] Student B refers Student C
- [ ] Student C enrolls in course
- [ ] Verify:
  - Student B earns commission (direct referral)
  - Student A does NOT earn (no multi-level marketing)
  - OR implement if multi-level is designed

---

## Feature 4: Enrollment Request Approval Workflow

### Test 4.1: Approval Transaction Atomicity
- [ ] Admin approves enrollment with referral
- [ ] Verify ALL of the following happen atomically:
  - Enrollment record created
  - Enrollment request status = approved
  - Referrer balance updated
  - Balance transaction created
  - Referral record created
- [ ] If any step fails, entire transaction rolls back

### Test 4.2: Concurrent Approvals
- [ ] Two admins open dashboard
- [ ] Both attempt to approve same enrollment simultaneously
- [ ] Verify:
  - Only one approval succeeds
  - No duplicate enrollments
  - No double commission payment

### Test 4.3: Approve Deleted User's Request
- [ ] Student submits enrollment
- [ ] Student account deleted
- [ ] Admin attempts to approve
- [ ] Verify:
  - Error handling (cannot approve for deleted user)
  - OR approval blocked

---

## Feature 5: Withdrawal Request Processing

### Test 5.1: Approval Deducts Balance
- [ ] Student balance: ₾100
- [ ] Requests ₾40 withdrawal
- [ ] Admin approves
- [ ] Verify:
  - Balance updated to ₾60
  - Debit transaction created
  - Withdrawal status = approved/completed

### Test 5.2: Rejection Preserves Balance
- [ ] Student balance: ₾100
- [ ] Requests ₾50 withdrawal
- [ ] Admin rejects
- [ ] Verify:
  - Balance remains ₾100
  - No transaction created
  - Withdrawal status = rejected

### Test 5.3: Insufficient Balance Safeguard
- [ ] Student balance: ₾25
- [ ] Requests ₾30 withdrawal
- [ ] Admin attempts to approve
- [ ] Verify:
  - System prevents approval (error)
  - Balance unchanged

---

# CROSS-ROLE INTEGRATION TESTING

## Integration 1: End-to-End Enrollment with Referral

### Test Complete Flow
1. **Student A (Referrer):**
   - [ ] Sign up and get referral code
   - [ ] Share referral link with Student B

2. **Student B (Referred):**
   - [ ] Sign up using Student A's referral link
   - [ ] Browse courses and select Course X (₾100, 20% commission)
   - [ ] Enroll using Student A's referral code
   - [ ] Upload payment screenshots
   - [ ] Submit enrollment request

3. **Admin:**
   - [ ] View enrollment request
   - [ ] Verify payment screenshots
   - [ ] Verify referral code = Student A's code
   - [ ] Approve enrollment

4. **System (Automated):**
   - [ ] Create enrollment for Student B
   - [ ] Calculate commission: ₾100 × 20% = ₾20
   - [ ] Credit Student A's balance by ₾20
   - [ ] Create balance transaction
   - [ ] Create referral record

5. **Student B (Enrolled):**
   - [ ] Access Course X chat
   - [ ] View lecture videos
   - [ ] Submit project

6. **Lecturer:**
   - [ ] See Student B in enrolled students
   - [ ] Review Student B's project submission

7. **Verify Throughout:**
   - [ ] All balances accurate
   - [ ] All records created
   - [ ] No errors in console

---

## Integration 2: End-to-End Withdrawal

### Test Complete Flow
1. **Student A (Referrer with earnings):**
   - [ ] Current balance: ₾100 from multiple referrals
   - [ ] Navigate to withdrawal section
   - [ ] Request ₾80 withdrawal
   - [ ] Provide IBAN: `GE29NB0000000123456789`
   - [ ] Submit request

2. **Admin:**
   - [ ] View withdrawal request
   - [ ] Verify:
     - Amount: ₾80
     - Current balance: ₾100
     - IBAN format valid
   - [ ] Approve request

3. **System (Automated):**
   - [ ] Deduct ₾80 from Student A's balance
   - [ ] New balance: ₾20
   - [ ] Create debit transaction
   - [ ] Update withdrawal status to approved/completed

4. **Student A:**
   - [ ] View updated balance: ₾20
   - [ ] See withdrawal in history as "Completed"
   - [ ] Cannot request withdrawal (balance below ₾20)

5. **Verify Throughout:**
   - [ ] Balance transaction accurate
   - [ ] Audit trail complete

---

## Integration 3: End-to-End Project Submission & Review

### Test Complete Flow
1. **Lecturer:**
   - [ ] Create project in Course X:
     - Name: "Product Ad Video"
     - Budget: ₾50
     - Platforms: TikTok, Instagram
     - Criteria: Quality (25), Creativity (25), Engagement (25), Technical (25)
   - [ ] Post project in Projects channel

2. **Student B (Enrolled):**
   - [ ] View project assignment
   - [ ] Create video and upload to TikTok
   - [ ] Submit project:
     - Video URL
     - TikTok link
     - Message: "Completed the ad project"
   - [ ] Submission appears in channel

3. **Lecturer:**
   - [ ] View submission
   - [ ] Click "Review"
   - [ ] Score:
     - Quality: 23/25
     - Creativity: 22/25
     - Engagement: 20/25
     - Technical: 24/25
     - Total: 89/100
   - [ ] Feedback: "Excellent work! Improve audio mixing."
   - [ ] Platform: TikTok
   - [ ] Approve submission
   - [ ] Submit review

4. **Student B:**
   - [ ] Receive notification (if implemented)
   - [ ] View review in chat
   - [ ] See score: 89/100
   - [ ] Read feedback

5. **Verify Throughout:**
   - [ ] All data saved correctly
   - [ ] Student sees review
   - [ ] Lecturer dashboard updated

---

## Integration 4: Bundle Enrollment with Multiple Courses

### Test Complete Flow
1. **Lecturer 1:**
   - [ ] Create Course A (₾100)
   - [ ] Create Course B (₾80)

2. **Lecturer 2:**
   - [ ] Create Course C (₾120)

3. **Lecturer 1:**
   - [ ] Create Bundle: "Content Creator Bundle"
   - [ ] Include: Course A, Course B, Course C
   - [ ] Bundle price: ₾250 (vs ₾300 individual)
   - [ ] Referral commission: 15%

4. **Student A:**
   - [ ] Share bundle referral link with Student B

5. **Student B:**
   - [ ] Sign up using Student A's referral link
   - [ ] Enroll in bundle using Student A's code
   - [ ] Upload payment screenshots
   - [ ] Submit bundle enrollment request

6. **Admin:**
   - [ ] View bundle enrollment request
   - [ ] Verify bundle includes 3 courses
   - [ ] Verify referral code
   - [ ] Approve bundle enrollment

7. **System (Automated):**
   - [ ] Create enrollment for Course A
   - [ ] Create enrollment for Course B
   - [ ] Create enrollment for Course C
   - [ ] Calculate commission: ₾250 × 15% = ₾37.50
   - [ ] Credit Student A by ₾37.50
   - [ ] Create balance transaction
   - [ ] Create referral record

8. **Student B:**
   - [ ] See all 3 courses in "My Courses"
   - [ ] Access chat for Course A
   - [ ] Access chat for Course B
   - [ ] Access chat for Course C

9. **Verify Throughout:**
   - [ ] All 3 enrollments created
   - [ ] Single commission based on bundle price
   - [ ] All courses accessible

---

# EDGE CASES & ERROR HANDLING

## Edge Case 1: Deleted Resources

### Test 1.1: Deleted Course with Enrollments
- [ ] Course has active enrollments
- [ ] Lecturer deletes course (if allowed)
- [ ] Verify:
  - Students retain access (grandfathered)
  - OR students notified and access removed
  - Refund process if applicable

### Test 1.2: Deleted User with Referrals
- [ ] Student A referred 5 students
- [ ] All have active enrollments
- [ ] Student A deletes account
- [ ] Verify:
  - Referral records preserved (for audit)
  - Referrer shown as "Deleted User"
  - Commissions already paid remain valid

### Test 1.3: Deleted Channel with Messages
- [ ] Channel has 100 messages
- [ ] Lecturer deletes channel
- [ ] Verify:
  - Messages archived or deleted
  - Students no longer see channel
  - No broken links to deleted channel

---

## Edge Case 2: Invalid Data States

### Test 2.1: Enrollment Without Course
- [ ] Course deleted after enrollment request
- [ ] Admin attempts to approve
- [ ] Verify:
  - Error: "Course no longer exists"
  - Cannot approve
  - OR auto-reject request

### Test 2.2: Referral Code Collision
- [ ] System generates referral code
- [ ] Code already exists (unlikely but possible)
- [ ] Verify:
  - System regenerates until unique
  - No duplicate codes in database

### Test 2.3: Negative Balance
- [ ] Student balance: ₾10
- [ ] Admin approves ₾50 withdrawal (system bug)
- [ ] Verify:
  - System prevents negative balance
  - OR balance goes negative (bug to report)

---

## Edge Case 3: Race Conditions

### Test 3.1: Simultaneous Message Sends
- [ ] Two students send message at exact same time
- [ ] Verify:
  - Both messages saved
  - Correct timestamp ordering
  - No message loss

### Test 3.2: Concurrent Enrollment Approvals
- [ ] Two admins approve different enrollments for same student
- [ ] Verify:
  - Both enrollments created
  - No conflicts
  - All data consistent

### Test 3.3: Rapid Balance Updates
- [ ] Multiple referrals approved simultaneously
- [ ] Verify:
  - All commissions added correctly
  - No lost updates
  - Final balance accurate

---

## Edge Case 4: Boundary Values

### Test 4.1: Maximum Withdrawal Amount
- [ ] Balance: ₾10,000
- [ ] Request ₾10,000 withdrawal (entire balance)
- [ ] Verify:
  - Request succeeds
  - Admin can approve
  - Balance becomes ₾0

### Test 4.2: Minimum Withdrawal Amount
- [ ] Request exactly ₾20 withdrawal
- [ ] Verify:
  - Request allowed (minimum met)
  - Admin can approve

### Test 4.3: Very Long Messages
- [ ] Send message with 5000 characters
- [ ] Verify:
  - Message truncated at limit (if exists)
  - OR full message saved
  - UI handles long messages (scrollable)

### Test 4.4: Very Long Course Title
- [ ] Lecturer creates course with 200-character title
- [ ] Verify:
  - Title truncated in UI (with ellipsis)
  - Full title viewable on hover/detail page
  - Database stores full title

---

## Edge Case 5: Network Failures

### Test 5.1: Failed File Upload
- [ ] Start uploading large video
- [ ] Disconnect internet mid-upload
- [ ] Verify:
  - Upload fails gracefully
  - Error message shown
  - Can retry upload

### Test 5.2: Failed API Request
- [ ] Submit enrollment request
- [ ] Server returns 500 error
- [ ] Verify:
  - Error message shown to user
  - Request not duplicated on retry
  - User can retry

### Test 5.3: Timeout Handling
- [ ] Slow network connection
- [ ] Request takes >30 seconds
- [ ] Verify:
  - Timeout message shown
  - User prompted to retry
  - No duplicate actions

---

# PERFORMANCE & SECURITY TESTING

## Performance Testing

### Test 1: Page Load Times
- [ ] Measure load time for:
  - Homepage: < 2 seconds
  - Course listing: < 3 seconds
  - Course chat: < 3 seconds
  - Admin dashboard: < 4 seconds
- [ ] Use browser DevTools → Network tab
- [ ] Test on slow 3G network (throttling)

### Test 2: Real-time Message Latency
- [ ] Send message in chat
- [ ] Measure time until received by other user
- [ ] Target: < 500ms
- [ ] Test with 10 concurrent users

### Test 3: Database Query Performance
- [ ] Load course with 1000+ messages
- [ ] Verify:
  - Initial query < 1 second
  - Pagination/infinite scroll smooth
- [ ] Load admin dashboard with 100+ requests
- [ ] Verify quick filtering and sorting

### Test 4: Video Streaming Performance
- [ ] Play 1080p video
- [ ] Verify:
  - No buffering on decent connection
  - Adaptive quality if implemented
  - Smooth playback

### Test 5: Concurrent User Handling
- [ ] Simulate 50 students in same course chat
- [ ] All send messages simultaneously
- [ ] Verify:
  - All messages delivered
  - No server errors
  - Reasonable latency (<2 seconds)

---

## Security Testing

### Test 1: SQL Injection
- [ ] Test all input fields with:
  - `' OR '1'='1`
  - `'; DROP TABLE users;--`
  - `1' UNION SELECT * FROM profiles--`
- [ ] Verify:
  - No SQL errors
  - Input treated as literal
  - Parameterized queries prevent injection

### Test 2: XSS (Cross-Site Scripting)
- [ ] Test in chat messages, profile fields, course descriptions:
  - `<script>alert('XSS')</script>`
  - `<img src=x onerror=alert('XSS')>`
  - `<svg onload=alert('XSS')>`
- [ ] Verify:
  - All HTML/scripts escaped
  - Content rendered as text
  - No code execution

### Test 3: CSRF (Cross-Site Request Forgery)
- [ ] Attempt to submit forms from external site
- [ ] Verify:
  - Requests require valid auth token
  - Supabase auth tokens validated
  - No unauthorized actions

### Test 4: Authentication Bypass
- [ ] Attempt to access protected routes without login:
  - `/my-courses`
  - `/settings`
  - `/courses/[id]/chat`
- [ ] Verify all redirect to login
- [ ] Attempt to call APIs without auth token
- [ ] Verify all return 401 errors

### Test 5: Authorization Bypass
- [ ] Log in as Student A
- [ ] Attempt to access Student B's data via:
  - Modified API requests
  - Direct database queries (if client access)
  - URL manipulation
- [ ] Verify:
  - All blocked by RLS policies
  - 403 errors returned
  - No data leakage

### Test 6: File Upload Security
- [ ] Attempt to upload:
  - Executable files (.exe, .sh)
  - Malicious scripts (.php, .js with exploit)
  - Oversized files (>100MB)
- [ ] Verify:
  - File type validation enforced
  - Executable types blocked
  - Size limits enforced
  - Files scanned (if antivirus integrated)

### Test 7: Rate Limiting
- [ ] Send 100 API requests in 1 second
- [ ] Verify:
  - Rate limiting kicks in
  - Error: "Too many requests"
  - OR implement rate limiting if missing

### Test 8: Sensitive Data Exposure
- [ ] Check API responses for:
  - Plain text passwords (should never appear)
  - Other users' balances
  - Bank account numbers
  - Email addresses of other users
- [ ] Verify:
  - Only authorized data returned
  - Passwords hashed
  - Sensitive data masked

### Test 9: Insecure Direct Object References (IDOR)
- [ ] Student A views enrollment ID: 123
- [ ] Modify URL to enrollment ID: 124 (Student B's enrollment)
- [ ] Verify:
  - Access denied
  - Cannot view other users' enrollments
- [ ] Test with:
  - Withdrawal requests
  - Balance transactions
  - Project submissions

### Test 10: Session Management
- [ ] Log in and get session token
- [ ] Log out
- [ ] Attempt to reuse old token
- [ ] Verify:
  - Token invalidated
  - Requests fail
- [ ] Test session timeout (30 min inactivity)
- [ ] Verify auto-logout

---

# TESTING CHECKLIST SUMMARY

## Admin Role Checklist
- [ ] Dashboard access and statistics
- [ ] Enrollment request viewing and approval/rejection
- [ ] Withdrawal request viewing and approval/rejection
- [ ] Course management and analytics
- [ ] Bundle enrollment management
- [ ] Real-time updates and notifications
- [ ] Security: access control, API protection, RLS verification
- [ ] Edge cases: concurrent actions, invalid data
- [ ] Mobile responsiveness

## Lecturer Role Checklist
- [ ] Course creation and editing
- [ ] Channel creation and management
- [ ] Lecture video uploads and management
- [ ] Project creation with criteria and requirements
- [ ] Student submission reviews and grading
- [ ] Course chat and communication
- [ ] Student management and progress tracking
- [ ] Referral commission settings (0-100%)
- [ ] Bundle creation and management
- [ ] Balance tracking and withdrawals
- [ ] Dual role testing (lecturer as student)
- [ ] Security: course access control, data protection
- [ ] Edge cases: large uploads, concurrent actions

## Student Role Checklist
- [ ] Account creation with/without referral codes
- [ ] Course browsing and filtering
- [ ] Enrollment process (all 4 steps)
- [ ] Course access after approval
- [ ] Chat functionality (send, reply, edit, delete)
- [ ] Lecture watching and progress tracking
- [ ] Project submissions (upload and URL)
- [ ] Referral system (earning and tracking)
- [ ] Balance management and withdrawals
- [ ] Profile and settings management
- [ ] Course muting
- [ ] Bundle enrollment
- [ ] Security: data isolation, access control
- [ ] Edge cases: late submissions, balance scenarios

## Cross-Role Integration Checklist
- [ ] End-to-end enrollment with referral
- [ ] End-to-end withdrawal processing
- [ ] End-to-end project submission and review
- [ ] Bundle enrollment with multiple courses

## Performance & Security Checklist
- [ ] Page load times (<3 seconds)
- [ ] Real-time message latency (<500ms)
- [ ] Database query performance
- [ ] Video streaming quality
- [ ] Concurrent user handling
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Authentication and authorization
- [ ] File upload security
- [ ] Rate limiting
- [ ] Sensitive data protection
- [ ] IDOR prevention
- [ ] Session management

---

# TESTING NOTES FOR CLAUDE EXTENSION TESTER

## How to Use This Guide

1. **Systematic Approach**: Follow each section in order, completing all tests for one role before moving to the next.

2. **Checkboxes**: Use the checkboxes `[ ]` to mark tests as completed. This helps track progress.

3. **Record Issues**: For any test that fails, document:
   - Test number (e.g., "Admin 2.3")
   - Expected behavior
   - Actual behavior
   - Steps to reproduce
   - Screenshots/error messages
   - Browser console errors

4. **Test Data**: Create test accounts with clear naming:
   - `admin-test@example.com` (Admin)
   - `lecturer1-test@example.com` (Lecturer 1)
   - `lecturer2-test@example.com` (Lecturer 2)
   - `student-a@example.com` (Student A - referrer)
   - `student-b@example.com` (Student B - referred)
   - `student-c@example.com` (Student C - control)

5. **Browser DevTools**: Keep open throughout testing:
   - Console tab: Watch for JavaScript errors
   - Network tab: Monitor API calls and responses
   - Application tab: Check localStorage, cookies, Supabase data

6. **Real-time Features**: Test with multiple browsers/devices simultaneously to verify real-time sync.

7. **Clean State**: Between tests, clear browser cache/cookies if needed to avoid state conflicts.

8. **Prioritization**:
   - **Critical**: Enrollment flow, payment processing, referral commissions, withdrawals
   - **High**: Chat functionality, video watching, project submissions
   - **Medium**: UI/UX, settings, profile management
   - **Low**: Edge cases, rare scenarios

9. **Regression Testing**: After any bug fixes, re-run affected tests to ensure fix didn't break other features.

10. **Final Verification**: After completing all tests, perform end-to-end user journeys as each role to ensure cohesive experience.

---

# CONTACT & SUPPORT

If you encounter any issues, bugs, or have questions during testing:
- Document all findings in a structured format
- Include screenshots and error logs
- Note browser version and OS
- Describe steps to reproduce
- Suggest severity (Critical/High/Medium/Low)

Thank you for thoroughly testing the MainCourse platform!
