'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { ProjectCriteria } from './ProjectCard';

interface SubmissionReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onReview: () => void;
  submissionId: string;
  projectId: string;
  criteria: ProjectCriteria[];
}

export default function SubmissionReviewDialog({
  isOpen,
  onClose,
  onReview,
  submissionId,
  projectId,
  criteria,
}: SubmissionReviewDialogProps) {
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSavedRPM, setLastSavedRPM] = useState<number>(0);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadExistingReview = useCallback(async () => {
    try {
      const { data: review, error } = await supabase
        .from('submission_reviews')
        .select('*')
        .eq('submission_id', submissionId)
        .maybeSingle();

      if (review && !error) {
        setSelectedCriteria(review.matched_criteria_ids || []);
        setComment(review.comment || '');
        setLastSavedRPM(parseFloat(review.payment_amount || '0'));
      } else {
        // No review yet, reset to defaults
        setSelectedCriteria([]);
        setComment('');
        setLastSavedRPM(0);
      }
    } catch (error) {
      console.error('Error loading review:', error);
      // Reset to defaults on error
      setSelectedCriteria([]);
      setComment('');
      setLastSavedRPM(0);
    }
  }, [submissionId, supabase]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedCriteria([]);
      setComment('');
      setError(null);
      setLastSavedRPM(0);
    } else {
      // Load existing review if any
      loadExistingReview();
    }
  }, [isOpen, submissionId, loadExistingReview]);

  const saveReview = useCallback(async (criteriaToSave: string[], commentToSave: string) => {
    setIsSaving(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const paymentAmount = criteriaToSave.reduce((total, criteriaId) => {
        const criterion = criteria.find(c => c.id === criteriaId);
        return total + (criterion?.rpm || 0);
      }, 0);

      // Ensure payment_amount is a proper decimal number (round to 2 decimal places)
      const finalPaymentAmount = Math.round(paymentAmount * 100) / 100;

      console.log('Saving review:', {
        submissionId,
        projectId,
        lecturerId: session.user.id,
        matchedCriteriaIds: criteriaToSave,
        paymentAmount: finalPaymentAmount,
        comment: commentToSave.trim() || null,
      });

      // Upsert review with "accepted" status (since we're not using reject anymore)
      // Store the final RPM and matched criteria IDs in the database
      const { data: reviewData, error: reviewError } = await supabase
        .from('submission_reviews')
        .upsert({
          submission_id: submissionId,
          project_id: projectId,
          lecturer_id: session.user.id,
          status: 'accepted', // Always accepted when criteria are selected
          matched_criteria_ids: criteriaToSave.length > 0 ? criteriaToSave : [],
          comment: commentToSave.trim() || null,
          payment_amount: finalPaymentAmount, // Store as number - Supabase will convert to DECIMAL
        }, {
          onConflict: 'submission_id',
        })
        .select();

      if (reviewError) {
        console.error('Error saving review:', reviewError);
        throw new Error(reviewError.message);
      }

      console.log('Review saved successfully:', reviewData);

      setLastSavedRPM(finalPaymentAmount);
      setSaveSuccess(true);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
      onReview(); // Notify parent to refresh
    } catch (err: any) {
      setError(err.message || 'Failed to save review');
    } finally {
      setIsSaving(false);
    }
  }, [submissionId, projectId, criteria, supabase, onReview]);

  const handleCriteriaToggle = useCallback((criteriaId: string) => {
    const newSelectedCriteria = selectedCriteria.includes(criteriaId)
      ? selectedCriteria.filter(id => id !== criteriaId)
      : [...selectedCriteria, criteriaId];
    
    setSelectedCriteria(newSelectedCriteria);
    setSaveSuccess(false); // Clear success message when criteria changes
  }, [selectedCriteria]);

  const calculatePaymentAmount = useCallback((): number => {
    return selectedCriteria.reduce((total, criteriaId) => {
      const criterion = criteria.find(c => c.id === criteriaId);
      return total + (criterion?.rpm || 0);
    }, 0);
  }, [selectedCriteria, criteria]);


  if (!isOpen) return null;

  const paymentAmount = calculatePaymentAmount();

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-gray-800 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-700 hover:bg-gray-600 rounded-full flex items-center justify-center text-gray-300 transition-colors"
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

        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Review Submission</h2>
            <p className="text-gray-400 text-sm">Select which criteria this video matches and provide your feedback</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Criteria Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Matching Criteria
            </label>
            {criteria.length === 0 ? (
              <p className="text-gray-500 text-sm">No criteria defined for this project</p>
            ) : (
              <div className="space-y-2">
                {criteria.map((criterion) => (
                  <label
                    key={criterion.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCriteria.includes(criterion.id)
                        ? 'bg-indigo-600/20 border-indigo-500'
                        : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedCriteria.includes(criterion.id)}
                        onChange={() => handleCriteriaToggle(criterion.id)}
                        className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                      />
                      <span className="text-white text-sm">{criterion.text}</span>
                    </div>
                    <span className="text-indigo-400 text-sm font-semibold">
                      ${criterion.rpm.toFixed(2)} RPM
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedCriteria.length > 0 && (
              <div className="mt-3 p-3 bg-indigo-900/20 border border-indigo-700 rounded-lg">
                <p className="text-sm text-gray-300">
                  <span className="font-semibold">Total RPM:</span>{' '}
                  <span className="text-indigo-400 font-bold">${calculatePaymentAmount().toFixed(2)}</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Based on {selectedCriteria.length} matched criteria
                  {isSaving && <span className="ml-2 text-yellow-400">(Saving...)</span>}
                </p>
              </div>
            )}
          </div>

          {/* Comment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Comment <span className="text-gray-500">(Optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => {
                setComment(e.target.value);
                setSaveSuccess(false); // Clear success message when comment changes
              }}
              placeholder="Add your feedback or comments about this submission..."
              rows={4}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Success Message */}
          {saveSuccess && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-sm text-green-300 font-semibold">
                  Review saved successfully! Student will see this information.
                </p>
              </div>
            </div>
          )}

          {/* Saved RPM Display */}
          {lastSavedRPM > 0 && !saveSuccess && (
            <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
              <p className="text-sm text-gray-300">
                <span className="font-semibold">Saved RPM:</span>{' '}
                <span className="text-green-400 font-bold">${lastSavedRPM.toFixed(2)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Student will see this amount based on selected criteria
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2 text-sm font-semibold text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Close
            </button>
            <button
              type="button"
              onClick={async () => {
                await saveReview(selectedCriteria, comment);
              }}
              disabled={isSaving || selectedCriteria.length === 0}
              className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSaving ? (
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
                  Save Review
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

