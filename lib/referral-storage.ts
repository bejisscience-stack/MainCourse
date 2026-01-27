/**
 * Referral Code Persistent Storage
 *
 * Stores referral codes in localStorage for 30 days so users who click a referral link
 * but don't register immediately still get the referral applied when they enroll.
 *
 * Supports:
 * - Course-specific referrals: Only apply to a specific course
 * - General referrals: Apply to all courses
 * - Last-click attribution: New referral links override existing ones
 */

interface StoredReferral {
  referralCode: string;
  courseId: string | null;  // null = general referral (applies to all courses)
  timestamp: number;
}

const STORAGE_KEY = 'referral_tracking';
const EXPIRY_DAYS = 30;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Get all stored referrals from localStorage
 */
function getStoredReferrals(): StoredReferral[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as StoredReferral[];
  } catch {
    return [];
  }
}

/**
 * Save referrals to localStorage
 */
function setStoredReferrals(referrals: StoredReferral[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(referrals));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Check if a referral has expired
 */
function isExpired(referral: StoredReferral): boolean {
  return Date.now() - referral.timestamp > EXPIRY_MS;
}

/**
 * Save a referral code to persistent storage
 *
 * @param referralCode - The referral code to save
 * @param courseId - Optional course ID. If provided, referral only applies to that course.
 *                   If null/undefined, it's a general referral that applies to all courses.
 */
export function saveReferral(referralCode: string, courseId?: string | null): void {
  if (typeof window === 'undefined') return;
  if (!referralCode) return;

  const normalizedCode = referralCode.toUpperCase().trim();
  const normalizedCourseId = courseId?.trim() || null;

  let referrals = getStoredReferrals();

  // Remove expired referrals
  referrals = referrals.filter(r => !isExpired(r));

  // Remove existing referral for the same course (or general referral if courseId is null)
  referrals = referrals.filter(r => r.courseId !== normalizedCourseId);

  // If this is a general referral, also remove all course-specific referrals
  // (general referral overrides everything)
  if (normalizedCourseId === null) {
    referrals = [];
  }

  // Add new referral
  referrals.push({
    referralCode: normalizedCode,
    courseId: normalizedCourseId,
    timestamp: Date.now(),
  });

  setStoredReferrals(referrals);
}

/**
 * Get the referral code for a specific course
 *
 * Priority:
 * 1. Course-specific referral matching the courseId
 * 2. General referral (applies to all courses)
 *
 * @param courseId - The course ID to get referral for
 * @returns The referral code if found and not expired, null otherwise
 */
export function getReferral(courseId?: string): string | null {
  if (typeof window === 'undefined') return null;

  const referrals = getStoredReferrals();
  const normalizedCourseId = courseId?.trim() || null;

  // First, try to find a course-specific referral
  if (normalizedCourseId) {
    const courseSpecific = referrals.find(
      r => r.courseId === normalizedCourseId && !isExpired(r)
    );
    if (courseSpecific) {
      return courseSpecific.referralCode;
    }
  }

  // Fall back to general referral
  const generalReferral = referrals.find(
    r => r.courseId === null && !isExpired(r)
  );

  return generalReferral?.referralCode || null;
}

/**
 * Clear referral code after successful enrollment
 *
 * @param courseId - The course ID to clear referral for.
 *                   If the stored referral was general, it will be cleared regardless.
 */
export function clearReferral(courseId?: string): void {
  if (typeof window === 'undefined') return;

  let referrals = getStoredReferrals();
  const normalizedCourseId = courseId?.trim() || null;

  // Remove the course-specific referral if it exists
  if (normalizedCourseId) {
    referrals = referrals.filter(r => r.courseId !== normalizedCourseId);
  }

  // Note: We don't clear general referral here because it should apply to all courses
  // The general referral will naturally expire after 30 days

  setStoredReferrals(referrals);
}

/**
 * Check if there's any stored referral (for UI indicators)
 */
export function hasStoredReferral(courseId?: string): boolean {
  return getReferral(courseId) !== null;
}
