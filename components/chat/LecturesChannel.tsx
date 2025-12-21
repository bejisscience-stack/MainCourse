'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useVideos } from '@/hooks/useVideos';
import type { Channel, Video, VideoProgress } from '@/types/server';

interface LecturesChannelProps {
  channel: Channel;
  courseId: string;
  currentUserId: string;
  isLecturer: boolean;
}

export default function LecturesChannel({
  channel,
  courseId,
  currentUserId,
  isLecturer,
}: LecturesChannelProps) {
  const { t } = useI18n();
  const { videos, isLoading: loading, mutate: mutateVideos } = useVideos(
    channel.id,
    courseId,
    currentUserId
  );
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);

  const isVideoUnlocked = (videoIndex: number) => {
    if (videoIndex === 0) return true;
    if (isLecturer) return true;
    const previousVideo = videos[videoIndex - 1];
    return previousVideo?.progress?.isCompleted || false;
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (video: Video) => {
    if (!video.progress || !video.duration) return 0;
    return (video.progress.progressSeconds / video.duration) * 100;
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-500 animate-spin"></div>
          </div>
              <p className="text-gray-400 font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-gray-900 to-gray-950 min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{channel.name}</h2>
              <p className="text-gray-500 text-sm">{t('lectures.videos', { count: videos.length })}</p>
            </div>
        </div>
        {isLecturer && (
          <button
            onClick={() => setShowUploadModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25 flex items-center gap-2 group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {t('lectures.uploadFirstVideo')}
          </button>
        )}
        </div>
      </div>

      {/* Videos Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-24 h-24 rounded-full bg-gray-800/50 flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">{t('lectures.noVideosYet')}</h3>
            <p className="text-gray-500 max-w-sm mb-6">
              {isLecturer 
                ? t('lectures.startBuildingCourse')
                : t('lectures.instructorNoVideos')}
            </p>
            {isLecturer && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/25"
              >
                {t('lectures.uploadFirstVideo')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {videos.map((video, index) => {
              const unlocked = isVideoUnlocked(index);
              const progress = getProgressPercentage(video);

              return (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  unlocked={unlocked}
                  progress={progress}
                  isLecturer={isLecturer}
                  courseId={courseId}
                  currentUserId={currentUserId}
                  formatDuration={formatDuration}
                  onPlay={() => unlocked && setSelectedVideo(video)}
                  onEdit={() => setEditingVideo(video)}
                  onDelete={async () => {
                    if (confirm(t('lectures.confirmDeleteVideo'))) {
                      await supabase.from('videos').delete().eq('id', video.id);
                      mutateVideos();
                    }
                  }}
                  onMarkAsSeen={mutateVideos}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Video Player Modal */}
      {selectedVideo && (
        <VideoPlayerModal
          video={selectedVideo}
          courseId={courseId}
          currentUserId={currentUserId}
          onClose={() => setSelectedVideo(null)}
          onProgressUpdate={mutateVideos}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && isLecturer && (
        <VideoUploadModal
          channelId={channel.id}
          courseId={courseId}
          onClose={() => {
            setShowUploadModal(false);
            mutateVideos();
          }}
        />
      )}

      {/* Edit Modal */}
      {editingVideo && isLecturer && (
        <VideoEditModal
          video={editingVideo}
          courseId={courseId}
          onClose={() => {
            setEditingVideo(null);
            mutateVideos();
          }}
        />
      )}
    </div>
  );
}

// Video Card Component
function VideoCard({
  video,
  index,
  unlocked,
  progress,
  isLecturer,
  courseId,
  currentUserId,
  formatDuration,
  onPlay,
  onEdit,
  onDelete,
  onMarkAsSeen,
}: {
  video: Video;
  index: number;
  unlocked: boolean;
  progress: number;
  isLecturer: boolean;
  courseId: string;
  currentUserId: string;
  formatDuration: (seconds?: number) => string;
  onPlay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMarkAsSeen: () => void;
}) {
  const { t } = useI18n();
  const [showMenu, setShowMenu] = useState(false);
  const [isMarkingAsSeen, setIsMarkingAsSeen] = useState(false);

  const handleMarkAsSeen = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!video.duration) return;
    
    setIsMarkingAsSeen(true);
    try {
      const { error } = await supabase.from('video_progress').upsert(
        {
          user_id: currentUserId,
          video_id: video.id,
          course_id: courseId,
          progress_seconds: video.duration,
          duration_seconds: video.duration,
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      );

      if (error) throw error;
      onMarkAsSeen();
    } catch (err) {
      console.error('Error marking video as seen:', err);
      alert('Failed to mark video as seen. Please try again.');
    } finally {
      setIsMarkingAsSeen(false);
    }
  };

  return (
    <div
      className={`group relative flex gap-4 p-4 rounded-2xl transition-all duration-300 ${
        unlocked
          ? 'bg-gray-800/40 hover:bg-gray-800/70 cursor-pointer border border-gray-700/50 hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/5'
          : 'bg-gray-800/20 border border-gray-800/50 opacity-60'
      }`}
      onClick={() => !showMenu && onPlay()}
                >
                  {/* Thumbnail */}
      <div className="relative w-48 h-28 flex-shrink-0 rounded-xl overflow-hidden bg-gray-900">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <svg className="w-12 h-12 text-gray-700" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    )}

        {/* Play overlay */}
        {unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
              <svg className="w-6 h-6 text-gray-900 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}

        {/* Lock overlay */}
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <svg className="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Duration badge */}
                    {video.duration && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/80 text-white text-xs font-medium rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}

                    {/* Progress bar */}
        {progress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-900/80">
                        <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                          style={{ width: `${progress}%` }}
            />
                      </div>
                    )}
                  </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs font-bold">
                {index + 1}
              </span>
              <h3 className="text-white font-semibold truncate">{video.title}</h3>
                    </div>
                    {video.description && (
              <p className="text-gray-400 text-sm line-clamp-2 mb-3">{video.description}</p>
            )}
            <div className="flex items-center gap-4 text-xs">
              {video.progress?.isCompleted ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/20 text-green-400 font-medium">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {t('lectures.completed')}
                </span>
              ) : progress > 0 ? (
                <span className="text-gray-500">{t('lectures.watched', { percent: Math.round(progress) })}</span>
              ) : null}
              {video.duration && (
                <span className="text-gray-500 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatDuration(video.duration)}
                </span>
              )}
            </div>
            
            {/* Mark as Seen button for students */}
            {!isLecturer && unlocked && !video.progress?.isCompleted && (
              <button
                onClick={handleMarkAsSeen}
                disabled={isMarkingAsSeen}
                className="mt-2 px-3 py-1.5 text-xs font-medium bg-indigo-600/20 text-indigo-400 rounded-lg hover:bg-indigo-600/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {isMarkingAsSeen ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('lectures.marking')}
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('lectures.markAsSeen')}
                  </>
                )}
              </button>
            )}
      </div>

          {/* Lecturer Menu */}
          {isLecturer && (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
              </button>
              
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 rounded-xl shadow-xl border border-gray-700 py-1 z-20 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onEdit();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-300 hover:bg-gray-700/50 hover:text-white flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      {t('lectures.editVideo')}
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onDelete();
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {t('lectures.deleteVideo')}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Video Player Modal
function VideoPlayerModal({
  video,
  courseId,
  currentUserId,
  onClose,
  onProgressUpdate,
}: {
  video: Video;
  courseId: string;
  currentUserId: string;
  onClose: () => void;
  onProgressUpdate: () => void;
}) {
  const { t } = useI18n();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCompleted, setIsCompleted] = useState(video.progress?.isCompleted || false);
  const [isMarkingAsSeen, setIsMarkingAsSeen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastProgressPercentageRef = useRef<number>(0);

  const markVideoAsSeen = useCallback(async (manual = false) => {
    if (!videoRef.current || !duration) return;
    
    setIsMarkingAsSeen(true);
    try {
      const current = videoRef.current.currentTime;
      const total = duration;
      
      const { error } = await supabase.from('video_progress').upsert(
        {
          user_id: currentUserId,
          video_id: video.id,
          course_id: courseId,
          progress_seconds: Math.floor(current),
          duration_seconds: Math.floor(total),
          is_completed: true,
          completed_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      );

      if (error) throw error;

      setIsCompleted(true);
      onProgressUpdate();
      
      if (manual) {
        // Show a brief success message
        const successMsg = document.createElement('div');
        successMsg.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        successMsg.textContent = '✓ Video marked as seen!';
        document.body.appendChild(successMsg);
        setTimeout(() => {
          document.body.removeChild(successMsg);
        }, 2000);
      }
    } catch (err) {
      console.error('Error marking video as seen:', err);
      alert('Failed to mark video as seen. Please try again.');
    } finally {
      setIsMarkingAsSeen(false);
    }
  }, [video.id, courseId, currentUserId, duration, onProgressUpdate]);

  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;

    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;

    if (!total || total <= 0) return;

    setCurrentTime(current);
    setDuration(total);

    const progressPercentage = (current / total) * 100;
    
    // Check if we've reached 90% and haven't marked as completed yet
    if (progressPercentage >= 90 && !isCompleted && progressPercentage > lastProgressPercentageRef.current) {
      // Clear any pending timeout
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }

      // Mark as completed after a short delay to ensure we're really at 90%
      progressUpdateTimeoutRef.current = setTimeout(async () => {
        if (!videoRef.current) return;
        
        const finalCurrent = videoRef.current.currentTime;
        const finalTotal = videoRef.current.duration;
        const finalPercentage = (finalCurrent / finalTotal) * 100;
        
        if (finalPercentage >= 90 && !isCompleted) {
          try {
            const { error } = await supabase.from('video_progress').upsert(
              {
                user_id: currentUserId,
                video_id: video.id,
                course_id: courseId,
                progress_seconds: Math.floor(finalCurrent),
                duration_seconds: Math.floor(finalTotal),
                is_completed: true,
                completed_at: new Date().toISOString(),
              },
              { onConflict: 'user_id,video_id' }
            );

            if (error) throw error;

            setIsCompleted(true);
            onProgressUpdate();
            lastUpdateTimeRef.current = Date.now();
          } catch (err) {
            console.error('Error auto-marking video as seen:', err);
          }
        }
      }, 2000); // Wait 2 seconds at 90% before auto-completing
    }

    // Update progress every 5 seconds (but not completion status)
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
    const shouldUpdateProgress = Math.floor(current) % 5 === 0 && timeSinceLastUpdate >= 5000;

    if (shouldUpdateProgress && !isCompleted) {
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }

      progressUpdateTimeoutRef.current = setTimeout(async () => {
        if (!videoRef.current || isCompleted) return;
        
        const current = videoRef.current.currentTime;
        const total = videoRef.current.duration;
        const progressPercentage = (current / total) * 100;

        // Only update progress, not completion (completion is handled above)
        if (progressPercentage < 90) {
        try {
          const { error } = await supabase.from('video_progress').upsert(
            {
              user_id: currentUserId,
              video_id: video.id,
              course_id: courseId,
              progress_seconds: Math.floor(current),
              duration_seconds: Math.floor(total),
                is_completed: false,
                completed_at: null,
            },
            { onConflict: 'user_id,video_id' }
          );

          if (error) throw error;
          lastUpdateTimeRef.current = Date.now();
        } catch (err) {
          console.error('Error updating progress:', err);
        }
    }
      }, 1000);
    }

    lastProgressPercentageRef.current = progressPercentage;
  }, [video.id, courseId, currentUserId, isCompleted, onProgressUpdate]);

  useEffect(() => {
    return () => {
      if (progressUpdateTimeoutRef.current) {
        clearTimeout(progressUpdateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-xl">{video.title}</h3>
            {video.description && (
              <p className="text-gray-400 text-sm mt-1">{video.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="aspect-video bg-black relative">
          <video
            ref={videoRef}
            src={video.videoUrl}
            controls
            autoPlay
            preload="metadata"
            playsInline
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (videoRef.current && video.progress) {
                videoRef.current.currentTime = video.progress.progressSeconds;
              }
              if (videoRef.current) {
                setDuration(videoRef.current.duration);
              }
            }}
          />
          
          {/* Progress indicator overlay */}
          {duration > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800/50">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all"
                style={{ width: `${(currentTime / duration) * 100}%` }}
          />
        </div>
          )}
        </div>
        
        {/* Action Bar */}
        <div className="p-4 border-t border-gray-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            {duration > 0 && (
              <div className="text-sm text-gray-400">
                {t('lectures.watched', { percent: Math.round((currentTime / duration) * 100) })}
              </div>
            )}
            {isCompleted ? (
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
                <span className="font-semibold">{t('lectures.completed')}</span>
            </div>
            ) : (
              <button
                onClick={() => markVideoAsSeen(true)}
                disabled={isMarkingAsSeen}
                className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-lg hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                {isMarkingAsSeen ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    {t('lectures.marking')}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t('lectures.markAsSeen')}
                  </>
                )}
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {duration > 0 && (
              <span>
                {Math.floor(currentTime / 60)}:{(Math.floor(currentTime % 60)).toString().padStart(2, '0')} / {Math.floor(duration / 60)}:{(Math.floor(duration % 60)).toString().padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
        
        {isCompleted && (
          <div className="p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-t border-green-500/20">
            <div className="flex items-center gap-3 text-green-400">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="font-semibold">Video completed! You can now access the next video.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Video Edit Modal
function VideoEditModal({
  video,
  courseId,
  onClose,
}: {
  video: Video;
  courseId: string;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    title: video.title,
    description: video.description || '',
    displayOrder: video.displayOrder || 0,
    isPublished: video.isPublished ?? true,
  });
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let thumbnailUrl = video.thumbnailUrl;

      // Upload new thumbnail if provided
      if (thumbnailFile) {
        const fileExt = thumbnailFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `thumbnail-${Date.now()}.${fileExt}`;
        const filePath = `${courseId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('course-thumbnails')
          .upload(filePath, thumbnailFile, { cacheControl: '3600', upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('course-thumbnails').getPublicUrl(filePath);
        thumbnailUrl = urlData?.publicUrl ?? undefined;
      }

      const { error: updateError } = await supabase
        .from('videos')
        .update({
          title: formData.title,
          description: formData.description || null,
          display_order: formData.displayOrder,
          is_published: formData.isPublished,
          thumbnail_url: thumbnailUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', video.id);

      if (updateError) throw updateError;

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update video');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg border border-gray-700">
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">Edit Video</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">New Thumbnail</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-medium file:cursor-pointer"
              disabled={isSubmitting}
            />
            {video.thumbnailUrl && !thumbnailFile && (
              <p className="text-gray-500 text-xs mt-2">Current thumbnail will be kept if no new file is selected.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Display Order</label>
              <input
                type="number"
                min="0"
                value={formData.displayOrder}
                onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">Visibility</label>
              <select
                value={formData.isPublished ? 'published' : 'draft'}
                onChange={(e) => setFormData({ ...formData, isPublished: e.target.value === 'published' })}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                disabled={isSubmitting}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-700 text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Video Upload Modal Component
function VideoUploadModal({
  channelId,
  courseId,
  onClose,
}: {
  channelId: string;
  courseId: string;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    displayOrder: 0,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'video' | 'thumbnail' | 'saving'>('idle');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setError('Please select a video file');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      setUploadStage('video');
      const videoUrl = await uploadFileWithProgress(videoFile, 'course-videos', 'video');
      
      let thumbnailUrl = null;
      if (thumbnailFile) {
        setUploadStage('thumbnail');
        setUploadProgress(0);
        thumbnailUrl = await uploadFileWithProgress(thumbnailFile, 'course-thumbnails', 'thumbnail');
      }

      setUploadStage('saving');
      setUploadProgress(100);
      
      let videoDuration: number | null = null;
      try {
        videoDuration = await getVideoDuration(videoFile);
      } catch {
        // Duration extraction failed
      }

      const { error: insertError } = await supabase.from('videos').insert([
        {
          channel_id: channelId,
          course_id: courseId,
          title: formData.title,
          description: formData.description || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          duration: videoDuration,
          display_order: formData.displayOrder,
          is_published: true,
        },
      ]);

      if (insertError) throw insertError;

      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
      setUploadStage('idle');
    }
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.floor(video.duration));
      };
      video.onerror = () => reject(new Error('Could not load video metadata'));
      video.src = URL.createObjectURL(file);
    });
  };

  const uploadFileWithProgress = async (file: File, bucket: string, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `${courseId}/${fileName}`;

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) throw new Error('Not authenticated');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error('Supabase URL not configured');

    const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${filePath}`;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
          if (!urlData?.publicUrl) {
            reject(new Error('Failed to get public URL'));
            return;
          }
          resolve(urlData.publicUrl);
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText);
            reject(new Error(errorData.message || `Upload failed: ${xhr.status}`));
          } catch {
            reject(new Error(`Upload failed: ${xhr.status}`));
          }
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

      xhr.open('POST', uploadUrl);
      xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.send(file);
    });
  };

  const getStageText = () => {
    switch (uploadStage) {
      case 'video': return `Uploading video... ${uploadProgress}%`;
      case 'thumbnail': return `Uploading thumbnail... ${uploadProgress}%`;
      case 'saving': return 'Saving video record...';
      default: return 'Upload Video';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-xl border border-gray-700">
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-white font-bold text-lg">Upload Video Lecture</h3>
            <p className="text-gray-500 text-sm mt-0.5">Add a new video to your course</p>
        </div>
          <button onClick={onClose} disabled={isUploading} className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition-colors disabled:opacity-50">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Video Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-500"
              placeholder="e.g., Introduction to the Course"
              disabled={isUploading}
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:text-gray-500 resize-none"
              placeholder="What will students learn in this video?"
              disabled={isUploading}
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Video File *</label>
            <div className="relative">
            <input
              type="file"
              accept="video/*"
              required
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white file:font-medium file:cursor-pointer hover:file:bg-indigo-500"
                disabled={isUploading}
              />
            </div>
            {videoFile && (
              <div className="mt-2 px-3 py-2 bg-gray-900/30 rounded-lg flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span className="text-gray-300 truncate flex-1">{videoFile.name}</span>
                <span className="text-gray-500">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Thumbnail (optional)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gray-600 file:text-white file:font-medium file:cursor-pointer hover:file:bg-gray-500"
              disabled={isUploading}
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">Display Order</label>
            <input
              type="number"
              min="0"
              value={formData.displayOrder}
              onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              disabled={isUploading}
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-3 p-4 bg-gray-900/30 rounded-xl">
              <div className="flex justify-between text-sm">
                <span className="text-gray-300 font-medium">{getStageText()}</span>
                {uploadStage !== 'saving' && <span className="text-indigo-400">{uploadProgress}%</span>}
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              {uploadStage === 'video' && videoFile && (
                <p className="text-gray-500 text-xs">
                  {((videoFile.size * uploadProgress) / (100 * 1024 * 1024)).toFixed(1)} MB of {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
            >
              {isUploading ? getStageText() : 'Upload Video'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-6 py-3 bg-gray-700 text-gray-300 font-semibold rounded-xl hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
