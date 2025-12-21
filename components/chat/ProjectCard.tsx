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
  const [reviewingSubmission, setReviewingSubmission] = useState<any | null>(null);
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
              platform: c.platform || undefined, // Platform-specific or undefined for all platforms
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
    console.log('🚀 loadSubmissions CALLED - isExpanded:', isExpanded, 'projectId:', project.id);
    if (!isExpanded) {
      console.log('⏸️ Skipping - card not expanded');
      return;
    }
    
    console.log('✅ Starting to load submissions for project:', project.id);
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
      // Now we support multiple reviews per submission (one per platform)
      let reviewsMap = new Map<string, any[]>(); // Map of submission_id -> reviews array
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
        
        // Create a map of submission_id -> reviews array (multiple reviews per submission for different platforms)
        if (directReviews && !directReviewsError) {
          console.log('📊 All reviews loaded from database:', {
            totalReviews: directReviews.length,
            reviews: directReviews.map((r: any) => ({
              id: r.id,
              submission_id: r.submission_id,
              platform: r.platform,
              platformType: typeof r.platform,
              matchedCriteriaIds: r.matched_criteria_ids,
              paymentAmount: r.payment_amount,
            })),
          });
          
          directReviews.forEach((review: any) => {
            const submissionId = review.submission_id;
            if (!reviewsMap.has(submissionId)) {
              reviewsMap.set(submissionId, []);
            }
            reviewsMap.get(submissionId)!.push(review);
          });
          
          // Log the final reviewsMap
          console.log('🗺️ ReviewsMap after processing:', {
            mapSize: reviewsMap.size,
            entries: Array.from(reviewsMap.entries()).map(([subId, reviews]) => ({
              submissionId: subId,
              reviewCount: reviews.length,
              platforms: reviews.map((r: any) => r.platform),
            })),
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
          // Now supports multiple reviews per submission (one per platform)
          const reviews = reviewsMap.get(sub.id) || [];
          
          // Transform all reviews by platform
          // Normalize platform keys to lowercase to ensure consistency
          const reviewsByPlatform: Record<string, any> = {};
          
          // IMPORTANT: Process reviews and ensure we don't lose any
          // If multiple reviews have the same platform (shouldn't happen), we'll keep the most recent one
          reviews.forEach((review: any) => {
            // Normalize platform to lowercase for consistency (youtube, instagram, etc.)
            // Use the raw platform value, not null/undefined
            const rawPlatform = review.platform;
            const platform = rawPlatform ? rawPlatform.toLowerCase().trim() : 'all';
            
            // Debug: Log each review being processed
            console.log('📝 Processing review:', {
              reviewId: review.id,
              submissionId: sub.id,
              rawPlatform: rawPlatform,
              rawPlatformType: typeof rawPlatform,
              normalizedPlatform: platform,
              matchedCriteriaIds: review.matched_criteria_ids,
              paymentAmount: review.payment_amount,
            });
            
            // Handle matched_criteria_ids - it might be an array or null
            let matchedCriteriaIds: string[] = [];
            if (review.matched_criteria_ids) {
              matchedCriteriaIds = Array.isArray(review.matched_criteria_ids) 
                ? review.matched_criteria_ids 
                : [];
            }

            // If a review already exists for this platform, log a warning
            // This should NOT happen if reviews are platform-specific, but log it if it does
            if (reviewsByPlatform[platform]) {
              console.error('❌ ERROR: Multiple reviews for same platform - keeping most recent!', {
                submissionId: sub.id,
                platform,
                existingReviewId: reviewsByPlatform[platform].id,
                existingPlatform: reviewsByPlatform[platform].platform,
                existingCreatedAt: reviewsByPlatform[platform].createdAt,
                newReviewId: review.id,
                newPlatform: review.platform,
                newCreatedAt: new Date(review.created_at).getTime(),
                allReviewsForSubmission: reviews.map((r: any) => ({
                  id: r.id,
                  platform: r.platform,
                  normalized: r.platform ? r.platform.toLowerCase().trim() : 'all',
                  createdAt: r.created_at,
                })),
              });
              
              // Keep the most recent review if there's a conflict
              const existingCreatedAt = reviewsByPlatform[platform].createdAt;
              const newCreatedAt = new Date(review.created_at).getTime();
              if (newCreatedAt <= existingCreatedAt) {
                console.log('⏭️ Skipping older review, keeping existing one');
                return; // Skip this review, keep the existing one
              }
              console.log('✅ Replacing with newer review');
            }

            reviewsByPlatform[platform] = {
              id: review.id,
              status: review.status,
              matchedCriteriaIds: matchedCriteriaIds,
              comment: review.comment || null,
              paymentAmount: parseFloat(review.payment_amount || '0'),
              createdAt: new Date(review.created_at).getTime(),
              platform: platform,
            };
          });
          
          // Debug: Log final reviewsByPlatform with detailed info
          const platformKeys = Object.keys(reviewsByPlatform);
          console.log('✅ Final reviewsByPlatform for submission', sub.id, ':', {
            reviewsByPlatform,
            platformKeys,
            platformCount: platformKeys.length,
            allPlatforms: platformKeys.join(', '),
            reviewDetails: platformKeys.map(key => ({
              platform: key,
              reviewId: reviewsByPlatform[key].id,
              rpm: reviewsByPlatform[key].paymentAmount,
              criteriaCount: reviewsByPlatform[key].matchedCriteriaIds?.length || 0,
            })),
          });
          
          // If we expected multiple platforms but only got one, log a warning
          if (reviews.length > 1 && platformKeys.length === 1) {
            console.error('❌ ERROR: Multiple reviews loaded but only one platform in reviewsByPlatform!', {
              submissionId: sub.id,
              totalReviewsLoaded: reviews.length,
              platformsInReviewsByPlatform: platformKeys.length,
              allReviewPlatforms: reviews.map((r: any) => ({
                id: r.id,
                rawPlatform: r.platform,
                normalizedPlatform: r.platform ? r.platform.toLowerCase() : 'all',
              })),
            });
          }

          // For backward compatibility, use first review if only one exists
          // Otherwise, we'll use reviewsByPlatform to show platform-specific data
          const review = reviews.length > 0 ? reviewsByPlatform[Object.keys(reviewsByPlatform)[0]] || null : null;

          // Debug: Log platform links for this submission
          const platformLinksData = sub.platform_links || null;
          console.log('🔗 Submission platform links:', {
            submissionId: sub.id,
            platformLinks: platformLinksData,
            platformCount: platformLinksData ? Object.keys(platformLinksData).length : 0,
            platforms: platformLinksData ? Object.keys(platformLinksData).join(', ') : 'none',
            reviewsByPlatformCount: Object.keys(reviewsByPlatform).length,
            reviewsByPlatformKeys: Object.keys(reviewsByPlatform).join(', '),
          });

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
              platformLinks: platformLinksData, // Platform-specific links
            },
            review: review,
            reviewsByPlatform: reviewsByPlatform, // All reviews organized by platform
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
    console.log('📂 ProjectCard useEffect - isExpanded:', isExpanded, 'projectId:', project.id);
    if (isExpanded) {
      console.log('📂 Loading submissions for project:', project.id);
      loadSubmissions();
    }
  }, [isExpanded, loadSubmissions, project.id]);

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
                    const reviewsByPlatform = submission.reviewsByPlatform || {};
                    const isOwnSubmission = submission.user.id === currentUserId;
                    const isExpanded = expandedSubmissionId === submission.submissionId;
                    const platformLinks = submissionData.platformLinks || {};
                    const hasPlatformLinks = Object.keys(platformLinks).length > 0;
                    
                    // Debug: Log reviewsByPlatform to see what platforms we have
                    console.log('🔍 RENDER TIME - Reviews by platform for submission:', submission.submissionId, {
                      reviewsByPlatform,
                      platformKeys: Object.keys(reviewsByPlatform),
                      platformCount: Object.keys(reviewsByPlatform).length,
                      allPlatforms: Object.keys(reviewsByPlatform).join(', '),
                      reviewDetails: Object.keys(reviewsByPlatform).map(key => ({
                        platform: key,
                        reviewId: reviewsByPlatform[key]?.id,
                        rpm: reviewsByPlatform[key]?.paymentAmount,
                        criteriaCount: reviewsByPlatform[key]?.matchedCriteriaIds?.length || 0,
                      })),
                    });
                    
                    // Calculate RPM per platform - include ALL platforms that have reviews
                    const rpmByPlatform: Record<string, number> = {};
                    Object.keys(reviewsByPlatform).forEach(platform => {
                      const platformReview = reviewsByPlatform[platform];
                      // Always add an entry for each platform that has a review, even if RPM is 0
                      rpmByPlatform[platform] = platformReview.paymentAmount > 0
                        ? platformReview.paymentAmount
                        : (platformReview.matchedCriteriaIds && platformReview.matchedCriteriaIds.length > 0
                            ? platformReview.matchedCriteriaIds.reduce((total: number, criteriaId: string) => {
                                const criterion = projectCriteria.find(c => c.id === criteriaId);
                                const rpm = criterion?.rpm || 0;
                                return total + rpm;
                              }, 0)
                            : 0);
                    });
                    
                    // Debug: Log RPM by platform
                    if (Object.keys(rpmByPlatform).length > 0) {
                      console.log('💰 RPM by platform:', {
                        rpmByPlatform,
                        platformKeys: Object.keys(rpmByPlatform),
                        totalRPM: Object.values(rpmByPlatform).reduce((sum, rpm) => sum + rpm, 0),
                      });
                    }
                    
                    // Calculate total RPM across all platforms
                    const totalRPM = Object.values(rpmByPlatform).reduce((sum, rpm) => sum + rpm, 0);
                    
                    // Calculate RPM from review if available (for backward compatibility)
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
                                  {/* Show RPM badges - platform-wise if multiple platforms, total if single */}
                                  {((isOwnSubmission && (totalRPM > 0 || calculatedRPM > 0)) || (isLecturer && (totalRPM > 0 || calculatedRPM > 0))) && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {Object.keys(reviewsByPlatform).length > 1 ? (
                                        <>
                                          {Object.keys(reviewsByPlatform).map((platform) => {
                                            const platformRPM = rpmByPlatform[platform] || 0;
                                            const platformName = PLATFORM_NAMES[platform.toLowerCase()] || platform;
                                            return (
                                              <span key={platform} className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                                platformRPM > 0 
                                                  ? 'bg-green-900/50 text-green-300 border-green-700' 
                                                  : 'bg-gray-700/50 text-gray-400 border-gray-600'
                                              }`}>
                                                {platformName}: ${platformRPM.toFixed(2)}
                                              </span>
                                            );
                                          })}
                                          {totalRPM > 0 && (
                                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-900/50 text-green-300 border border-green-700">
                                              Total: ${totalRPM.toFixed(2)}
                                            </span>
                                          )}
                                        </>
                                      ) : Object.keys(reviewsByPlatform).length === 1 ? (
                                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-900/50 text-green-300 border border-green-700">
                                          RPM: ${(totalRPM > 0 ? totalRPM : calculatedRPM).toFixed(2)}
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-900/50 text-green-300 border border-green-700">
                                          RPM: ${(totalRPM > 0 ? totalRPM : calculatedRPM).toFixed(2)}
                                        </span>
                                      )}
                                    </div>
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
                                  {((isOwnSubmission && (Object.keys(reviewsByPlatform).length > 0 || totalRPM > 0 || calculatedRPM > 0)) || (isLecturer && (Object.keys(reviewsByPlatform).length > 0 || totalRPM > 0 || calculatedRPM > 0))) && (
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
                                            (RPM: ${(totalRPM > 0 ? totalRPM : calculatedRPM).toFixed(2)})
                                            {Object.keys(rpmByPlatform).length > 1 && ` - ${Object.keys(rpmByPlatform).length} platforms`}
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
                                          {/* Platform-wise RPM Breakdown - Always show if we have platform-specific reviews */}
                                          {Object.keys(reviewsByPlatform).length > 0 ? (
                                            <div className="space-y-3">
                                              {Object.keys(reviewsByPlatform).map((platform, index) => {
                                                const platformReview = reviewsByPlatform[platform];
                                                const platformRPM = rpmByPlatform[platform] || 0;
                                                const platformName = PLATFORM_NAMES[platform.toLowerCase()] || platform;
                                                
                                                // Debug: Log each platform being rendered
                                                console.log(`🎨 RENDERING platform ${index + 1}/${Object.keys(reviewsByPlatform).length}:`, {
                                                  platform,
                                                  platformName,
                                                  platformRPM,
                                                  reviewId: platformReview?.id,
                                                  hasCriteria: platformReview?.matchedCriteriaIds?.length > 0,
                                                  hasComment: !!platformReview?.comment,
                                                });
                                                
                                                // Show all platforms that have reviews, regardless of RPM or criteria
                                                
                                                return (
                                                  <div key={platform} className="bg-gray-700/30 border border-gray-600 rounded-lg p-3">
                                                    <div className="flex items-center justify-between mb-2">
                                                      <span className="text-xs font-semibold text-white">{platformName} Review</span>
                                                      {platformRPM > 0 && (
                                                        <span className="text-green-400 font-bold text-sm">${platformRPM.toFixed(2)} RPM</span>
                                                      )}
                                                      {platformRPM === 0 && (
                                                        <span className="text-gray-400 text-xs">No RPM earned</span>
                                                      )}
                                                    </div>
                                                    
                                                    {/* Matched Criteria for this platform */}
                                                    {platformReview.matchedCriteriaIds && platformReview.matchedCriteriaIds.length > 0 && (
                                                      <div className="space-y-1.5 mt-2">
                                                        {platformReview.matchedCriteriaIds.map((criteriaId: string) => {
                                                          const criterion = projectCriteria.find(c => c.id === criteriaId);
                                                          return criterion ? (
                                                            <div
                                                              key={criteriaId}
                                                              className="flex items-center justify-between p-1.5 rounded border bg-indigo-600/10 border-indigo-500/30"
                                                            >
                                                              <div className="flex items-center space-x-2">
                                                                <div className="w-3 h-3 bg-indigo-600 border border-indigo-500 rounded flex items-center justify-center flex-shrink-0">
                                                                  <svg className="w-2 h-2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                                    )}
                                                    
                                                    {/* Comment for this platform */}
                                                    {platformReview.comment && (
                                                      <div className="mt-2 pt-2 border-t border-gray-600">
                                                        <p className="text-xs text-gray-400 mb-1">Comment:</p>
                                                        <p className="text-gray-300 text-xs whitespace-pre-wrap">{platformReview.comment}</p>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                              
                                              {/* Total RPM Display */}
                                              {totalRPM > 0 && Object.keys(rpmByPlatform).length > 1 && (
                                                <div className="bg-green-900/20 border border-green-700 rounded-lg p-2">
                                                  <p className="text-xs text-gray-300 mb-0.5">
                                                    <span className="font-semibold">Total RPM (All Platforms):</span>{' '}
                                                    <span className="text-green-400 font-bold">${totalRPM.toFixed(2)}</span>
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                          ) : (
                                            <>
                                              {/* Fallback for legacy single review */}
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
                                          
                                              {/* Matched Criteria */}
                                              {review && review.matchedCriteriaIds && review.matchedCriteriaIds.length > 0 && (
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
                                            </>
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
                                    {((isOwnSubmission && (totalRPM > 0 || calculatedRPM > 0)) || (isLecturer && (totalRPM > 0 || calculatedRPM > 0))) && (
                                      <span className="px-3 py-1 rounded text-sm font-semibold bg-green-900/50 text-green-300 border border-green-700">
                                        RPM: ${(totalRPM > 0 ? totalRPM : calculatedRPM).toFixed(2)}
                                        {Object.keys(rpmByPlatform).length > 1 && ` (${Object.keys(rpmByPlatform).length} platforms)`}
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
                                  {!isLecturer && isOwnSubmission && (Object.keys(reviewsByPlatform).length > 0 || review) ? (
                                    <div className="pt-4 border-t border-gray-700">
                                      <p className="text-sm text-white mb-3 font-bold">Your Review Results</p>
                                      <div className="space-y-3">
                                        {/* Platform-wise RPM Breakdown - Show for all platforms */}
                                        {Object.keys(reviewsByPlatform).length > 0 ? (
                                          <div className="space-y-3">
                                            {Object.keys(reviewsByPlatform).map((platform, index) => {
                                              const platformReview = reviewsByPlatform[platform];
                                              const platformRPM = rpmByPlatform[platform] || 0;
                                              const platformName = PLATFORM_NAMES[platform.toLowerCase()] || platform;
                                              
                                              // Debug: Log each platform being rendered in expanded view
                                              console.log(`🎨 EXPANDED VIEW - Rendering platform ${index + 1}/${Object.keys(reviewsByPlatform).length}:`, {
                                                platform,
                                                platformName,
                                                platformRPM,
                                                reviewId: platformReview?.id,
                                                hasCriteria: platformReview?.matchedCriteriaIds?.length > 0,
                                                hasComment: !!platformReview?.comment,
                                              });
                                              
                                              // Show all platforms that have reviews, regardless of RPM or criteria
                                              
                                              return (
                                                <div key={platform} className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
                                                  <div className="flex items-center justify-between mb-3">
                                                    <p className="text-sm font-semibold text-white">{platformName} Review</p>
                                                    {platformRPM > 0 && (
                                                      <span className="text-green-400 font-bold text-lg">
                                                        ${platformRPM.toFixed(2)} RPM
                                                      </span>
                                                    )}
                                                    {platformRPM === 0 && (
                                                      <span className="text-gray-400 text-sm">No RPM earned</span>
                                                    )}
                                                  </div>
                                                  
                                                  {/* Matched Criteria for this platform */}
                                                  {platformReview.matchedCriteriaIds && platformReview.matchedCriteriaIds.length > 0 && (
                                                    <div className="mt-3">
                                                      <p className="text-xs text-gray-400 mb-2 font-semibold">Matched Criteria & RPM Breakdown:</p>
                                                      <div className="space-y-2">
                                                        {platformReview.matchedCriteriaIds.map((criteriaId: string) => {
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
                                                  
                                                  {/* Platform RPM Display */}
                                                  {platformRPM > 0 && (
                                                    <div className="mt-3 bg-green-900/20 border border-green-700 rounded-lg p-3">
                                                      <p className="text-xs text-gray-400 mb-1">RPM Earned for {platformName}:</p>
                                                      <p className="text-green-400 font-bold text-2xl">
                                                        ${platformRPM.toFixed(2)}
                                                      </p>
                                                    </div>
                                                  )}
                                                  
                                                  {/* Comment for this platform */}
                                                  {platformReview.comment && (
                                                    <div className="mt-3 pt-3 border-t border-gray-600">
                                                      <p className="text-xs text-gray-400 mb-2 font-semibold">Lecturer Comment ({platformName}):</p>
                                                      <div className="bg-gray-700/50 rounded-lg p-3">
                                                        <p className="text-gray-300 text-sm whitespace-pre-wrap">{platformReview.comment}</p>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            })}
                                            
                                            {/* Total RPM Display - Prominent (only if multiple platforms) */}
                                            {totalRPM > 0 && Object.keys(rpmByPlatform).length > 1 && (
                                              <div className="bg-green-900/20 border-2 border-green-700 rounded-lg p-4">
                                                <p className="text-xs text-gray-400 mb-1">Total RPM Earned (All Platforms):</p>
                                                <p className="text-green-400 font-bold text-3xl">
                                                  ${totalRPM.toFixed(2)}
                                                </p>
                                                <p className="text-xs text-green-300 mt-1">This is your total earnings from all platforms</p>
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <>
                                            {/* Single platform or legacy review - show as before */}
                                            {review && review.matchedCriteriaIds && review.matchedCriteriaIds.length > 0 ? (
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
                                            {(totalRPM > 0 || calculatedRPM > 0 || (review && review.paymentAmount && review.paymentAmount > 0)) ? (
                                          <div className="bg-green-900/20 border-2 border-green-700 rounded-lg p-4">
                                                <p className="text-xs text-gray-400 mb-1">
                                                  {Object.keys(rpmByPlatform).length > 1 
                                                    ? 'Total RPM Earned (All Platforms):' 
                                                    : 'Total RPM Earned:'}
                                                </p>
                                            <p className="text-green-400 font-bold text-3xl">
                                                  ${(totalRPM > 0 ? totalRPM : (calculatedRPM > 0 ? calculatedRPM : (review?.paymentAmount || 0))).toFixed(2)}
                                                </p>
                                                <p className="text-xs text-green-300 mt-1">
                                                  {Object.keys(rpmByPlatform).length > 1 
                                                    ? 'This is your total earnings from all platforms' 
                                                    : 'This is your total earnings from this submission'}
                                                </p>
                                          </div>
                                        ) : null}
                                          </>
                                        )}
                                        
                                        {/* Lecturer Comments - Platform-specific if multiple platforms */}
                                        {Object.keys(reviewsByPlatform).length > 1 ? (
                                          <div className="space-y-3">
                                            {Object.keys(reviewsByPlatform).map((platform) => {
                                              const platformReview = reviewsByPlatform[platform];
                                              const platformName = PLATFORM_NAMES[platform.toLowerCase()] || platform;
                                              if (!platformReview.comment) return null;
                                              
                                              return (
                                                <div key={platform}>
                                                  <p className="text-xs text-gray-400 mb-2 font-semibold">Lecturer Comment ({platformName}):</p>
                                                  <div className="bg-gray-700/50 rounded-lg p-3">
                                                    <p className="text-gray-300 text-sm whitespace-pre-wrap">{platformReview.comment}</p>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        ) : (
                                          review && review.comment ? (
                                          <div>
                                            <p className="text-xs text-gray-400 mb-2 font-semibold">Lecturer Comment:</p>
                                            <div className="bg-gray-700/50 rounded-lg p-3">
                                              <p className="text-gray-300 text-sm whitespace-pre-wrap">{review.comment}</p>
                                            </div>
                                          </div>
                                          ) : null
                                        )}
                                        
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
                                          setReviewingSubmission(submission);
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
      {reviewingSubmissionId && projectDbId && reviewingSubmission && (
        <SubmissionReviewDialog
          isOpen={!!reviewingSubmissionId}
          onClose={() => {
            setReviewingSubmissionId(null);
            setReviewingSubmission(null);
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
          submission={reviewingSubmission}
        />
      )}
    </>
  );
}


