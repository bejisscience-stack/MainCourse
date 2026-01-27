'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { saveReferral } from '@/lib/referral-storage';

/**
 * Global component that captures referral codes from URL parameters
 * and saves them to persistent localStorage storage.
 *
 * This component should be included in the root layout to capture
 * referrals regardless of which page the user lands on.
 *
 * Supported URL parameters:
 * - ref: The referral code
 */
export default function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const captureReferral = async () => {
      const ref = searchParams.get('ref');

      if (!ref) return;

      const normalizedRef = ref.toUpperCase().trim();

      // Validate referral code before saving
      try {
        const response = await fetch('/api/public/validate-referral-code', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referralCode: normalizedRef }),
        });

        const result = await response.json();

        if (result.valid) {
          // Save to persistent storage
          saveReferral(normalizedRef);
        }
      } catch (error) {
        // If validation fails, still save the referral code
        // It will be validated again during enrollment
        saveReferral(normalizedRef);
      }
    };

    captureReferral();
  }, [searchParams]);

  // This component doesn't render anything
  return null;
}
