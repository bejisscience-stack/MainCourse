'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navigation from '@/components/Navigation';
import BackgroundShapes from '@/components/BackgroundShapes';
import CourseCard from '@/components/CourseCard';
import { supabase } from '@/lib/supabase';
import { useUser } from '@/hooks/useUser';
import { useLecturerCourses } from '@/hooks/useLecturerCourses';
import type { Course } from '@/hooks/useCourses';

export default function LecturerDashboard() {
  const router = useRouter();
  const { user, profile, role: userRole, isLoading: userLoading } = useUser();
  const { courses, isLoading: coursesLoading, mutate: mutateCourses } = useLecturerCourses(user?.id || null);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
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

  // Redirect if not lecturer or not logged in
  useEffect(() => {
    if (!userLoading) {
      if (!user) {
        router.push('/login');
      } else if (userRole !== 'lecturer') {
        router.push('/');
      }
    }
  }, [user, userRole, userLoading, router]);

  const loading = userLoading || coursesLoading;

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showModal) {
        handleCloseModal();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal]);


  const handleOpenModal = (course?: Course) => {
    setVideoFile(null);
    setThumbnailFile(null);
    setVideoUploadProgress(0);
    setThumbnailUploadProgress(0);
    setIsUploading(false);
    
    if (course) {
      setEditingCourse(course);
      setFormData({
        title: course.title,
        description: course.description || '',
        course_type: course.course_type,
        price: course.price.toString(),
        original_price: course.original_price?.toString() || '',
        author: course.author,
        creator: course.creator,
        intro_video_url: course.intro_video_url || '',
        thumbnail_url: course.thumbnail_url || '',
        is_bestseller: course.is_bestseller,
      });
    } else {
      setEditingCourse(null);
      setFormData({
        title: '',
        description: '',
        course_type: 'Editing',
        price: '',
        original_price: '',
        author: profile?.username || '',
        creator: profile?.username || '',
        intro_video_url: '',
        thumbnail_url: '',
        is_bestseller: false,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    // Warn if upload is in progress
    if (isUploading) {
      const confirmClose = window.confirm('Upload is in progress. Are you sure you want to close? The upload will be cancelled.');
      if (!confirmClose) {
        return;
      }
    }
    
    setShowModal(false);
    setEditingCourse(null);
    setVideoFile(null);
    setThumbnailFile(null);
    setVideoUploadProgress(0);
    setThumbnailUploadProgress(0);
    setIsUploading(false);
    setError(null);
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
  };

  const uploadFile = async (
    file: File,
    bucket: string,
    path: string,
    onProgress: (progress: number) => void
  ): Promise<string> => {
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Get file extension (case insensitive, handle files without extension)
    const fileExt = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const fileName = `${path}-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    console.log('Starting upload:', { bucket, filePath, fileName, fileSize: file.size, fileType: file.type });

    // Start progress simulation
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
      // Note: We don't check bucket existence here because listBuckets() may not
      // return all buckets for regular users. Instead, we attempt the upload and
      // let Supabase return a clear error if the bucket doesn't exist.

      // Add timeout to upload (5 minutes for large files)
      const uploadPromise = supabase.storage
        .from(bucket)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout: File is too large or connection is slow. Please try a smaller file or check your internet connection.')), 5 * 60 * 1000);
      });

      const { data, error: uploadError } = await Promise.race([
        uploadPromise,
        timeoutPromise
      ]) as any;

      stopProgress();
      onProgress(95);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message || 'Upload failed. Please check your file size and try again.');
      }

      if (!data) {
        throw new Error('Upload failed: No data returned');
      }

      console.log('Upload successful, getting public URL...');

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      onProgress(100);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL');
      }

      console.log('Upload complete:', urlData.publicUrl);
      return urlData.publicUrl;
    } catch (error: any) {
      stopProgress();
      onProgress(0);
      console.error('Upload failed:', error);
      throw error;
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!user) {
      setError('You must be logged in to upload files');
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setError(`Video file size (${sizeMB}MB) exceeds the 50MB limit. Please compress your video or use a smaller file.`);
      return;
    }

    // Validate file type
    const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    const validExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validVideoTypes.includes(file.type) && !validExtensions.some(ext => file.name.toLowerCase().endsWith(ext))) {
      console.warn('File type validation:', { type: file.type, name: file.name, ext: fileExt });
      // Still allow upload, but warn
    }

    setVideoFile(file);
    setVideoUploadProgress(0);
    setIsUploading(true);
    setError(null);

    console.log('Starting video upload:', { name: file.name, size: file.size, type: file.type });

    try {
      const url = await uploadFile(file, 'course-videos', 'video', setVideoUploadProgress);
      setFormData({ ...formData, intro_video_url: url });
      console.log('Video upload successful');
      
      setTimeout(() => {
        setVideoUploadProgress(0);
        setIsUploading(false);
      }, 1500);
    } catch (err: any) {
      console.error('Video upload error:', err);
      const errorMessage = err.message || 'Failed to upload video. Please check your connection and try again.';
      setError(errorMessage);
      setVideoFile(null);
      setVideoUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleThumbnailUpload = async (file: File) => {
    if (!user) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Thumbnail image size must be less than 5MB');
      return;
    }

    // Validate file type
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
      setError(err.message || 'Failed to upload thumbnail. Please try again.');
      setThumbnailFile(null);
      setThumbnailUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const courseData = {
        title: formData.title,
        description: formData.description || null,
        course_type: formData.course_type,
        price: parseFloat(formData.price),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        author: formData.author,
        creator: formData.creator,
        intro_video_url: formData.intro_video_url || null,
        thumbnail_url: formData.thumbnail_url || null,
        is_bestseller: formData.is_bestseller,
        lecturer_id: user?.id,
      };

      if (editingCourse) {
        const { error: updateError } = await supabase
          .from('courses')
          .update(courseData)
          .eq('id', editingCourse.id);

        if (updateError) throw updateError;
      } else {
        const { data: newCourse, error: insertError } = await supabase
          .from('courses')
          .insert([courseData])
          .select()
          .single();

        if (insertError) throw insertError;

        // Automatically create default channels: "Lectures" and "Projects"
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
      }

      mutateCourses();
      handleCloseModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save course');
      console.error('Error saving course:', err);
    }
  };

  const handleDelete = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (deleteError) throw deleteError;
      mutateCourses();
    } catch (err: any) {
      setError(err.message || 'Failed to delete course');
      console.error('Error deleting course:', err);
    }
  };

  if (loading) {
    return (
      <main className="relative min-h-screen bg-white overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-navy-900"></div>
            <p className="mt-4 text-navy-600">Loading dashboard...</p>
            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-white overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-navy-900 mb-2">
                Lecturer Dashboard
              </h1>
              <p className="text-lg text-navy-600">
                Manage your courses and content
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                href="/lecturer/chat"
                className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                Chat
              </Link>
              <button
                onClick={() => handleOpenModal()}
                className="bg-navy-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-navy-800 transition-colors"
              >
                + Create Course
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 animate-in fade-in">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold">Error loading dashboard</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-red-500 hover:text-red-700"
                  aria-label="Dismiss error"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Courses List */}
          {courses.length === 0 ? (
            <div className="text-center py-12 bg-navy-50 rounded-lg">
              <p className="text-navy-600 text-lg mb-4">You haven't created any courses yet.</p>
              <button
                onClick={() => handleOpenModal()}
                className="bg-navy-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-navy-800 transition-colors"
              >
                Create Your First Course
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={{
                    id: course.id,
                    title: course.title,
                    description: course.description || undefined,
                    course_type: course.course_type,
                    price: course.price,
                    original_price: course.original_price || undefined,
                    author: course.author,
                    creator: course.creator,
                    intro_video_url: course.intro_video_url || undefined,
                    thumbnail_url: course.thumbnail_url || undefined,
                    rating: course.rating,
                    review_count: course.review_count,
                    is_bestseller: course.is_bestseller,
                  }}
                  showEnrollButton={false}
                  customAction={
                    <button
                      onClick={() => handleOpenModal(course)}
                      className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-navy-900 rounded-full hover:bg-navy-800 transition-colors"
                    >
                      <svg
                        className="w-3.5 h-3.5 mr-1.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      Edit Course
                    </button>
                  }
                />
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                // Close modal when clicking outside
                if (e.target === e.currentTarget) {
                  handleCloseModal();
                }
              }}
            >
              <div 
                className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-navy-900">
                      {editingCourse ? 'Edit Course' : 'Create New Course'}
                    </h2>
                    <button
                      onClick={handleCloseModal}
                      className="text-navy-600 hover:text-navy-900 focus:outline-none focus:ring-2 focus:ring-navy-500 rounded p-1 transition-colors"
                      aria-label="Close modal"
                      title="Close (ESC or click outside)"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Error Message inside Modal */}
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
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
                          className="ml-2 text-red-500 hover:text-red-700"
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
                      <label className="block text-sm font-medium text-navy-700 mb-2">
                        Title *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-navy-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-navy-700 mb-2">
                        Course Type *
                      </label>
                      <select
                        required
                        value={formData.course_type}
                        onChange={(e) => setFormData({ ...formData, course_type: e.target.value as any })}
                        className="w-full px-4 py-2 bg-white border border-navy-200 text-black rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                      >
                        <option value="Editing">Editing</option>
                        <option value="Content Creation">Content Creation</option>
                        <option value="Website Creation">Website Creation</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          Price ($) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          Original Price ($)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.original_price}
                          onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          Author *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.author}
                          onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-navy-700 mb-2">
                          Creator *
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.creator}
                          onChange={(e) => setFormData({ ...formData, creator: e.target.value })}
                          className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-navy-700 mb-2">
                        Intro Video
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
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
                            <div className={`w-full px-4 py-3 border-2 border-dashed rounded-lg text-center transition-colors ${
                              isUploading && videoUploadProgress > 0
                                ? 'border-navy-500 bg-navy-50'
                                : 'border-navy-300 hover:border-navy-400'
                            }`}>
                              {isUploading && videoUploadProgress > 0 ? (
                                <>
                                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-navy-900 mb-2"></div>
                                  <span className="text-sm text-navy-700 font-medium block">
                                    Uploading {videoFile?.name || 'video'}...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-6 h-6 mx-auto mb-2 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm text-navy-700 font-medium block truncate">
                                    {videoFile ? videoFile.name : 'Upload Video File'}
                                  </span>
                                  <p className="text-xs text-navy-500 mt-1">Click to select video (max 50MB)</p>
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                        {videoUploadProgress > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-navy-600">
                              <span>Uploading...</span>
                              <span>{videoUploadProgress}%</span>
                            </div>
                            <div className="w-full bg-navy-200 rounded-full h-2">
                              <div
                                className="bg-navy-900 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${videoUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {formData.intro_video_url && (
                          <div className="text-xs text-green-600 flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            Video uploaded successfully
                          </div>
                        )}
                        <div className="text-xs text-navy-500 mt-2">Or enter URL:</div>
                        <input
                          type="url"
                          value={formData.intro_video_url}
                          onChange={(e) => setFormData({ ...formData, intro_video_url: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-navy-700 mb-2">
                        Thumbnail Image
                      </label>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
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
                            <div className="w-full px-4 py-3 border-2 border-dashed border-navy-300 rounded-lg hover:border-navy-400 transition-colors text-center">
                              <svg className="w-6 h-6 mx-auto mb-2 text-navy-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm text-navy-700 font-medium">
                                {thumbnailFile ? thumbnailFile.name : 'Upload Thumbnail Image'}
                              </span>
                              <p className="text-xs text-navy-500 mt-1">Click to select image</p>
                            </div>
                          </label>
                        </div>
                        {thumbnailUploadProgress > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-navy-600">
                              <span>Uploading...</span>
                              <span>{thumbnailUploadProgress}%</span>
                            </div>
                            <div className="w-full bg-navy-200 rounded-full h-2">
                              <div
                                className="bg-navy-900 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${thumbnailUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {formData.thumbnail_url && (
                          <div className="space-y-2">
                            <div className="text-xs text-green-600 flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Thumbnail uploaded successfully
                            </div>
                            <img
                              src={formData.thumbnail_url}
                              alt="Thumbnail preview"
                              className="w-full h-32 object-cover rounded-lg border border-navy-200"
                            />
                          </div>
                        )}
                        <div className="text-xs text-navy-500 mt-2">Or enter URL:</div>
                        <input
                          type="url"
                          value={formData.thumbnail_url}
                          onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-4 py-2 bg-white border border-navy-200 text-black placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_bestseller"
                        checked={formData.is_bestseller}
                        onChange={(e) => setFormData({ ...formData, is_bestseller: e.target.checked })}
                        className="w-4 h-4 text-navy-900 focus:ring-navy-500"
                      />
                      <label htmlFor="is_bestseller" className="ml-2 text-sm font-medium text-navy-700">
                        Mark as Bestseller
                      </label>
                    </div>

                    <div className="flex flex-col gap-4 pt-4">
                      <div className="flex gap-4">
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="flex-1 bg-navy-900 text-white font-semibold px-6 py-3 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? 'Uploading...' : editingCourse ? 'Update Course' : 'Create Course'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          disabled={isUploading}
                          className="flex-1 bg-navy-100 text-navy-900 font-semibold px-6 py-3 rounded-lg hover:bg-navy-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Cancel
                        </button>
                      </div>
                      {editingCourse && (
                        <button
                          type="button"
                          onClick={() => {
                            handleCloseModal();
                            handleDelete(editingCourse.id);
                          }}
                          disabled={isUploading}
                          className="w-full bg-red-600 text-white font-semibold px-6 py-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Delete Course
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

