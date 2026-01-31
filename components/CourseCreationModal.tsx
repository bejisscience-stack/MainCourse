'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

interface CourseCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  user: User | null;
}

interface Profile {
  username: string | null;
}

export default function CourseCreationModal({
  isOpen,
  onClose,
  onSuccess,
  user,
}: CourseCreationModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    course_type: 'Editing' as 'Editing' | 'Content Creation' | 'Website Creation',
    price: '',
    original_price: '',
    author: '',
    creator: '',
    intro_video_url: '',
    thumbnail_url: '',
    is_bestseller: false,
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen && user) {
      // Fetch profile to get username from profiles table
      (async () => {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .single();

          setFormData({
            title: '',
            description: '',
            course_type: 'Editing',
            price: '',
            original_price: '',
            // Always use profiles.username (required field in database)
            author: profile?.username || '',
            creator: profile?.username || '',
            intro_video_url: '',
            thumbnail_url: '',
            is_bestseller: false,
          });
        } catch {
          // Fallback if profile fetch fails
          setFormData({
            title: '',
            description: '',
            course_type: 'Editing',
            price: '',
            original_price: '',
            author: '',
            creator: '',
            intro_video_url: '',
            thumbnail_url: '',
            is_bestseller: false,
          });
        }
      })();
      setVideoFile(null);
      setThumbnailFile(null);
      setVideoUploadProgress(0);
      setThumbnailUploadProgress(0);
      setIsUploading(false);
      setError(null);
    }
  }, [isOpen, user]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const uploadFile = async (
    file: File,
    bucket: string,
    path: string,
    onProgress: (progress: number) => void
  ): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    let progress = 0;
    let progressInterval: NodeJS.Timeout | null = null;

    const startProgress = () => {
      progressInterval = setInterval(() => {
        progress += 5;
        if (progress < 95) {
          onProgress(progress);
        }
      }, 300);
    };

    const stopProgress = () => {
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    };

    startProgress();

    try {
      const uploadPromise = supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout')), 5 * 60 * 1000);
      });

      const { data, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise,
      ]);

      stopProgress();
      onProgress(100);

      if (uploadError) throw uploadError;
      if (!data) throw new Error('Upload failed: No data returned');

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error: any) {
      stopProgress();
      onProgress(0);
      throw error;
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!user) {
      setError('You must be logged in to upload files');
      return;
    }

    setVideoFile(file);
    setVideoUploadProgress(0);
    setIsUploading(true);
    setError(null);

    try {
      const url = await uploadFile(file, 'course-videos', 'video', setVideoUploadProgress);
      setFormData({ ...formData, intro_video_url: url });

      setTimeout(() => {
        setVideoUploadProgress(0);
        setIsUploading(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to upload video.');
      setVideoFile(null);
      setVideoUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!user) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Thumbnail image size must be less than 5MB');
      return;
    }

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }

    setThumbnailFile(file);
    setThumbnailUploadProgress(0);
    setIsUploading(true);
    setError(null);

    try {
      const url = await uploadFile(file, 'course-thumbnails', 'thumbnail', setThumbnailUploadProgress);
      setFormData({ ...formData, thumbnail_url: url });

      setTimeout(() => {
        setThumbnailUploadProgress(0);
        setIsUploading(false);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Failed to upload thumbnail.');
      setThumbnailFile(null);
      setThumbnailUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Validate prices are non-negative
    const priceValue = parseFloat(formData.price);
    const originalPriceValue = formData.original_price ? parseFloat(formData.original_price) : null;

    if (isNaN(priceValue) || priceValue < 0) {
      setError('Price must be a valid non-negative number');
      setIsSubmitting(false);
      return;
    }

    if (originalPriceValue !== null && (isNaN(originalPriceValue) || originalPriceValue < 0)) {
      setError('Original price must be a valid non-negative number');
      setIsSubmitting(false);
      return;
    }

    try {
      const courseData = {
        title: formData.title,
        description: formData.description || null,
        course_type: formData.course_type,
        price: priceValue,
        original_price: originalPriceValue,
        author: formData.author,
        creator: formData.creator,
        intro_video_url: formData.intro_video_url || null,
        thumbnail_url: formData.thumbnail_url || null,
        is_bestseller: formData.is_bestseller,
        lecturer_id: user?.id,
      };

      const { data: newCourse, error: insertError } = await supabase
        .from('courses')
        .insert([courseData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Automatically create required channels (Lectures and Projects)
      if (newCourse) {
        await supabase.from('channels').insert([
          {
            course_id: newCourse.id,
            name: 'lectures',
            type: 'lectures',
            description: `Video lectures for ${courseData.title}`,
            category_name: 'COURSE CHANNELS',
            display_order: 0,
          },
          {
            course_id: newCourse.id,
            name: 'projects',
            type: 'text',
            description: `Project submissions and discussions for ${courseData.title}`,
            category_name: 'COURSE CHANNELS',
            display_order: 1,
          },
        ]);
      }

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save course');
      console.error('Error saving course:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Create New Course</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded p-1 transition-colors"
              aria-label="Close modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg mb-4">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-red-400 hover:text-red-200"
                  aria-label="Dismiss error"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Course Type *
              </label>
              <select
                required
                value={formData.course_type}
                onChange={(e) => setFormData({ ...formData, course_type: e.target.value as any })}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Editing">Editing</option>
                <option value="Content Creation">Content Creation</option>
                <option value="Website Creation">Website Creation</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Price (₾) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Original Price (₾)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.original_price}
                  onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Author *
                </label>
                <input
                  type="text"
                  required
                  value={formData.author}
                  onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Creator *
                </label>
                <input
                  type="text"
                  required
                  value={formData.creator}
                  onChange={(e) => setFormData({ ...formData, creator: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Intro Video
              </label>
              <div className="space-y-2">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="video/*,.mov,video/quicktime"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleVideoUpload(file);
                    }}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <div className={`w-full px-4 py-3 border-2 border-dashed rounded-lg text-center transition-colors ${isUploading && videoUploadProgress > 0
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-gray-600 hover:border-gray-500'
                    }`}>
                    {isUploading && videoUploadProgress > 0 ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                        <span className="text-sm text-gray-300 font-medium block">
                          Uploading {videoFile?.name || 'video'}... {videoUploadProgress}%
                        </span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-300 font-medium block truncate">
                          {videoFile ? videoFile.name : 'Upload Video File'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Click to select video</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Thumbnail
              </label>
              <div className="space-y-2">
                <label className="flex-1 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleThumbnailUpload(file);
                    }}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <div className={`w-full px-4 py-3 border-2 border-dashed rounded-lg text-center transition-colors ${isUploading && thumbnailUploadProgress > 0
                      ? 'border-indigo-500 bg-indigo-900/20'
                      : 'border-gray-600 hover:border-gray-500'
                    }`}>
                    {isUploading && thumbnailUploadProgress > 0 ? (
                      <>
                        <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500 mb-2"></div>
                        <span className="text-sm text-gray-300 font-medium block">
                          Uploading {thumbnailFile?.name || 'thumbnail'}... {thumbnailUploadProgress}%
                        </span>
                      </>
                    ) : (
                      <>
                        <svg className="w-6 h-6 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm text-gray-300 font-medium block truncate">
                          {thumbnailFile ? thumbnailFile.name : 'Upload Thumbnail Image'}
                        </span>
                        <p className="text-xs text-gray-500 mt-1">Click to select image (max 5MB)</p>
                      </>
                    )}
                  </div>
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="flex-1 bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Course'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="flex-1 bg-gray-700 text-gray-300 font-semibold px-6 py-3 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

