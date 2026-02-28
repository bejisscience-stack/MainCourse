'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectCriteria } from './ProjectCard';

interface SubmissionReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReview: () => void;
  submissionId: string;
  projectId: string;
  criteria: ProjectCriteria[];
  submission?: any; // Submission data with platform links
}

const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export default function SubmissionReviewDialog({
  isOpen,
  onClose,
  onReview,
  submissionId,
  projectId,
  criteria,
  submission,
}: SubmissionReviewDialogProps) {
  // Get platforms from submission
  const platformLinks = submission?.submissionData?.platformLinks || {};
  const platforms = Object.keys(platformLinks).filter(p => platformLinks[p]);
  const hasMultiplePlatforms = platforms.length > 1;
  
  // State per platform
  const [selectedPlatform, setSelectedPlatform] = useState<string>(platforms[0] || '');
  const [selectedCriteria, setSelectedCriteria] = useState<Record<string, string[]>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [lastSavedRPM, setLastSavedRPM] = useState<Record<string, number>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<string, boolean>>({});
  const [reviewStatus, setReviewStatus] = useState<Record<string, 'accepted' | 'rejected'>>({});

  // Get criteria for current platform (platform-specific + all-platform criteria)
  const getCriteriaForPlatform = useCallback((platform: string) => {
    return criteria.filter(c => c.platform === undefined || c.platform === platform);
  }, [criteria]);

  const loadExistingReviews = useCallback(async () => {
    try {
      const { data: reviews, error } = await supabase
        .from('submission_reviews')
        .select('*')
        .eq('submission_id', submissionId);

      if (reviews && !error && reviews.length > 0) {
        const criteriaMap: Record<string, string[]> = {};
        const commentsMap: Record<string, string> = {};
        const rpmMap: Record<string, number> = {};

        reviews.forEach((review) => {
          const platform = review.platform || 'all';
          criteriaMap[platform] = review.matched_criteria_ids || [];
          commentsMap[platform] = review.comment || '';
          rpmMap[platform] = parseFloat(review.payment_amount || '0');
        });

        // Only update state if we have reviews - don't reset existing state
        setSelectedCriteria(prev => ({ ...prev, ...criteriaMap }));
        setComments(prev => ({ ...prev, ...commentsMap }));
        setLastSavedRPM(prev => ({ ...prev, ...rpmMap }));
      }
      // If no reviews, don't reset - let user make selections
    } catch (error) {
      console.error('Error loading reviews:', error);
      // Don't reset on error - preserve user's current selections
    }
  }, [submissionId]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCriteria({});
      setComments({});
      setError(null);
      setLastSavedRPM({});
      setSaveSuccess({});
      setIsSaving({});
      setSelectedPlatform(platforms[0] || '');
    } else {
      // Set initial platform only if not set
      if (platforms.length > 0 && !selectedPlatform) {
        setSelectedPlatform(platforms[0]);
      }
    }
  }, [isOpen, platforms]);

  // Load existing reviews only once when dialog opens
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (isOpen && platforms.length > 0 && submissionId && !hasLoadedRef.current) {
      loadExistingReviews();
      hasLoadedRef.current = true;
    }
    if (!isOpen) {
      hasLoadedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, submissionId]); // Only depend on isOpen and submissionId

  const saveReviewForPlatform = useCallback(async (platform: string) => {
    setIsSaving(prev => ({ ...prev, [platform]: true }));
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const platformCriteria = getCriteriaForPlatform(platform);
      const criteriaToSave = selectedCriteria[platform] || [];
      
      const paymentAmount = criteriaToSave.reduce((total, criteriaId) => {
        const criterion = platformCriteria.find(c => c.id === criteriaId);
        return total + (criterion?.rpm || 0);
      }, 0);

      // Ensure payment_amount is a proper decimal number (round to 2 decimal places)
      const finalPaymentAmount = Math.round(paymentAmount * 100) / 100;

      console.log('Saving review for platform:', {
        submissionId,
        projectId,
        platform,
        lecturerId: session.user.id,
        matchedCriteriaIds: criteriaToSave,
        paymentAmount: finalPaymentAmount,
        comment: (comments[platform] || '').trim() || null,
      });

      // First, check if a review already exists for this submission and platform
      const { data: existingReview } = await supabase
        .from('submission_reviews')
        .select('id')
        .eq('submission_id', submissionId)
        .eq('platform', platform)
        .maybeSingle();

      let reviewData;
      let reviewError;

      const currentStatus = reviewStatus[platform] || 'accepted';

      if (existingReview) {
        // Update existing review
        const { data, error } = await supabase
          .from('submission_reviews')
          .update({
            status: currentStatus,
            matched_criteria_ids: currentStatus === 'rejected' ? [] : (criteriaToSave.length > 0 ? criteriaToSave : []),
            comment: (comments[platform] || '').trim() || null,
            payment_amount: currentStatus === 'rejected' ? 0 : finalPaymentAmount,
          })
          .eq('id', existingReview.id)
          .select()
          .single();

        reviewData = data;
        reviewError = error;
      } else {
        // Insert new review
        const { data, error } = await supabase
          .from('submission_reviews')
          .insert({
            submission_id: submissionId,
            project_id: projectId,
            lecturer_id: session.user.id,
            platform: platform, // Platform-specific review
            status: currentStatus,
            matched_criteria_ids: currentStatus === 'rejected' ? [] : (criteriaToSave.length > 0 ? criteriaToSave : []),
            comment: (comments[platform] || '').trim() || null,
            payment_amount: currentStatus === 'rejected' ? 0 : finalPaymentAmount,
          })
          .select()
          .single();

        reviewData = data;
        reviewError = error;
      }

      if (reviewError) {
        console.error('Error saving review:', reviewError);
        throw new Error(reviewError.message);
      }

      console.log('Review saved successfully:', reviewData);

      setLastSavedRPM(prev => ({ ...prev, [platform]: finalPaymentAmount }));
      setSaveSuccess(prev => ({ ...prev, [platform]: true }));
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(prev => ({ ...prev, [platform]: false }));
      }, 3000);
      
      onReview(); // Notify parent to refresh
    } catch (err: any) {
      setError(err.message || 'Failed to save review');
    } finally {
      setIsSaving(prev => ({ ...prev, [platform]: false }));
    }
  }, [submissionId, projectId, selectedCriteria, comments, getCriteriaForPlatform, supabase, onReview]);

  const handleCriteriaToggle = useCallback((criteriaId: string, platform: string) => {
    setSelectedCriteria(prev => {
      const currentCriteria = prev[platform] || [];
      const newSelectedCriteria = currentCriteria.includes(criteriaId)
        ? currentCriteria.filter(id => id !== criteriaId)
        : [...currentCriteria, criteriaId];
      
      return { ...prev, [platform]: newSelectedCriteria };
    });
    setSaveSuccess(prev => ({ ...prev, [platform]: false })); // Clear success message when criteria changes
  }, []); // Remove selectedCriteria from dependencies to avoid stale closures

  const calculatePaymentAmount = useCallback((platform: string): number => {
    const platformCriteria = getCriteriaForPlatform(platform);
    const criteriaToCheck = selectedCriteria[platform] || [];
    return criteriaToCheck.reduce((total, criteriaId) => {
      const criterion = platformCriteria.find(c => c.id === criteriaId);
      return total + (criterion?.rpm || 0);
    }, 0);
  }, [selectedCriteria, getCriteriaForPlatform]);

  if (!isOpen) return null;

  const currentCriteria = getCriteriaForPlatform(selectedPlatform);
  const currentSelectedCriteria = selectedCriteria[selectedPlatform] || [];
  const currentComment = comments[selectedPlatform] || '';
  const currentPaymentAmount = calculatePaymentAmount(selectedPlatform);
  const currentLastSavedRPM = lastSavedRPM[selectedPlatform] || 0;
  const currentIsSaving = isSaving[selectedPlatform] || false;
  const currentSaveSuccess = saveSuccess[selectedPlatform] || false;

  return (
    <div 
      className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close modal when clicking outside
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-3xl bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
          aria-label="Close dialog"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="p-6 space-y-6 overflow-y-auto chat-scrollbar flex-1 min-h-0">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Review Submission</h2>
            <p className="text-gray-400 text-sm">
              {hasMultiplePlatforms 
                ? 'Review each platform independently. Select criteria that match for each platform.'
                : 'Select which criteria this video matches and provide your feedback'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {/* Platform Tabs (if multiple platforms) */}
          {hasMultiplePlatforms && (
            <div className="border-b border-navy-800/60">
              <div className="flex gap-2">
                {platforms.map((platform) => (
                  <button
                    key={platform}
                    onClick={() => setSelectedPlatform(platform)}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      selectedPlatform === platform
                        ? 'text-white border-b-2 border-emerald-400'
                        : 'text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    {PLATFORM_NAMES[platform.toLowerCase()] || platform}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Platform Info */}
          {hasMultiplePlatforms && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <p className="text-sm text-emerald-200">
                Reviewing: <span className="font-semibold">{PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}</span>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Link: <a href={platformLinks[selectedPlatform]} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">
                  {platformLinks[selectedPlatform]}
                </a>
              </p>
            </div>
          )}

          {/* Review Status Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">Review Decision</label>
            <div className="flex gap-3">
              <button
                onClick={() => setReviewStatus(prev => ({ ...prev, [selectedPlatform]: 'accepted' }))}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  (reviewStatus[selectedPlatform] || 'accepted') === 'accepted'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-navy-800/70 text-gray-400 border border-navy-700/50 hover:bg-navy-800'
                }`}
              >
                ✓ Accept
              </button>
              <button
                onClick={() => setReviewStatus(prev => ({ ...prev, [selectedPlatform]: 'rejected' }))}
                className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
                  (reviewStatus[selectedPlatform] || 'accepted') === 'rejected'
                    ? 'bg-red-500 text-white'
                    : 'bg-navy-800/70 text-gray-400 border border-navy-700/50 hover:bg-navy-800'
                }`}
              >
                ✕ Reject
              </button>
            </div>
          </div>

          {/* Criteria Selection - Hidden if Rejected */}
          {(reviewStatus[selectedPlatform] || 'accepted') !== 'rejected' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Matching Criteria {hasMultiplePlatforms && `for ${PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}`}
            </label>
            {currentCriteria.length === 0 ? (
              <p className="text-gray-500 text-sm">No criteria defined for this platform</p>
            ) : (
              <div className="space-y-2">
                {currentCriteria.map((criterion) => {
                  const checkboxId = `criteria-${criterion.id}-${selectedPlatform}`;
                  return (
                  <label
                    key={criterion.id}
                    htmlFor={checkboxId}
                    onClick={(e) => {
                      // Prevent double-toggling when clicking directly on checkbox
                      if ((e.target as HTMLElement).tagName !== 'INPUT') {
                        handleCriteriaToggle(criterion.id, selectedPlatform);
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentSelectedCriteria.includes(criterion.id)
                        ? 'bg-emerald-500/15 border-emerald-500/40'
                        : 'bg-navy-900/60 border-navy-800/60 hover:border-navy-700/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        checked={currentSelectedCriteria.includes(criterion.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCriteriaToggle(criterion.id, selectedPlatform);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 text-emerald-500 bg-navy-900 border-navy-700 rounded focus:ring-emerald-400 focus:ring-2 cursor-pointer pointer-events-auto z-10 relative"
                      />
                      <span className="text-white text-sm">{criterion.text}</span>
                      {criterion.platform && (
                        <span className="text-xs text-emerald-300">({PLATFORM_NAMES[criterion.platform.toLowerCase()] || criterion.platform})</span>
                      )}
                    </div>
                    <span className="text-emerald-300 text-sm font-semibold">
                      ${criterion.rpm.toFixed(2)} RPM
                    </span>
                  </label>
                  );
                })}
              </div>
            )}
            {currentSelectedCriteria.length > 0 && (
              <div className="mt-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold">Total RPM:</span>{' '}
                  <span className="text-emerald-300 font-bold">${currentPaymentAmount.toFixed(2)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on {currentSelectedCriteria.length} matched criteria
                  {currentIsSaving && <span className="ml-2 text-yellow-400">(Saving...)</span>}
                </p>
              </div>
            )}
          </div>
          )}

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Comment <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              value={currentComment}
              onChange={(e) => {
                setComments(prev => ({ ...prev, [selectedPlatform]: e.target.value }));
                setSaveSuccess(prev => ({ ...prev, [selectedPlatform]: false }));
              }}
              placeholder="Add your feedback or comments about this submission..."
              rows={4}
              className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent resize-none"
            />
          </div>

          {/* Success Message */}
          {currentSaveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-emerald-200 font-semibold">
                  Review saved successfully for {PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}! Student will see this information.
                </p>
              </div>
            </div>
          )}

          {/* Saved RPM Display */}
          {currentLastSavedRPM > 0 && !currentSaveSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <p className="text-sm text-gray-300">
                <span className="font-semibold">Saved RPM:</span>{' '}
                <span className="text-emerald-300 font-bold">${currentLastSavedRPM.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Student will see this amount based on selected criteria for {PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-navy-800/60">
            <button
              type="button"
              onClick={onClose}
              disabled={currentIsSaving}
              className="px-6 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Close
            </button>
            <button
              type="button"
              onClick={async () => {
                await saveReviewForPlatform(selectedPlatform);
              }}
              disabled={currentIsSaving || currentSelectedCriteria.length === 0}
              className="px-6 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {currentIsSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Review {hasMultiplePlatforms && `for ${PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
