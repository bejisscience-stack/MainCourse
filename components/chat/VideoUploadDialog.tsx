'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useI18n } from '@/contexts/I18nContext';

interface VideoUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ProjectSubmissionData) => Promise<void>;
  channelId?: string;
  initialData?: Partial<ProjectSubmissionData>;
}

export interface ProjectCriteria {
  text: string;
  rpm: number; // Rate Per Match
  platform?: string; // Platform name (optional, for platform-specific criteria)
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
  startDate: string;
  endDate: string;
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
  initialData,
}: VideoUploadDialogProps) {
  const { t } = useI18n();
  const [videoLink, setVideoLink] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [budget, setBudget] = useState('');
  const [minViews, setMinViews] = useState('5000');
  const [maxViews, setMaxViews] = useState('100000');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [criteria, setCriteria] = useState<ProjectCriteria[]>([]);
  const [criteriaInput, setCriteriaInput] = useState('');
  const [criteriaRpmInputs, setCriteriaRpmInputs] = useState<Record<number, string>>({});
  const [criteriaPlatformInputs, setCriteriaPlatformInputs] = useState<Record<number, string>>({});
  const [activeCriteriaPlatform, setActiveCriteriaPlatform] = useState<string>(''); // For adding new criteria
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = ['Video', 'Budget', 'Details', 'Criteria'];
  const isLastStep = currentStep === steps.length - 1;

  // Reset form when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all fields when closing
      setVideoLink('');
      setVideoFile(null);
      setBudget('');
      setMinViews('5000'); // Reset to default value
      setMaxViews('100000'); // Reset to default value
      setName('');
      setDescription('');
      setSelectedPlatforms([]);
      setCriteria([]);
      setCriteriaInput('');
      setCriteriaRpmInputs({});
      setCriteriaPlatformInputs({});
      setActiveCriteriaPlatform('');
      setStartDate('');
      setEndDate('');
      setErrors({});
      setSubmitSuccess(false);
      setCurrentStep(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Initialize form with initialData when dialog opens
  useEffect(() => {
    if (isOpen && initialData) {
      if (initialData.videoLink) setVideoLink(initialData.videoLink);
      if (initialData.budget !== undefined) setBudget(initialData.budget.toString());
      if (initialData.minViews !== undefined) setMinViews(initialData.minViews.toString());
      if (initialData.maxViews !== undefined) setMaxViews(initialData.maxViews.toString());
      if (initialData.name) setName(initialData.name);
      if (initialData.description) setDescription(initialData.description);
      if (initialData.platforms && initialData.platforms.length > 0) {
        setSelectedPlatforms([...initialData.platforms]);
      }
      if (initialData.criteria && initialData.criteria.length > 0) {
        setCriteria([...initialData.criteria]);
        // Initialize RPM inputs for existing criteria
        const rpmInputs: Record<number, string> = {};
        const platformInputs: Record<number, string> = {};
        initialData.criteria.forEach((c, i) => {
          rpmInputs[i] = c.rpm.toString();
          if (c.platform) platformInputs[i] = c.platform;
        });
        setCriteriaRpmInputs(rpmInputs);
        setCriteriaPlatformInputs(platformInputs);
      }
      if (initialData.startDate) setStartDate(initialData.startDate);
      if (initialData.endDate) setEndDate(initialData.endDate);
    }
  }, [isOpen, initialData]);

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
        platform: activeCriteriaPlatform || undefined, // Platform-specific if selected
      };
      setCriteria(prev => [...prev, newCriteria]);
      setCriteriaInput('');
      setActiveCriteriaPlatform('');
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.criteria;
        return newErrors;
      });
    }
  }, [criteriaInput, activeCriteriaPlatform]);

  const handleRemoveCriteria = useCallback((index: number) => {
    setCriteria(prev => prev.filter((_, i) => i !== index));
    setCriteriaRpmInputs(prev => {
      const newInputs = { ...prev };
      delete newInputs[index];
      return newInputs;
    });
    setCriteriaPlatformInputs(prev => {
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

  const handleCriteriaPlatformChange = useCallback((index: number, platform: string) => {
    setCriteriaPlatformInputs(prev => ({ ...prev, [index]: platform }));
    setCriteria(prev => prev.map((c, i) => i === index ? { ...c, platform: platform || undefined } : c));
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

    // Start date validation: required
    if (!startDate.trim()) {
      newErrors.startDate = 'Start date is required';
    }

    // End date validation: required and must be after start date
    if (!endDate.trim()) {
      newErrors.endDate = 'End date is required';
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        newErrors.endDate = 'End date must be after or equal to start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [videoLink, videoFile, budget, minViews, maxViews, name, description, selectedPlatforms, criteria, startDate, endDate]);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 0) {
      if (!videoLink.trim() && !videoFile) {
        newErrors.video = 'Please provide either a video link or upload a video file';
      }
    }

    if (step === 1) {
      const budgetNum = parseFloat(budget);
      if (!budget || isNaN(budgetNum) || budgetNum <= 0) {
        newErrors.budget = 'Budget must be a positive number';
      }

      const minViewsNum = parseInt(minViews);
      if (!minViews || isNaN(minViewsNum) || minViewsNum < 5000) {
        newErrors.minViews = 'Minimum views must be at least 5,000';
      }

      const maxViewsNum = parseInt(maxViews);
      if (!maxViews || isNaN(maxViewsNum)) {
        newErrors.maxViews = 'Maximum views is required';
      } else if (!isNaN(minViewsNum) && maxViewsNum <= minViewsNum) {
        newErrors.maxViews = 'Maximum views must be greater than minimum views';
      }
    }

    if (step === 2) {
      if (!name.trim()) {
        newErrors.name = 'Project name is required';
      }
      if (!description.trim()) {
        newErrors.description = 'Project description is required';
      }
      if (selectedPlatforms.length === 0) {
        newErrors.platforms = 'Please select at least one social media platform';
      }
      if (!startDate) {
        newErrors.startDate = 'Start date is required';
      }
      if (!endDate) {
        newErrors.endDate = 'End date is required';
      } else if (startDate && new Date(endDate) < new Date(startDate)) {
        newErrors.endDate = 'End date must be after or equal to start date';
      }
    }

    if (step === 3 && criteria.length > 0) {
      const hasInvalidRpm = criteria.some((c) => !c.rpm || c.rpm <= 0);
      if (hasInvalidRpm) {
        newErrors.criteria = 'All criteria must have an RPM value greater than 0';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [videoLink, videoFile, budget, minViews, maxViews, name, description, selectedPlatforms, criteria, startDate, endDate]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  }, [currentStep, steps.length, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentStep < steps.length - 1) {
      handleNext();
      return;
    }

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
        startDate: startDate.trim(),
        endDate: endDate.trim(),
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
  }, [currentStep, steps.length, handleNext, videoLink, videoFile, budget, minViews, maxViews, name, description, selectedPlatforms, criteria, startDate, endDate, validateForm, onSubmit, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        // Close modal when clicking outside
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="relative w-full max-w-2xl bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto chat-scrollbar flex-1 min-h-0">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-100 mb-1">{t('projects.createVideoProject')}</h2>
            <p className="text-gray-500 text-sm">{t('projects.fillDetailsBelow')}</p>
          </div>

          {/* Stepper */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span className="text-gray-300">{steps[currentStep]}</span>
            </div>
            <div className="w-full h-1 bg-navy-800/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400/80 transition-all"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Success Message */}
          {submitSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t('projects.projectSubmittedSuccess')}</span>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl">
              {errors.submit}
            </div>
          )}

          {currentStep === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">Video</h3>

              {/* Video Link */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('projects.videoLink')}
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
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                />
                {errors.video && (
                  <p className="mt-1 text-sm text-red-400">{errors.video}</p>
                )}
              </div>

              {/* Video File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('projects.uploadVideo')}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-500 file:text-white hover:file:bg-emerald-400 cursor-pointer"
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
                  {t('projects.provideVideoLinkOrFile')}
                </p>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">Budget & Views</h3>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('projects.budgetUSD')}
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
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                />
                {errors.budget && (
                  <p className="mt-1 text-sm text-red-400">{errors.budget}</p>
                )}
              </div>

              {/* View Count Range */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-200">{t('projects.viewCountRange')}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Minimum Views */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('projects.minimumViews')}
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
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.minViews && (
                      <p className="mt-1 text-sm text-red-400">{errors.minViews}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">{t('projects.minimumViewsHelper')}</p>
                  </div>

                  {/* Maximum Views */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('projects.maximumViews')}
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
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.maxViews && (
                      <p className="mt-1 text-sm text-red-400">{errors.maxViews}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">{t('projects.mustBeGreaterThanMinimum')}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">Project Details</h3>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('projects.projectName')}
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
                  placeholder={t('projects.enterProjectName')}
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-400">{errors.name}</p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('projects.description')} <span className="text-red-400">*</span>
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
                  placeholder={t('projects.enterProjectDescription')}
                  rows={4}
                  className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent resize-none"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-400">{errors.description}</p>
                )}
              </div>

              {/* Project Dates */}
              <div className="space-y-3">
                <div className="text-sm font-semibold text-gray-200">{t('projects.projectDuration')}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('projects.startDate')}
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value);
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.startDate;
                          delete newErrors.endDate; // Clear end date error when start changes
                          return newErrors;
                        });
                      }}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-sm text-red-400">{errors.startDate}</p>
                    )}
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {t('projects.endDate')}
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => {
                        setEndDate(e.target.value);
                        setErrors(prev => {
                          const newErrors = { ...prev };
                          delete newErrors.endDate;
                          return newErrors;
                        });
                      }}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-400">{errors.endDate}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">{t('projects.mustBeAfterOrEqualStartDate')}</p>
                  </div>
                </div>
              </div>

              {/* Social Media Platforms */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {t('projects.socialMediaPlatforms')}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {SOCIAL_MEDIA_PLATFORMS.map((platform) => (
                    <label
                      key={platform.id}
                      className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                        selectedPlatforms.includes(platform.id)
                          ? 'bg-emerald-500/15 border-emerald-500/40'
                          : 'bg-navy-900/60 border-navy-800/60 hover:border-navy-700/70'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatforms.includes(platform.id)}
                        onChange={() => handlePlatformToggle(platform.id)}
                        className="w-4 h-4 text-emerald-500 bg-navy-900 border-navy-700 rounded focus:ring-emerald-400 focus:ring-2"
                      />
                      <span className="text-white font-medium">{platform.label}</span>
                    </label>
                  ))}
                </div>
                {errors.platforms && (
                  <p className="mt-2 text-sm text-red-400">{errors.platforms}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">{t('projects.selectAtLeastOnePlatform')}</p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold text-gray-100">Criteria & Review</h3>

              {/* Criteria Section */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-3">
                  {t('projects.criteriaOptional')}
                </label>
                
                {/* Criteria Input */}
                <div className="mb-3 space-y-2">
                  <div className="flex gap-2">
                    <select
                      value={activeCriteriaPlatform}
                      onChange={(e) => setActiveCriteriaPlatform(e.target.value)}
                      className="px-3 py-2 bg-navy-900/60 text-white rounded-lg border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent text-sm"
                    >
                      <option value="">{t('projects.allPlatforms')}</option>
                      {selectedPlatforms.map(platform => (
                        <option key={platform} value={platform}>
                          {SOCIAL_MEDIA_PLATFORMS.find(p => p.id === platform)?.label || platform}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={criteriaInput}
                      onChange={(e) => setCriteriaInput(e.target.value)}
                      onKeyDown={handleAddCriteria}
                      placeholder={t('projects.typeCriteriaAndPressEnter')}
                      className="flex-1 px-4 py-2 bg-navy-900/60 text-white rounded-lg border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    {t('projects.selectPlatformAndPressEnter')}
                  </p>
                </div>

                {/* Criteria List */}
                {criteria.length > 0 && (
                  <div className="space-y-2">
                    {criteria.map((criterion, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-xl border border-navy-800/60"
                      >
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{criterion.text}</p>
                          {criterion.platform && (
                            <p className="text-xs text-emerald-300 mt-1">
                              Platform: {SOCIAL_MEDIA_PLATFORMS.find(p => p.id === criterion.platform)?.label || criterion.platform}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={criteriaPlatformInputs[index] ?? criterion.platform ?? ''}
                            onChange={(e) => handleCriteriaPlatformChange(index, e.target.value)}
                            className="px-2 py-1 bg-navy-800 text-white rounded border border-navy-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent text-xs"
                          >
                            <option value="">{t('projects.allPlatforms')}</option>
                            {selectedPlatforms.map(platform => (
                              <option key={platform} value={platform}>
                                {SOCIAL_MEDIA_PLATFORMS.find(p => p.id === platform)?.label || platform}
                              </option>
                            ))}
                          </select>
                          <label className="text-xs text-gray-400">RPM:</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={criteriaRpmInputs[index] ?? criterion.rpm}
                            onChange={(e) => handleCriteriaRpmChange(index, e.target.value)}
                            placeholder="0.00"
                            className="w-24 px-2 py-1 bg-navy-800 text-white rounded border border-navy-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveCriteria(index)}
                            className="text-red-300 hover:text-red-200 transition-colors p-1"
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
                  {t('projects.addCriteriaDescription')}
                </p>
              </div>

              {/* Review Summary */}
              <div className="rounded-xl border border-navy-800/60 bg-navy-900/50 p-4 text-sm text-gray-300">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><span className="text-gray-500">Video:</span> {videoLink ? 'Link provided' : videoFile?.name || 'Not selected'}</div>
                  <div><span className="text-gray-500">Budget:</span> {budget ? `$${budget}` : '-'}</div>
                  <div><span className="text-gray-500">Views:</span> {minViews && maxViews ? `${minViews} - ${maxViews}` : '-'}</div>
                  <div><span className="text-gray-500">Dates:</span> {startDate && endDate ? `${startDate} → ${endDate}` : '-'}</div>
                  <div className="sm:col-span-2"><span className="text-gray-500">Platforms:</span> {selectedPlatforms.length ? selectedPlatforms.join(', ') : '-'}</div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-navy-800/60">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0 || isSubmitting}
              className="px-4 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting || submitSuccess}
                className="px-4 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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
                    <span>{t('projects.submitting')}</span>
                  </>
                ) : submitSuccess ? (
                  <span>{t('projects.submitted')}</span>
                ) : (
                  <span>{isLastStep ? (t('projects.submitProject') || 'Submit project') : 'Next'}</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

