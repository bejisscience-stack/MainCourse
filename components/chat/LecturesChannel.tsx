'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
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
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    loadVideos();
  }, [channel.id]);

  const loadVideos = async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('channel_id', channel.id)
        .eq('course_id', courseId)
        .order('display_order', { ascending: true });

      if (error) throw error;

      // Load progress for each video
      const videoIds = (data || []).map((v) => v.id);
      const { data: progressData } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', currentUserId)
        .in('video_id', videoIds);

      const progressMap = new Map(
        (progressData || []).map((p) => [p.video_id, p as VideoProgress])
      );

      const videosWithProgress: Video[] = (data || []).map((v) => ({
        id: v.id,
        channelId: v.channel_id,
        courseId: v.course_id,
        title: v.title,
        description: v.description || undefined,
        videoUrl: v.video_url,
        thumbnailUrl: v.thumbnail_url || undefined,
        duration: v.duration || undefined,
        displayOrder: v.display_order,
        isPublished: v.is_published,
        progress: progressMap.get(v.id)
          ? {
              id: progressMap.get(v.id)!.id,
              userId: progressMap.get(v.id)!.user_id,
              videoId: progressMap.get(v.id)!.video_id,
              courseId: progressMap.get(v.id)!.course_id,
              progressSeconds: progressMap.get(v.id)!.progress_seconds,
              durationSeconds: progressMap.get(v.id)!.duration_seconds || undefined,
              isCompleted: progressMap.get(v.id)!.is_completed,
              completedAt: progressMap.get(v.id)!.completed_at || undefined,
            }
          : undefined,
      }));

      setVideos(videosWithProgress);
    } catch (err) {
      console.error('Error loading videos:', err);
    } finally {
      setLoading(false);
    }
  };

  const isVideoUnlocked = (videoIndex: number) => {
    if (videoIndex === 0) return true; // First video is always unlocked
    if (isLecturer) return true; // Lecturers can access all videos

    // Check if previous video is completed
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
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-400">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
          <p>Loading lectures...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      {/* Header */}
      <div className="h-12 px-4 border-b border-gray-700 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-xl">📹</span>
          <h2 className="text-white font-semibold text-sm">{channel.name}</h2>
        </div>
        {isLecturer && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Upload Video
          </button>
        )}
      </div>

      {/* Videos List */}
      <div className="flex-1 overflow-y-auto p-6">
        {videos.length === 0 ? (
          <div className="text-center text-gray-400 py-12">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg font-medium mb-2">No videos yet</p>
            {isLecturer && <p className="text-sm">Click "Upload Video" to add your first lecture</p>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {videos.map((video, index) => {
              const unlocked = isVideoUnlocked(index);
              const progress = getProgressPercentage(video);

              return (
                <div
                  key={video.id}
                  className={`bg-gray-800 rounded-lg overflow-hidden border-2 transition-all ${
                    unlocked
                      ? 'border-gray-700 hover:border-indigo-600 cursor-pointer'
                      : 'border-gray-800 opacity-60 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (unlocked) {
                      setSelectedVideo(video);
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-900">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-16 h-16 text-gray-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    )}

                    {/* Lock overlay */}
                    {!unlocked && (
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                        <div className="text-center text-white">
                          <svg
                            className="w-12 h-12 mx-auto mb-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                          <p className="text-sm font-medium">Complete previous video</p>
                        </div>
                      </div>
                    )}

                    {/* Play button */}
                    {unlocked && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                          <svg
                            className="w-8 h-8 text-gray-900 ml-1"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Duration badge */}
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}

                    {/* Progress bar */}
                    {video.progress && progress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-700">
                        <div
                          className="h-full bg-indigo-600 transition-all"
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    )}

                    {/* Completed badge */}
                    {video.progress?.isCompleted && (
                      <div className="absolute top-2 right-2 bg-green-600 text-white p-1.5 rounded-full">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Video info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-semibold text-sm line-clamp-2 flex-1">
                        {index + 1}. {video.title}
                      </h3>
                    </div>
                    {video.description && (
                      <p className="text-gray-400 text-xs line-clamp-2 mb-2">
                        {video.description}
                      </p>
                    )}
                    {video.progress && (
                      <div className="text-xs text-gray-500">
                        {video.progress.isCompleted
                          ? 'Completed'
                          : `${Math.round(progress)}% watched`}
                      </div>
                    )}
                  </div>
                </div>
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
          onProgressUpdate={loadVideos}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && isLecturer && (
        <VideoUploadModal
          channelId={channel.id}
          courseId={courseId}
          onClose={() => {
            setShowUploadModal(false);
            loadVideos();
          }}
        />
      )}
    </div>
  );
}

// Video Player Component
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
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isCompleted, setIsCompleted] = useState(video.progress?.isCompleted || false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleTimeUpdate = async () => {
    if (!videoRef.current) return;

    const current = videoRef.current.currentTime;
    const total = videoRef.current.duration;

    setCurrentTime(current);
    setDuration(total);

    // Update progress every 5 seconds
    if (Math.floor(current) % 5 === 0) {
      const progressPercentage = (current / total) * 100;
      const completed = progressPercentage >= 90; // Consider 90% as completed

      try {
        const { error } = await supabase.from('video_progress').upsert(
          {
            user_id: currentUserId,
            video_id: video.id,
            course_id: courseId,
            progress_seconds: Math.floor(current),
            duration_seconds: Math.floor(total),
            is_completed: completed,
            completed_at: completed ? new Date().toISOString() : null,
          },
          { onConflict: 'user_id,video_id' }
        );

        if (error) throw error;

        if (completed && !isCompleted) {
          setIsCompleted(true);
          onProgressUpdate();
        }
      } catch (err) {
        console.error('Error updating progress:', err);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-gray-900 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-white font-semibold text-lg">{video.title}</h3>
            {video.description && (
              <p className="text-gray-400 text-sm mt-1">{video.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="aspect-video bg-black">
          <video
            ref={videoRef}
            src={video.videoUrl}
            controls
            className="w-full h-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (videoRef.current && video.progress) {
                videoRef.current.currentTime = video.progress.progressSeconds;
              }
            }}
          />
        </div>
        {isCompleted && (
          <div className="p-4 bg-green-900/30 border-t border-green-700">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="font-medium">Video completed! You can now access the next video.</span>
            </div>
          </div>
        )}
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

    try {
      // Upload video
      const videoUrl = await uploadFile(videoFile, 'course-videos', 'video');
      
      // Upload thumbnail if provided
      let thumbnailUrl = null;
      if (thumbnailFile) {
        thumbnailUrl = await uploadFile(thumbnailFile, 'course-thumbnails', 'thumbnail');
      }

      // Get video duration (simplified - in production, use a proper video processing library)
      // For now, we'll set it to null and update later

      // Create video record
      const { error: insertError } = await supabase.from('videos').insert([
        {
          channel_id: channelId,
          course_id: courseId,
          title: formData.title,
          description: formData.description || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          display_order: formData.displayOrder,
          is_published: true,
        },
      ]);

      if (insertError) throw insertError;

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to upload video');
    } finally {
      setIsUploading(false);
    }
  };

  const uploadFile = async (file: File, bucket: string, path: string): Promise<string> => {
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `${courseId}/${fileName}`;

    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

    return urlData.publicUrl;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl">
        <div className="p-4 border-b border-gray-700">
          <h3 className="text-white font-semibold">Upload Video Lecture</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Video Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Introduction to..."
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="What will students learn in this video?"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Video File *
            </label>
            <input
              type="file"
              accept="video/*"
              required
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Thumbnail (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-gray-300 text-sm font-medium mb-2">
              Display Order
            </label>
            <input
              type="number"
              min="0"
              value={formData.displayOrder}
              onChange={(e) =>
                setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })
              }
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isUploading}
              className="flex-1 bg-indigo-600 text-white font-semibold px-4 py-2 rounded hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {isUploading ? 'Uploading...' : 'Upload Video'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 text-gray-300 font-semibold px-4 py-2 rounded hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
