'use client';

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeProfileUsername } from '@/lib/username';
import VideoSubmissionDialog from './VideoSubmissionDialog';
import SubmissionReviewDialog from './SubmissionReviewDialog';

export interface ProjectCriteria {
  id: string;
  text: string;
  rpm: number;
}

export interface ProjectData {
  id: string; // message ID
  name: string;
  description: string;
  videoLink?: string;
  budget: number;
  minViews: number;
  maxViews: number;
  platforms: string[];
  criteria: ProjectCriteria[];
  submittedBy: {
    id: string;
    username: string;
  };
  timestamp: number;
}

interface ProjectCardProps {
  project: ProjectData;
  currentUserId: string;
  isLecturer: boolean;
  channelId: string;
  onSubmission?: () => void;
}

const PLATFORM_NAMES: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
};

export default function ProjectCard({
  project,
  currentUserId,
  isLecturer,
  channelId,
  onSubmission,
}: ProjectCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [projectCriteria, setProjectCriteria] = useState<ProjectCriteria[]>([]);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [projectDbId, setProjectDbId] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [expandedReviewSections, setExpandedReviewSections] = useState<Set<string>>(new Set());

  // Load criteria and project DB ID when component mounts or project changes
  useEffect(() => {
    const loadCriteria = async () => {
      try {
        const { data: projectData } = await supabase
          .from('projects')
          .select('id')
          .eq('message_id', project.id)
          .single();

        if (projectData) {
          setProjectDbId(projectData.id);

          const { data: criteria } = await supabase
            .from('project_criteria')
            .select('*')
            .eq('project_id', projectData.id)
            .order('display_order', { ascending: true });

          if (criteria) {
            setProjectCriteria(criteria.map(c => ({
              id: c.id,
              text: c.criteria_text,
              rpm: parseFloat(c.rpm),
            })));
          }
        }
      } catch (error) {
        console.error('Error loading criteria:', error);
      }
    };

    loadCriteria();
  }, [project.id, supabase]);

  const loadSubmissions = useCallback(async () => {
    // Always reload when called (don't check submissions.length to allow refresh)
    if (!isExpanded) return;
    
    setIsLoadingSubmissions(true);
    try {
      // Fetch submissions from the database
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Find project by message_id (project.id is the message_id)
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('id')
        .eq('message_id', project.id)
        .single();

      if (projectError || !projectData) {
        console.error('Error fetching project:', projectError);
        setIsLoadingSubmissions(false);
        return;
      }

      // Fetch submissions for this project
      const { data: submissionRecords, error: submissionsError } = await supabase
        .from('project_submissions')
        .select(`
          *,
          messages!inner (
            id,
            content,
            user_id,
            created_at
          )
        `)
        .eq('project_id', projectData.id)
        .order('created_at', { ascending: false });
      
      // Load reviews separately to avoid RLS issues with joins
      let reviewsMap = new Map();
      if (submissionRecords && submissionRecords.length > 0) {
        const submissionIds = submissionRecords.map((sub: any) => sub.id);
        const { data: directReviews, error: directReviewsError } = await supabase
          .from('submission_reviews')
          .select('*')
          .in('submission_id', submissionIds);
        
        console.log('🔍 Direct query of submission_reviews table:', {
          submissionIds,
          directReviews,
          directReviewsError,
          reviewCount: directReviews?.length || 0,
        });
        
        // Create a map of submission_id -> review for easy lookup
        if (directReviews && !directReviewsError) {
          directReviews.forEach((review: any) => {
            reviewsMap.set(review.submission_id, review);
          });
        } else if (directReviewsError) {
          console.error('Error loading reviews directly:', directReviewsError);
        }
      }

      console.log('Loaded submissions:', submissionRecords?.length || 0, {
        projectId: projectData.id,
        records: submissionRecords,
        error: submissionsError,
      });

      // Debug: Log review data
      if (submissionRecords && submissionRecords.length > 0) {
        submissionRecords.forEach((sub: any, idx: number) => {
          const rawReview = sub.submission_reviews?.[0];
          console.log(`📋 Submission ${idx + 1} - Raw Data:`, {
            submissionId: sub.id,
            userId: sub.messages?.user_id,
            hasRawReview: !!rawReview,
            rawReview: rawReview,
            rawReviewType: typeof rawReview,
            rawReviewKeys: rawReview ? Object.keys(rawReview) : null,
            matchedCriteriaIds: rawReview?.matched_criteria_ids,
            matchedCriteriaIdsType: typeof rawReview?.matched_criteria_ids,
            paymentAmount: rawReview?.payment_amount,
            paymentAmountType: typeof rawReview?.payment_amount,
            allSubmissionReviews: sub.submission_reviews,
            submissionReviewsLength: sub.submission_reviews?.length || 0,
          });
        });
      }

      if (submissionsError) {
        console.error('Error loading submissions:', submissionsError);
        setIsLoadingSubmissions(false);
        return;
      }

      if (!submissionRecords || submissionRecords.length === 0) {
        console.log('No submissions found for project:', projectData.id);
        setSubmissions([]);
        setIsLoadingSubmissions(false);
        return;
      }

      // Fetch attachments separately for all messages
      const messageIds = (submissionRecords || []).map((sub: any) => sub.messages?.id).filter(Boolean);
      const attachmentsMap = new Map();
      
      if (messageIds.length > 0) {
        const { data: attachments } = await supabase
          .from('message_attachments')
          .select('*')
          .in('message_id', messageIds);
        
        if (attachments) {
          attachments.forEach((att: any) => {
            if (!attachmentsMap.has(att.message_id)) {
              attachmentsMap.set(att.message_id, []);
            }
            attachmentsMap.get(att.message_id).push({
              id: att.id,
              fileUrl: att.file_url,
              fileName: att.file_name,
              fileType: att.file_type,
              fileSize: att.file_size,
              mimeType: att.mime_type,
            });
          });
        }
      }

      // Transform submission records to message format
      const transformedSubmissions = await Promise.all(
        (submissionRecords || []).map(async (sub: any) => {
          if (!sub.messages) return null;

          const msg = sub.messages;
          
          // Get user profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, username, email')
            .eq('id', msg.user_id)
            .single();

          // Use normalizeProfileUsername to get username from profiles table
          const username = profile ? normalizeProfileUsername(profile) : 'User';
          
          // Debug log if username is missing
          if (!profile || !profile.username || username === 'User') {
            console.warn(`⚠️ Username issue in ProjectCard for submission ${sub.id}:`, {
              submissionId: sub.id,
              userId: msg.user_id,
              hasProfile: !!profile,
              profileUsername: profile?.username,
              normalizedUsername: username,
              profileEmail: profile?.email,
            });
          }

          // Get attachments for this message
          const messageAttachments = attachmentsMap.get(msg.id) || [];

          // Get review data from the map we created (loaded separately to avoid RLS join issues)
          const review = reviewsMap.get(sub.id) || null;
          
          // Debug: Log review transformation
          if (sub.messages?.user_id === currentUserId || isLecturer) {
            console.log(`🔄 Transforming review for submission ${sub.id}:`, {
              hasRawReview: !!review,
              rawReview: review,
              reviewFromMap: reviewsMap.get(sub.id),
              allReviewsInMap: Array.from(reviewsMap.keys()),
            });
          }

          // Transform review data, ensuring matched_criteria_ids is an array
          let reviewData = null;
          if (review) {
            // Handle matched_criteria_ids - it might be an array or null
            let matchedCriteriaIds: string[] = [];
            if (review.matched_criteria_ids) {
              // If it's already an array, use it; otherwise convert
              matchedCriteriaIds = Array.isArray(review.matched_criteria_ids) 
                ? review.matched_criteria_ids 
                : [];
            }

            reviewData = {
              id: review.id,
              status: review.status,
              matchedCriteriaIds: matchedCriteriaIds,
              comment: review.comment || null,
              paymentAmount: parseFloat(review.payment_amount || '0'),
              createdAt: new Date(review.created_at).getTime(),
            };
            
            // Debug: Log transformed review
            if (sub.messages?.user_id === currentUserId || isLecturer) {
              console.log(`✅ Transformed review data:`, reviewData);
            }
          } else {
            // Debug: Log why review is null
            if (sub.messages?.user_id === currentUserId || isLecturer) {
              console.log(`❌ No review found for submission ${sub.id}. Raw data:`, {
                submissionReviews: sub.submission_reviews,
                submissionReviewsType: typeof sub.submission_reviews,
                submissionReviewsIsArray: Array.isArray(sub.submission_reviews),
              });
            }
          }

          return {
            id: msg.id,
            submissionId: sub.id,
            content: msg.content,
            timestamp: new Date(msg.created_at).getTime(),
            user: {
              id: msg.user_id,
              username,
              avatarUrl: '',
            },
            attachments: messageAttachments.length > 0 ? messageAttachments : undefined,
            submissionData: {
              videoUrl: sub.video_url,
              message: sub.message,
              platformLinks: sub.platform_links || null, // Platform-specific links
            },
            review: reviewData,
          };
        })
      );

      // Filter submissions: students see only their own, lecturers see all
      const filteredSubmissions = transformedSubmissions.filter(Boolean).filter((sub: any) => {
        if (isLecturer) {
          return true; // Lecturers see all submissions
        } else {
          return sub.user.id === currentUserId; // Students see only their own
        }
      });

      setSubmissions(filteredSubmissions);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [isExpanded, project.id, channelId, currentUserId, isLecturer, supabase]);

  // Load submissions when project card is expanded
  useEffect(() => {
    if (isExpanded) {
      loadSubmissions();
    }
  }, [isExpanded, loadSubmissions]);

  const handleExpand = useCallback(() => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    if (newExpanded) {
      // Load submissions when expanding
      loadSubmissions();
    }
  }, [isExpanded, loadSubmissions]);

  const handleSubmissionSuccess = useCallback(() => {
    setSubmissions([]); // Reset to reload
    loadSubmissions();
    onSubmission?.();
  }, [loadSubmissions, onSubmission]);

  const isProjectOwner = project.submittedBy.id === currentUserId;
  const canSubmit = !isLecturer && !isProjectOwner; // Students can submit, lecturers and project owner cannot

  return (
    <>
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
                🎬
              </div>
              <div>
                <h3 className="text-white font-semibold">{project.name}</h3>
                <p className="text-gray-400 text-xs">
                  by {project.submittedBy.username} • {new Date(project.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
            <p className="text-gray-300 text-sm line-clamp-2">{project.description}</p>
          </div>
          <button
            onClick={handleExpand}
            className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            <svg
              className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
            {/* Project Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Budget</p>
                <p className="text-white font-semibold">${project.budget.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">View Count Range</p>
                <p className="text-white font-semibold">
                  {project.minViews.toLocaleString()} - {project.maxViews.toLocaleString()} views
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Platforms</p>
                <div className="flex flex-wrap gap-2">
                  {project.platforms.map((platform) => (
                    <span
                      key={platform}
                      className="px-2 py-1 bg-indigo-600/20 text-indigo-300 rounded text-xs"
                    >
                      {PLATFORM_NAMES[platform] || platform}
                    </span>
                  ))}
                </div>
              </div>
              {project.videoLink && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Reference Video</p>
                  <a
                    href={project.videoLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:text-indigo-300 text-sm underline"
                  >
                    View Video
                  </a>
                </div>
              )}
            </div>

            {/* Full Description */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Description</p>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{project.description}</p>
            </div>

            {/* Criteria Section */}
            {projectCriteria.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Criteria</p>
                <div className="space-y-2">
                  {projectCriteria.map((criterion) => (
                    <div
                      key={criterion.id}
                      className="flex items-center justify-between p-2 bg-gray-700/30 rounded border border-gray-600"
                    >
                      <span className="text-white text-sm">{criterion.text}</span>
                      <span className="text-indigo-400 text-sm font-semibold">
                        ${criterion.rpm.toFixed(2)} RPM
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  RPM = Rate Per Match (payment amount if student video matches this criteria)
                </p>
              </div>
            )}

            {/* Submissions Section */}
            <div className="pt-4 border-t border-gray-700">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-white font-semibold text-sm">
                  Submissions {submissions.length > 0 && `(${submissions.length})`}
                </h4>
                {canSubmit && (
                  <button
                    onClick={() => setShowSubmissionDialog(true)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors"
                  >
                    Submit Video
                  </button>
                )}
              </div>

              {isLoadingSubmissions ? (
                <div className="text-center py-4 text-gray-400 text-sm">Loading submissions...</div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm">
                  {canSubmit ? 'No submissions yet. Be the first to submit!' : 'No submissions yet.'}
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.map((submission: any) => {
                    const submissionData = submission.submissionData || {};
                    const review = submission.review;
                    const isOwnSubmission = submission.user.id === currentUserId;
                    const isExpanded = expandedSubmissionId === submission.submissionId;
                    const platformLinks = submissionData.platformLinks || {};
                    const hasPlatformLinks = Object.keys(platformLinks).length > 0;
                    
                    // Calculate RPM from review if available
                    // Use payment_amount from review if available, otherwise calculate from criteria
                    const calculatedRPM = review 
                      ? (review.paymentAmount > 0 
                          ? review.paymentAmount 
                          : (review.matchedCriteriaIds && review.matchedCriteriaIds.length > 0
                              ? review.matchedCriteriaIds.reduce((total: number, criteriaId: string) => {
                                  const criterion = projectCriteria.find(c => c.id === criteriaId);
                                  const rpm = criterion?.rpm || 0;
                                  return total + rpm;
                                }, 0)
                              : 0))
                      : 0;
                    
                    // Debug logging for students viewing their own submissions
                    if (isOwnSubmission && !isLecturer) {
                      const willShow = !isLecturer && isOwnSubmission && review;
                      console.log('🔍 Student submission review check:', {
                        submissionId: submission.submissionId,
                        userId: submission.user.id,
                        currentUserId,
                        isLecturer,
                        isOwnSubmission,
                        hasReview: !!review,
                        review: review,
                        reviewType: typeof review,
                        reviewKeys: review ? Object.keys(review) : null,
                        calculatedRPM,
                        matchedCriteriaIds: review?.matchedCriteriaIds,
                        paymentAmount: review?.paymentAmount,
                        projectCriteriaCount: projectCriteria.length,
                        willShowReview: willShow,
                        conditionBreakdown: {
                          '!isLecturer': !isLecturer,
                          'isOwnSubmission': isOwnSubmission,
                          'review exists': !!review,
                        },
                      });
                    }
                    
                    return (
                      <>
                        <div
                          key={submission.id}
                          className="bg-gray-700/50 rounded-lg border border-gray-600 cursor-pointer hover:border-gray-500 transition-colors"
                          onClick={(e) => {
                            // Don't open dialog if clicking on review details section
                            const target = e.target as HTMLElement;
                            if (target.closest('[data-review-details-section]')) {
                              return;
                            }
                            setExpandedSubmissionId(isExpanded ? null : submission.submissionId);
                          }}
                        >
                          <div className="flex items-start justify-between gap-3 p-3">
                            <div className="flex-1">
                              {/* Header */}
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-white font-medium text-sm">
                                    {submission.user.username}
                                  </span>
                                  <span className="text-gray-500 text-xs">
                                    {new Date(submission.timestamp).toLocaleString()}
                                  </span>
                                  {/* Show RPM badge for students on their own submissions, or for lecturers on any reviewed submission */}
                                  {((isOwnSubmission && review && calculatedRPM > 0) || (isLecturer && review && calculatedRPM > 0)) && (
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-900/50 text-green-300 border border-green-700">
                                      RPM: ${calculatedRPM.toFixed(2)}
                                    </span>
                                  )}
                                  {/* Show review status badge for students */}
                                  {isOwnSubmission && review && calculatedRPM > 0 && (
                                    <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-900/50 text-indigo-300 border border-indigo-700">
                                      ✓ Reviewed
                                    </span>
                                  )}
                                </div>
                                {/* Expand/Collapse Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSubmissionId(isExpanded ? null : submission.submissionId);
                                  }}
                                  className="text-gray-400 hover:text-white transition-colors"
                                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                  <svg
                                    className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                              </div>

                              {/* Collapsed View - Summary */}
                              {!isExpanded && (
                                <div className="space-y-2">
                                  <div className="text-gray-400 text-xs">
                                    {hasPlatformLinks 
                                      ? `${Object.keys(platformLinks).length} platform link(s)`
                                      : submissionData.videoUrl 
                                        ? 'Video link available'
                                        : 'Click to view details'
                                    }
                                  </div>
                                  
                                  {/* Show RPM and Matched Criteria for students on their own submissions, or for lecturers on any reviewed submission */}
                                  {((isOwnSubmission && review && calculatedRPM > 0) || (isLecturer && review && calculatedRPM > 0)) && (
                                    <div className="pt-2 border-t border-gray-600" data-review-details-section>
                                      {/* Collapsible Review Section Header */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedReviewSections(prev => {
                                            const newSet = new Set(prev);
                                            if (newSet.has(submission.submissionId)) {
                                              newSet.delete(submission.submissionId);
                                            } else {
                                              newSet.add(submission.submissionId);
                                            }
                                            return newSet;
                                          });
                                        }}
                                        className="w-full flex items-center justify-between text-left hover:bg-gray-600/20 rounded-lg p-2 -m-2 transition-colors"
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-gray-300">
                                            Review Details
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            (RPM: ${calculatedRPM.toFixed(2)})
                                          </span>
                                        </div>
                                        <svg
                                          className={`w-4 h-4 text-gray-400 transition-transform ${
                                            expandedReviewSections.has(submission.submissionId) ? 'rotate-180' : ''
                                          }`}
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                      </button>
                                      
                                      {/* Collapsible Review Content */}
                                      {expandedReviewSections.has(submission.submissionId) && (
                                        <div className="space-y-2 mt-2">
                                          {/* RPM Display - Similar to review dialog */}
                                          <div className="bg-green-900/20 border border-green-700 rounded-lg p-2">
                                            <p className="text-xs text-gray-300 mb-0.5">
                                              <span className="font-semibold">Saved RPM:</span>{' '}
                                              <span className="text-green-400 font-bold">${calculatedRPM.toFixed(2)}</span>
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                              {isLecturer 
                                                ? 'Your review: Student will see this amount based on selected criteria'
                                                : 'Student will see this amount based on selected criteria'}
                                            </p>
                                          </div>
                                          
                                          {/* Matched Criteria - Similar to review dialog with checkboxes */}
                                          {review.matchedCriteriaIds && review.matchedCriteriaIds.length > 0 && (
                                            <div>
                                              <p className="text-xs text-gray-500 mb-1.5 font-semibold">Matched Criteria:</p>
                                              <div className="space-y-1.5">
                                                {review.matchedCriteriaIds.map((criteriaId: string) => {
                                                  const criterion = projectCriteria.find(c => c.id === criteriaId);
                                                  return criterion ? (
                                                    <div
                                                      key={criteriaId}
                                                      className="flex items-center justify-between p-2 rounded-lg border bg-indigo-600/10 border-indigo-500/30"
                                                    >
                                                      <div className="flex items-center space-x-2">
                                                        <div className="w-4 h-4 bg-indigo-600 border border-indigo-500 rounded flex items-center justify-center flex-shrink-0">
                                                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                          </svg>
                                                        </div>
                                                        <span className="text-white text-xs font-medium">{criterion.text}</span>
                                                      </div>
                                                      <span className="text-indigo-400 text-xs font-semibold">
                                                        ${criterion.rpm.toFixed(2)} RPM
                                                      </span>
                                                    </div>
                                                  ) : null;
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Dialog Modal */}
                        {isExpanded && (
                          <div 
                            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
                            onClick={() => setExpandedSubmissionId(null)}
                          >
                            <div 
                              className="relative w-full max-w-3xl bg-gray-800 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Close button */}
                              <button
                                onClick={() => setExpandedSubmissionId(null)}
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

                              <div className="p-6 space-y-4">
                                {/* Header */}
                                <div className="border-b border-gray-700 pb-4">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className="text-white font-semibold text-lg">
                                      {submission.user.username}
                                    </span>
                                    <span className="text-gray-500 text-sm">
                                      {new Date(submission.timestamp).toLocaleString()}
                                    </span>
                                    {/* Show RPM badge for students on their own submissions, or for lecturers on any reviewed submission */}
                                    {((isOwnSubmission && review && calculatedRPM > 0) || (isLecturer && review && calculatedRPM > 0)) && (
                                      <span className="px-3 py-1 rounded text-sm font-semibold bg-green-900/50 text-green-300 border border-green-700">
                                        RPM: ${calculatedRPM.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Content */}
                                <div className="space-y-4">
                                  {/* Platform Links */}
                                  {hasPlatformLinks && (
                                    <div>
                                      <p className="text-sm text-gray-400 mb-3 font-semibold">Video Links by Platform:</p>
                                      <div className="space-y-3">
                                        {Object.entries(platformLinks).map(([platform, link]) => (
                                          <div key={platform} className="bg-gray-700/50 rounded-lg p-3">
                                            <div className="flex items-center justify-between gap-3">
                                              <span className="text-sm text-gray-300 font-medium w-24">{PLATFORM_NAMES[platform.toLowerCase()] || platform}:</span>
                                              <a
                                                href={link as string}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:text-indigo-300 text-sm underline flex-1 truncate"
                                              >
                                                {link as string}
                                              </a>
                                              <a
                                                href={link as string}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors whitespace-nowrap"
                                              >
                                                Open
                                              </a>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Legacy Video URL */}
                                  {submissionData.videoUrl && !hasPlatformLinks && (
                                    <div>
                                      <p className="text-sm text-gray-400 mb-2 font-semibold">Video Link:</p>
                                      <div className="bg-gray-700/50 rounded-lg p-3">
                                        <a
                                          href={submissionData.videoUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-indigo-400 hover:text-indigo-300 text-sm underline break-all"
                                        >
                                          {submissionData.videoUrl}
                                        </a>
                                      </div>
                                    </div>
                                  )}

                                  {/* Review Section for Students - Show prominently after video links */}
                                  {!isLecturer && isOwnSubmission && review ? (
                                    <div className="pt-4 border-t border-gray-700">
                                      <p className="text-sm text-white mb-3 font-bold">Your Review Results</p>
                                      <div className="space-y-3">
                                        {/* Matched Criteria Breakdown */}
                                        {review.matchedCriteriaIds && review.matchedCriteriaIds.length > 0 ? (
                                          <div>
                                            <p className="text-xs text-gray-400 mb-2 font-semibold">Matched Criteria & RPM Breakdown:</p>
                                            <div className="space-y-2">
                                              {review.matchedCriteriaIds.map((criteriaId: string) => {
                                                const criterion = projectCriteria.find(c => c.id === criteriaId);
                                                return criterion ? (
                                                  <div
                                                    key={criteriaId}
                                                    className="bg-indigo-600/10 border border-indigo-600/30 rounded-lg p-3 flex items-center justify-between"
                                                  >
                                                    <div className="flex items-center space-x-2">
                                                      <div className="w-4 h-4 bg-indigo-600 border border-indigo-500 rounded flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                      </div>
                                                      <span className="text-sm text-indigo-300 font-medium">{criterion.text}</span>
                                                    </div>
                                                    <span className="text-indigo-400 font-bold">+${criterion.rpm.toFixed(2)} RPM</span>
                                                  </div>
                                                ) : null;
                                              })}
                                            </div>
                                          </div>
                                        ) : null}
                                        
                                        {/* Total RPM Display - Prominent */}
                                        {(calculatedRPM > 0 || (review.paymentAmount && review.paymentAmount > 0)) ? (
                                          <div className="bg-green-900/20 border-2 border-green-700 rounded-lg p-4">
                                            <p className="text-xs text-gray-400 mb-1">Total RPM Earned:</p>
                                            <p className="text-green-400 font-bold text-3xl">
                                              ${(calculatedRPM > 0 ? calculatedRPM : review.paymentAmount || 0).toFixed(2)}
                                            </p>
                                            <p className="text-xs text-green-300 mt-1">This is your total earnings from this submission</p>
                                          </div>
                                        ) : null}
                                        
                                        {/* Lecturer Comment */}
                                        {review.comment ? (
                                          <div>
                                            <p className="text-xs text-gray-400 mb-2 font-semibold">Lecturer Comment:</p>
                                            <div className="bg-gray-700/50 rounded-lg p-3">
                                              <p className="text-gray-300 text-sm whitespace-pre-wrap">{review.comment}</p>
                                            </div>
                                          </div>
                                        ) : null}
                                        
                                        {/* Show message if no criteria matched and no RPM */}
                                        {(!review.matchedCriteriaIds || review.matchedCriteriaIds.length === 0) && 
                                         calculatedRPM === 0 && 
                                         (!review.paymentAmount || review.paymentAmount === 0) ? (
                                          <div className="bg-gray-700/30 border border-gray-600 rounded-lg p-3">
                                            <p className="text-sm text-gray-400">Review submitted but no criteria matched</p>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  ) : null}
                                  
                                  {/* Debug: Show if student's own submission but no review */}
                                  {!isLecturer && isOwnSubmission && !review && (
                                    <div className="pt-4 border-t border-gray-700">
                                      <div className="bg-yellow-900/20 border border-yellow-700 rounded-lg p-3">
                                        <p className="text-xs text-yellow-300">⚠️ Debug: This is your submission but no review found. Check console for details.</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Review Section for Lecturers - Show prominently after video links */}
                                  {isLecturer && review && calculatedRPM > 0 && (
                                    <div className="pt-4 border-t border-gray-700">
                                      <p className="text-sm text-white mb-3 font-bold">Your Review</p>
                                      <div className="space-y-3">
                                        {/* Total RPM Display - Prominent */}
                                        <div className="bg-green-900/20 border-2 border-green-700 rounded-lg p-4">
                                          <p className="text-xs text-gray-400 mb-1">Total RPM (Student will see this amount):</p>
                                          <p className="text-green-400 font-bold text-3xl">${calculatedRPM.toFixed(2)}</p>
                                          <p className="text-xs text-green-300 mt-1">Based on {review.matchedCriteriaIds?.length || 0} matched criteria</p>
                                        </div>
                                        
                                        {/* Matched Criteria Breakdown */}
                                        {review.matchedCriteriaIds && review.matchedCriteriaIds.length > 0 && (
                                          <div>
                                            <p className="text-xs text-gray-400 mb-2 font-semibold">Matched Criteria & RPM Breakdown:</p>
                                            <div className="space-y-2">
                                              {review.matchedCriteriaIds.map((criteriaId: string) => {
                                                const criterion = projectCriteria.find(c => c.id === criteriaId);
                                                return criterion ? (
                                                  <div
                                                    key={criteriaId}
                                                    className="bg-indigo-600/10 border border-indigo-600/30 rounded-lg p-3 flex items-center justify-between"
                                                  >
                                                    <div className="flex items-center space-x-2">
                                                      <div className="w-4 h-4 bg-indigo-600 border border-indigo-500 rounded flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                      </div>
                                                      <span className="text-sm text-indigo-300 font-medium">{criterion.text}</span>
                                                    </div>
                                                    <span className="text-indigo-400 font-bold">+${criterion.rpm.toFixed(2)} RPM</span>
                                                  </div>
                                                ) : null;
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        
                                        {/* Lecturer Comment */}
                                        {review.comment && (
                                          <div>
                                            <p className="text-xs text-gray-400 mb-2 font-semibold">Your Comment:</p>
                                            <div className="bg-gray-700/50 rounded-lg p-3">
                                              <p className="text-gray-300 text-sm whitespace-pre-wrap">{review.comment}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Message */}
                                  {submissionData.message && (
                                    <div>
                                      <p className="text-sm text-gray-400 mb-2 font-semibold">Message:</p>
                                      <div className="bg-gray-700/50 rounded-lg p-3">
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{submissionData.message}</p>
                                      </div>
                                    </div>
                                  )}
                                  {submission.content && submission.content !== 'Video submission' && submission.content !== 'Submission' && (
                                    <div>
                                      <p className="text-sm text-gray-400 mb-2 font-semibold">Content:</p>
                                      <div className="bg-gray-700/50 rounded-lg p-3">
                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{submission.content}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Attachments */}
                                  {submission.attachments && submission.attachments.length > 0 && (
                                    <div>
                                      <p className="text-sm text-gray-400 mb-2 font-semibold">Attachments:</p>
                                      <div className="space-y-3">
                                        {submission.attachments.map((att: any) => (
                                          <div key={att.id} className="bg-gray-700/50 rounded-lg p-3">
                                            {att.fileType === 'video' ? (
                                              <video
                                                src={att.fileUrl}
                                                controls
                                                className="w-full max-w-2xl rounded-lg"
                                                preload="metadata"
                                              >
                                                Your browser does not support the video tag.
                                              </video>
                                            ) : (
                                              <a
                                                href={att.fileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-indigo-400 hover:text-indigo-300 text-sm underline"
                                              >
                                                {att.fileName}
                                              </a>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}


                                  {/* Lecturer Review Button */}
                                  {isLecturer && !review && (
                                    <div className="pt-4 border-t border-gray-700">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setExpandedSubmissionId(null);
                                          setReviewingSubmissionId(submission.submissionId);
                                        }}
                                        className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded-lg transition-colors font-medium"
                                      >
                                        Review Submission
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Video Submission Dialog */}
      {showSubmissionDialog && (
        <VideoSubmissionDialog
          isOpen={showSubmissionDialog}
          onClose={() => setShowSubmissionDialog(false)}
          onSubmit={handleSubmissionSuccess}
          projectId={project.id}
          channelId={channelId}
          platforms={project.platforms}
        />
      )}

      {/* Submission Review Dialog */}
      {reviewingSubmissionId && projectDbId && (
        <SubmissionReviewDialog
          isOpen={!!reviewingSubmissionId}
          onClose={() => {
            setReviewingSubmissionId(null);
            setSubmissions([]); // Reset to reload
            if (isExpanded) {
              loadSubmissions();
            }
          }}
          onReview={() => {
            setSubmissions([]); // Reset to reload
            if (isExpanded) {
              loadSubmissions();
            }
          }}
          submissionId={reviewingSubmissionId}
          projectId={projectDbId}
          criteria={projectCriteria}
        />
      )}
    </>
  );
}


