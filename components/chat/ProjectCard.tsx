'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { normalizeProfileUsername } from '@/lib/username';
import VideoSubmissionDialog from './VideoSubmissionDialog';
import SubmissionReviewDialog from './SubmissionReviewDialog';
import { useI18n } from '@/contexts/I18nContext';
import { useProjectCountdown } from '@/hooks/useProjectCountdown';
import { useProjectBudget } from '@/hooks/useProjectBudget';

export interface ProjectCriteria {
  id: string;
  text: string;
  rpm: number;
  platform?: string;
}

export interface ProjectData {
  id: string;
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
  startDate?: string;
  endDate?: string;
}

interface ProjectCardProps {
  project: ProjectData;
  currentUserId: string;
  isLecturer: boolean;
  channelId: string;
  onSubmission?: () => void;
}

const PLATFORM_CONFIG: Record<string, { name: string; icon: string; color: string; bg: string }> = {
  youtube: { name: 'YouTube', icon: '▶', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  instagram: { name: 'Instagram', icon: '📷', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20' },
  facebook: { name: 'Facebook', icon: 'f', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  tiktok: { name: 'TikTok', icon: '♪', color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20' },
};

export default function ProjectCard({
  project,
  currentUserId,
  isLecturer,
  channelId,
  onSubmission,
}: ProjectCardProps) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [projectCriteria, setProjectCriteria] = useState<ProjectCriteria[]>([]);
  const [reviewingSubmissionId, setReviewingSubmissionId] = useState<string | null>(null);
  const [reviewingSubmission, setReviewingSubmission] = useState<any | null>(null);
  const [projectDbId, setProjectDbId] = useState<string | null>(null);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  const countdown = useProjectCountdown(project.startDate, project.endDate);
  const budget = useProjectBudget(projectDbId || '', project.budget);
  const isProjectExpired = countdown.isExpired;

  // Format helpers
  const formattedDates = useMemo(() => {
    const formatDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };
    const start = formatDate(project.startDate);
    const end = formatDate(project.endDate);
    if (!start && !end) return null;
    if (!start) return `Until ${end}`;
    if (!end) return `From ${start}`;
    return `${start} - ${end}`;
  }, [project.startDate, project.endDate]);

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount);

  const formatViews = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  // Load criteria and project DB ID
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
              platform: c.platform || undefined,
            })));
          }
        }
      } catch (error) {
        console.error('Error loading criteria:', error);
      }
    };
    loadCriteria();
  }, [project.id]);

  // Load submissions (keeping existing logic but simplified)
  const loadSubmissions = useCallback(async () => {
    if (!isExpanded) return;
    setIsLoadingSubmissions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: projectData } = await supabase
        .from('projects')
        .select('id')
        .eq('message_id', project.id)
        .single();

      if (!projectData) {
        setIsLoadingSubmissions(false);
        return;
      }

      const { data: submissionRecords } = await supabase
        .from('project_submissions')
        .select(`*, messages!inner (id, content, user_id, created_at)`)
        .eq('project_id', projectData.id)
        .order('created_at', { ascending: false });

      let reviewsMap = new Map<string, any[]>();
      if (submissionRecords && submissionRecords.length > 0) {
        const submissionIds = submissionRecords.map((sub: any) => sub.id);
        const { data: directReviews } = await supabase
          .from('submission_reviews')
          .select('*')
          .in('submission_id', submissionIds);

        if (directReviews) {
          directReviews.forEach((review: any) => {
            const submissionId = review.submission_id;
            if (!reviewsMap.has(submissionId)) reviewsMap.set(submissionId, []);
            reviewsMap.get(submissionId)!.push(review);
          });
        }
      }

      if (!submissionRecords || submissionRecords.length === 0) {
        setSubmissions([]);
        setIsLoadingSubmissions(false);
        return;
      }

      const messageIds = submissionRecords.map((sub: any) => sub.messages?.id).filter(Boolean);
      const attachmentsMap = new Map();
      if (messageIds.length > 0) {
        const { data: attachments } = await supabase
          .from('message_attachments')
          .select('*')
          .in('message_id', messageIds);
        attachments?.forEach((att: any) => {
          if (!attachmentsMap.has(att.message_id)) attachmentsMap.set(att.message_id, []);
          attachmentsMap.get(att.message_id).push(att);
        });
      }

      const userIds = [...new Set(submissionRecords.map((sub: any) => sub.messages?.user_id).filter(Boolean))];
      const profilesMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, username, email').in('id', userIds);
        profiles?.forEach((p: any) => profilesMap.set(p.id, p));
      }

      const transformedSubmissions = submissionRecords.map((sub: any) => {
        if (!sub.messages) return null;
        const msg = sub.messages;
        const profile = profilesMap.get(msg.user_id);
        const username = profile ? normalizeProfileUsername(profile) : 'User';
        const reviews = reviewsMap.get(sub.id) || [];
        const reviewsByPlatform: Record<string, any> = {};

        reviews.forEach((review: any) => {
          const platform = review.platform ? review.platform.toLowerCase().trim() : 'all';
          let matchedCriteriaIds = Array.isArray(review.matched_criteria_ids) ? review.matched_criteria_ids : [];
          reviewsByPlatform[platform] = {
            id: review.id,
            status: review.status,
            matchedCriteriaIds,
            comment: review.comment || null,
            paymentAmount: parseFloat(review.payment_amount || '0'),
            createdAt: new Date(review.created_at).getTime(),
            platform,
          };
        });

        const review = reviews.length > 0 ? reviewsByPlatform[Object.keys(reviewsByPlatform)[0]] || null : null;

        return {
          id: msg.id,
          submissionId: sub.id,
          content: msg.content,
          timestamp: new Date(msg.created_at).getTime(),
          user: { id: msg.user_id, username, avatarUrl: '' },
          attachments: attachmentsMap.get(msg.id) || [],
          submissionData: { videoUrl: sub.video_url, message: sub.message, platformLinks: sub.platform_links },
          review,
          reviewsByPlatform,
        };
      }).filter(Boolean);

      const filteredSubmissions = transformedSubmissions.filter((sub: any) =>
        isLecturer || sub.user.id === currentUserId
      );

      setSubmissions(filteredSubmissions);
    } catch (error) {
      console.error('Error loading submissions:', error);
    } finally {
      setIsLoadingSubmissions(false);
    }
  }, [isExpanded, project.id, currentUserId, isLecturer]);

  useEffect(() => {
    if (isExpanded) loadSubmissions();
  }, [isExpanded, loadSubmissions]);

  const handleExpand = useCallback(() => {
    if (isProjectExpired && !isLecturer) return;
    setIsExpanded(!isExpanded);
  }, [isExpanded, isProjectExpired, isLecturer]);

  const handleSubmissionSuccess = useCallback(() => {
    setSubmissions([]);
    loadSubmissions();
    onSubmission?.();
  }, [loadSubmissions, onSubmission]);

  const isProjectOwner = project.submittedBy.id === currentUserId;
  const canSubmit = !isLecturer && !isProjectOwner && !isProjectExpired;

  // Calculate total potential RPM
  const totalPotentialRPM = useMemo(() =>
    projectCriteria.reduce((sum, c) => sum + c.rpm, 0), [projectCriteria]
  );

  return (
    <>
      <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isProjectExpired
          ? 'bg-gray-900/50 border-gray-700/50 opacity-70'
          : 'bg-gradient-to-br from-gray-800/90 via-gray-800/95 to-gray-900/90 border-gray-700/50 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5'
      }`}>
        {/* Gradient accent line */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${
          isProjectExpired ? 'bg-gray-600' : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
        }`} />

        {/* Main Card Content */}
        <div className="p-5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              {/* Title & Status Badges */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h3 className={`text-lg font-bold truncate ${isProjectExpired ? 'text-gray-400' : 'text-white'}`}>
                  {project.name}
                </h3>

                {/* Expired Badge */}
                {isProjectExpired && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-700 text-gray-300 border border-gray-600">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    {t('activeProjects.expired') || 'Expired'}
                  </span>
                )}

                {/* Countdown Badge */}
                {!isProjectExpired && countdown.formattedTime && (
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                    countdown.timeRemaining.days <= 1 ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    countdown.timeRemaining.days <= 3 ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {countdown.formattedTime}
                  </span>
                )}
              </div>

              {/* Author & Date */}
              <p className="text-sm text-gray-400">
                {t('projects.by')} <span className="text-gray-300 font-medium">{project.submittedBy.username}</span>
                {formattedDates && (
                  <span className="ml-2 text-gray-500">• {formattedDates}</span>
                )}
              </p>
            </div>

            {/* Expand Button */}
            <button
              onClick={handleExpand}
              disabled={isProjectExpired && !isLecturer}
              className={`flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isProjectExpired && !isLecturer
                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-emerald-500/20 hover:text-emerald-400'
              }`}
            >
              <svg className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {/* Budget Card */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 text-xs">$</span>
                </div>
                <span className="text-xs text-gray-400 font-medium">{t('activeProjects.budget') || 'Budget'}</span>
              </div>
              <p className="text-lg font-bold text-white">{formatCurrency(project.budget)}</p>
              {projectDbId && !budget.isLoading && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-500">{t('activeProjects.remaining') || 'Remaining'}</span>
                    <span className={`font-medium ${
                      budget.status === 'depleted' ? 'text-gray-500' :
                      budget.status === 'critical' ? 'text-red-400' :
                      budget.status === 'low' ? 'text-amber-400' :
                      'text-emerald-400'
                    }`}>{formatCurrency(budget.remainingBudget)}</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        budget.status === 'depleted' ? 'bg-gray-500' :
                        budget.status === 'critical' ? 'bg-red-500' :
                        budget.status === 'low' ? 'bg-amber-500' :
                        'bg-emerald-500'
                      }`}
                      style={{ width: `${budget.percentageRemaining}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Views Card */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <span className="text-xs text-gray-400 font-medium">{t('activeProjects.viewRange') || 'Views'}</span>
              </div>
              <p className="text-lg font-bold text-white">{formatViews(project.minViews)} - {formatViews(project.maxViews)}</p>
            </div>

            {/* Platforms Card */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-md bg-purple-500/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </div>
                <span className="text-xs text-gray-400 font-medium">{t('projects.platforms') || 'Platforms'}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {project.platforms.slice(0, 3).map((platform) => {
                  const config = PLATFORM_CONFIG[platform.toLowerCase()] || { name: platform, icon: '•', color: 'text-gray-400', bg: 'bg-gray-700/50 border-gray-600' };
                  return (
                    <span key={platform} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.bg} ${config.color}`}>
                      <span>{config.icon}</span>
                      <span className="hidden sm:inline">{config.name}</span>
                    </span>
                  );
                })}
                {project.platforms.length > 3 && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700/50 text-gray-400">+{project.platforms.length - 3}</span>
                )}
              </div>
            </div>

            {/* Potential RPM Card */}
            <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md bg-amber-500/20 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs text-gray-400 font-medium">{t('activeProjects.potentialRPM') || 'Potential RPM'}</span>
              </div>
              <p className="text-lg font-bold text-white">{formatCurrency(totalPotentialRPM)}</p>
              <p className="text-xs text-gray-500">{projectCriteria.length} criteria</p>
            </div>
          </div>

          {/* Description */}
          <p className={`text-sm leading-relaxed ${isProjectExpired ? 'text-gray-500' : 'text-gray-300'} ${!isExpanded ? 'line-clamp-2' : ''}`}>
            {project.description}
          </p>

          {/* Action Button (when not expanded) */}
          {!isExpanded && canSubmit && (
            <button
              onClick={() => setShowSubmissionDialog(true)}
              className="mt-4 w-full py-2.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('projects.submitVideo') || 'Submit Video'}
            </button>
          )}
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-700/50 bg-gray-900/30">
            <div className="p-5 space-y-5">
              {/* Reference Video */}
              {project.videoLink && (
                <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-300">{t('projects.referenceVideo') || 'Reference Video'}</p>
                    <a href={project.videoLink} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 truncate block">
                      {project.videoLink}
                    </a>
                  </div>
                  <a href={project.videoLink} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors">
                    {t('projects.viewVideo') || 'Watch'}
                  </a>
                </div>
              )}

              {/* Criteria Section */}
              {projectCriteria.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                    </svg>
                    {t('projects.criteria') || 'Criteria'} ({projectCriteria.length})
                  </h4>
                  <div className="space-y-2">
                    {projectCriteria.map((criterion) => (
                      <div key={criterion.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="text-sm text-gray-300">{criterion.text}</span>
                          {criterion.platform && (
                            <span className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-400">{PLATFORM_CONFIG[criterion.platform.toLowerCase()]?.name || criterion.platform}</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-emerald-400">${criterion.rpm.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submissions Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    {t('projects.submissions') || 'Submissions'} {submissions.length > 0 && `(${submissions.length})`}
                  </h4>
                  {canSubmit && (
                    <button
                      onClick={() => setShowSubmissionDialog(true)}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-sm font-medium rounded-lg transition-all"
                    >
                      {t('projects.submitVideo') || 'Submit Video'}
                    </button>
                  )}
                </div>

                {isLoadingSubmissions ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="ml-3 text-gray-400 text-sm">{t('projects.loadingSubmissions') || 'Loading...'}</span>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="text-center py-8 bg-gray-800/30 rounded-lg border border-gray-700/50">
                    <svg className="w-12 h-12 mx-auto text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-400 text-sm mb-1">{t('projects.noSubmissionsYet') || 'No submissions yet'}</p>
                    <p className="text-gray-500 text-xs">{canSubmit ? (t('projects.beFirstToSubmit') || 'Be the first to submit!') : ''}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {submissions.map((submission: any) => {
                      const submissionData = submission.submissionData || {};
                      const reviewsByPlatform = submission.reviewsByPlatform || {};
                      const isOwnSubmission = submission.user.id === currentUserId;
                      const totalRPM = Object.values(reviewsByPlatform).reduce((sum: number, r: any) => sum + (r.paymentAmount || 0), 0);
                      const hasReview = Object.keys(reviewsByPlatform).length > 0;
                      const platformLinks = submissionData.platformLinks || {};

                      return (
                        <div
                          key={submission.id}
                          onClick={() => setExpandedSubmissionId(expandedSubmissionId === submission.submissionId ? null : submission.submissionId)}
                          className="p-4 bg-gray-800/50 rounded-lg border border-gray-700/50 hover:border-gray-600 cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-sm font-semibold">
                                {submission.user.username.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-white">{submission.user.username}</p>
                                <p className="text-xs text-gray-500">{new Date(submission.timestamp).toLocaleString()}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {hasReview && totalRPM > 0 && (
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ${totalRPM.toFixed(2)} RPM
                                </span>
                              )}
                              {hasReview && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                  {t('projects.reviewed') || 'Reviewed'}
                                </span>
                              )}
                              {isLecturer && !hasReview && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setReviewingSubmissionId(submission.submissionId);
                                    setReviewingSubmission(submission);
                                  }}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg transition-colors"
                                >
                                  Review
                                </button>
                              )}
                              <svg className={`w-5 h-5 text-gray-400 transition-transform ${expandedSubmissionId === submission.submissionId ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </div>

                          {/* Expanded Submission Details */}
                          {expandedSubmissionId === submission.submissionId && (
                            <div className="mt-4 pt-4 border-t border-gray-700/50 space-y-3">
                              {/* Platform Links */}
                              {Object.keys(platformLinks).length > 0 && (
                                <div className="space-y-2">
                                  {Object.entries(platformLinks).map(([platform, link]) => (
                                    <div key={platform} className="flex items-center gap-3 p-2 bg-gray-900/50 rounded-lg">
                                      <span className={`text-sm font-medium ${PLATFORM_CONFIG[platform.toLowerCase()]?.color || 'text-gray-400'}`}>
                                        {PLATFORM_CONFIG[platform.toLowerCase()]?.name || platform}
                                      </span>
                                      <a href={link as string} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 truncate flex-1">
                                        {link as string}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Legacy video URL */}
                              {submissionData.videoUrl && Object.keys(platformLinks).length === 0 && (
                                <a href={submissionData.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-emerald-400 hover:text-emerald-300 block">
                                  {submissionData.videoUrl}
                                </a>
                              )}

                              {/* Review Details */}
                              {hasReview && (isOwnSubmission || isLecturer) && (
                                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                                  <p className="text-xs text-emerald-400 font-semibold mb-2">Earned RPM: ${totalRPM.toFixed(2)}</p>
                                  {Object.entries(reviewsByPlatform).map(([platform, review]: [string, any]) => (
                                    <div key={platform} className="text-xs text-gray-400">
                                      {PLATFORM_CONFIG[platform.toLowerCase()]?.name || platform}: ${review.paymentAmount?.toFixed(2) || '0.00'}
                                      {review.comment && <p className="mt-1 text-gray-500 italic">"{review.comment}"</p>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
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

      {reviewingSubmissionId && projectDbId && reviewingSubmission && (
        <SubmissionReviewDialog
          isOpen={!!reviewingSubmissionId}
          onClose={() => {
            setReviewingSubmissionId(null);
            setReviewingSubmission(null);
            setSubmissions([]);
            if (isExpanded) loadSubmissions();
          }}
          onReview={() => {
            setSubmissions([]);
            if (isExpanded) loadSubmissions();
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
