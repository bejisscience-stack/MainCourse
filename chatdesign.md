# Chat UI Design Changes

This document includes every code change made in this chat, with the purpose of each change.
Each section includes the full updated code blocks for that change.

<!-- FILES -->
## `components/chat/LecturesChannel.tsx`
Purpose: Revamp lectures view (header, empty state, responsive grid) and align video modals with new surfaces.

```tsx
if (loading) {
  return (
    <div className="flex-1 flex items-center justify-center bg-navy-950/40">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/20"></div>
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-emerald-400 animate-spin"></div>
        </div>
        <p className="text-gray-400 font-medium">{t('common.loading')}</p>
      </div>
    </div>
  );
}

return (
  <div className="flex-1 flex flex-col bg-navy-950/30 min-h-0">
    <div className="px-6 py-4 border-b border-navy-800/60 bg-navy-950/70 backdrop-blur-md">
      {/* header */}
    </div>
    <div className="flex-1 overflow-y-auto p-6 chat-scrollbar">
      {videos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center py-16">
          {/* empty state */}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {videos.map((video, index) => (
            <VideoCard key={video.id} video={video} index={index} /* ... */ />
          ))}
        </div>
      )}
    </div>
  </div>
);
```

```tsx
<div className={`group relative flex flex-col sm:flex-row gap-4 p-4 rounded-2xl transition-all duration-300 ${
  unlocked
    ? 'bg-navy-900/60 hover:bg-navy-900/80 cursor-pointer border border-navy-800/60 hover:border-emerald-400/40 hover:shadow-soft-lg'
    : 'bg-navy-900/30 border border-navy-800/50 opacity-60'
}`}>
  {/* thumbnail + content */}
</div>
```

```tsx
<div className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
  <div className="bg-navy-950/90 rounded-2xl shadow-soft-xl w-full max-w-xl max-h-[90vh] border border-navy-800/60 overflow-hidden flex flex-col">
    {/* upload modal */}
  </div>
</div>
```

<!-- FILES -->
## `components/chat/ProjectCard.tsx`
Purpose: Improve project card hierarchy, grouping, and expanded content styling with the new chat theme.

```tsx
<div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 w-full max-w-4xl ${
  isProjectExpired
    ? 'bg-navy-900/50 border-navy-800/60 opacity-70'
    : 'bg-gradient-to-br from-navy-900/80 via-navy-900/90 to-navy-950/90 border-navy-800/60 hover:border-emerald-500/30 hover:shadow-soft-lg'
}`}>
  {/* Gradient accent line */}
  <div className={`absolute top-0 left-0 right-0 h-1 ${
    isProjectExpired ? 'bg-navy-700' : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500'
  }`} />
  {/* ...card body... */}
