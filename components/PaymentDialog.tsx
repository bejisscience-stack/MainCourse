'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Course } from './CourseCard';

interface PaymentDialogProps {
  course: Course;
  isOpen: boolean;
  onClose: () => void;
  onEnroll: (courseId: string) => void;
}

// Generate a unique 5-digit code from course ID (uppercase letters and numbers)
function generateCourseCode(courseId: string): string {
  // Use a simple hash function to generate consistent code from course ID
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) {
    const char = courseId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Use absolute value and convert to base 36, then take first 5 chars
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  let num = Math.abs(hash);
  
  for (let i = 0; i < 5; i++) {
    code += chars[num % chars.length];
    num = Math.floor(num / chars.length);
  }
  
  return code;
}

export default function PaymentDialog({ course, isOpen, onClose, onEnroll }: PaymentDialogProps) {
  const [uploadedImages, setUploadedImages] = useState<Array<{ file: File; preview: string; url?: string }>>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const courseCode = useMemo(() => generateCourseCode(course.id), [course.id]);

  const formatPrice = useMemo(() => {
    return (price: number) => new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(price);
  }, []);

  const formattedPrice = useMemo(() => formatPrice(course.price), [formatPrice, course.price]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
      setUploadError('Please select image files only');
      return;
    }

    // Validate file sizes (5MB limit per image)
    const maxSize = 5 * 1024 * 1024;
    const oversizedFiles = imageFiles.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setUploadError(`Some files exceed the 5MB limit. Please compress them and try again.`);
      return;
    }

    setUploadError(null);

    // Create preview URLs for new images
    const newImages = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }));

    setUploadedImages(prev => [...prev, ...newImages]);
    
    // Reset input
    e.target.value = '';
  }, []);

  const handleRemoveImage = useCallback((index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      // Revoke object URL to prevent memory leak
      URL.revokeObjectURL(newImages[index].preview);
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  const handleUpload = useCallback(async () => {
    if (uploadedImages.length === 0) {
      setUploadError('Please upload at least one transaction screenshot');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload images to storage (we'll use a payment-screenshots bucket or chat-media)
      // For now, let's use a simple approach - store locally or use existing bucket
      const uploadedUrls: string[] = [];

      for (const imageData of uploadedImages) {
        if (imageData.url) {
          // Already uploaded
          uploadedUrls.push(imageData.url);
          continue;
        }

        const fileExt = imageData.file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `payment-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${course.id}/${user.id}/${fileName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('payment-screenshots')
          .upload(filePath, imageData.file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          throw new Error(`Failed to upload ${imageData.file.name}: ${uploadError.message}`);
        }

        const { data: urlData } = supabase.storage
          .from('payment-screenshots')
          .getPublicUrl(filePath);

        if (urlData?.publicUrl) {
          uploadedUrls.push(urlData.publicUrl);
        }
      }

      // Here you could save the payment information to a database table
      // For now, we'll just proceed with enrollment
      
      // Close dialog and proceed with enrollment
      onClose();
      onEnroll(course.id);
    } catch (err: any) {
      console.error('Upload error:', err);
      setUploadError(err.message || 'Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  }, [uploadedImages, course.id, onClose, onEnroll]);

  const handleClose = useCallback(() => {
    // Clean up object URLs
    uploadedImages.forEach(img => URL.revokeObjectURL(img.preview));
    setUploadedImages([]);
    setUploadError(null);
    onClose();
  }, [uploadedImages, onClose]);

  // Close modal on ESC key press and handle body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center text-gray-600 transition-colors"
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
            <h2 className="text-2xl font-bold text-navy-900 mb-2">Payment Instructions</h2>
            <p className="text-gray-600">Please follow the instructions below to complete your enrollment</p>
          </div>

          {/* Course Information */}
          <div className="bg-navy-50 rounded-lg p-4 space-y-3">
            <div>
              <h3 className="text-lg font-semibold text-navy-900">{course.title}</h3>
              {course.description && (
                <p className="text-sm text-gray-600 mt-1">{course.description}</p>
              )}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-navy-200">
              <div>
                <p className="text-sm text-gray-600">Creator</p>
                <p className="font-semibold text-navy-900">{course.creator}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-xl font-bold text-navy-900">{formattedPrice}</p>
              </div>
            </div>
          </div>

          {/* Account Number */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Account Number</p>
            <p className="text-lg font-mono font-semibold text-gray-900">GE00BG0000000013231</p>
          </div>

          {/* Unique Course Code */}
          <div className="bg-navy-50 rounded-lg p-4">
            <p className="text-sm text-gray-600 mb-1">Unique Course Code</p>
            <p className="text-2xl font-mono font-bold text-navy-900 tracking-wider">{courseCode}</p>
            <p className="text-xs text-gray-500 mt-1">Please include this code in your transaction reference</p>
          </div>

          {/* Payment Instructions Images */}
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">Payment Instructions:</p>
              <div className="space-y-4">
                {/* First Instruction Image - Account Number Entry */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-700 mb-3">Step 1: Enter Account Number</p>
                  <div className="relative w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/payment-instructions/payment-step-1.png"
                      alt="Payment instruction step 1 - Enter account number GE00BG0000000013231"
                      className="w-full h-auto object-contain block"
                      style={{ maxHeight: '600px' }}
                      loading="lazy"
                    />
                  </div>
                </div>

                {/* Second Instruction Image - Payment Details */}
                <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                  <p className="text-xs font-medium text-gray-700 mb-3">Step 2: Complete Payment Details</p>
                  <div className="relative w-full bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/payment-instructions/payment-step-2.png"
                      alt="Payment instruction step 2 - Complete payment with unique code in description field"
                      className="w-full h-auto object-contain block"
                      style={{ maxHeight: '600px' }}
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* File Upload Section */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Transaction Screenshot(s)
              </label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-navy-900 file:text-white hover:file:bg-navy-800 cursor-pointer"
              />
              <p className="text-xs text-gray-500 mt-1">You can upload multiple images. Maximum 5MB per image.</p>
            </div>

            {/* Uploaded Images Preview */}
            {uploadedImages.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Uploaded Images ({uploadedImages.length}):</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {uploadedImages.map((imageData, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={imageData.preview}
                        alt={`Transaction screenshot ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Remove image"
                      >
                        <svg
                          className="w-4 h-4"
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
                      <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                        {index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error Message */}
            {uploadError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {uploadError}
              </div>
            )}
          </div>

          {/* Processing Time Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <svg
                className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">Processing Time</p>
                <p className="text-sm text-yellow-700 mt-1">It needs 2 Hours to Accept your enrollment after payment verification.</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              className="px-6 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={isUploading || uploadedImages.length === 0}
              className="px-6 py-2 text-sm font-semibold text-white bg-navy-900 rounded-lg hover:bg-navy-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isUploading ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Uploading...</span>
                </>
              ) : (
                <span>Submit Payment</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

