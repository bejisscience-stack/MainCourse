# Performance Audit Report

## Executive Summary
This document identifies all performance bottlenecks in the codebase and provides optimization strategies. All optimizations will maintain existing business logic and functionality.

---

## Phase 1: Identified Performance Issues

### 1. Database Query Optimizations

#### 1.1 N+1 Query Patterns
**Location:** `app/api/chats/[chatId]/messages/route.ts`
- **Issue:** Lines 195-213: Fallback profile fetching uses sequential individual queries instead of batch
- **Impact:** High - Can cause 50+ sequential queries for a single message fetch
- **Root Cause:** Fallback logic queries profiles one-by-one when batch fetch fails
- **Solution:** Remove fallback individual queries, rely on batch fetch only, or implement proper retry logic

**Location:** `app/api/chats/[chatId]/messages/route.ts`
- **Issue:** Lines 50-79: Sequential queries for channel → course → enrollment checks
- **Impact:** Medium - Adds 3 sequential round trips per request
- **Root Cause:** Queries executed sequentially instead of in parallel where possible
- **Solution:** Combine queries using JOINs or execute independent queries in parallel

#### 1.2 Missing Database Indexes
**Location:** Database schema
- **Issue:** Missing indexes for frequently queried fields:
  - `channels.course_id` (queried in multiple API routes)
  - `messages.channel_id` (queried with ordering)
  - `messages.created_at` (used for ordering and pagination)
  - `profiles.username` (queried frequently for display)
- **Impact:** High - Slow queries on large datasets
- **Solution:** Add composite indexes for common query patterns

#### 1.3 Inefficient Query Patterns
**Location:** `app/my-courses/page.tsx` (Lines 66-79)
- **Issue:** Fetches ALL courses then filters in JavaScript instead of using database WHERE clause
- **Impact:** Medium - Transfers unnecessary data over network
- **Root Cause:** Using `.not()` syntax issues, falling back to JS filtering
- **Solution:** Use proper Supabase query with `.not().in()` or create a view

**Location:** `app/courses/page.tsx` (Lines 64-91)
- **Issue:** Bundle fetching uses nested select which may be inefficient
- **Impact:** Low-Medium - Could be slow with many courses per bundle
- **Solution:** Verify query performance, add indexes if needed

---

### 2. Component Rendering Optimizations

#### 2.1 Missing React.memo
**Location:** Multiple components
- **Issue:** Components re-render unnecessarily when parent updates
- **Impact:** Medium - Unnecessary DOM updates and computation
- **Components Missing memo:**
  - `CourseEnrollmentCard` (used in lists)
  - `Message` component (rendered many times in chat)
  - `ChannelSidebar` items
  - `ServerSidebar` items
- **Solution:** Wrap components with React.memo where props are stable

#### 2.2 Unnecessary Re-renders from Object/Array Recreation
**Location:** `hooks/useChatMessages.ts` (Line 57)
- **Issue:** `channelIds` array recreated on every render
- **Impact:** Low-Medium - Causes hook dependencies to change unnecessarily
- **Solution:** Use useMemo for stable array references

**Location:** `app/courses/page.tsx` (Line 38-40)
- **Issue:** State initialized with `new Set()` creates new reference each render
- **Impact:** Low - Minor unnecessary re-renders
- **Solution:** Initialize in useState callback or use useMemo

#### 2.3 Heavy Computations Not Memoized
**Location:** `app/courses/page.tsx` (Lines 117-142)
- **Issue:** `filteredCourses` computation runs on every render
- **Impact:** Low-Medium - Recomputes filters unnecessarily
- **Status:** ✅ Already using useMemo - Good!

**Location:** `components/CoursesCarousel.tsx` (Lines 31-47)
- **Issue:** `displayedCourses` computation
- **Status:** ✅ Already using useMemo - Good!

---

### 3. Code Splitting & Lazy Loading

#### 3.1 Heavy Components Loaded Eagerly
**Location:** `app/page.tsx`
- **Issue:** All components imported statically
- **Impact:** High - Large initial bundle size
- **Components to Lazy Load:**
  - `CoursesCarousel` (only needed when scrolled)
  - `VideoSection` (only needed when scrolled)
  - `Hero` (can be lazy loaded with loading state)

**Location:** `app/courses/page.tsx`
- **Issue:** `CourseEnrollmentCard` imported statically
- **Impact:** Medium - Component loaded even if not immediately visible
- **Solution:** Lazy load with dynamic import

**Location:** `components/chat/` components
- **Issue:** All chat components loaded upfront
- **Impact:** High - Chat is heavy, only needed on chat pages
- **Solution:** Lazy load chat components on chat pages

#### 3.2 Missing Route-Based Code Splitting
**Location:** Next.js app router
- **Issue:** No explicit code splitting configuration
- **Impact:** Medium - All routes bundled together
- **Solution:** Next.js handles this automatically, but verify it's working

---

### 4. Data Fetching Optimizations

