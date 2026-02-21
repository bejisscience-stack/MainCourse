/**
 * Referral Code Persistent Storage
 *
 * Stores referral codes in localStorage for 30 days so users who click a referral link
 * but don't register immediately still get the referral applied when they enroll.
 *
 * Supports general referrals that apply to all courses.
 * Last-click attribution: New referral links override existing ones.
 */

interface StoredReferral {
  referralCode: string;
  timestamp: number;
}

const STORAGE_KEY = 'referral_tracking';
const EXPIRY_DAYS = 30;
const EXPIRY_MS = EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Get stored referral from localStorage
 */
function getStoredReferral(): StoredReferral | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as StoredReferral;
  } catch {
    return null;
  }
}

/**
 * Save referral to localStorage
 */
function setStoredReferral(referral: StoredReferral | null): void {
  if (typeof window === 'undefined') return;

  try {
    if (referral) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(referral));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
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
 */
export function saveReferral(referralCode: string): void {
  if (typeof window === 'undefined') return;
  if (!referralCode) return;

  const normalizedCode = referralCode.toUpperCase().trim();

  setStoredReferral({
    referralCode: normalizedCode,
    timestamp: Date.now(),
  });
}

/**
 * Get the stored referral code
 *
 * @returns The referral code if found and not expired, null otherwise
 */
export function getReferral(): string | null {
  if (typeof window === 'undefined') return null;

  const referral = getStoredReferral();

  if (!referral || isExpired(referral)) {
    // Clean up expired referral
    if (referral) {
      setStoredReferral(null);
    }
    return null;
  }

  return referral.referralCode;
}

/**
 * Clear referral code after successful enrollment
 */
export function clearReferral(): void {
  if (typeof window === 'undefined') return;
  setStoredReferral(null);
}

/**
 * Check if there's any stored referral (for UI indicators)
 */
export function hasStoredReferral(): boolean {
  return getReferral() !== null;
}
