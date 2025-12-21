'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

interface VideoUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectSubmissionData) => Promise<void>;
  channelId?: string;
}

export interface ProjectCriteria {
  text: string;
  rpm: number; // Rate Per Match
}

export interface ProjectSubmissionData {
  videoLink?: string;
  videoFile?: File;
  budget: number;
  minViews: number;
  maxViews: number;
  name: string;
  description: string;
  platforms: string[];
  criteria: ProjectCriteria[];
}

const SOCIAL_MEDIA_PLATFORMS = [
  { id: 'youtube', label: 'YouTube' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
];

export default function VideoUploadDialog({
  isOpen,
  onClose,
  onSubmit,
  channelId,
}: VideoUploadDialogProps) {
  const [videoLink, setVideoLink] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [budget, setBudget] = useState('');
  const [minViews, setMinViews] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<ProjectCriteria[]>([]);
  const [criteriaInput, setCriteriaInput] = useState('');
  const [criteriaRpmInputs, setCriteriaRpmInputs] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all fields when closing
      setVideoLink('');
      setVideoFile(null);
      setBudget('');
      setMinViews('');
      setMaxViews('');
      setName('');
      setDescription('');
      setSelectedPlatforms([]);
      setCriteria([]);
      setCriteriaInput('');
      setCriteriaRpmInputs({});
      setErrors({});
      setSubmitSuccess(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setErrors(prev => ({ ...prev, videoFile: 'Please select a video file' }));
        return;
      }
      setVideoFile(file);
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.videoFile;
        return newErrors;
      });
    }
  }, []);

  const handlePlatformToggle = useCallback((platformId: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(platformId)) {
        return prev.filter(id => id !== platformId);
      } else {
        return [...prev, platformId];
      }
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.platforms;
      return newErrors;
    });
  }, []);

  const handleAddCriteria = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && criteriaInput.trim()) {
      e.preventDefault();
      const newCriteria: ProjectCriteria = {
        text: criteriaInput.trim(),
        rpm: 0, // Default RPM, will be set by user
      };
      setCriteria(prev => [...prev, newCriteria]);
      setCriteriaInput('');
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.criteria;
        return newErrors;
      });
    }
  }, [criteriaInput]);

  const handleRemoveCriteria = useCallback((index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
    setCriteriaRpmInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
  }, []);

  const handleCriteriaRpmChange = useCallback((index: number, value: string) => {
    setCriteriaRpmInputs(prev => ({ ...prev, [index]: value }));
    const rpm = parseFloat(value) || 0;
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, rpm } : c));
  }, []);

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // Video validation: at least one must be provided
    if (!videoLink.trim() && !videoFile) {
      newErrors.video = 'Please provide either a video link or upload a video file';
    }

    // Budget validation: must be a positive number
    const budgetNum = parseFloat(budget);
    if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
      newErrors.budget = 'Budget must be a positive number';
    }

    // Minimum views validation: must be at least 5,000
    const minViewsNum = parseInt(minViews);
    if (!minViews || isNaN(minViewsNum) || minViewsNum < 5000) {
      newErrors.minViews = 'Minimum views must be at least 5,000';
    }

    // Maximum views validation: must be greater than minimum views
    const maxViewsNum = parseInt(maxViews);
    if (!maxViews || isNaN(maxViewsNum)) {
      newErrors.maxViews = 'Maximum views is required';
    } else if (maxViewsNum <= minViewsNum) {
      newErrors.maxViews = 'Maximum views must be greater than minimum views';
    }

    // Name validation: required
    if (!name.trim()) {
      newErrors.name = 'Project name is required';
    }

    // Description validation: required
    if (!description.trim()) {
      newErrors.description = 'Project description is required';
    }

    // Platforms validation: at least one must be selected
    if (selectedPlatforms.length === 0) {
      newErrors.platforms = 'Please select at least one social media platform';
    }

    // Criteria validation: each criteria must have RPM > 0
    if (criteria.length > 0) {
      const invalidCriteria = criteria.some(c => c.rpm <= 0);
      if (invalidCriteria) {
        newErrors.criteria = 'All criteria must have an RPM value greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [videoLink, videoFile, budget, minViews, maxViews, name, description, selectedPlatforms, criteria]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const submissionData: ProjectSubmissionData = {
        videoLink: videoLink.trim() || undefined,
        videoFile: videoFile || undefined,
        budget: parseFloat(budget),
        minViews: parseInt(minViews),
        maxViews: parseInt(maxViews),
        name: name.trim(),
        description: description.trim(),
        platforms: selectedPlatforms,
        criteria: criteria,
      };

      await onSubmit(submissionData);
      
      // Show success message
      setSubmitSuccess(true);
      
      // Close dialog after 1.5 seconds
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      setErrors({ submit: error.message || 'Failed to submit project. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  }, [videoLink, videoFile, budget, minViews, maxViews, name, description, selectedPlatforms, validateForm, onSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-gray-800 rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto"
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
            <h2 className="text-2xl font-bold text-white mb-2">Submit Video Project</h2>
            <p className="text-gray-400 text-sm">Fill in the details below to submit your project</p>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Project submitted successfully!</span>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
              {errors.submit}
            </div>
          )}

          {/* Video Upload Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Video Upload</h3>
            
            {/* Video Link */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Video Link
              </label>
              <input
                type="url"
                value={videoLink}
                onChange={(e) => {
                  setVideoLink(e.target.value);
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.video;
                    return newErrors;
                  });
                }}
                placeholder="https://example.com/video"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.video && (
                <p className="mt-1 text-sm text-red-400">{errors.video}</p>
              )}
            </div>

            {/* Video File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Upload Video
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {videoFile && (
                <p className="mt-2 text-sm text-gray-400">
                  Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
              {errors.videoFile && (
                <p className="mt-1 text-sm text-red-400">{errors.videoFile}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Provide either a video link or upload a video file (at least one is required)
              </p>
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Budget <span className="text-gray-500">(USD)</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => {
                setBudget(e.target.value);
                setErrors(prev => {
                  const newErrors = { ...prev };
                  delete newErrors.budget;
                  return newErrors;
                });
              }}
              placeholder="0.00"
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {errors.budget && (
              <p className="mt-1 text-sm text-red-400">{errors.budget}</p>
            )}
          </div>

          {/* View Count Range */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">View Count Range</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Minimum Views */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Minimum Views <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min="5000"
                  value={minViews}
                  onChange={(e) => {
                    setMinViews(e.target.value);
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.minViews;
                      delete newErrors.maxViews; // Clear max error when min changes
                      return newErrors;
                    });
                  }}
                  placeholder="5000"
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {errors.minViews && (
                  <p className="mt-1 text-sm text-red-400">{errors.minViews}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Minimum: 5,000 views</p>
              </div>

              {/* Maximum Views */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Maximum Views <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={minViews ? parseInt(minViews) + 1 : undefined}
                  value={maxViews}
                  onChange={(e) => {
                    setMaxViews(e.target.value);
                    setErrors(prev => {
                      const newErrors = { ...prev };
                      delete newErrors.maxViews;
                      return newErrors;
                    });
                  }}
                  placeholder="100000"
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {errors.maxViews && (
                  <p className="mt-1 text-sm text-red-400">{errors.maxViews}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Must be greater than minimum views</p>
              </div>
            </div>
          </div>

          {/* Project Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Project Details</h3>
            
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Project Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.name;
                    return newErrors;
                  });
                }}
                placeholder="Enter project name"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-400">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.description;
                    return newErrors;
                  });
                }}
                placeholder="Enter project description"
                rows={4}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-400">{errors.description}</p>
              )}
            </div>
          </div>

          {/* Social Media Platforms */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Social Media Platforms <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {SOCIAL_MEDIA_PLATFORMS.map((platform) => (
                <label
                  key={platform.id}
                  className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedPlatforms.includes(platform.id)
                      ? 'bg-indigo-600/20 border-indigo-500'
                      : 'bg-gray-700 border-gray-600 hover:border-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlatforms.includes(platform.id)}
                    onChange={() => handlePlatformToggle(platform.id)}
                    className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500 focus:ring-2"
                  />
                  <span className="text-white font-medium">{platform.label}</span>
                </label>
              ))}
            </div>
            {errors.platforms && (
              <p className="mt-2 text-sm text-red-400">{errors.platforms}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">Select at least one platform</p>
          </div>

          {/* Criteria Section */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Criteria <span className="text-gray-500">(Optional)</span>
            </label>
            
            {/* Criteria Input */}
            <div className="mb-3">
              <input
                type="text"
                value={criteriaInput}
                onChange={(e) => setCriteriaInput(e.target.value)}
                onKeyDown={handleAddCriteria}
                placeholder="Type criteria and press Enter to add"
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              <p className="mt-1 text-xs text-gray-500">Press Enter to add a criteria</p>
            </div>

            {/* Criteria List */}
            {criteria.length > 0 && (
              <div className="space-y-2">
                {criteria.map((criterion, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-700/50 rounded-lg border border-gray-600"
                  >
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{criterion.text}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">RPM:</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={criteriaRpmInputs[index] ?? criterion.rpm}
                        onChange={(e) => handleCriteriaRpmChange(index, e.target.value)}
                        placeholder="0.00"
                        className="w-24 px-2 py-1 bg-gray-600 text-white rounded border border-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveCriteria(index)}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                        title="Remove criteria"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {errors.criteria && (
              <p className="mt-2 text-sm text-red-400">{errors.criteria}</p>
            )}
            <p className="mt-2 text-xs text-gray-500">
              Add criteria that student videos should match. Set RPM (Rate Per Match) for each criteria.
            </p>
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
                <span>Submit Project</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