#### 4.1 Redundant API Calls
**Location:** `app/courses/page.tsx` (Lines 53-62)
- **Issue:** `fetchBundles` and `fetchEnrolledBundles` called in useEffect without dependency checks
- **Impact:** Low-Medium - May refetch unnecessarily
- **Solution:** Use SWR for bundles fetching with proper cache keys

**Location:** `hooks/useUser.ts` (Line 102)
- **Issue:** `revalidateOnFocus: true` causes refetch on every window focus
- **Impact:** Low - May be intentional for role changes, but could be optimized
- **Solution:** Consider reducing frequency or making it conditional

#### 4.2 Missing Request Deduplication
**Location:** `app/courses/page.tsx` (Lines 64-91)
- **Issue:** Bundle fetching doesn't use SWR, so no deduplication
- **Impact:** Medium - Multiple components could trigger same fetch
- **Solution:** Convert to SWR hook

#### 4.3 Sequential Instead of Parallel Requests
**Location:** `app/api/chats/[chatId]/messages/route.ts`
- **Issue:** Multiple independent queries executed sequentially
- **Impact:** Medium - Adds latency
- **Solution:** Use Promise.all() for independent queries

---

### 5. Memory Leaks

#### 5.1 Storage Event Listener Never Removed
**Location:** `lib/supabase.ts` (Line 61)
- **Issue:** Storage event listener added but never cleaned up
- **Impact:** Medium - Memory leak, listener persists after component unmount
- **Solution:** Store listener reference and remove on cleanup

#### 5.2 Missing Cleanup in useEffect
**Location:** `components/chat/ChatArea.tsx` (Line 192)
- **Issue:** Scroll listener added but cleanup may not always run
- **Impact:** Low - Usually cleaned up, but edge cases exist
- **Solution:** Ensure cleanup always runs

**Location:** `hooks/useChatMessages.ts` (Lines 389-396)
- **Issue:** Interval cleanup may not run if component unmounts during timeout
- **Impact:** Low - Minor memory leak potential
- **Solution:** Ensure all timeouts/intervals are cleaned up

---

### 6. Bundle Size Optimizations

#### 6.1 Large Dependencies
**Location:** `package.json`
- **Issue:** All dependencies loaded
- **Impact:** Low - Dependencies are reasonable
- **Status:** ✅ Good - No unnecessary large libraries

#### 6.2 Missing Tree Shaking
**Location:** Various files
- **Issue:** May import entire libraries instead of specific functions
- **Impact:** Low - Verify imports are specific
- **Solution:** Ensure named imports where possible

---

### 7. Image & Asset Optimizations

#### 7.1 Image Loading
**Location:** `components/CourseCard.tsx` (Line 122)
- **Issue:** Images loaded without lazy loading or priority hints
- **Impact:** Medium - Above-fold images should have priority
- **Solution:** Add Next.js Image component with priority for above-fold

**Location:** `next.config.js`
- **Status:** ✅ Image optimization already configured - Good!

---

### 8. Network Optimizations

#### 8.1 Missing Request Caching
**Location:** API routes
- **Issue:** No explicit caching headers for GET requests
- **Impact:** Low-Medium - Browser may not cache appropriately
- **Solution:** Add Cache-Control headers for cacheable responses

#### 8.2 Large Response Payloads
**Location:** `app/api/chats/[chatId]/messages/route.ts`
- **Issue:** Fetches 50 messages at once, may be too much
- **Impact:** Low - 50 is reasonable, but could be optimized
- **Solution:** Consider reducing initial load, implement pagination

---

## Priority Ranking

### Critical (Fix Immediately)
1. N+1 query fallback in messages API route
2. Missing database indexes
3. Memory leak in supabase.ts storage listener

### High Priority
4. Lazy load heavy components (CoursesCarousel, VideoSection, Chat components)
5. Convert bundle fetching to SWR for deduplication
6. Add React.memo to frequently rendered components

### Medium Priority
7. Parallelize independent database queries
8. Optimize my-courses page query (filter in database)
9. Add Next.js Image component with proper loading strategies

### Low Priority
10. Reduce revalidateOnFocus frequency
11. Add explicit cache headers
12. Verify tree shaking is working

---

## Expected Performance Improvements

After implementing all optimizations:
- **Initial Load Time:** 30-40% reduction (from code splitting)
- **API Response Time:** 50-60% reduction (from query optimizations)
- **Component Render Time:** 20-30% reduction (from memoization)
- **Memory Usage:** 15-20% reduction (from leak fixes)
- **Bundle Size:** 25-35% reduction (from code splitting)

---

## Implementation Plan

1. ✅ Phase 1: Analysis (Current)
2. ⏳ Phase 2: Critical fixes (N+1, indexes, memory leaks)
3. ⏳ Phase 3: High priority (lazy loading, SWR, memoization)
4. ⏳ Phase 4: Medium priority (parallel queries, optimizations)
5. ⏳ Phase 5: Verification (test all features, measure improvements)