</div>
```

```tsx
<div className={`border-t border-navy-800/60 bg-navy-900/50 overflow-hidden transition-all duration-300 ease-in-out ${
  isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
}`}>
  <div className="p-3 sm:p-4 md:p-5 space-y-3 sm:space-y-4 md:space-y-5 max-h-[50vh] sm:max-h-[60vh] overflow-y-auto chat-scrollbar">
    {/* Reference Video */}
    {project.videoLink && (
      <div className="flex items-center gap-3 p-3 bg-navy-900/50 rounded-lg border border-navy-800/60">
        {/* ... */}
      </div>
    )}

    {/* Criteria Section */}
    {projectCriteria.length > 0 && (
      <div>
        <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          {/* ... */}
        </h4>
        <div className="space-y-2">
          {projectCriteria.map((criterion) => (
            <div key={criterion.id} className="flex items-center justify-between p-3 bg-navy-900/50 rounded-lg border border-navy-800/60">
              {/* ... */}
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
</div>
```

<!-- FILES -->
## `components/chat/MemberSidebar.tsx`
Purpose: Provide a complete members list UI (online/offline sections) with consistent theming.

```tsx
const statusClasses: Record<Member['status'], string> = {
  online: 'bg-emerald-400',
  away: 'bg-amber-400',
  busy: 'bg-red-400',
  offline: 'bg-gray-500',
};

const renderMember = (member: Member, isMuted: boolean) => (
  <div
    key={member.id}
    className={`flex items-center gap-2.5 px-2 py-2 rounded-lg border border-transparent transition-all ${
      isMuted
        ? 'opacity-70 hover:opacity-100 hover:bg-navy-800/30'
        : 'hover:bg-navy-800/40'
    }`}
    title={member.username}
  >
    <div className="relative w-8 h-8 rounded-full bg-navy-900/70 border border-navy-800/60 flex items-center justify-center text-[11px] font-semibold text-emerald-200 overflow-hidden">
      {member.avatarUrl ? (
        <img
          src={member.avatarUrl}
          alt={member.username}
          className="w-full h-full object-cover"
        />
      ) : (
        member.username.charAt(0).toUpperCase()
      )}
      <span
        className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-navy-950 ${statusClasses[member.status]}`}
      />
    </div>
    <div className="min-w-0 flex-1">
      <div className={`text-sm truncate ${isMuted ? 'text-gray-400' : 'text-gray-200'}`}>
        {member.username}
      </div>
      {member.role && (
        <div
          className="text-[11px] truncate"
          style={{ color: member.roleColor || 'rgba(var(--muted), 0.85)' }}
        >
          {member.role}
        </div>
      )}
    </div>
  </div>
);

return (
  <div className="w-full h-full bg-navy-950/70 flex flex-col overflow-hidden">
    <div className="h-11 px-3 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        Members
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-gray-500">{members.length}</span>
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
            title="Collapse members"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        )}
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-2 py-3 chat-scrollbar">
      {members.length === 0 && (
        <div className="px-2 py-6 text-center text-sm text-gray-500">
          No members to display.
        </div>
      )}

      {onlineMembers.length > 0 && (
        <div className="mb-4">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-gray-500">
            Online ({onlineMembers.length})
          </div>
          <div className="space-y-1">
            {onlineMembers.map((member) => renderMember(member, false))}
          </div>
        </div>
      )}

      {offlineMembers.length > 0 && (
        <div>
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-gray-500">
            Offline ({offlineMembers.length})
          </div>
          <div className="space-y-1">
            {offlineMembers.map((member) => renderMember(member, true))}
          </div>
        </div>
      )}
    </div>
  </div>
);
```

<!-- FILES -->
## `app/chat/page.tsx`, `app/lecturer/chat/page.tsx`, `app/courses/[courseId]/chat/page.tsx`
Purpose: Remove member fetching/props now that the members panel is removed.

```tsx
<LayoutContainer
  servers={servers}
  currentUserId={user.id}
  isLecturer={false}
  enrolledCourseIds={enrolledCourseIds}
  onSendMessage={handleSendMessage}
  onReaction={handleReaction}
/>
```

```tsx
<LayoutContainer
  servers={servers}
  currentUserId={user.id}
  isLecturer={true}
  onAddCourse={handleAddCourse}
  onSendMessage={handleSendMessage}
  onReaction={handleReaction}
  onChannelCreate={handleChannelCreate}
  onChannelUpdate={handleChannelUpdate}
  onChannelDelete={handleChannelDelete}
/>
```

```tsx
<LayoutContainer
  servers={servers}
  currentUserId={user.id}
  isLecturer={false}
  enrolledCourseIds={enrolledCourseIds}
  onSendMessage={handleSendMessage}
  onReaction={handleReaction}
  showDMButton={false}
  isEnrollmentExpired={showExpirationOverlay}
  enrollmentInfo={enrollmentInfo}
  onReEnrollRequest={mutateEnrollments}
/>
```

<!-- FILES -->
## `components/chat/SubmissionReviewDialog.tsx`
Purpose: Align review modal styling with the updated theme and improve clarity for multi-platform reviews.

```tsx
<div 
  className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }}
>
  <div 
    className="relative w-full max-w-3xl bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl max-h-[90vh] overflow-hidden flex flex-col"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={onClose}
      className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
      aria-label="Close dialog"
    >
      {/* icon */}
    </button>

    <div className="p-6 space-y-6 overflow-y-auto chat-scrollbar flex-1 min-h-0">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {hasMultiplePlatforms && (
        <div className="border-b border-navy-800/60">
          <div className="flex gap-2">
            {platforms.map((platform) => (
              <button
                key={platform}
                onClick={() => setSelectedPlatform(platform)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedPlatform === platform
                    ? 'text-white border-b-2 border-emerald-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {PLATFORM_NAMES[platform.toLowerCase()] || platform}
              </button>
            ))}
          </div>
        </div>
      )}

      {hasMultiplePlatforms && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
          <p className="text-sm text-emerald-200">
            Reviewing: <span className="font-semibold">{PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Link: <a href={platformLinks[selectedPlatform]} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">
              {platformLinks[selectedPlatform]}
            </a>
          </p>
        </div>
      )}

      <label className="block text-sm font-medium text-gray-300 mb-3">
        Select Matching Criteria {hasMultiplePlatforms && `for ${PLATFORM_NAMES[selectedPlatform.toLowerCase()] || selectedPlatform}`}
      </label>
      {/* criteria cards updated to emerald theme */}

      <textarea
        value={currentComment}
        onChange={(e) => {
          setComments(prev => ({ ...prev, [selectedPlatform]: e.target.value }));
          setSaveSuccess(prev => ({ ...prev, [selectedPlatform]: false }));
        }}
        placeholder="Add your feedback or comments about this submission..."
        rows={4}
        className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent resize-none"
      />

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-navy-800/60">
        <button
          type="button"
          onClick={onClose}
          disabled={currentIsSaving}
          className="px-6 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Close
        </button>
        <button
          type="button"
          onClick={async () => {
            await saveReviewForPlatform(selectedPlatform);
          }}
          disabled={currentIsSaving || currentSelectedCriteria.length === 0}
          className="px-6 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          Save Review
        </button>
      </div>
    </div>
  </div>
</div>
```

<!-- FILES -->
## `components/chat/VideoSubmissionDialog.tsx`
Purpose: Align submission dialog styling with the updated modal surface and ensure scroll safety.

```tsx
<div 
  className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }}
>
  <div 
    className="relative w-full max-w-lg bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl max-h-[90vh] overflow-hidden flex flex-col"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={onClose}
      className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
      aria-label={t('videoSubmission.closeDialog')}
    >
      {/* icon */}
    </button>

    <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto chat-scrollbar flex-1 min-h-0">
      {/* Success / Error styling */}
      {submitSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 px-4 py-3 rounded-xl">
          {/* ... */}
        </div>
      )}
      {errors.submit && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-xl">
          {errors.submit}
        </div>
      )}

      {/* Inputs */}
      <input
        type="url"
        value={platformLinks[platform] || ''}
        onChange={(e) => handlePlatformLinkChange(platform, e.target.value)}
        placeholder={`https://${platform.toLowerCase()}.com/your-video`}
        className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={t('videoSubmission.addNotes')}
        rows={3}
        className="w-full px-4 py-2.5 bg-navy-900/60 text-white rounded-xl border border-navy-800/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-transparent resize-none"
      />

      <div className="flex items-center justify-end space-x-3 pt-4 border-t border-navy-800/60">
        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-6 py-2 text-sm font-semibold text-gray-300 bg-navy-900/60 border border-navy-800/60 rounded-lg hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.cancel')}
        </button>
        <button
          type="submit"
          disabled={isSubmitting || submitSuccess}
          className="px-6 py-2 text-sm font-semibold text-white bg-emerald-500/90 rounded-lg hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {t('projects.submitVideo')}
        </button>
      </div>
    </form>
  </div>
</div>
```

<!-- FILES -->
## `components/chat/VideoUploadDialog.tsx`
Purpose: Convert create-project dialog into a multi-step wizard with per-step validation and a review step; update modal styling and scroll behavior.

```tsx
const [currentStep, setCurrentStep] = useState(0);
const steps = ['Video', 'Budget', 'Details', 'Criteria'];
const isLastStep = currentStep === steps.length - 1;
```

```tsx
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
```

```tsx
if (currentStep < steps.length - 1) {
  handleNext();
  return;
}
```

```tsx
<div 
  className="fixed inset-0 bg-navy-950/80 z-50 flex items-center justify-center p-4"
  onClick={(e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }}
>
  <div 
    className="relative w-full max-w-2xl bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl max-h-[90vh] overflow-hidden flex flex-col"
    onClick={(e) => e.stopPropagation()}
  >
    <button
      onClick={onClose}
      className="absolute top-4 right-4 z-10 w-8 h-8 bg-navy-800/70 hover:bg-navy-700 rounded-full flex items-center justify-center text-gray-300 transition-colors"
      aria-label="Close dialog"
    >
      {/* icon */}
    </button>

    <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto chat-scrollbar flex-1 min-h-0">
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

      {/* Conditional step sections */}
      {currentStep === 0 && (/* Video step UI */)}
      {currentStep === 1 && (/* Budget & Views step UI */)}
      {currentStep === 2 && (/* Details step UI */)}
      {currentStep === 3 && (/* Criteria + Review step UI */)}

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
            {isLastStep ? (t('projects.submitProject') || 'Submit project') : 'Next'}
          </button>
        </div>
      </div>
    </form>
  </div>
</div>
```

<!-- FILES -->
## `components/chat/ChatArea.tsx`
Purpose: Normalize the floating “scroll to bottom” action so it avoids overlap and stays consistent across breakpoints.

```tsx
{userScrolledUpRef.current && messages.length > 10 && (
  <button
    onClick={handleScrollToBottom}
    className="absolute bottom-28 sm:bottom-24 right-4 sm:right-6 h-10 w-10 flex items-center justify-center bg-navy-900/85 border border-navy-800/70 text-gray-100 rounded-full shadow-soft hover:shadow-soft-lg hover:bg-navy-800/80 transition-all transform hover:scale-105 z-20 will-change-transform"
    style={{ transformOrigin: 'center', backfaceVisibility: 'hidden' }}
    title="Scroll to bottom"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  </button>
)}
```

<!-- FILES -->
## `components/chat/MessageInput.tsx`
Purpose: Make the emoji trigger visually consistent with the input surface and improve contrast/size for tap targets.

```tsx
<button
  type="button"
  className="flex-shrink-0 h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-300 rounded-lg border border-transparent hover:border-navy-700/70 hover:bg-navy-800/70 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
  title="Add emoji"
  disabled={disabled || isMuted}
>
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
</button>
```

<!-- FILES -->
## `components/chat/ChatNavigation.tsx`
Purpose: Improve profile button spacing/truncation and hover affordance for better readability on smaller widths.

```tsx
<button
  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-navy-800/60 hover:bg-navy-800/60 transition-colors"
>
  <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold shadow-soft">
    {userName.charAt(0).toUpperCase()}
  </div>
  <div className="hidden md:block text-left max-w-[140px]">
    <div className="text-gray-100 text-sm font-medium truncate">{userName}</div>
    <div className="text-emerald-300 text-xs flex items-center gap-1">
      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
      {t('chat.online')}
    </div>
  </div>
  <svg
    className={`w-4 h-4 text-gray-400 transition-transform ${
      profileMenuOpen ? 'rotate-180' : ''
    }`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
</button>
```

<!-- FILES -->
## `components/chat/Message.tsx`
Purpose: Keep emoji reaction picker fully visible by dynamically positioning it (top/bottom/left/right) and rendering it in a fixed portal to avoid clipping.

```tsx
const [showMenu, setShowMenu] = useState(false);
const [showReactionPicker, setShowReactionPicker] = useState(false);
const [showUserMenu, setShowUserMenu] = useState(false);
const messageRef = useRef<HTMLDivElement>(null);
const userMenuRef = useRef<HTMLDivElement>(null);
const reactionButtonRef = useRef<HTMLButtonElement>(null);
const reactionPickerRef = useRef<HTMLDivElement>(null);
const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
const [reactionPickerPosition, setReactionPickerPosition] = useState<{
  top: number;
  left: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
} | null>(null);
const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
```

```tsx
useEffect(() => {
  if (typeof document !== 'undefined') {
    setPortalRoot(document.body);
  }
}, []);

useEffect(() => {
  if (!showMenu) {
    setShowReactionPicker(false);
    setReactionPickerPosition(null);
  }
}, [showMenu]);

const updateReactionPickerPosition = useCallback(() => {
  if (!reactionButtonRef.current || !reactionPickerRef.current) return;

  const buttonRect = reactionButtonRef.current.getBoundingClientRect();
  const pickerRect = reactionPickerRef.current.getBoundingClientRect();
  const spacing = 10;
  const padding = 8;

  const topSpace = buttonRect.top;
  const bottomSpace = window.innerHeight - buttonRect.bottom;
  const leftSpace = buttonRect.left;
  const rightSpace = window.innerWidth - buttonRect.right;

  const fitsTop = topSpace >= pickerRect.height + spacing;
  const fitsBottom = bottomSpace >= pickerRect.height + spacing;
  const fitsLeft = leftSpace >= pickerRect.width + spacing;
  const fitsRight = rightSpace >= pickerRect.width + spacing;

  let placement: 'top' | 'bottom' | 'left' | 'right' = 'top';
  if (fitsTop) {
    placement = 'top';
  } else if (fitsBottom) {
    placement = 'bottom';
  } else if (fitsRight) {
    placement = 'right';
  } else if (fitsLeft) {
    placement = 'left';
  } else {
    const maxSpace = Math.max(topSpace, bottomSpace, leftSpace, rightSpace);
    if (maxSpace === topSpace) placement = 'top';
    else if (maxSpace === bottomSpace) placement = 'bottom';
    else if (maxSpace === rightSpace) placement = 'right';
    else placement = 'left';
  }

  let top = buttonRect.top + buttonRect.height / 2 - pickerRect.height / 2;
  let left = buttonRect.left + buttonRect.width / 2 - pickerRect.width / 2;

  if (placement === 'top') {
    top = buttonRect.top - pickerRect.height - spacing;
  } else if (placement === 'bottom') {
    top = buttonRect.bottom + spacing;
  } else if (placement === 'left') {
    left = buttonRect.left - pickerRect.width - spacing;
  } else if (placement === 'right') {
    left = buttonRect.right + spacing;
  }

  top = Math.min(Math.max(padding, top), window.innerHeight - pickerRect.height - padding);
  left = Math.min(Math.max(padding, left), window.innerWidth - pickerRect.width - padding);

  setReactionPickerPosition({ top, left, placement });
}, []);

useEffect(() => {
  if (!showReactionPicker) {
    setReactionPickerPosition(null);
    return;
  }

  const raf = requestAnimationFrame(updateReactionPickerPosition);

  const handleResize = () => updateReactionPickerPosition();
  const handleScroll = () => updateReactionPickerPosition();
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;
    if (
      reactionPickerRef.current?.contains(target) ||
      reactionButtonRef.current?.contains(target)
    ) {
      return;
    }
    setShowReactionPicker(false);
  };

  window.addEventListener('resize', handleResize);
  document.addEventListener('scroll', handleScroll, true);
  document.addEventListener('mousedown', handleClickOutside);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('scroll', handleScroll, true);
    document.removeEventListener('mousedown', handleClickOutside);
  };
}, [showReactionPicker, updateReactionPickerPosition]);

const handleMouseLeave = useCallback(() => {
  hoverTimeoutRef.current = setTimeout(() => {
    if (showReactionPicker) return;
    setShowMenu(false);
    setShowReactionPicker(false);
  }, 150);
}, [showReactionPicker]);

const reactionArrowPlacement = reactionPickerPosition?.placement ?? 'top';
```

```tsx
{showReactionPicker && portalRoot &&
  createPortal(
    <div
      ref={reactionPickerRef}
      className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
      style={{
        top: reactionPickerPosition?.top ?? 0,
        left: reactionPickerPosition?.left ?? 0,
        visibility: reactionPickerPosition ? 'visible' : 'hidden',
      }}
    >
      <div className="bg-navy-950/95 backdrop-blur-2xl border border-navy-700/70 rounded-xl shadow-2xl shadow-black/50 p-3">
        <div
          className={`absolute w-3 h-3 bg-navy-950/95 border border-navy-700/70 rotate-45 ${
            reactionArrowPlacement === 'bottom'
              ? 'top-[-6px] left-1/2 -translate-x-1/2'
              : reactionArrowPlacement === 'left'
                ? 'right-[-6px] top-1/2 -translate-y-1/2'
                : reactionArrowPlacement === 'right'
                  ? 'left-[-6px] top-1/2 -translate-y-1/2'
                  : 'bottom-[-6px] left-1/2 -translate-x-1/2'
          }`}
        />

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 min-w-[180px] sm:min-w-[260px]">
          {COMMON_REACTIONS.map((emoji, index) => (
            <button
              key={emoji}
              onClick={() => {
                onReaction?.(message.id, emoji);
                setShowReactionPicker(false);
                setShowMenu(false);
              }}
              className="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-xl text-2xl leading-none transition-all duration-200 hover:bg-white/10 hover:scale-110 active:scale-100"
              style={{ animationDelay: `${index * 30}ms` }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>,
    portalRoot
  )
}
```

<!-- FILES -->
## `components/chat/LayoutContainer.tsx`
Purpose: Remove members panel from the layout, reclaim sidebar space for channels, and refine footer control styling.

```tsx
return (
  <div className="flex w-full h-full bg-navy-950/40 backdrop-blur-sm text-white overflow-hidden">
    {/* Server sidebar */}
    <ServerSidebar
      servers={servers}
      activeServerId={activeServerId}
      onServerSelect={handleServerSelect}
      onAddCourse={onAddCourse}
      isLecturer={isLecturer}
      enrolledCourseIds={enrolledCourseIds}
      showDMButton={showDMButton}
    />

    {/* Channels Sidebar Container */}
    {!isDMMode && activeServer && (
      <div className="w-60 bg-navy-950/70 border-r border-navy-800/60 flex flex-col">
        {/* Channels Section */}
        <div className={`flex flex-col transition-all ${channelsCollapsed ? 'flex-shrink-0' : 'flex-1 min-h-0'}`}>
          {/* Channels Header with Collapse Button - shown when collapsed */}
          {channelsCollapsed ? (
            <div className="h-12 px-4 border-b border-navy-800/60 flex items-center justify-between bg-navy-950/60 flex-shrink-0">
              <span className="text-gray-400 text-xs font-semibold tracking-wider">CHANNELS</span>
              <button
                onClick={() => setChannelsCollapsed(!channelsCollapsed)}
                className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
                title="Expand channels"
              >
                <svg
                  className="w-4 h-4 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden min-h-0">
              <ChannelSidebar
                server={activeServer}
                activeChannelId={activeChannelId}
                onChannelSelect={handleChannelSelect}
                onChannelCreate={onChannelCreate}
                onChannelUpdate={onChannelUpdate}
                onChannelDelete={onChannelDelete}
                isLecturer={isLecturer}
                onCollapse={() => setChannelsCollapsed(true)}
              />
            </div>
          )}
        </div>

        {/* User profile footer - at the very bottom */}
        <div className="h-14 bg-navy-950/80 px-2 py-2 flex items-center gap-2 border-t border-navy-800/60 flex-shrink-0 mt-auto">
          <div className="w-8 h-8 rounded-full bg-emerald-500/90 flex items-center justify-center text-white text-xs font-semibold shadow-soft">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-gray-100 text-sm font-medium truncate">{userName || 'User'}</div>
            <div className="text-emerald-300 text-xs flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              {t('chat.online')}
            </div>
          </div>
          <div className="flex gap-0.5">
            <button className="h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-200 rounded-lg border border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button className="h-9 w-9 inline-flex items-center justify-center text-gray-400 hover:text-emerald-200 rounded-lg border border-navy-800/60 bg-navy-900/50 hover:bg-navy-800/70 hover:border-emerald-400/40 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756-2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Chat area */}
    <ChatErrorBoundary>
      <ChatArea
        channel={activeChannel}
        currentUserId={currentUserId}
        isLecturer={isLecturer}
        onSendMessage={onSendMessage || (() => {})}
        onReaction={onReaction}
        isEnrollmentExpired={isEnrollmentExpired}
        enrollmentInfo={enrollmentInfo}
        onReEnrollRequest={onReEnrollRequest}
      />
    </ChatErrorBoundary>
  </div>
);
```

<!-- FILES -->
## `components/chat/ChannelManagement.tsx`
Purpose: Make channel management usable for long lists with search, sticky header, and reliable close behavior (ESC + close button).

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [onClose]);

const filteredChannels = useMemo(() => {
  const query = searchQuery.trim().toLowerCase();
  if (!query) return channels;
  return channels.filter((channel) => {
    const nameMatch = channel.name.toLowerCase().includes(query);
    const descMatch = channel.description?.toLowerCase().includes(query);
    const categoryMatch = channel.categoryName?.toLowerCase().includes(query);
    return nameMatch || descMatch || categoryMatch;
  });
}, [channels, searchQuery]);
```

```tsx
return (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div className="p-5 border-b border-navy-800/60 bg-navy-950/60 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{t('channels.manageChannels')}</h3>
            <p className="text-xs text-gray-400">{filteredChannels.length} {filteredChannels.length === 1 ? 'channel' : 'channels'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingChannel(null);
              setFormData({ name: '', type: 'text', description: '', categoryName: 'COURSE CHANNELS' });
              setShowCreateModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-indigo-500/25 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('channels.addChannel')}
          </button>
          <button
            onClick={onClose}
            className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-navy-800/60 bg-navy-900/70 text-gray-300 hover:text-white hover:bg-navy-800/80 transition-colors"
            title={t('common.close')}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    {/* Search */}
    <div className="px-5 py-3 border-b border-navy-800/60 bg-navy-950/50">
      <div className="relative">
        <svg className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.5 5.5a7.5 7.5 0 0011.15 11.15z" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('channels.searchPlaceholder') || 'Search channels'}
          className="w-full pl-9 pr-3 py-2.5 bg-navy-900/70 border border-navy-800/60 text-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400/30 focus:border-emerald-400/30 transition-all placeholder-gray-500"
        />
      </div>
    </div>

    {/* Channel List */}
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 chat-scrollbar">
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm flex items-start gap-3">
          <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {filteredChannels.map((channel) => (
        <div
          key={channel.id}
          className="group relative bg-gradient-to-br from-navy-800/90 to-navy-900/70 rounded-2xl p-4 border border-navy-700/40 hover:border-navy-500/50 transition-all duration-300 hover:shadow-xl hover:shadow-navy-900/50"
        >
          <div className="flex items-start gap-4">
            {/* Channel Icon */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-lg ${
              channel.type === 'lectures'
                ? 'bg-gradient-to-br from-rose-500/30 to-orange-500/20 border border-rose-500/40 shadow-rose-500/10'
                : channel.name.toLowerCase() === 'projects'
                ? 'bg-gradient-to-br from-amber-500/30 to-yellow-500/20 border border-amber-500/40 shadow-amber-500/10'
                : channel.type === 'voice'
                ? 'bg-gradient-to-br from-emerald-500/30 to-teal-500/20 border border-emerald-500/40 shadow-emerald-500/10'
                : 'bg-gradient-to-br from-blue-500/30 to-indigo-500/20 border border-blue-500/40 shadow-blue-500/10'
            }`}>
              {channel.type === 'lectures'
                ? '📹'
                : channel.name.toLowerCase() === 'projects'
                ? '📁'
                : channel.type === 'voice'
                ? '🔊'
                : '#'}
            </div>

            {/* Channel Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-white font-bold text-base">{channel.name}</h4>
                {isRequiredChannel(channel) && (
                  <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-500/15 rounded-md border border-emerald-500/30">
                    {t('channels.required')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium ${
                  channel.type === 'lectures'
                    ? 'bg-rose-500/10 text-rose-400'
                    : channel.type === 'voice'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'bg-blue-500/10 text-blue-400'
                }`}>
                  {channel.type === 'lectures' && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                  {channel.type === 'voice' && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                  {channel.type === 'text' && (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  )}
                  {channel.type}
                </span>
              </div>
              {channel.description && (
                <p className="text-gray-500 text-xs mt-2 line-clamp-2">{channel.description}</p>
              )}
            </div>

            {/* Action Buttons */}
            {!isRequiredChannel(channel) && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0">
                <button
                  onClick={() => handleEdit(channel)}
                  className="p-2.5 text-gray-400 hover:text-white bg-navy-700/0 hover:bg-navy-700/80 rounded-xl transition-all duration-200 hover:scale-105"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDelete(channel.id)}
                  className="p-2.5 text-gray-400 hover:text-red-400 bg-navy-700/0 hover:bg-red-500/10 rounded-xl transition-all duration-200 hover:scale-105"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      {filteredChannels.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-2xl bg-navy-800/50 border border-navy-700/50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400 text-sm">{searchQuery.trim() ? 'No channels match your search.' : t('channels.noChannelsYet')}</p>
        </div>
      )}
    </div>
  </div>
);
```

<!-- FILES -->
## `components/chat/ChannelSidebar.tsx`
Purpose: Improve channel list readability, state styling, and provide a full-screen channel management overlay that is always visible and closable.

```tsx
return (
  <div className="w-full h-full bg-navy-950/70 border-r border-navy-800/60 flex flex-col relative overflow-hidden">
    {/* Server header */}
    <div className="h-12 px-4 border-b border-navy-800/60 bg-navy-950/60 flex items-center justify-between shadow-soft flex-shrink-0">
      <h2 className="text-gray-100 font-semibold text-sm truncate flex-1">{server.name}</h2>
      <div className="flex items-center gap-1">
        {totalUnread > 0 && (
          <span className="bg-emerald-500/90 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center shadow-soft">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        {onCollapse && (
          <button
            onClick={onCollapse}
            className="text-gray-400 hover:text-emerald-300 transition-colors p-1 rounded-md hover:bg-navy-800/60"
            title="Collapse channels"
          >
            <svg
              className="w-4 h-4 transition-transform rotate-180"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        )}
        {isLecturer && (
          <button
            onClick={() => setShowChannelManagement(true)}
            className="text-gray-400 hover:text-emerald-300 p-1 rounded-md hover:bg-navy-800/60 transition-colors"
            title="Manage Channels"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756-2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
    </div>

    {/* Channels list */}
    <div className="flex-1 overflow-y-auto px-2.5 py-3 chat-scrollbar">
      {server.channels.map((category: ChannelCategory) => {
        const isCollapsed = collapsedCategories.has(category.id);
        const categoryChannels = sortChannels(category.channels);
        const categoryUnread = categoryChannels.reduce((sum, ch) => sum + getUnreadCount(ch.id), 0);

        return (
          <div key={category.id} className="mb-3">
            {/* Category header */}
            <div className="w-full flex items-center justify-between px-1 py-1.5 text-gray-500 hover:text-emerald-300 text-[11px] font-semibold uppercase tracking-wider group cursor-pointer">
              <button
                onClick={() => toggleCategory(category.id)}
                className="flex-1 flex items-center gap-1 text-left"
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-90'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="truncate">{category.name}</span>
                {isCollapsed && categoryUnread > 0 && (
                  <span className="bg-emerald-500/90 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center ml-auto shadow-soft">
                    {categoryUnread}
                  </span>
                )}
              </button>
              {isLecturer && onChannelCreate && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowChannelManagement(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-emerald-300 p-0.5 rounded-md hover:bg-navy-800/60"
                  title="Create Channel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              )}
            </div>

            {/* Channels in category */}
            {!isCollapsed && (
              <div className="space-y-0.5">
                {categoryChannels.map((channel) => {
                  const isActive = activeChannelId === channel.id;
                  const unreadCount = getUnreadCount(channel.id);
                  const hasUnread = unreadCount > 0;

                  return (
                    <button
                      key={channel.id}
                      onClick={() => handleChannelClick(channel.id)}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all group/channel border border-transparent ${
                        isActive
                          ? 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft'
                          : hasUnread
                          ? 'text-gray-100 font-medium hover:bg-navy-800/50 hover:border-navy-700/60'
                          : 'text-gray-400 hover:bg-navy-800/40 hover:text-gray-200 hover:border-navy-700/50'
                      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/40`}
                    >
                      <ChannelIcon type={channel.type} name={channel.name} />
                      <span className="flex-1 text-left truncate">{channel.name}</span>
                      
                      {/* Unread badge */}
                      {hasUnread && !isActive && (
                        <span className="bg-emerald-500/90 text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center animate-in fade-in duration-200 shadow-soft">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      )}
                      
                      {/* Active indicator */}
                      {isActive && (
                        <div className="w-1 h-4 bg-emerald-400 rounded-full" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>

    {/* Channel Management Modal */}
    {showChannelManagement && server && onChannelCreate && onChannelUpdate && onChannelDelete && (
      <div
        className="fixed inset-0 bg-navy-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShowChannelManagement(false)}
      >
        <div
          className="w-full max-w-3xl max-h-[90vh] bg-navy-950/90 border border-navy-800/60 rounded-2xl shadow-soft-xl overflow-hidden"
          onClick={(event) => event.stopPropagation()}
        >
          <ChannelManagement
            courseId={server.id}
            channels={allChannels}
            onChannelCreate={onChannelCreate}
            onChannelUpdate={onChannelUpdate}
            onChannelDelete={onChannelDelete}
            onClose={() => setShowChannelManagement(false)}
          />
        </div>
      </div>
    )}
  </div>
);
```

<!-- FILES -->
## `components/chat/ServerSidebar.tsx`
Purpose: Refine server sidebar visuals (surfaces, active/locked states, tooltips) and improve contrast/spacing for better navigation clarity.

```tsx
return (
  <>
    <div className="w-16 bg-navy-950/85 border-r border-navy-800/60 flex flex-col items-center py-4 gap-3 overflow-y-auto chat-scrollbar">
      {/* Home/Direct Messages button */}
      {showDMButton && (
        <>
          <button
            className={`w-12 h-12 rounded-2xl bg-emerald-500/90 hover:bg-emerald-500 transition-all duration-200 flex items-center justify-center text-white font-semibold text-sm shadow-soft ${
              activeServerId === 'home' ? 'ring-2 ring-emerald-400/50 shadow-glow' : ''
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70`}
            onClick={() => onServerSelect('home')}
            onMouseEnter={() => setHoveredServerId('home')}
            onMouseLeave={() => setHoveredServerId(null)}
          >
            <span>DM</span>
          </button>
          <div className="w-8 h-px bg-navy-800/70"></div>
        </>
      )}

      {/* Server list */}
      {servers.map((server) => {
        const isActive = activeServerId === server.id;
        const isHovered = hoveredServerId === server.id;
        const isEnrolled = enrolledCourseIds.has(server.id) || isLecturer;
        const isLocked = !isEnrolled;

        return (
          <div key={server.id} className="relative group">
            <button
              className={`w-12 h-12 rounded-xl transition-all duration-200 flex items-center justify-center text-sm font-semibold relative border ${
                isActive
                  ? 'rounded-2xl bg-emerald-500/15 text-emerald-200 border-emerald-500/40 shadow-soft-lg'
                  : isLocked
                  ? 'bg-navy-900/40 text-gray-500 border-navy-800/50'
                  : 'bg-navy-900/70 text-gray-200 border-navy-800/60 hover:bg-navy-800/80 hover:border-navy-700/70 hover:text-white'
              } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50`}
              onClick={() => handleServerClick(server.id)}
              onMouseEnter={() => setHoveredServerId(server.id)}
              onMouseLeave={() => setHoveredServerId(null)}
              disabled={isLocked && isEnrolling}
              aria-label={isLocked ? t('enrollment.courseLockedTooltip') : server.name}
              title={isLocked ? t('enrollment.courseLockedTooltip') : server.name}
            >
              {isLocked ? (
                <svg
                  className="w-6 h-6 text-gray-500"
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
              ) : (
                server.icon || server.name.charAt(0).toUpperCase()
              )}
            </button>

            {/* Tooltip for locked courses */}
            {isLocked && isHovered && (
              <div
                className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-navy-900/95 border border-navy-700/60 text-gray-200 text-sm rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl"
                role="tooltip"
              >
                <span>{t('enrollment.courseLockedTooltip')}</span>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-navy-900/95"></div>
              </div>
            )}

            {/* Tooltip for enrolled courses */}
            {!isLocked && isHovered && (
              <div
                className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-navy-900/95 border border-navy-700/60 text-gray-200 text-sm rounded-lg whitespace-nowrap z-50 pointer-events-none shadow-xl"
                role="tooltip"
              >
                {server.name}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-navy-900/95"></div>
              </div>
            )}

            {/* Active indicator */}
            {isActive && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-10 bg-emerald-400 rounded-full"></div>
            )}
          </div>
        );
      })}

      {/* Add Course button (lecturer only) */}
      {isLecturer && (
        <button
          className="w-12 h-12 rounded-xl bg-navy-900/70 border border-navy-800/60 hover:border-emerald-500/50 hover:bg-emerald-500/15 transition-all duration-200 flex items-center justify-center text-emerald-300 hover:text-emerald-200 text-2xl font-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/50"
          title={t('lecturerDashboard.createCourse')}
          onClick={() => router.push('/lecturer/dashboard?createCourse=true')}
        >
          +
        </button>
      )}
    </div>

    {/* Payment Dialog */}
    {courseForPayment && (
      <PaymentDialog
        course={courseForPayment}
        isOpen={!!courseForPayment}
        onClose={handlePaymentDialogClose}
        onEnroll={handleEnroll}
      />
    )}
  </>
);
```

<!-- FILES -->
## `app/globals.css`
Purpose: Add chat-specific utility classes for consistent surfaces, borders, muted text, rings, and custom scrollbars without affecting the rest of the app.

```css
/* Chat UI shared surfaces */
.chat-surface {
  background-color: rgba(var(--surface), 0.78);
  backdrop-filter: blur(10px);
}

.chat-surface-elevated {
  background-color: rgba(var(--surface-elevated), 0.85);
  backdrop-filter: blur(12px);
}

.chat-surface-muted {
  background-color: rgba(var(--surface), 0.55);
}

.chat-border {
  border-color: rgba(var(--border), 0.65);
}

.chat-divider {
  background-color: rgba(var(--border), 0.6);
}

.chat-text-muted {
  color: rgba(var(--muted), 0.9);
}

.chat-ring {
  box-shadow: 0 0 0 2px rgba(var(--accent-color), 0.25);
}

.chat-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: rgba(var(--muted), 0.7) transparent;
}

.chat-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.chat-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.chat-scrollbar::-webkit-scrollbar-thumb {
  background-color: rgba(var(--muted), 0.65);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: content-box;
}

.chat-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: rgba(var(--muted), 0.9);
}
```

<!-- FILES -->
