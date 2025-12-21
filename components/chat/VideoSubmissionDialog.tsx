'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface VideoSubmissionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  projectId: string;
  channelId: string;
  platforms: string[]; // Array of platform names for this project
}

const PLATFORM_NAMES: Record<string, string> = {
  facebook: 'Facebook',
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  twitter: 'Twitter',
  linkedin: 'LinkedIn',
};

export default function VideoSubmissionDialog({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  channelId,
  platforms,
}: VideoSubmissionDialogProps) {
  // Store links for each platform
  const [platformLinks, setPlatformLinks] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const supabase = require('@/lib/supabase').supabase;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Initialize platform links object
      const initialLinks: Record<string, string> = {};
      platforms.forEach(platform => {
        initialLinks[platform] = '';
      });
      setPlatformLinks(initialLinks);
      setMessage('');
      setErrors({});
      setSubmitSuccess(false);
    }
  }, [isOpen, platforms]);

  // Close modal on ESC key press and handle body scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const handlePlatformLinkChange = useCallback((platform: string, value: string) => {
    setPlatformLinks(prev => ({
      ...prev,
      [platform]: value,
    }));
    // Clear error for this platform when user starts typing
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`platform_${platform}`];
      return newErrors;
    });
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Check if at least one platform has a link
    const hasAtLeastOneLink = platforms.some(platform => {
      const link = platformLinks[platform]?.trim();
      return link && link.length > 0;
    });

    if (!hasAtLeastOneLink) {
      newErrors.video = 'Please provide at least one video link for a platform';
    }

    // Validate each link that is provided
    platforms.forEach(platform => {
      const link = platformLinks[platform]?.trim();
      if (link && link.length > 0) {
        try {
          new URL(link);
        } catch {
          newErrors[`platform_${platform}`] = 'Please enter a valid URL';
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [platformLinks, platforms]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('Starting submission process:', { projectId, channelId, userId: session.user.id, platforms });

      // Collect all platform links (filter out empty ones)
      const videoLinks: Record<string, string> = {};
      platforms.forEach(platform => {
        const link = platformLinks[platform]?.trim();
        if (link && link.length > 0) {
          videoLinks[platform] = link;
        }
      });

      console.log('Platform links:', videoLinks);

      // Use the first link as the primary video URL for backward compatibility
      const primaryVideoUrl = Object.values(videoLinks)[0] || null;

      // Create a simple message content (for display purposes)
      const messageContent = message.trim() || 'Video submission';

      console.log('Creating message:', { content: messageContent, replyTo: projectId });

      // First, create the message as a reply to the project
      // Note: projectId is the message_id of the project message
      const response = await fetch(`/api/chats/${channelId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          content: messageContent,
          replyTo: projectId, // This is the message_id of the project
        }),
      });

      console.log('Message API response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        let errorMessage = 'Failed to send message';
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.details || errorMessage;
          errorDetails = errorData.details || '';
          console.error('Message creation failed:', {
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
            details: errorDetails,
            errorData,
            projectId,
            channelId,
          });
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
          errorMessage = `Server error: ${response.status} ${response.statusText}`;
        }
        const fullErrorMessage = errorDetails ? `${errorMessage}. ${errorDetails}` : errorMessage;
        throw new Error(fullErrorMessage);
      }

      const { message: createdMessage } = await response.json();
      
      console.log('Message created:', createdMessage);
      
      if (!createdMessage || !createdMessage.id) {
        throw new Error('Failed to create message - invalid response from server');
      }

      // Get the project to find project_id and course_id
      // projectId here is the message_id
      console.log('Looking up project for message_id:', projectId);
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, course_id')
        .eq('message_id', projectId)
        .maybeSingle();

      console.log('Project lookup result:', { project, error: projectError });

      if (projectError) {
        console.error('Error fetching project:', projectError);
        throw new Error(`Failed to find project: ${projectError.message}`);
      }
      
      if (!project) {
        throw new Error('Project not found. Please make sure you are replying to a valid project.');
      }

      console.log('Creating submission record:', {
        project_id: project.id,
        message_id: createdMessage.id,
        channel_id: channelId,
        course_id: project.course_id,
        user_id: session.user.id,
      });

      // Then, create the submission record in the database
      // Use the actual project.id (not message_id)
      // Store platform links as JSON
      const submissionData: any = {
        project_id: project.id, // Use the actual project.id from database
        message_id: createdMessage.id,
        channel_id: channelId,
        course_id: project.course_id,
        user_id: session.user.id,
        video_url: primaryVideoUrl || null, // Keep primary URL for backward compatibility
        message: message.trim() || null,
      };

      // Try to include platform_links if we have links to store
      // If the column doesn't exist, we'll catch the error and retry without it
      if (Object.keys(videoLinks).length > 0) {
        submissionData.platform_links = videoLinks;
      }

      console.log('Inserting submission data:', submissionData);

      let { error: submissionError } = await supabase
        .from('project_submissions')
        .insert(submissionData);

      // If error is about missing column, try again without platform_links
      if (submissionError && (submissionError.message?.includes('platform_links') || submissionError.code === '42703')) {
        console.warn('platform_links column not found, retrying without it:', submissionError.message);
        // Remove platform_links and try again
        const { platform_links, ...dataWithoutPlatformLinks } = submissionData;
        const { error: retryError } = await supabase
          .from('project_submissions')
          .insert(dataWithoutPlatformLinks);
        
        if (retryError) {
          console.error('Error creating submission (retry):', retryError);
          throw new Error(`Failed to save submission: ${retryError.message || retryError.code || 'Unknown error'}. Note: Please run migration 054_add_platform_links_to_submissions.sql to enable platform-specific links.`);
        }
        // Success without platform_links - warn user
        console.warn('Submission saved without platform_links. Please run migration 054_add_platform_links_to_submissions.sql');
      } else if (submissionError) {
        console.error('Error creating submission:', submissionError);
        throw new Error(`Failed to save submission: ${submissionError.message || submissionError.code || 'Unknown error'}`);
      }

      console.log('Submission created successfully');

      setSubmitSuccess(true);
      setTimeout(() => {
        onSubmit();
        onClose();
      }, 1500);
    } catch (error: any) {
      console.error('Submission error:', error);
      setErrors({ submit: error.message || 'Failed to submit video. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [platformLinks, message, validateForm, projectId, channelId, platforms, onSubmit, onClose, supabase]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-gray-800 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Submit Your Video</h2>
            <p className="text-gray-400 text-sm">Submit video links for this project</p>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Video submitted successfully!</span>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {errors.submit}
            </div>
          )}

          {/* Platform Video Links Section */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">
                Video Links by Platform
              </label>
              <p className="text-xs text-gray-500 mb-4">
                Provide video links for each platform. At least one platform link is required.
              </p>
              <div className="space-y-3">
                {platforms.map((platform) => (
                  <div key={platform}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {PLATFORM_NAMES[platform.toLowerCase()] || platform} Video Link
                    </label>
                    <input
                      type="url"
                      value={platformLinks[platform] || ''}
                      onChange={(e) => handlePlatformLinkChange(platform, e.target.value)}
                      placeholder={`https://${platform.toLowerCase()}.com/your-video`}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    {errors[`platform_${platform}`] && (
                      <p className="mt-1 text-sm text-red-400">{errors[`platform_${platform}`]}</p>
                    )}
                  </div>
                ))}
              </div>
              {errors.video && (
                <p className="mt-2 text-sm text-red-400">{errors.video}</p>
              )}
            </div>
          </div>

          {/* Optional Message */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add any additional notes about your submission..."
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-6 py-2 text-sm font-semibold text-gray-300 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || submitSuccess}
              className="px-6 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSubmitting ? (
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
                  <span>Submitting...</span>
                </>
              ) : submitSuccess ? (
                <span>Submitted!</span>
              ) : (
                <span>Submit Video</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

