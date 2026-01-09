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
import { useI18n } from '@/contexts/I18nContext';
import { formatPriceInGel } from '@/lib/currency';
import type { Course } from '@/hooks/useCourses';

export default function LecturerDashboard() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, profile, role: userRole, isLoading: userLoading } = useUser();
  const { courses, isLoading: coursesLoading, mutate: mutateCourses } = useLecturerCourses(user?.id || null);
  // Defensive check: ensure courses is always an array
  const safeCourses = Array.isArray(courses) ? courses : [];
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
    referral_commission_percentage: '0',
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState(0);
  const [thumbnailUploadProgress, setThumbnailUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [showBundleModal, setShowBundleModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<any | null>(null);
  const [bundleFormData, setBundleFormData] = useState({
    title: '',
    description: '',
    price: '',
    original_price: '',
  });
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [bundlesLoading, setBundlesLoading] = useState(false);

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

  // Fetch bundles
  useEffect(() => {
    if (user?.id) {
      fetchBundles();
    }
  }, [user?.id]);

  const fetchBundles = async () => {
    if (!user?.id) return;
    setBundlesLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_bundles')
        .select(`
          *,
          course_bundle_items (
            course_id,
            courses (
              id,
              title,
              price
            )
          )
        `)
        .eq('lecturer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBundles(data || []);
    } catch (err: any) {
      console.error('Error fetching bundles:', err);
      setError(err.message || 'Failed to load bundles');
    } finally {
      setBundlesLoading(false);
    }
  };

  const handleOpenBundleModal = (bundle?: any) => {
    if (bundle) {
      setEditingBundle(bundle);
      setBundleFormData({
        title: bundle.title,
        description: bundle.description || '',
        price: bundle.price.toString(),
        original_price: bundle.original_price?.toString() || '',
      });
      // Get course IDs from bundle items
      const courseIds = bundle.course_bundle_items?.map((item: any) => item.course_id) || [];
      setSelectedCourseIds(courseIds);
    } else {
      setEditingBundle(null);
      setBundleFormData({
        title: '',
        description: '',
        price: '',
        original_price: '',
      });
      setSelectedCourseIds([]);
    }
    setShowBundleModal(true);
  };

  const handleCloseBundleModal = () => {
    setShowBundleModal(false);
    setEditingBundle(null);
    setBundleFormData({
      title: '',
      description: '',
      price: '',
      original_price: '',
    });
    setSelectedCourseIds([]);
    setError(null);
  };

  const handleBundleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedCourseIds.length < 2) {
      setError('Please select at least 2 courses for the bundle');
      return;
    }

    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    // Validate prices are non-negative
    const bundlePriceValue = parseFloat(bundleFormData.price);
    const bundleOriginalPriceValue = bundleFormData.original_price ? parseFloat(bundleFormData.original_price) : null;

    if (isNaN(bundlePriceValue) || bundlePriceValue < 0) {
      setError('Bundle price must be a valid non-negative number');
      return;
    }

    if (bundleOriginalPriceValue !== null && (isNaN(bundleOriginalPriceValue) || bundleOriginalPriceValue < 0)) {
      setError('Bundle original price must be a valid non-negative number');
      return;
    }

    try {
      const bundleData = {
        lecturer_id: user.id,
        title: bundleFormData.title,
        description: bundleFormData.description || null,
        price: bundlePriceValue,
        original_price: bundleOriginalPriceValue,
        is_active: true,
      };

      if (editingBundle) {
        // Update bundle
        const { data: updatedBundle, error: updateError } = await supabase
          .from('course_bundles')
          .update(bundleData)
          .eq('id', editingBundle.id)
          .select()
          .single();

        if (updateError) throw updateError;

        // Delete existing bundle items
        await supabase
          .from('course_bundle_items')
          .delete()
          .eq('bundle_id', editingBundle.id);

        // Insert new bundle items
        const itemsToInsert = selectedCourseIds.map(courseId => ({
          bundle_id: updatedBundle.id,
          course_id: courseId,
        }));

        const { error: itemsError } = await supabase
          .from('course_bundle_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      } else {
        // Create new bundle
        const { data: newBundle, error: insertError } = await supabase
          .from('course_bundles')
          .insert([bundleData])
          .select()
          .single();

        if (insertError) throw insertError;

        // Insert bundle items
        const itemsToInsert = selectedCourseIds.map(courseId => ({
          bundle_id: newBundle.id,
          course_id: courseId,
        }));

        const { error: itemsError } = await supabase
          .from('course_bundle_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      await fetchBundles();
      handleCloseBundleModal();
    } catch (err: any) {
      setError(err.message || 'Failed to save bundle');
      console.error('Error saving bundle:', err);
    }
  };

  const handleDeleteBundle = async (bundleId: string) => {
    if (!confirm('Are you sure you want to delete this bundle?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('course_bundles')
        .delete()
        .eq('id', bundleId);

      if (deleteError) throw deleteError;
      await fetchBundles();
    } catch (err: any) {
      setError(err.message || 'Failed to delete bundle');
      console.error('Error deleting bundle:', err);
    }
  };

  const toggleCourseSelection = (courseId: string) => {
    setSelectedCourseIds(prev => {
      if (prev.includes(courseId)) {
        return prev.filter(id => id !== courseId);
      } else {
        return [...prev, courseId];
      }
    });
  };

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


  const handleOpenModal = async (course?: Course) => {
    setVideoFile(null);
    setThumbnailFile(null);
    setVideoUploadProgress(0);
    setThumbnailUploadProgress(0);
    setIsUploading(false);
    
    if (course) {
      // Fetch full course data including referral_commission_percentage
      try {
        const { data: fullCourse, error } = await supabase
          .from('courses')
          .select('*')
          .eq('id', course.id)
          .single();

        if (error) {
          console.error('Error fetching full course data:', error);
          // Fallback to provided course data
        }

        const courseData = fullCourse || course;
        
        setEditingCourse(courseData);
        setFormData({
          title: courseData.title || '',
          description: courseData.description || '',
          course_type: courseData.course_type || 'Editing',
          price: courseData.price?.toString() || '0',
          original_price: courseData.original_price?.toString() || '',
          author: courseData.author || '',
          creator: courseData.creator || '',
          intro_video_url: courseData.intro_video_url || '',
          thumbnail_url: courseData.thumbnail_url || '',
          is_bestseller: courseData.is_bestseller || false,
          referral_commission_percentage: courseData.referral_commission_percentage?.toString() || '0',
        });
      } catch (err) {
        console.error('Error loading course data:', err);
        // Fallback to provided course data
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
          referral_commission_percentage: (course as any).referral_commission_percentage?.toString() || '0',
        });
      }
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
        referral_commission_percentage: '0',
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
      referral_commission_percentage: '0',
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

    // Validate prices are non-negative
    const priceValue = parseFloat(formData.price);
    const originalPriceValue = formData.original_price ? parseFloat(formData.original_price) : null;

    if (isNaN(priceValue) || priceValue < 0) {
      setError('Price must be a valid non-negative number');
      return;
    }

    if (originalPriceValue !== null && (isNaN(originalPriceValue) || originalPriceValue < 0)) {
      setError('Original price must be a valid non-negative number');
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
        referral_commission_percentage: parseInt(formData.referral_commission_percentage) || 0,
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
      <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
        <BackgroundShapes />
        <Navigation />
        <div className="relative z-10 pt-24 pb-16 flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
            <p className="mt-4 text-charcoal-600 dark:text-gray-400">{t('common.loading')}</p>
            {error && (
              <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm max-w-md mx-auto">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-b from-[#fafafa] to-white dark:from-navy-950 dark:to-navy-900 overflow-hidden">
      <BackgroundShapes />
      <Navigation />
      <div className="relative z-10 pt-24 pb-16 md:pb-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-charcoal-950 dark:text-white mb-2">
                {t('lecturerDashboard.title')}
              </h1>
              <p className="text-lg text-charcoal-600 dark:text-gray-400">
                {t('lecturerDashboard.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/lecturer/chat"
                className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white font-semibold rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {t('lecturerDashboard.chat')}
              </Link>
              <button
                onClick={() => handleOpenBundleModal()}
                className="px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                disabled={safeCourses.length < 2}
                title={safeCourses.length < 2 ? t('lecturerDashboard.needTwoCourses') : ''}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('lecturerDashboard.createBundle')}
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="px-6 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {t('lecturerDashboard.createCourse')}
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-6">
              <div className="flex items-start">
                <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold">{t('lecturerDashboard.errorLoadingDashboard')}</p>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  aria-label="Dismiss error"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Bundles Section */}
          {safeCourses.length >= 2 && (
            <div className="mb-12">
              <div className="mb-6">
                <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white mb-2">
                  {t('lecturerDashboard.courseBundles')}
                </h2>
                <p className="text-charcoal-600 dark:text-gray-400">
                  {t('lecturerDashboard.bundleDescription')}
                </p>
              </div>

              {bundlesLoading ? (
                <div className="text-center py-12 bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                  <p className="mt-4 text-charcoal-600 dark:text-gray-400">{t('lecturerDashboard.loadingBundles')}</p>
                </div>
              ) : bundles.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl shadow-soft">
                  <p className="text-purple-700 dark:text-purple-300 text-lg mb-4">{t('lecturerDashboard.noBundlesYet')}</p>
                  <button
                    onClick={() => handleOpenBundleModal()}
                    className="px-6 py-3 bg-purple-600 dark:bg-purple-500 text-white font-semibold rounded-xl hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark"
                  >
                    {t('lecturerDashboard.createFirstBundle')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-6">
                  {bundles.map((bundle) => {
                    const bundleCourses = bundle.course_bundle_items?.map((item: any) => item.courses) || [];
                    const totalOriginalPrice = bundleCourses.reduce((sum: number, course: any) => sum + (course?.price || 0), 0);
                    
                    return (
                      <div key={bundle.id} className="bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl p-6 shadow-soft hover:shadow-md transition-all duration-200">
                        <div className="mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">{t('lecturerDashboard.bundle')}</span>
                            {!bundle.is_active && (
                              <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full">{t('lecturerDashboard.inactive')}</span>
                            )}
                          </div>
                          <h3 className="text-lg font-bold text-charcoal-950 dark:text-white mb-2">{bundle.title}</h3>
                          {bundle.description && (
                            <p className="text-sm text-charcoal-600 dark:text-gray-400 line-clamp-2">{bundle.description}</p>
                          )}
                        </div>
                        <div className="mb-4">
                          <p className="text-xs text-charcoal-500 dark:text-gray-500 mb-1">{t('lecturerDashboard.includesCourses', { count: bundleCourses.length })}</p>
                          <ul className="text-sm text-charcoal-700 dark:text-gray-300 space-y-1">
                            {bundleCourses.slice(0, 3).map((course: any, idx: number) => (
                              <li key={idx} className="flex items-center">
                                <svg className="w-4 h-4 mr-1 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                {course?.title || 'Unknown Course'}
                              </li>
                            ))}
                            {bundleCourses.length > 3 && (
                              <li className="text-xs text-charcoal-500 dark:text-gray-500">+{bundleCourses.length - 3} more</li>
                            )}
                          </ul>
                        </div>
                        <div className="flex items-center justify-between mb-4 pt-4 border-t border-charcoal-200 dark:border-navy-600">
                          <div>
                            <p className="text-xs text-charcoal-500 dark:text-gray-500">{t('lecturerDashboard.bundlePrice')}</p>
                            <p className="text-xl font-bold text-charcoal-950 dark:text-white">
                              {formatPriceInGel(bundle.price)}
                            </p>
                            {bundle.original_price && totalOriginalPrice > bundle.price && (
                              <p className="text-xs text-charcoal-400 dark:text-gray-500 line-through">
                                {formatPriceInGel(totalOriginalPrice)} {t('lecturerDashboard.total')}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenBundleModal(bundle)}
                            className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-purple-600 dark:bg-purple-500 rounded-xl hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-200"
                          >
                            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            {t('lecturerDashboard.edit')}
                          </button>
                          <button
                            onClick={() => handleDeleteBundle(bundle.id)}
                            className="px-4 py-2 text-sm font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-all duration-200"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Courses List */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-charcoal-950 dark:text-white mb-6">{t('lecturerDashboard.individualCourses')}</h2>
          </div>
          {safeCourses.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-navy-800 border border-charcoal-100/50 dark:border-navy-700/50 rounded-3xl shadow-soft">
              <p className="text-charcoal-600 dark:text-gray-400 text-lg mb-4">{t('lecturerDashboard.noCoursesYet')}</p>
              <button
                onClick={() => handleOpenModal()}
                className="px-6 py-3 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark"
              >
                {t('lecturerDashboard.createFirstCourse')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {safeCourses.map((course) => (
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
                      className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-charcoal-950 dark:bg-emerald-500 rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200"
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
                      {t('lecturerDashboard.editCourse')}
                    </button>
                  }
                />
              ))}
            </div>
          )}

          {/* Modal */}
          {showModal && (
            <div 
              className="fixed inset-0 bg-black/80 dark:bg-black/90 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                // Close modal when clicking outside
                if (e.target === e.currentTarget) {
                  handleCloseModal();
                }
              }}
            >
              <div 
                className="bg-white dark:bg-navy-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white">
                      {editingCourse ? t('lecturerDashboard.editCourse') : t('lecturerDashboard.createNewCourse')}
                    </h2>
                    <button
                      onClick={handleCloseModal}
                      className="text-charcoal-600 dark:text-gray-400 hover:text-charcoal-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl p-2 transition-colors"
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
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-semibold">{t('common.error')}</p>
                          <p className="text-sm">{error}</p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="ml-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
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
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.titleLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.descriptionLabel')}
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={4}
                        className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.courseTypeLabel')}
                      </label>
                      <select
                        required
                        value={formData.course_type}
                        onChange={(e) => setFormData({ ...formData, course_type: e.target.value as any })}
                        className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                      >
                        <option value="Editing">{t('courses.filterEditing')}</option>
                        <option value="Content Creation">{t('courses.filterContentCreation')}</option>
                        <option value="Website Creation">{t('courses.filterWebsiteCreation')}</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('lecturerDashboard.priceLabel')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('lecturerDashboard.originalPriceLabel')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.original_price}
                          onChange={(e) => setFormData({ ...formData, original_price: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.referralCommissionLabel') || 'Referral Commission Percentage (0-100%)'}
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={formData.referral_commission_percentage}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            if (value >= 0 && value <= 100) {
                              setFormData({ ...formData, referral_commission_percentage: value.toString() });
                            }
                          }}
                          className="w-32 px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                        <span className="text-charcoal-600 dark:text-gray-400">%</span>
                      </div>
                      <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-1">
                        {t('lecturerDashboard.referralCommissionHint') || 'Percentage of the course price that goes to the referring student. You receive the remaining amount.'}
                      </p>
                      {parseInt(formData.referral_commission_percentage) > 0 && formData.price && (
                        <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-sm text-purple-700">
                            <span className="font-semibold">{t('lecturerDashboard.commissionBreakdown') || 'Commission Breakdown'}:</span>
                          </p>
                          <p className="text-sm text-purple-600 mt-1">
                            • {t('lecturerDashboard.referrerGets') || 'Referrer gets'}: ${(parseFloat(formData.price) * parseInt(formData.referral_commission_percentage) / 100).toFixed(2)} ({formData.referral_commission_percentage}%)
                          </p>
                          <p className="text-sm text-purple-600">
                            • {t('lecturerDashboard.youGet') || 'You get'}: ${(parseFloat(formData.price) * (100 - parseInt(formData.referral_commission_percentage)) / 100).toFixed(2)} ({100 - parseInt(formData.referral_commission_percentage)}%)
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('lecturerDashboard.authorLabel')}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.author}
                          onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('lecturerDashboard.creatorLabel')}
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.creator}
                          onChange={(e) => setFormData({ ...formData, creator: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.introVideoLabel')}
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
                            <div className={`w-full px-4 py-3 border-2 border-dashed rounded-xl text-center transition-colors ${
                              isUploading && videoUploadProgress > 0
                                ? 'border-emerald-500 dark:border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                                : 'border-charcoal-300 dark:border-navy-600 hover:border-emerald-400 dark:hover:border-emerald-500'
                            }`}>
                              {isUploading && videoUploadProgress > 0 ? (
                                <>
                                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500 dark:border-emerald-400 mb-2"></div>
                                  <span className="text-sm text-charcoal-700 dark:text-gray-300 font-medium block">
                                    {t('lecturerDashboard.uploading')} {videoFile?.name || 'video'}...
                                  </span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-6 h-6 mx-auto mb-2 text-charcoal-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-sm text-charcoal-700 dark:text-gray-300 font-medium block truncate">
                                    {videoFile 
                                      ? videoFile.name 
                                      : editingCourse && formData.intro_video_url
                                        ? t('lecturerDashboard.currentVideo') + ' ✓'
                                        : t('lecturerDashboard.uploadVideoFile')
                                    }
                                  </span>
                                  <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-1">
                                    {editingCourse && formData.intro_video_url
                                      ? t('lecturerDashboard.clickToReplaceVideo') || 'Click to replace current video'
                                      : t('lecturerDashboard.clickToSelectVideo')
                                    }
                                  </p>
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                        {videoUploadProgress > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-charcoal-600 dark:text-gray-400">
                              <span>{t('lecturerDashboard.uploading')}</span>
                              <span>{videoUploadProgress}%</span>
                            </div>
                            <div className="w-full bg-charcoal-200 dark:bg-navy-600 rounded-full h-2">
                              <div
                                className="bg-emerald-500 dark:bg-emerald-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${videoUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {formData.intro_video_url && (
                          <div className="space-y-2">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {editingCourse ? t('lecturerDashboard.currentVideo') || 'Current Video' : t('lecturerDashboard.videoUploadedSuccess')}
                            </div>
                            {editingCourse && formData.intro_video_url && (
                              <div className="relative rounded-xl overflow-hidden border border-charcoal-200 dark:border-navy-600 bg-charcoal-50 dark:bg-navy-700/30">
                                <video
                                  src={formData.intro_video_url}
                                  controls
                                  className="w-full h-48 object-contain"
                                  onError={(e) => {
                                    console.error('Video load error:', e);
                                  }}
                                >
                                  Your browser does not support the video tag.
                                </video>
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  {t('lecturerDashboard.currentVideo') || 'Current Video'}
                                </div>
                              </div>
                            )}
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                                {t('lecturerDashboard.currentVideoUrl') || 'Current Video URL:'}
                              </p>
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 break-all font-mono">
                                {formData.intro_video_url}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-charcoal-500 dark:text-gray-400 mt-2">{t('lecturerDashboard.orEnterUrl')}</div>
                        <input
                          type="url"
                          value={formData.intro_video_url}
                          onChange={(e) => setFormData({ ...formData, intro_video_url: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.thumbnailLabel')}
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
                            <div className="w-full px-4 py-3 border-2 border-dashed border-charcoal-300 dark:border-navy-600 rounded-xl hover:border-emerald-400 dark:hover:border-emerald-500 transition-colors text-center">
                              <svg className="w-6 h-6 mx-auto mb-2 text-charcoal-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span className="text-sm text-charcoal-700 dark:text-gray-300 font-medium">
                                {thumbnailFile 
                                  ? thumbnailFile.name 
                                  : editingCourse && formData.thumbnail_url
                                    ? t('lecturerDashboard.currentThumbnail') + ' ✓'
                                    : t('lecturerDashboard.uploadThumbnail')
                                }
                              </span>
                              <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-1">
                                {editingCourse && formData.thumbnail_url
                                  ? t('lecturerDashboard.clickToReplaceThumbnail') || 'Click to replace current thumbnail'
                                  : t('lecturerDashboard.clickToSelectImage')
                                }
                              </p>
                            </div>
                          </label>
                        </div>
                        {thumbnailUploadProgress > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-charcoal-600 dark:text-gray-400">
                              <span>{t('lecturerDashboard.uploading')}</span>
                              <span>{thumbnailUploadProgress}%</span>
                            </div>
                            <div className="w-full bg-charcoal-200 dark:bg-navy-600 rounded-full h-2">
                              <div
                                className="bg-emerald-500 dark:bg-emerald-400 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${thumbnailUploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {formData.thumbnail_url && (
                          <div className="space-y-2">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {editingCourse ? t('lecturerDashboard.currentThumbnail') || 'Current Thumbnail' : t('lecturerDashboard.thumbnailUploadedSuccess')}
                            </div>
                            <div className="relative rounded-xl overflow-hidden border border-charcoal-200 dark:border-navy-600">
                              <img
                                src={formData.thumbnail_url}
                                alt="Thumbnail preview"
                                className="w-full h-48 object-cover"
                                onError={(e) => {
                                  console.error('Thumbnail load error');
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              {editingCourse && (
                                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                  {t('lecturerDashboard.currentThumbnail') || 'Current Thumbnail'}
                                </div>
                              )}
                            </div>
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3">
                              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">
                                {t('lecturerDashboard.currentThumbnailUrl') || 'Current Thumbnail URL:'}
                              </p>
                              <p className="text-xs text-emerald-600 dark:text-emerald-400 break-all font-mono">
                                {formData.thumbnail_url}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-charcoal-500 dark:text-gray-400 mt-2">{t('lecturerDashboard.orEnterUrl')}</div>
                        <input
                          type="url"
                          value={formData.thumbnail_url}
                          onChange={(e) => setFormData({ ...formData, thumbnail_url: e.target.value })}
                          placeholder="https://..."
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_bestseller"
                        checked={formData.is_bestseller}
                        onChange={(e) => setFormData({ ...formData, is_bestseller: e.target.checked })}
                        className="w-4 h-4 text-emerald-500 dark:text-emerald-400 focus:ring-emerald-500 dark:focus:ring-emerald-400 rounded"
                      />
                      <label htmlFor="is_bestseller" className="ml-2 text-sm font-medium text-charcoal-700 dark:text-gray-300">
                        {t('lecturerDashboard.markAsBestseller')}
                      </label>
                    </div>

                    <div className="flex flex-col gap-4 pt-4">
                      <div className="flex gap-4">
                        <button
                          type="submit"
                          disabled={isUploading}
                          className="flex-1 bg-charcoal-950 dark:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-charcoal-800 dark:hover:bg-emerald-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isUploading ? t('lecturerDashboard.uploading') : editingCourse ? t('lecturerDashboard.updateCourse') : t('lecturerDashboard.createCourse')}
                        </button>
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          disabled={isUploading}
                          className="flex-1 bg-charcoal-100 dark:bg-navy-700 text-charcoal-900 dark:text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {t('common.cancel')}
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
                          className="w-full bg-red-600 dark:bg-red-500 text-white font-semibold px-6 py-4 rounded-xl hover:bg-red-700 dark:hover:bg-red-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          {t('lecturerDashboard.deleteCourse')}
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Bundle Modal */}
          {showBundleModal && (
            <div 
              className="fixed inset-0 bg-black/80 dark:bg-black/90 flex items-center justify-center z-50 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  handleCloseBundleModal();
                }
              }}
            >
              <div 
                className="bg-white dark:bg-navy-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-charcoal-950 dark:text-white">
                      {editingBundle ? t('lecturerDashboard.editBundle') : t('lecturerDashboard.createCourseBundle')}
                    </h2>
                    <button
                      onClick={handleCloseBundleModal}
                      className="text-charcoal-600 dark:text-gray-400 hover:text-charcoal-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 rounded-xl p-2 transition-colors"
                      aria-label="Close modal"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl mb-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <p className="font-semibold">{t('common.error')}</p>
                          <p className="text-sm">{error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleBundleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.bundleTitleLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={bundleFormData.title}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, title: e.target.value })}
                        className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        placeholder={t('lecturerDashboard.bundleTitlePlaceholder')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.descriptionLabel')}
                      </label>
                      <textarea
                        value={bundleFormData.description}
                        onChange={(e) => setBundleFormData({ ...bundleFormData, description: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        placeholder={t('lecturerDashboard.bundleDescriptionPlaceholder')}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('lecturerDashboard.bundlePriceLabel')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          required
                          value={bundleFormData.price}
                          onChange={(e) => setBundleFormData({ ...bundleFormData, price: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                          {t('lecturerDashboard.bundleOriginalPriceLabel')}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={bundleFormData.original_price}
                          onChange={(e) => setBundleFormData({ ...bundleFormData, original_price: e.target.value })}
                          className="w-full px-4 py-3 bg-white dark:bg-navy-700/50 border border-charcoal-200 dark:border-navy-600 text-charcoal-950 dark:text-white placeholder-charcoal-400 dark:placeholder-gray-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-charcoal-700 dark:text-gray-300 mb-2">
                        {t('lecturerDashboard.selectCoursesLabel')}
                      </label>
                      <div className="border border-charcoal-200 dark:border-navy-600 rounded-xl p-4 max-h-64 overflow-y-auto bg-charcoal-50/50 dark:bg-navy-700/30">
                        {safeCourses.length === 0 ? (
                          <p className="text-sm text-charcoal-500 dark:text-gray-400">{t('lecturerDashboard.noCoursesAvailable')}</p>
                        ) : (
                          <div className="space-y-2">
                            {safeCourses.map((course) => (
                              <label
                                key={course.id}
                                className="flex items-center p-3 rounded-xl border border-charcoal-200 dark:border-navy-600 hover:bg-white dark:hover:bg-navy-700/50 cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedCourseIds.includes(course.id)}
                                  onChange={() => toggleCourseSelection(course.id)}
                                  className="w-4 h-4 text-purple-600 dark:text-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400 border-charcoal-300 dark:border-navy-500 rounded"
                                />
                                <div className="ml-3 flex-1">
                                  <p className="text-sm font-medium text-charcoal-950 dark:text-white">{course.title}</p>
                                  <p className="text-xs text-charcoal-500 dark:text-gray-400">${course.price.toFixed(2)}</p>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-charcoal-500 dark:text-gray-400 mt-2">
                        {t('lecturerDashboard.selected', { count: selectedCourseIds.length })}
                      </p>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-purple-600 dark:bg-purple-500 text-white font-semibold px-6 py-3 rounded-xl hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-200 hover:shadow-soft dark:hover:shadow-glow-dark"
                      >
                        {editingBundle ? t('lecturerDashboard.updateBundle') : t('lecturerDashboard.createBundle')}
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseBundleModal}
                        className="flex-1 bg-charcoal-100 dark:bg-navy-700 text-charcoal-900 dark:text-gray-300 font-semibold px-6 py-3 rounded-xl hover:bg-charcoal-200 dark:hover:bg-navy-600 transition-all duration-200"
                      >
                        {t('common.cancel')}
                      </button>
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

